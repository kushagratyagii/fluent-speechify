import type { ValidationErrors } from "./profile";

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignUp(input: SignUpInput): ValidationErrors<SignUpInput> {
  const errors: ValidationErrors<SignUpInput> = {};
  if (!input.name.trim()) errors.name = "Please enter your name.";
  else if (input.name.trim().length > 60) errors.name = "That name is too long.";

  if (!input.email.trim()) errors.email = "Please enter your email.";
  else if (!EMAIL_RE.test(input.email.trim())) errors.email = "That doesn't look like a valid email.";

  if (input.password.length < 8) errors.password = "Use at least 8 characters.";

  if (input.confirmPassword !== input.password) {
    errors.confirmPassword = "Passwords don't match.";
  }
  return errors;
}

export function validateLogin(input: LoginInput): ValidationErrors<LoginInput> {
  const errors: ValidationErrors<LoginInput> = {};
  if (!input.email.trim()) errors.email = "Please enter your email.";
  else if (!EMAIL_RE.test(input.email.trim())) errors.email = "That doesn't look like a valid email.";
  if (!input.password) errors.password = "Please enter your password.";
  return errors;
}
