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
- Team creation auto-adds creator as team-specific member
- Modal dialogs for creating and editing orgs and teams
- Description on orgs and teams

### 3. Membership schema (partial unique indexes)
- Replaced composite unique constraint with two partial unique indexes:
  - `unique_membership_org_wide`: `UNIQUE (user_id, org_id) WHERE team_id IS NULL`
  - `unique_membership_per_team`: `UNIQUE (user_id, org_id, team_id) WHERE team_id IS NOT NULL`
- Enforces uniqueness at DB level for both org-wide and per-team memberships

### 4. Members API & UI
- `GET/POST/DELETE /api/organizations/[orgId]/members` — list, add (by email), remove members
- Team-scoped membership via `?teamId=X` query param (only team-specific members shown)
- Org view: deduplicated member list (`selectDistinctOn`), one row per unique user
- Team view: full-height member sidebar (240px) with toggle "Add member" button
- Org view: inline `MembersSection` with hover-reveal Remove

### 5. Meetings
- `meetings` table: `title`, `description`, `scheduled_at`, `location`, `org_id`, `created_by`
- `meeting_teams` join table (many-to-many between meetings and teams)
- `GET/POST /api/teams/[teamId]/meetings` — list and schedule meetings
- Schedule meeting modal with title, description, date, time, location
- Meeting cards: date badge, upcoming (accent) vs past (muted, opacity-70)
- `MeetingCard` component shared for both upcoming/past

### 6. UI Design
- Discord-inspired layout + macOS visual polish
- Frosted glass top bar, three-column team view layout
- Clickable breadcrumb nav (org name / # team name) in top bar
- Clickable org name in channel sidebar to return to org view
- Full-height member sidebar in team view
- Custom thin dark scrollbar, `antialiased` text

## Not done (blocked or not started)

### Permissions & roles
- `lib/permissions.ts` exists but is empty
- `roles`, `permissions`, `role_permissions` tables exist in schema
- No `role_id` on `memberships` — cannot assign roles to members
- Seed file for fixed permission catalog exists (`db/seed/permissions.ts`) but roles not seeded
- App-wide: any authenticated user can do anything

### Templates
- `templates` and `template_sections` tables exist in schema
- No CRUD APIs, no UI

### Minutes & minutes content editor
- `minutes`, `minutes_sections` tables exist in schema
- No CRUD APIs, no UI
- No minutes editor or PDF pipeline

### Clusters, tags, attendance, exports, audit log
- Tables exist in schema
- No APIs or UI
