# RBAC Permissions — org/team/meeting authorization

> Audience: someone new to this codebase who needs to understand how
> authorization works — who can do what, and how the system decides.
> Companion code: [`lib/permissions.ts`](../lib/permissions.ts),
> [`lib/permissions.check.ts`](../lib/permissions.check.ts).
> Companion spec: `DESIGN.md` §3–§5.

---

## 1. What problem this solves

Before this module, the system had **authentication** (who you are, via
`getCurrentUser()`) but zero **authorization** (what you're allowed to do).
Every route checked only that you were logged in — any member could
PATCH/DELETE any org, any team, any meeting.

This module adds the missing authorization layer. A route can now ask "does
this user have permission key X on this org?" and get a yes/no answer, with
resolution that understands:

- **Org-wide roles** — a role that applies everywhere in an org
- **Team-scoped roles** — a role limited to a specific team
- **Meeting-level overrides** — a role assigned to a specific person on a
  specific meeting, overriding the org/team defaults

---

## 2. The three-layer model (plus one override)

Permission flows through a chain of joins:

```
Permission key (e.g. "manage_members")
      ▲
      │ belongs to
Role_Permissions (role_id ↔ permission_id)
      ▲
      │ belongs to
Role (org-scoped, e.g. "Admin", "Secretary")
      ▲
      │ assigned via
Membership (user × org × team × role)
```

### Core tables

| Table               | Role                                                        |
| ------------------- | ----------------------------------------------------------- |
| `permissions`       | Fixed catalog of 12 hardcoded permission keys (seeded)      |
| `roles`             | Dynamic per org — orgs create their own role names          |
| `role_permissions`  | Join: which permissions a role has                          |
| `memberships`       | Who has which role in which org, optionally scoped to a team|

### The override table

| Table               | Role                                                        |
| ------------------- | ----------------------------------------------------------- |
| `meeting_overrides` | Per-meeting role assignment, checked **before** membership  |

---

## 3. Resolution order

`getPermissionKeys()` follows the order specified in `DESIGN.md` §5:

```
1. If meetingId is given:
   Query meeting_overrides for (meetingId, userId)
     → JOIN role_permissions → permissions
     → If ANY rows returned, those ARE the answer. Stop.

2. Otherwise:
   Query memberships for (userId, orgId)
     → JOIN role_permissions → permissions
     → WHERE teamId IS NULL (org-wide) OR teamId = :teamId (if given)
     → Union of all matching rows
```

Key property: **meeting overrides are an exclusive answer**, not additive.
If a user has a meeting_override row, that meeting uses only the override
role's permissions — the user's org/team memberships are ignored for that
meeting. This is by design (per `DESIGN.md` §5): it keeps the common case
cheap and only pays the extra join when an override exists.

---

## 4. The functions

### `getPermissionKeys(params)` → `Set<string>`

```ts
interface PermissionParams {
  userId: string;
  orgId: string;
  teamId?: string;    // scope to a specific team
  meetingId?: string; // check meeting_overrides first
}
```

Returns the set of all permission keys the user has in the given scope.

### `hasPermission(params, key)` → `boolean`

Thin wrapper:

```ts
async function hasPermission(params: PermissionParams, key: string): Promise<boolean> {
  const keys = await getPermissionKeys(params);
  return keys.has(key);
}
```

Routes call `hasPermission()` directly, the same way they call
`getCurrentUser()` today. No middleware, no caching — YAGNI until a second
use case needs it.

---

## 5. Bootstrap fix — creating an org

Before this change, `POST /api/organizations` inserted a membership with no
role — so the creator had zero permissions forever. Now the handler:

1. Creates the org
2. Creates an **"Admin"** role scoped to that org
3. Fetches **all** rows from the permission catalog
4. Links every permission to the Admin role via `role_permissions`
5. Sets the creator's membership `roleId` to the new Admin role

This matches `DESIGN.md` §4: "admin is just a role whose permission set
happens to be broad."

---

## 6. The permission catalog

Seeded by `db/seed/permissions.ts`. 12 fixed keys:

| Key                       | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `create_meeting`          | Schedule a meeting                               |
| `edit_meeting`            | Edit a meeting's details                         |
| `delete_meeting`          | Delete a meeting                                 |
| `edit_after_grace_period` | Edit minutes after the edit-lock grace period    |
| `manage_members`          | Add or remove organization/team members          |
| `manage_org`              | Edit organization settings                       |
| `manage_teams`            | Create, edit, or delete teams                    |
| `manage_templates`        | Create, edit, or delete minute templates         |
| `manage_tags`             | Manage the organization's tag catalog            |
| `export_minutes`          | Generate PDF/DOCX exports of minutes             |
| `view_audit_log`          | View the organization's audit log                |
| `superuser`               | Complete control over the organization           |

These are **fixed** — adding a new permission is a code + migration change
(see the `ponytail:` note in `DESIGN.md` §2). Assigning existing permissions
to roles is fully dynamic via `role_permissions` rows.

---

## 7. Schema changes

### `memberships` — added `role_id`

```ts
roleId: uuid("role_id")
  .references(() => roles.id, { onDelete: "set null" }),
```

Nullable. A membership with no role simply resolves to zero permissions
(safe default).

### `meeting_overrides` — new table

```ts
export const meetingOverrides = pgTable(
  "meeting_overrides",
  {
    meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.meetingId, table.userId] })],
);
```

Composite PK on `(meeting_id, user_id)` — one override per (meeting, user).

---

## 8. The check script

`lib/permissions.check.ts` is an assert-based self-check (not a test
framework). It inserts throwaway data and asserts:

1. **Org-wide role** — a user with an org-wide membership sees the permission
   everywhere in the org.
2. **Team-scoped role, own team** — a user with a team-scoped membership sees
   the permission on that team.
3. **Team-scoped role, other team** — the same user does **not** see the
   permission on a different team.
4. **Meeting override** — a user with no membership role at all gets the
   permission on a meeting via `meeting_overrides`.
5. **`hasPermission` wrapper** — the convenience function returns `true` for
   the org-wide user.

All inserted rows are cleaned up at the end.

```bash
bun run lib/permissions.check.ts
# -> "All permission checks passed"
```

---

## 9. Role management API

Six endpoints to manage roles and permissions for an org. Follows the same
patterns as the existing teams/members routes.

### `GET /api/organizations/[orgId]/roles`

List all roles for the org.

### `POST /api/organizations/[orgId]/roles`

```json
{ "name": "Secretary" }
```

Creates a new role with zero permissions attached. Returns the role.

### `PATCH /api/organizations/[orgId]/roles`

```json
{ "roleId": "...", "name": "Co-chair" }
```

Rename a role. The role must belong to the org.

### `DELETE /api/organizations/[orgId]/roles?roleId=...`

Delete a role. The FK on `memberships.roleId` is `SET NULL`, so existing
memberships keep their row but lose their role assignment.

### `GET /api/permissions`

List the global permission catalog (12 fixed keys, seeded). Read-only.

### `GET /api/organizations/[orgId]/roles/[roleId]/permissions`

List the permissions currently attached to a role.

### `POST /api/organizations/[orgId]/roles/[roleId]/permissions`

```json
{ "permissionId": "..." }
```

Attach a permission to the role. Idempotent (`onConflictDoNothing`).

### `DELETE /api/organizations/[orgId]/roles/[roleId]/permissions`

```json
{ "permissionId": "..." }
```

Detach a permission from the role.

### Member role assignment

`POST /api/organizations/[orgId]/members` now accepts optional `roleId`.
`PATCH /api/organizations/[orgId]/members` updates `roleId` on a membership:

```json
{ "userId": "...", "roleId": "..." }
```

---

## 10. File map

| File                              | Role                                                |
| --------------------------------- | --------------------------------------------------- |
| `lib/permissions.ts`              | `getPermissionKeys()` + `hasPermission()`           |
| `lib/permissions.check.ts`        | Assert-based self-check for the above               |
| `db/schema/memberships.ts`        | Added `roleId` FK to `roles`                        |
| `db/schema/meeting_overrides.ts`  | New table for per-meeting role overrides            |
| `db/schema/index.ts`              | Added `export * from "./meeting_overrides"`         |
| `db/migrations/0002_fix_meetings.sql` | Meetings column rename (`sheduled_at` → `scheduled_at`) + add `location`/`description` |
| `db/migrations/0003_*.sql`        | RBAC migration (meeting_overrides, role_id)           |
| `app/api/organizations/route.ts`  | Bootstrap fix: create Admin role on org creation    |
| `app/api/organizations/[orgId]/roles/route.ts` | Role CRUD (list, create, rename, delete) |
| `app/api/organizations/[orgId]/roles/[roleId]/permissions/route.ts` | Attach/detach permissions |
| `app/api/permissions/route.ts`    | Global permission catalog listing                   |
| `app/api/organizations/[orgId]/members/route.ts` | Extended with `roleId` on POST/PATCH       |
| `DESIGN.md` §3–§5                 | Spec: membership model, roles, meeting overrides    |

---

## 11. Role-scoped data isolation (NFR #8)

> **Ref #8** — A role scoped to one committee/organization must never see or
> query another committee's or organization's private minutes, even by URL/ID
> guessing.

The core rule, applied everywhere: **access scope is derived from the
resolved membership, never from a client-supplied org/team/meeting id.**
A query is only allowed if the caller is a member of the org — either
org-wide (`memberships.team_id IS NULL`) or in the exact team the resource
belongs to.

### Scope-resolution helpers (`lib/permissions.ts`)

| Helper | Returns | Semantics |
| ------ | ------- | --------- |
| `resolveOrganizationAccess(userId, orgId)` | `{ orgWide, teamIds } \| null` | `null` = caller has no membership in the org (→ `404 Not found`, no existence leak). `orgWide` true when any membership row has `team_id IS NULL`; otherwise `teamIds` is the caller's own teams. |
| `canAccessOrganization(userId, orgId)` | `boolean` | Thin wrapper over the above. |
| `resolveTeamAccess(userId, teamId)` | `{ orgId } \| null` | `null` unless the caller is org-wide or a member of that exact team. The returned `orgId` is the **only** org used for subsequent queries — the team's org, not a body/URL value. |
| `resolveMeetingAccess(userId, meetingId)` | `{ orgId } \| null` | Same rule one level deeper: grants access only if the caller is org-wide or a member of one of the meeting's teams. Checks meeting-level overrides first. |

### `getPermissionKeys({ meetingId })` is now self-scoping

The meeting branch of `getPermissionKeys` previously trusted the caller's
`orgId` for the fallback membership lookup. Now it:

1. **Derives the org from the meeting row itself** (`meetings.org_id`), so a
   guessed meeting id can never be authorized against an unrelated
   membership.
2. **Ignores cross-org meeting overrides.** An override is only honored when
   its `role_id` belongs to the same org as the meeting. Anything else is
   fail-closed (the override is not counted, and the membership fallback is
   also org-scoped). This closes the hole where a role with the same UUID
   could be a different org's role.
3. Falls back to memberships scoped to the meeting's own teams, still
   org-bounded.

`hasPermission` now also returns `true` for the `superuser` key.

### Enforced routes

| Route | Read | Write |
| ----- | ---- | ----- |
| `/api/organizations/[orgId]` | membership required (`404` otherwise) | `manage_org` |
| `/api/organizations/[orgId]/teams` | caller's teams only (all teams if org-wide) | `manage_teams` (parent team org-validated) |
| `/api/organizations/[orgId]/members` | caller's teams only (all if org-wide); team id validated against org | `manage_members` (team id validated against org) |
| `/api/teams/[teamId]/meetings` | team access resolved from membership; org filter applied to meeting rows | `create_meeting`; org taken from the team |

Every mutation also re-checks the target's org in its `WHERE` clause
(`and(eq(...id), eq(...orgId))`), so a guessed id can't delete or edit a
row in another org even when the permission check passes for the caller's
own org.

### Minutes

`minutes.id` **shares** `meetings.id` (one minutes record per meeting, per
`DESIGN.md` §2), so a future minutes-by-id handler enforces the same
boundary by calling `resolveMeetingAccess(userId, minutesId)` and
`getPermissionKeys({ userId, orgId, meetingId: minutesId })` before reading
or writing `minutes`/`minutes_sections`. No new code path is needed for
isolation.

### Regression coverage

`lib/permissions.check.ts` (Test 5) inserts two team-scoped meetings and
asserts:

1. A team member can resolve and see a meeting in their own team.
2. The same user **cannot** resolve or see a sibling team's meeting.
3. Meeting-level permission resolution succeeds for the own-team meeting.
4. The same meeting **cannot** be resolved with a foreign (guessed) org id.

---

> **Ref #6** — Organization-level roles: roles are per-org, names are
> configurable, permissions are assigned via `role_permissions`. The schema
> supports splitting a broad role into narrower ones without restructuring
> (create a new role row, reassign memberships).
