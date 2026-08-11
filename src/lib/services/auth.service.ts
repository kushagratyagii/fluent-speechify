import { accountRepository, authSessionRepository } from "@/lib/repositories/account.repository";
import { StorageKeys } from "@/lib/db/keys";
import { getStorage } from "@/lib/db/storage";
import type { Account } from "@/types";

export class AuthError extends Error {}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * One-time migration for practice data created before accounts existed
 * (un-namespaced `profiles:current`, `streaks:current`, etc). Runs exactly
 * once, on the very first account ever created on a device, so that data
 * isn't silently lost when this feature ships — and never runs again, so a
 * second account created afterwards starts genuinely empty.
 */
async function migrateLegacyDataToAccount(accountId: string): Promise<void> {
  const storage = getStorage();
  const isFirstAccountEver = (await accountRepository.list()).length === 0;
  if (!isFirstAccountEver) return;

  const legacyProfile = await storage.get(StorageKeys.legacyProfile);
  if (!legacyProfile) return; // nothing pre-existing to migrate

  const pairs: Array<[string, string]> = [
    [StorageKeys.legacyProfile, StorageKeys.profile(accountId)],
    [StorageKeys.legacyAssessment, StorageKeys.assessment(accountId)],
    [StorageKeys.legacySessions, StorageKeys.sessions(accountId)],
    [StorageKeys.legacyStreak, StorageKeys.streak(accountId)],
    [StorageKeys.legacyAchievements, StorageKeys.achievements(accountId)],
    [StorageKeys.legacyActiveSession, StorageKeys.activeSession(accountId)],
  ];
  for (const [from, to] of pairs) {
    const value = await storage.get(from);
    if (value !== null) await storage.set(to, value);
  }
  // Daily plans are dated (`daily_plans:YYYY-MM-DD`) rather than one fixed
  // key, so they're found by prefix instead of a static from/to pair.
  const legacyPlanKeys = await storage.keys("daily_plans:");
  for (const key of legacyPlanKeys) {
    const date = key.slice("daily_plans:".length);
    const value = await storage.get(key);
    if (value !== null) await storage.set(StorageKeys.dailyPlan(accountId, date), value);
  }
}

export const authService = {
  async getAccount(): Promise<Account | null> {
    const accountId = await authSessionRepository.getCurrentAccountId();
    if (!accountId) return null;
    return accountRepository.findById(accountId);
  },

  async isAuthenticated(): Promise<boolean> {
    return Boolean(await this.getAccount());
  },

  async signUp(input: { name: string; email: string; password: string }): Promise<Account> {
    const email = normalizeEmail(input.email);
    if (await accountRepository.findByEmail(email)) {
      throw new AuthError(
        "An account with that email already exists on this device. Log in instead.",
      );
    }

    const salt = randomSalt();
    const passwordHash = await hashPassword(input.password, salt);

    const account: Account = {
      id: id("acct"),
      name: input.name.trim(),
      email,
      passwordHash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
    };

    await migrateLegacyDataToAccount(account.id);
    await accountRepository.create(account);
    await authSessionRepository.start(account.id);
    return account;
  },

  async login(input: { email: string; password: string }): Promise<Account> {
    const account = await accountRepository.findByEmail(normalizeEmail(input.email));
    if (!account) {
      throw new AuthError("No account found on this device with that email — sign up first.");
    }
    const hash = await hashPassword(input.password, account.passwordSalt);
    if (hash !== account.passwordHash) {
      throw new AuthError("Incorrect password.");
    }
    await authSessionRepository.start(account.id);
    return account;
  },

  async logout(): Promise<void> {
    await authSessionRepository.end();
  },
};
