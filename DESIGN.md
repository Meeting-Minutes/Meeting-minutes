# Design Document — Minutes Management System

> Companion to the README. The README says _what_ the system does; this covers _how_ it's stored and structured.

## Table of Contents

- [1. Storage overview](#1-storage-overview)
- [2. Entities & schema](#2-entities--schema)
- [3. Multi-org / multi-team membership](#3-multi-org--multi-team-membership)
- [4. Roles & permissions](#4-roles--permissions)
- [5. Who administers what](#5-who-administers-what)
- [6. Template format](#6-template-format)
- [7. Minutes → PDF pipeline](#7-minutes--pdf-pipeline)
- [8. Open implementation questions](#8-open-implementation-questions)

---

## 1. Storage overview

Two kinds of data, stored in two different places — don't put both in Postgres:

| Data                                                                                 | Where                                                              | Why                                                                                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Structured records (orgs, users, roles, meetings, minutes content, attendance, tags) | **Postgres**                                                       | Relational, queried/filtered/joined constantly (search, scoping, clustering)              |
| Generated files (exported PDFs/DOCX, uploaded logos/attachments)                     | **Object storage** (S3-compatible — S3, R2, MinIO for self-hosted) | Large binary blobs; Postgres isn't a file store. DB holds a `file_url`/key, not the bytes |

Minute **content itself** (the text a secretary types) lives in Postgres as JSONB, not as a file — it needs to be searchable, diffable (audit log), and re-renderable into different export formats later. The PDF is a _derived artifact_ generated on demand or on approval, not the source of truth.

---

## 2. Entities & schema

```
organizations
  └─ teams (self-referencing parent_team_id → nested sub-committees)
  └─ roles (org-scoped, custom per org)
       └─ role_permissions → permissions (fixed catalog)
  └─ memberships (user × org × team × role)
  └─ templates
       └─ template_sections (ordered, typed)
  └─ meetings (belongs to org, optionally a team; optional template_id)
       └─ meeting_tags → tags (org-scoped)
       └─ attendance (user OR external name/email)
       └─ minutes (one per meeting, shares meetings.id, references template)
            └─ minutes_sections (content per template_section)
            └─ exports (generated files)
  └─ clusters
       └─ cluster_meetings → meetings
  └─ audit_log (org-scoped, references any entity)

users (global — not owned by one org)
```

### Core tables

**`users`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| email | text unique | |
| name | text | |
| auth_provider_id | text | if using an external auth provider |
| created_at | timestamp | |

A user row is **global** — one person, one row, regardless of how many orgs they belong to. This is what makes "same person in multiple orgs" trivial: it's not solved in `users`, it's solved in `memberships` (below).

**`organizations`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| slug | text unique | for URLs/subdomains if you go multi-tenant-by-subdomain later |
| created_at | timestamp | |

**`teams`** _(committees / sub-committees)_
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK → organizations | |
| parent_team_id | uuid FK → teams, nullable | self-reference, enables sub-committees under a committee |
| name | text | |
| created_at | timestamp | |

**`permissions`** _(fixed catalog, seeded — not user-editable)_
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| key | text unique | e.g. `create_minutes`, `approve_minutes`, `manage_roles`, `search_scope:org`, `search_scope:team` |
| description | text | |

`ponytail:` this is a static seed table, not admin-editable — adding a _new kind_ of permission is a migration, but _assigning_ existing permissions to a role is fully dynamic. Ceiling: if you later want orgs to invent entirely custom permission keys (not just custom role names), this table stops being enough — upgrade path is a plugin/capability registry, not needed yet.

**`roles`** _(custom per org — this is what makes roles non-hardcoded)_
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK → organizations | a role belongs to exactly one org |
| name | text | e.g. "Secretary", "Coordinator" — cosmetic, org-chosen |
| created_at | timestamp | |

**`role_permissions`** _(join table — role has permissions)_
| column | type | notes |
|---|---|---|
| role_id | uuid FK → roles | |
| permission_id | uuid FK → permissions | |
| — | | composite PK (role_id, permission_id) |

**`memberships`** — the table that solves multi-org / multi-team (see §3)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| org_id | uuid FK → organizations | |
| team_id | uuid FK → teams, **nullable** | null = org-wide membership |
| role_id | uuid FK → roles | must belong to the same org_id (app-level check) |
| created_at | timestamp | |
| — | | unique (user_id, org_id) WHERE team_id IS NULL | org-wide: one per user per org |
| — | | unique (user_id, org_id, team_id) WHERE team_id IS NOT NULL | per-team: one per user per org per team |

**`templates`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK → organizations | |
| name | text | display name shown when creating a meeting |
| description | text, nullable | optional description for admins |
| created_by | uuid FK → users | |
| created_at | timestamp | |
| updated_at | timestamp | |

Templates are collections of ordered sections rather than static HTML or Markdown documents. This allows non-technical administrators to build templates using a visual editor while keeping the storage format frontend-agnostic.

**`template_sections`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| template_id | uuid FK → templates | |
| order | int | display order within the template |
| type | text | component type (`meeting_info`, `attendance`, `agenda`, `rich_text`, `table`, `signature`, etc.) |
| title | text | section heading shown to users |
| config | jsonb | section-specific configuration (columns, defaults, options, validation rules, etc.) |

Each section represents a reusable building block. The application knows how to render each `type`; the `config` field customizes its behavior without requiring code changes.

Examples:

- `meeting_info` → no configuration
- `agenda` → columns, numbering style
- `table` → column definitions
- `rich_text` → formatting options
- `signature` → signer labels

The frontend provides a drag-and-drop template builder that creates and reorders these rows. Administrators never edit JSON directly.

`ponytail:` templates intentionally are **not versioned**. Meetings reference the template that was selected when they were created. If an organization wants to preserve an older layout while making changes, they duplicate the template and edit the copy. This is simpler for users to understand than hidden version history and avoids maintaining multiple internal revisions of the same template.

**`meetings`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK → organizations | |
| template_id | uuid FK → templates, nullable, `set null` on delete | template picked when the meeting was scheduled |
| title | text | |
| scheduled_at | timestamp | |
| continuation_of | uuid FK → meetings | |
| created_by | uuid FK → users | |
| grace_period_ends_at | timestamp | computed at creation/approval (§5, edit-lock) |
| created_at | timestamp | |

`ponytail:` `template_id` lives on both `meetings` and `minutes` — `meetings.template_id` is the pick made at scheduling time (what the editor renders before minutes exist); `minutes.template_id` is what actually got used once minutes were created. They can diverge if the meeting's template is changed after minutes already exist, and that's intentional — `minutes.template_id` is the immutable record, `meetings.template_id` is just the current default for that meeting's editor.

**`meeting_teams`**
| column | type | notes |
|---|---|---|
| meeting_id | uuid FK → meetings | |
| team_id | uuid FK → teams | |

**`minutes`**
| column | type | notes |
|---|---|---|
| id | uuid PK, FK → meetings.id | shares the meeting's id — one minutes record per meeting, enforced structurally rather than by a separate unique column |
| template_id | uuid FK → templates, **nullable** | null = freeform meeting, no template |
| status | enum | `draft` \| `published` |
| created_at | timestamp | |
| updated_at | timestamp | |
| published_at | timestamp, nullable | |

**`minutes_sections`** — the per-section content for a minutes record; this is what replaced the old single `minutes.content` JSON blob
| column | type | notes |
|---|---|---|
| minutes_id | uuid FK → minutes, `cascade` on delete | |
| section_id | uuid FK → template_sections, `cascade` on delete | |
| content | jsonb, not null | shape depends on the section's `type` — a `rich_text` section's content is a doc blob, a `table` section's content is rows, etc. |
| — | | composite PK (minutes_id, section_id) — one content row per section per minutes record |

**`tags`** / **`meeting_tags`** — org-scoped tag catalog + join table, standard many-to-many.

**`clusters`** / **`cluster_meetings`** — a cluster is just a named group; membership computed by the tag-overlap job and stored as rows so "related minutes" is a simple join, not a live re-computation on every page load.

**`attendance`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| meeting_id | uuid FK → meetings | |
| user_id | uuid FK → users, **nullable** | null for external attendees |
| external_name | text, nullable | required if user_id is null |
| external_email | text, nullable | |
| present | boolean | |

TODO: exports
**`exports`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| minutes_id | uuid FK → minutes | |
| format | enum | `pdf` \| `docx` |
| file_key | text | object storage key, not the file itself |
| generated_at | timestamp | |

TODO: audit log
**`audit_log`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK → organizations | |
| actor_user_id | uuid FK → users | |
| entity_type | text | e.g. `minutes`, `role` |
| entity_id | uuid | |
| action | text | e.g. `update`, `override_after_lock` |
| diff | jsonb | before/after, or a change summary |
| created_at | timestamp | |

---

## 3. Multi-org / multi-team membership

This is entirely handled by `memberships` — nothing else needs to change to support it.

**Same user, multiple orgs**: two rows in `memberships` with the same `user_id`, different `org_id`. Each row has its own `role_id`, scoped to that row's org. A person can be an admin in Org A and have zero access in Org B just by not having a row there. Completely isolated — a query scoped to Org A's data never touches Org B's rows, so there's no leakage risk from this alone.

**Same user, same org, multiple teams**: multiple rows with the same `user_id` + `org_id`, different `team_id`. Example: one row with `team_id = NULL` (org-wide role, e.g. "Member") and another row with `team_id = <sub-committee id>` and a different role (e.g. "Team Lead" for that one sub-committee only). A person's _effective_ permission on a given team is the union of:

- their org-wide membership (`team_id IS NULL`), if any — applies everywhere in that org, and
- their team-specific membership for that exact team, if any.

**Resolving "can user U do action X on team T in org O"**:

```sql
select p.key
from memberships m
join role_permissions rp on rp.role_id = m.role_id
join permissions p on p.id = rp.permission_id
where m.user_id = :U
  and m.org_id = :O
  and (m.team_id = :T or m.team_id is null)
```

If `X` is in that result set, allow. This single query is the whole authorization check — no separate "is admin" flag anywhere, admin is just a role whose permission set happens to be broad.

---

## 4. Roles & permissions

- **Permissions are fixed** (a seeded catalog table) — the _behaviors_ the system knows how to gate are finite and defined in code (`approve_minutes`, `manage_roles`, etc.).
- **Roles are dynamic per org** — an org's admin creates roles and picks which permissions each role has. Nothing about role names or role count is hardcoded.
- **A role belongs to one org.** Two different orgs can both have a role called "Secretary" with completely different permission sets — they're different rows, no shared identity beyond the name string.
- **Assignment is via `memberships`**, scoped optionally to a team. This is also how "admin currently == the top role, separable later" works: initially you might have one very broad role assigned org-wide, and later split it into two roles with narrower permission sets — no schema change required, just new rows in `roles`/`role_permissions` and updated `memberships`.

---

## 5. Who administers what

Not a separate concept — it falls out of §3/§4 directly:

- **Org-level admin** = a person with a `memberships` row where `team_id IS NULL` and their role has permissions like `manage_roles`, `manage_members`, `manage_org`.
- **Team-level lead/secretary** = a person with a `memberships` row where `team_id = <that team>` and their role has permissions like `approve_minutes`, `edit_after_grace_period` — scoped to just that team, because the permission check in §3 only grants access when `team_id` matches or is null.
- **Per-meeting override** (README feature: a specific meeting can have its own owner distinct from the org/team default) — same pattern one level deeper: rather than adding a `meeting_id` to `memberships` (which would blow up the isolation model), this is better modeled as a `meeting_overrides` table: `(meeting_id, user_id, role_id)`, checked _before_ falling back to the team/org resolution in §3. Keeps the common case (org/team-scoped) cheap and only pays the extra join when a meeting actually has an override row.

---

## 6. Template format

Templates are **rows, not a JSON blob**: a `templates` row owns an ordered list of `template_sections` rows, each with a fixed `type` and a per-section `config` JSON — this is what makes "new templates without code changes" and "fully editable" both true at once, and it's what a **template builder UI** (drag/reorder sections, add/remove sections) actually manipulates: reordering writes new `order` values, adding a section inserts a row, editing a section's options patches its `config`. Non-technical admins never touch raw JSON.

A template with its sections looks like (rows shown as JSON for readability, not the storage format):

```json
{
  "template": { "id": "…", "name": "Standard Committee Meeting" },
  "sections": [
    { "id": "s1", "order": 0, "type": "meeting_info", "title": "Meeting Info", "config": null },
    { "id": "s2", "order": 1, "type": "attendance", "title": "Attendance", "config": null },
    { "id": "s3", "order": 2, "type": "agenda", "title": "Agenda Items", "config": { "columns": ["topic", "discussion", "decision"] } },
    { "id": "s4", "order": 3, "type": "signature", "title": "Approved By", "config": { "signer_labels": ["Chair", "Secretary"] } }
  ]
}
```

- `type` maps to a small, fixed set of renderable component types the frontend knows how to draw and edit: `meeting_info`, `attendance`, `agenda`, `rich_text`, `table`, `signature`. New _templates_ are just new arrangements/configs of these — no code change. A genuinely new `type` is a code change, but that's rare compared to arranging existing types into new templates.
- **Content lives per-section**, not as one big blob: each `minutes_sections` row is keyed by `(minutes_id, section_id)` and holds that one section's `content` jsonb. Rendering a minutes record is "walk this minutes' template's `template_sections` in `order`, join each to its `minutes_sections` row by `section_id`, render `content` per that section's `type`" — same code path for screen, PDF, and search-index text. This also makes partial-save and per-section audit/diffing cheap: editing the agenda section touches one row, not the whole document.
- **No versioning** — see the `ponytail:` note in §2 under `template_sections`. A meeting's minutes keep their `template_id` even if the template is edited later (adding/removing/reordering sections), so an edited template can, in principle, desync from minutes that already have `minutes_sections` content for a since-removed `section_id`. This is accepted for now (see §8) on the same YAGNI logic as the rest of §2 — admins are expected to duplicate a template before making a breaking change to it, not edit shared templates out from under live minutes.
- **Freeform minutes** (no template, `minutes.template_id` null): there's no `template_sections` row to key `minutes_sections.section_id` off of, since that column is part of the composite primary key and can't be null. This is an open gap, not a solved case — see §8.

---

## 7. Minutes → PDF pipeline

```
template_sections (ordered) + minutes_sections (content per section)
        │
        ▼
  render to HTML  (server-side — walk schema, fill content, standard HTML/CSS template)
        │
        ▼
  headless Chromium (Puppeteer / Playwright)  →  PDF bytes
        │
        ▼
  upload to object storage  →  exports row (file_key)
        │
        ▼
  bulk email job attaches file_key's object automatically
```

- **HTML as the intermediate format** — not a direct JSON→PDF library — because you get print-quality CSS (page breaks, headers/footers, Devanagari font rendering) for free, and the exact same render path can be reused for the in-browser preview before export. One rendering code path, two consumers (screen preview, PDF).
- **DOCX export** (if needed alongside PDF) uses a separate path — `docx` npm library generating from the same `schema` + `content`, not a PDF→DOCX conversion (those are always lossy). Two renderers off one data model, not one format converted to the other.
- **Bilingual/Devanagari rendering**: the headless-Chromium approach handles this for free as long as the container has the right fonts installed (e.g. Noto Sans Devanagari) — this is an infra/Docker concern (`ponytail:` add the font package to the Dockerfile when this becomes real; ceiling is font licensing/availability, not a code problem).
- **Generation timing**: on-demand (user clicks export) is the lazy default. Only pre-generate at approval time if bulk-export/bulk-email volume makes on-demand generation too slow in practice — don't build a background job queue for this until the numbers actually justify it.

---

## 8. Open implementation questions

Carried over / sharpened from the README's open questions, now that they're schema-shaped decisions:

- **Freeform minutes storage** (§6) — `minutes_sections.section_id` is part of a composite PK, so it can't be null, which means a template-less minutes record currently has nowhere to put content. Options: (a) a small set of implicit "virtual" template_sections seeded per org for freeform use, (b) a nullable `minutes.content` column that's only used in the freeform case, sitting alongside `minutes_sections` for the templated case, or (c) require every org to have a default minimal template and drop "freeform" as a concept. Needs a decision before freeform meetings are implemented.
- **`meeting_overrides`** (§5) — confirm this is the right shape vs. just allowing `memberships.team_id` to reference a meeting too (would require `memberships` to know about two different parent types — messier; the separate-table approach above is recommended).
- **External members with accounts** — if "yes" (per README open question), they get a normal `users` row + `memberships` row with a deliberately narrow role. If "no," `attendance.external_name/email` (already in the schema above) is sufficient and no `users` row is created.
- **Permission catalog growth** — is the fixed `permissions` table enough, or will custom-permission-per-org ever be needed? Recommend staying fixed until an actual use case demands otherwise (YAGNI).
- **Clustering computation** — `cluster_meetings` as stored rows (this doc) assumes a background job recomputes clusters periodically or on tag change, rather than computing tag-overlap live on every request. Worth confirming that tradeoff (staleness vs. query cost) before building the tagging milestone.
