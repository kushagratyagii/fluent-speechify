import { supabase } from "@/lib/supabase";
import type { Account } from "@/types";

export class AuthError extends Error {}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toAccount(user: {
  id: string;
  email?: string;
  created_at?: string;
  user_metadata?: {
    name?: string;
  };
}): Account {
  return {
    id: user.id,
    name: user.user_metadata?.name ?? "",
    email: user.email ?? "",
    createdAt: user.created_at ?? new Date().toISOString(),
  };
}

export const authService = {
  async getAccount(): Promise<Account | null> {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw new AuthError(error.message);
    }

    if (!user) return null;

    return toAccount(user);
  },

  async isAuthenticated(): Promise<boolean> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return Boolean(session);
  },

  async signUp(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<Account> {
    const email = normalizeEmail(input.email);
    const name = input.name.trim();

    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        data: {
          name,
        },
      },
    });

    if (error) {
      throw new AuthError(error.message);
    }

    if (!data.user) {
      throw new AuthError("Could not create the account.");
    }

    return toAccount(data.user);
  },

  async login(input: {
    email: string;
    password: string;
  }): Promise<Account> {
    const email = normalizeEmail(input.email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: input.password,
    });

    if (error) {
      throw new AuthError(error.message);
    }

    if (!data.user) {
      throw new AuthError("Could not sign in.");
    }

    return toAccount(data.user);
  },

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new AuthError(error.message);
    }
  },
};