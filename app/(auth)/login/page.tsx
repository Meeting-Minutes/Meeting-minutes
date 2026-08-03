"use client";

import { useActionState, useRef } from "react";
import { login } from "./actions";

const DEMO_ACCOUNTS = [
  { email: "admin@pcampus.edu.np", label: "Admin — both orgs" },
  { email: "secretary@pcampus.edu.np", label: "Secretary in PCampus, Admin in Board" },
  { email: "viewer@pcampus.edu.np", label: "View-only in PCampus, Editor in Board" },
];

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function fillDemo(email: string) {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = "demodemo123";
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-tertiary">
      <div className="bg-bg-primary w-full max-w-sm p-8 rounded-lg shadow-xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-text-normal m-0">Welcome back</h1>
          <p className="text-text-muted text-sm mt-1">Sign in to your account</p>
        </div>

        <form action={action} className="flex flex-col gap-4">
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
              className="px-3 py-2 text-text-normal placeholder:text-text-muted/50 bg-bg-input border border-border rounded focus:border-accent focus:outline-none"
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
              className="px-3 py-2 text-text-normal placeholder:text-text-muted/50 bg-bg-input border border-border rounded focus:border-accent focus:outline-none"
            />
          </div>

          {state?.error && (
            <p className="text-danger text-sm m-0">{state.error}</p>
          )}

          <button
            disabled={pending}
            type="submit"
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-60 text-white font-medium py-2.5 px-4 rounded transition-colors"
          >
            {pending ? "Signing in…" : "Sign In"}
          </button>
        </form>

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
                className="flex justify-between items-center text-left text-xs px-2 py-1.5 rounded hover:bg-bg-secondary transition-colors group"
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
