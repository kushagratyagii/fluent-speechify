import { supabase } from "@/lib/supabase";
import { StorageKeys } from "@/lib/db/keys";
import { getStorage } from "@/lib/db/storage";
import type { Account } from "@/types";


/**
 * The account "directory". Multiple accounts can live on one device/browser
 * (each person practising on a shared family computer, for instance) — this
 * repository is just the list of who exists, not who's currently signed in.
 */
export const accountRepository = {
  async list(): Promise<Account[]> {
    return (await getStorage().get<Account[]>(StorageKeys.accounts)) ?? [];
  },

  async findByEmail(email: string): Promise<Account | null> {
    const accounts = await this.list();
    return accounts.find((a) => a.email === email) ?? null;
  },

  async findById(id: string): Promise<Account | null> {
    const accounts = await this.list();
    return accounts.find((a) => a.id === id) ?? null;
  },

  async create(account: Account): Promise<Account> {
    const accounts = await this.list();
    await getStorage().set(StorageKeys.accounts, [...accounts, account]);
    return account;
  },

  /** Removes the account entry itself — the caller is responsible for wiping its data (see `clearAllData`). */
  async remove(id: string): Promise<void> {
    const accounts = await this.list();
    await getStorage().set(
      StorageKeys.accounts,
      accounts.filter((a) => a.id !== id),
    );
  },
};

/** Which account (if any) this browser is currently signed in as. */
export const authSessionRepository = {
  async getCurrentAccountId(): Promise<string | null> {
    return getStorage().get<string>(StorageKeys.authSession);
  },

  async start(accountId: string): Promise<void> {
    await getStorage().set(StorageKeys.authSession, accountId);
  },

  async end(): Promise<void> {
    await getStorage().remove(StorageKeys.authSession);
  },
};

/**
 * Per-account repositories (profile, sessions, streak, plan...) all call
 * this to resolve which account's data to read/write, so their own
 * get/save methods don't need an accountId parameter threaded through every
 * service call site. It should only ever be reached once AppShell's auth
 * gate has already confirmed someone is signed in.
 */
export async function requireCurrentAccountId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("No account is signed in.");
  }

  return user.id;
}
