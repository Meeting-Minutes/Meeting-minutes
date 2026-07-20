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

### 4. Descriptions & members
- Added `description` (nullable text) to `organizations` and `teams` tables
- Migration: `0005_zippy_master_mold.sql`
- Create/edit org/team modals now include description field
- Description shown in org/team headers
- New API: `GET/POST/DELETE /api/organizations/[orgId]/members` — list, add (by email), remove members
- Team-scoped membership via `?teamId=X` query param
- Members panel with list, add-by-email, and remove in org and team views
- Edit org/team name & description via Edit button in header

## Not done (blocked or not started)

### Permissions & roles
- `lib/permissions.ts` exists but is empty
- `roles`, `permissions`, `role_permissions` tables exist in schema but not in DB (no migration yet)
- No `role_id` on `memberships` — cannot assign roles to members
- Seed file for fixed permission catalog exists (`db/seed/permissions.ts`) but roles not seeded
- App-wide: any authenticated user can do anything
- **Dependency**: must be done before meetings/minutes if access control is needed

### Templates
- `templates` and `template_sections` tables exist in schema
- No CRUD APIs, no UI
- **Dependency**: needed before meetings/minutes

### Meetings & minutes
- `meetings`, `meeting_teams`, `minutes`, `minutes_sections` tables exist in schema
- No CRUD APIs, no UI
- "Schedule meeting" button in UI is disabled ("Coming soon")
- **Next logical milestone** after templates and/or permissions
