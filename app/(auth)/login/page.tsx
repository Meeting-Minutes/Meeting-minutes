"use client";

import { Suspense, useActionState, useRef, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "./actions";
import ThemeToggle from "../../theme-toggle";

const DEMO_ACCOUNTS = [
  { email: "admin@pcampus.edu.np", label: "Admin" },
  { email: "secretary@pcampus.edu.np", label: "Secretary" },
  { email: "viewer@pcampus.edu.np", label: "Viewer" },
  { email: "lead@pcampus.edu.np", label: "R&D Lead" },
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
  const router = useRouter();
  const [state, action, pending] = useActionState(login, undefined);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (state?.redirect) {
      router.push(state.redirect);
      router.refresh();
    }
  }, [state?.redirect, router, next]);

  function fillDemo(email: string) {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = "demodemo123";
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-bg-tertiary px-4">
      <div className="absolute top-5 right-5 z-10">
        <ThemeToggle />
      </div>

      <div className="animate-pop-in w-full max-w-3xl bg-bg-primary rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)] border border-border/40 overflow-hidden flex flex-col md:flex-row min-h-[480px]">

        {/* ── Left: branding ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-between p-8 md:p-10 border-b md:border-b-0 md:border-r border-border/40">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/30 to-success/15 flex items-center justify-center mb-5 shadow-[0_8px_24px_-8px_rgba(88,101,242,0.5)]">
              <svg className="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className="w-10 h-1 rounded-full bg-accent mb-6" />
            <h1 className="text-2xl md:text-3xl font-bold text-text-normal leading-tight">
              Minutes
            </h1>
            <p className="text-sm text-text-muted mt-2 leading-relaxed max-w-xs">
              Meeting minutes management for your organization.
            </p>
          </div>

          <div className="mt-8 md:mt-0 pt-6 border-t border-border/40">
            <p className="text-xs font-semibold text-text-normal">Minutes</p>
            <p className="text-xs text-text-muted">Meeting management system</p>
          </div>
        </div>

        {/* ── Right: form ────────────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-center p-8 md:p-10">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-1">
            Minutes Account
          </p>
          <h2 className="text-xl font-bold text-text-normal mb-1">Sign in</h2>
          <p className="text-sm text-text-muted mb-6">
            Use your email address to sign in.
          </p>

          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="next" value={next.startsWith("/") ? next : "/"} />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-text-normal">
                Email
              </label>
              <input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 text-sm text-text-normal placeholder:text-text-muted/40 bg-bg-input border border-border rounded-lg focus:border-accent focus:shadow-[0_0_0_3px_rgba(88,101,242,0.12)] transition-all focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-text-normal">
                Password
              </label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pr-10 text-sm text-text-normal placeholder:text-text-muted/40 bg-bg-input border border-border rounded-lg focus:border-accent focus:shadow-[0_0_0_3px_rgba(88,101,242,0.12)] transition-all focus:outline-none"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-normal transition-colors p-0.5"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm mt-0.5">
              <label className="flex items-center gap-2 text-text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="accent-[var(--color-accent)] w-3.5 h-3.5"
                />
                Remember me
              </label>
            </div>

            {state?.error && (
              <p className="animate-fade-up text-danger text-sm m-0">{state.error}</p>
            )}

            <button
              disabled={pending}
              type="submit"
              className="w-full bg-[#1a1f36] hover:bg-[#252b48] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-60 mt-1"
            >
              {pending ? "Signing in\u2026" : "Sign in"}
            </button>
          </form>

          <p className="text-text-muted text-sm mt-5 mb-0 text-center">
            New here?{" "}
            <Link
              href={next.startsWith("/") && next !== "/" ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
              className="text-accent hover:text-accent-hover transition-colors font-medium"
            >
              Create an account
            </Link>
          </p>

          {/* Demo accounts */}
          <div className="mt-5 pt-4 border-t border-border/40">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
              Demo Accounts
            </p>
            <div className="flex flex-col gap-1">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => fillDemo(a.email)}
                  className="group flex items-center gap-2 text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-bg-secondary transition-colors"
                >
                  <span className="text-text-muted group-hover:text-text-normal transition-colors">{a.label}</span>
                  <span className="text-text-muted/50 text-[10px]">{a.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
