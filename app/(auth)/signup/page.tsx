"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signup } from "./actions";
import ThemeToggle from "../../theme-toggle";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-tertiary" />}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const next = useSearchParams().get("next") ?? "/";
  const [state, action, pending] = useActionState(signup, undefined);

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
          <h1 className="text-2xl font-semibold text-text-normal m-0">Create your account</h1>
          <p className="text-text-muted text-sm mt-1">One account for every organization</p>
        </div>

        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next.startsWith("/") ? next : "/"} />
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Your name"
              required
              autoComplete="name"
              className="px-3.5 py-2.5 text-text-normal placeholder:text-text-muted/50 bg-bg-input border border-border rounded-lg focus:border-accent focus:shadow-[0_0_0_3px_rgba(88,101,242,0.15)] transition-all focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
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
              id="password"
              name="password"
              type="password"
              placeholder="Your password"
              required
              autoComplete="new-password"
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
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-text-muted text-sm mt-5 mb-0 text-center">
          Already have an account?{" "}
          <Link
            href={next.startsWith("/") && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login"}
            className="text-accent hover:text-accent-hover transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
