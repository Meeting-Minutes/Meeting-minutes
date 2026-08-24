"use client";

import { Suspense, useActionState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { login } from "./actions";
import ThemeToggle from "../../theme-toggle";

const DEMO_ACCOUNTS = [
  { email: "admin@pcampus.edu.np", label: "Admin — PCampus & Riverside" },
  { email: "secretary@pcampus.edu.np", label: "Secretary — PCampus" },
  { email: "viewer@pcampus.edu.np", label: "View-only — PCampus" },
  { email: "lead@pcampus.edu.np", label: "R&D Lead — PCampus" },
];

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-tertiary" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const next = useSearchParams().get("next") ?? "/";
  const [state, action, pending] = useActionState(login, undefined);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function fillDemo(email: string) {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = "demodemo123";
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-bg-tertiary px-4">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>
      <div className="animate-pop-in bg-bg-primary w-full max-w-sm p-8 rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] border border-border/40">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/30 to-success/15 flex items-center justify-center mx-auto mb-4 shadow-[0_8px_24px_-8px_rgba(88,101,242,0.6)]">
            <span className="text-accent text-lg font-bold">M</span>
          </div>
          <h1 className="text-2xl font-semibold text-text-normal m-0">Welcome back</h1>
          <p className="text-text-muted text-sm mt-1">Sign in to your account</p>
        </div>

        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next.startsWith("/") ? next : "/"} />
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Email
            </label>
            <input
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              placeholder="you@pcampus.edu.np"
              required
              autoComplete="email"
              className="px-3.5 py-2.5 text-text-normal placeholder:text-text-muted/50 bg-bg-input border border-border rounded-lg focus:border-accent focus:shadow-[0_0_0_3px_rgba(88,101,242,0.15)] transition-all focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Password
            </label>
            <input
              ref={passwordRef}
              id="password"
              name="password"
              type="password"
              placeholder="Your password"
              required
              autoComplete="current-password"
              className="px-3.5 py-2.5 text-text-normal placeholder:text-text-muted/50 bg-bg-input border border-border rounded-lg focus:border-accent focus:shadow-[0_0_0_3px_rgba(88,101,242,0.15)] transition-all focus:outline-none"
            />
          </div>

          {state?.error && (
            <p className="animate-fade-up text-danger text-sm m-0">{state.error}</p>
          )}

          <button
            disabled={pending}
            type="submit"
            className="btn-primary w-full text-white font-semibold py-2.5 px-4 rounded-lg disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-text-muted text-sm mt-5 mb-0 text-center">
          New here?{" "}
          <Link
            href={next.startsWith("/") && next !== "/" ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
            className="text-accent hover:text-accent-hover transition-colors"
          >
            Create an account
          </Link>
        </p>

        <div className="mt-6 pt-4 border-t border-border/50">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Demo Accounts
          </p>
          <p className="text-xs text-text-muted mb-2">
            Password: <code className="text-[10px] bg-bg-secondary px-1 py-0.5 rounded">demodemo123</code>
          </p>
          <div className="flex flex-col gap-1">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => fillDemo(a.email)}
                className="group flex justify-between items-center text-left text-xs px-2.5 py-2 rounded-lg hover:bg-bg-secondary hover:border-l-2 hover:border-l-accent border-l-2 border-l-transparent transition-all active:scale-[0.98]"
              >
                <code className="text-[11px] text-accent group-hover:text-accent-hover">{a.email}</code>
                <span className="text-text-muted">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
