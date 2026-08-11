"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logomark } from "@/components/ui/logomark";
import { useAppData } from "@/hooks/use-app-data";
import { AuthError, authService } from "@/lib/services/auth.service";
import { hasErrors } from "@/lib/validations/profile";
import {
  validateLogin,
  validateSignUp,
  type LoginInput,
  type SignUpInput,
} from "@/lib/validations/auth";

type Mode = "login" | "signup";

const emptySignUp: SignUpInput = { name: "", email: "", password: "", confirmPassword: "" };
const emptyLogin: LoginInput = { email: "", password: "" };

export function AuthView() {
  const router = useRouter();
  const { refresh } = useAppData();

  const [mode, setMode] = useState<Mode>("signup");
  const [submitting, setSubmitting] = useState(false);

  const [signUp, setSignUp] = useState<SignUpInput>(emptySignUp);
  const [signUpErrors, setSignUpErrors] = useState<Record<string, string>>({});

  const [login, setLogin] = useState<LoginInput>(emptyLogin);
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateSignUp(signUp);
    setSignUpErrors(errors);
    if (hasErrors(errors)) return;

    setSubmitting(true);
    try {
      await authService.signUp(signUp);
      await refresh();
      toast.success(`Welcome, ${signUp.name.trim().split(" ")[0]}!`);
      router.replace("/onboarding");
    } catch (err) {
      toast.error(err instanceof AuthError ? err.message : "Couldn't create your account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateLogin(login);
    setLoginErrors(errors);
    if (hasErrors(errors)) return;

    setSubmitting(true);
    try {
      await authService.login(login);
      await refresh();
      toast.success("Welcome back!");
      router.replace("/dashboard");
    } catch (err) {
      toast.error(err instanceof AuthError ? err.message : "Couldn't log you in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-primary/8 via-background to-warm/8 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Logomark className="size-6" />
          </span>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {mode === "signup" ? "Start practicing" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signup"
              ? "One session today is a steadier voice tomorrow."
              : "Log in to pick up where you left off."}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-1.5 shadow-[0_1px_2px_-1px_oklch(0.22_0.03_235/0.06),0_8px_24px_-12px_oklch(0.22_0.03_235/0.12)]">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Log in
            </button>
          </div>

          <div className="overflow-hidden p-5">
            <AnimatePresence mode="wait" initial={false}>
              {mode === "signup" ? (
                <motion.form
                  key="signup"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleSignUp}
                  className="space-y-4"
                  noValidate
                >
                  <Field
                    id="name"
                    label="Name"
                    icon={<User className="size-4" />}
                    value={signUp.name}
                    onChange={(v) => setSignUp((s) => ({ ...s, name: v }))}
                    error={signUpErrors.name}
                    placeholder="Asha Verma"
                    autoComplete="name"
                  />
                  <Field
                    id="signup-email"
                    label="Email"
                    icon={<Mail className="size-4" />}
                    value={signUp.email}
                    onChange={(v) => setSignUp((s) => ({ ...s, email: v }))}
                    error={signUpErrors.email}
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  <Field
                    id="signup-password"
                    label="Password"
                    icon={<Lock className="size-4" />}
                    value={signUp.password}
                    onChange={(v) => setSignUp((s) => ({ ...s, password: v }))}
                    error={signUpErrors.password}
                    type="password"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <Field
                    id="confirm-password"
                    label="Confirm password"
                    icon={<ShieldCheck className="size-4" />}
                    value={signUp.confirmPassword}
                    onChange={(v) => setSignUp((s) => ({ ...s, confirmPassword: v }))}
                    error={signUpErrors.confirmPassword}
                    type="password"
                    placeholder="Type it again"
                    autoComplete="new-password"
                  />
                  <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                    Create account
                  </Button>
                </motion.form>
              ) : (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2 }}
                  onSubmit={handleLogin}
                  className="space-y-4"
                  noValidate
                >
                  <Field
                    id="login-email"
                    label="Email"
                    icon={<Mail className="size-4" />}
                    value={login.email}
                    onChange={(v) => setLogin((s) => ({ ...s, email: v }))}
                    error={loginErrors.email}
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  <Field
                    id="login-password"
                    label="Password"
                    icon={<Lock className="size-4" />}
                    value={login.password}
                    onChange={(v) => setLogin((s) => ({ ...s, password: v }))}
                    error={loginErrors.password}
                    type="password"
                    placeholder="Your password"
                    autoComplete="current-password"
                  />
                  <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                    Log in
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Your account and practice data stay on this device — nothing is sent to a server.
        </p>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  icon,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          className="h-10 pl-8"
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
