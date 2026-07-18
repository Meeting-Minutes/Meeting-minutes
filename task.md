# Task Log

## [2026-07-18] Login feature — complete

Email + password login with JWT sessions. Ready for OAuth extension.

### Schema
- Added `password_hash` (nullable) to `users` table

### lib/
- `lib/session.ts` — **new**. JWT encrypt/decrypt, create/delete httpOnly cookies via `jose`. 7-day expiry, stateless.
- `lib/auth.ts` — **rewritten**. `verifyCredentials`, `getCurrentUser`, `requireAuth`. Uses `bcryptjs.compare`.

### API routes
- `app/api/auth/login/route.ts` — **new**. POST: validate + set session.
- `app/api/auth/logout/route.ts` — **new**. POST: clear session.
- `app/api/auth/me/route.ts` — **new**. GET: current user or 401.

### Login page
- `app/login/actions.ts` — **new**. Server Action: verify creds, set cookie, redirect.
- `app/login/page.tsx` — **new**. Discord-style dark card, `useActionState` form.

### Route protection
- `proxy.ts` — **new**. Next.js 16 Proxy. Protects `/`, redirects unauth → `/login`, auth → `/`.

### Seed
- `db/seed/users.ts` — **new**. Seeds `admin@example.com` / `password123`.
- `db/seed/seeds.ts` — **updated**. Added `seedUsers` to the run list.

### Config & infra
- `.env` — **updated**. Added `SESSION_SECRET`.
- `.env.example` — **updated**. Added `SESSION_SECRET` placeholder.
- `package.json` — **updated**. Added `db:seed` script.
- `dependencies` added: `jose`, `bcryptjs`, `server-only`, `@types/bun` (dev).

### Migration
- `db/migrations/0001_huge_firebrand.sql` — **new**. ALTER TABLE users ADD password_hash.

### UI theme (full Discord-like dark redesign)
- `app/globals.css` — **rewritten**. Tailwind v4 theme with Discord color palette.
- `app/layout.tsx` — **updated**. Dark bg, removed light mode.
- `app/page.tsx` — **rewritten**. 3-column sidebar layout (server bar + channel list + content).

### Files changed/added

| File | Action |
|---|---|
| `db/schema/users.ts` | edited |
| `lib/session.ts` | **new** |
| `lib/auth.ts` | rewritten |
| `app/api/auth/login/route.ts` | **new** |
| `app/api/auth/logout/route.ts` | **new** |
| `app/api/auth/me/route.ts` | **new** |
| `app/login/actions.ts` | **new** |
| `app/login/page.tsx` | **new** |
| `proxy.ts` | **new** |
| `app/globals.css` | rewritten |
| `app/layout.tsx` | edited |
| `app/page.tsx` | rewritten |
| `db/seed/users.ts` | **new** |
| `db/seed/seeds.ts` | edited |
| `db/migrations/0001_huge_firebrand.sql` | **new** |
| `.env` | edited |
| `.env.example` | edited |
| `package.json` | edited |
| `task.md` | **new** |
