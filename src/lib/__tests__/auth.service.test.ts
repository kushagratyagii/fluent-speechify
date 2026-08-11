import { beforeEach, describe, expect, it } from "vitest";
import { authService, AuthError } from "@/lib/services/auth.service";

describe("authService", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is not authenticated before any account exists", async () => {
    expect(await authService.isAuthenticated()).toBe(false);
    expect(await authService.getAccount()).toBeNull();
  });

  it("signs up, creating an account and starting a session", async () => {
    const account = await authService.signUp({
      name: "Asha Verma",
      email: "Asha@Example.com",
      password: "correct-horse-battery",
    });

    expect(account.name).toBe("Asha Verma");
    expect(account.email).toBe("asha@example.com"); // normalized to lowercase
    expect(account.passwordHash).not.toBe("correct-horse-battery"); // never stored in plain text
    expect(await authService.isAuthenticated()).toBe(true);
  });

  it("allows a second account with a different email on the same device", async () => {
    await authService.signUp({ name: "Asha", email: "asha@example.com", password: "password123" });
    await authService.logout();
    const second = await authService.signUp({
      name: "Someone Else",
      email: "other@example.com",
      password: "password123",
    });
    expect(second.email).toBe("other@example.com");
    expect(await authService.isAuthenticated()).toBe(true);
  });

  it("refuses to sign up twice with the same email", async () => {
    await authService.signUp({ name: "Asha", email: "asha@example.com", password: "password123" });
    await expect(
      authService.signUp({ name: "Asha Again", email: "asha@example.com", password: "password123" }),
    ).rejects.toThrow(AuthError);
  });

  it("logs in with the correct email and password", async () => {
    await authService.signUp({ name: "Asha", email: "asha@example.com", password: "password123" });
    await authService.logout();
    expect(await authService.isAuthenticated()).toBe(false);

    await authService.login({ email: "ASHA@example.com", password: "password123" });
    expect(await authService.isAuthenticated()).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    await authService.signUp({ name: "Asha", email: "asha@example.com", password: "password123" });
    await authService.logout();

    await expect(
      authService.login({ email: "asha@example.com", password: "wrong-password" }),
    ).rejects.toThrow(AuthError);
    expect(await authService.isAuthenticated()).toBe(false);
  });

  it("rejects login when no account exists yet", async () => {
    await expect(
      authService.login({ email: "nobody@example.com", password: "whatever1" }),
    ).rejects.toThrow(AuthError);
  });

  it("logout ends the session but keeps the account in the directory", async () => {
    await authService.signUp({ name: "Asha", email: "asha@example.com", password: "password123" });
    await authService.logout();

    expect(await authService.isAuthenticated()).toBe(false);
    expect(await authService.getAccount()).toBeNull(); // no one is signed in right now
    // But the account itself still exists and can be logged back into.
    await authService.login({ email: "asha@example.com", password: "password123" });
    expect(await authService.isAuthenticated()).toBe(true);
  });

  it("migrates pre-auth practice data to the very first account only", async () => {
    // Simulate leftover data from before accounts existed (this app's actual
    // pre-auth storage layout).
    window.localStorage.setItem(
      "speech-therapy:v1:profiles:current",
      JSON.stringify({ id: "local", name: "Old Data" }),
    );
    window.localStorage.setItem(
      "speech-therapy:v1:streaks:current",
      JSON.stringify({ current: 4, longest: 4, lastPracticeDate: "2026-08-01" }),
    );

    const first = await authService.signUp({ name: "Asha", email: "asha@example.com", password: "password123" });
    const migratedProfile = window.localStorage.getItem(
      `speech-therapy:v1:account:${first.id}:profile`,
    );
    expect(migratedProfile).not.toBeNull();
    expect(JSON.parse(migratedProfile!).name).toBe("Old Data");

    // A second account must NOT also receive a copy of that legacy data.
    await authService.logout();
    const second = await authService.signUp({ name: "Rohan", email: "rohan@example.com", password: "password123" });
    const secondProfile = window.localStorage.getItem(
      `speech-therapy:v1:account:${second.id}:profile`,
    );
    expect(secondProfile).toBeNull();
  });
});
