# Progress

## Done

### 1. Login (email + password)
- `password_hash` column on `users`
- JWT sessions via `jose` (httpOnly cookie, 7-day expiry)
- `verifyCredentials` / `getCurrentUser` / `requireAuth` in `lib/auth.ts`
- Server Action login form — works without JS
- Next.js 16 Proxy route protection
- Seed: `admin@example.com` / `password123`

### 2. Org & Team management
- `slug` column on `organizations`
- `GET/POST /api/organizations` — list/create (scoped to user's memberships, auto-membership on create)
- `GET/PATCH/DELETE /api/organizations/[orgId]` — org detail/edit/delete
- `GET/POST /api/organizations/[orgId]/teams` — team list/create under org
- `GET /api/me/memberships` — user's org memberships
- Dynamic Discord-style sidebar: server bar shows orgs, channel panel shows teams
- Modal dialogs for creating orgs and teams

### 3. Membership schema fix (partial unique indexes)
- Replaced composite unique constraint `(user_id, org_id, team_id)` with two partial unique indexes:
  - `unique_membership_org_wide`: `UNIQUE (user_id, org_id) WHERE team_id IS NULL`
  - `unique_membership_per_team`: `UNIQUE (user_id, org_id, team_id) WHERE team_id IS NOT NULL`
- Enforces uniqueness at DB level for both org-wide and per-team memberships
- Migration: `0004_lovely_marvel_apes.sql`

## Notes
- Memberships table still needs `role_id` (blocked on roles/permissions feature)
- Permissions not enforced yet — any authenticated user can manage orgs/teams
