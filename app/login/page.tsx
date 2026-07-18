"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-tertiary">
      <div className="bg-bg-primary w-full max-w-sm p-8 rounded-lg shadow-xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-text-normal m-0">
            Welcome back
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Sign in to your account
          </p>
        </div>

        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="email"
              className="text-xs font-semibold text-text-muted uppercase tracking-wide"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              className="px-3 py-2 text-text-normal placeholder:text-text-muted/50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="password"
              className="text-xs font-semibold text-text-muted uppercase tracking-wide"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Your password"
              required
              className="px-3 py-2 text-text-normal placeholder:text-text-muted/50"
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
            {pending ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
