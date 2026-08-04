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
- `meetings` table: `title`, `description`, `scheduled_at`, `location`, `org_id`, `created_by`, `template_id`
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

### 7. Meetings search + date filter
- `?q=` query param on `GET /api/teams/[teamId]/meetings`
- ILIKE search on `title`, `description`, `location`
- `?from=`/`?to=` date range params (`gte`/`lte` on `scheduled_at`)
- Search bar in team view: flat results when query active, upcoming/past split when empty
- Date filter hidden behind "Filter by date" toggle
- API gated by `resolveTeamAccess` + `create_meeting`/org scoping

### 8. Permissions & roles (RBAC)
- `lib/permissions.ts`: `getPermissionKeys()`, `hasPermission()`, self-scoping to meeting/team/org
- `meeting_overrides` table for per-meeting role overrides
- `role_id` column on `memberships`
- **14 seeded permission keys** in `db/seed/permissions.ts` (incl. `manage_team_roles`, `superuser`)
- `bootstrapOrgAdmin(orgId, userId)`: org creation seeds real "Admin" role (all catalog perms minus `superuser`) — splittable, no hardcoded superuser
- Role-scoped data isolation: `resolveOrganizationAccess` / `resolveTeamAccess` / `resolveMeetingAccess` derive org/team from membership, never client-supplied
- `isRoleScopeValid`: org-wide membership can only hold org-wide roles; prevents role promotion/borrowing
- `lib/permissions.check.ts`: 6 test groups (org/team/meeting isolation, bootstrap regression)

### 9. Roles CRUD
- `GET/POST/DELETE /api/organizations/[orgId]/roles` — org-wide roles, gated `manage_roles`
- `GET/POST/DELETE /api/organizations/[orgId]/roles/[roleId]/permissions` — permission attach/detach
- `GET/POST/PATCH/DELETE /api/teams/[teamId]/roles` — sub-committee-scoped roles, gated `manage_team_roles`
- `GET /api/permissions` — global catalog (any logged-in user)
- Settings UI: Roles & Permissions tab with permission toggles, member role assignment

### 10. Templates CRUD (KV model: fields JSONB + Handlebars)
- `templates`: `name`, `description`, `fields` jsonb (7 field types: text/textarea/number/date/boolean/select/table), `tex_path`, `org_id`, `created_by`
- `GET/POST /api/organizations/[orgId]/templates` — list/create (multipart, `.hbs`/`.html` upload to `uploads/templates/`)
- `GET/PATCH/DELETE /api/organizations/[orgId]/templates/[templateId]` — detail/edit/delete, org-scoped
- Settings UI: Templates tab + template builder (`/settings/templates/[templateId]`) — field reorder ▲▼, select options, table columns, live `.hbs` source view
- **Note:** section-based model (`template_sections`/`minutes_sections`) was dropped in migration 0007 — `DESIGN.md`/`SRS.md` still document the old model (stale)

### 11. Minutes + PDF export
- `minutes`: `id` = meeting id (1:1), `template_id`, `status` draft/published, `content` jsonb, `published_at`
- `GET /api/meetings/[meetingId]` — meeting + template + minutes; PATCH gated `edit_meeting`
- `GET/PUT /api/meetings/[meetingId]/minutes` — upsert content, template fallback chain, gated `edit_meeting`
- Meeting detail page `/meetings/[meetingId]`: form generated from `template.fields`, Save / Preview / Export PDF
- `lib/render-pdf.ts`: Handlebars renderer (`eq`, `not`, `has` helpers, auto HTML escaping) + self-check
- PDF export: client-side `html2pdf.js` (html2canvas + jsPDF, A4)
- Seed: 3 `.hbs` templates + 4 meetings with published minutes
- **Gotcha:** export not gated by `export_minutes` permission; `resolveMeetingAccess` duplicated across 2 route files

### 12. Ops scripts (low-ops burden)
- `scripts/backup.sh` — pg_dump to `backups/` (timestamped, gitignored)
- `scripts/restore.sh` — fail-fast restore (`ON_ERROR_STOP=1`) + re-migrate
- `scripts/update.sh` — `git pull --ff-only` + `bun install` + migrate
- `scripts/fix-admin-permissions.ts` — backfills pre-#63 orgs' Admin roles
- `db:backup` / `db:restore` / `update` npm scripts

### 13. Clustering indexes
- 5 indexes: `meetings_org_idx`, `meeting_tags_meeting_id_idx`, `meeting_tags_tag_id_idx`, `cluster_meetings_meeting_idx`, `clusters_org_idx`
- `lib/clustering.check.ts` — self-check: tag-overlap query + EXPLAIN asserts no Seq Scan; wired as `db:check:clustering`

## Not done (blocked or not started)

### Clusters, tags, attendance, exports table, audit log
- Tables exist in schema; no APIs or UI
- Only clustering *indexes* + query self-check exist (no cluster computation job)

### Rich-text editing
- `@tiptap/*` installed but unused (dead deps) — minutes editor is a flat form, no rich text yet

### Cleanup / tech debt
- `lib/rich-text.ts` and `lib/render-document.ts` deleted, but task.md/docs still referenced them (fixed here)
- `DESIGN.md` §6–7 stale (template_sections model + headless-Chromium PDF vs actual fields-JSONB + html2pdf.js)
- `uploads/` not in `.gitignore`; template upload path is CWD-relative
- PDF export not permission-gated; `resolveMeetingAccess` duplicated in 3 places
