# Software Requirements Specification — Minutes Management System

**Status:** Draft, pre-development. Derived from `README.md` (requirements) and `DESIGN.md` (schema/architecture) as of this writing. Where those two disagree with the schema in `db/schema/`, the schema wins and the doc has been flagged.

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Functional Requirements](#3-functional-requirements)
4. [External Interface Requirements](#4-external-interface-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Data Requirements](#6-data-requirements)
7. [Open Issues / Unresolved Requirements](#7-open-issues--unresolved-requirements)
8. [Traceability](#8-traceability)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the functional and non-functional requirements for the Minutes Management System, a template-based meeting-minutes platform. It is written for the development team building the system and for reviewers evaluating the design before implementation starts.

### 1.2 Scope

The system lets an organization made of teams/committees/sub-committees:

- run meetings against reusable, admin-defined **templates**, or without one (freeform);
- track **attendance**, including external (non-member) participants;
- enforce **role-based access control** with custom, per-org roles rather than hardcoded job titles;
- **tag and cluster** meetings by topic so related history surfaces automatically;
- **schedule** meetings and send email invites/reminders;
- **bulk-export** minutes to PDF/DOCX and bulk-email them;
- **search** minutes, bounded by the searching user's role scope;
- generate a structured **agenda** from rough notes; and
- store content in **multiple languages** as a first-class concern.

It is designed to run for a single organization or as multi-tenant SaaS serving several independent organizations, each fully isolated.

Out of scope for this document: hosting/infra choice, auth provider choice, and any UI visual design — these are implementation decisions not yet made (see `README.md` → Tech Stack).

### 1.3 Definitions

| Term | Meaning |
|---|---|
| Org | An `organizations` row — top-level tenant boundary. |
| Team | A committee or sub-committee (`teams`), self-nestable under a parent team. |
| Template | An ordered set of typed sections (`templates` + `template_sections`) that a meeting's minutes are drafted against. |
| Section | One typed, configurable block within a template (`meeting_info`, `attendance`, `agenda`, `rich_text`, `table`, `signature`). |
| Minutes | The record of what happened in one meeting; one per meeting, optionally following a template. |
| Freeform minutes | Minutes with no template (`minutes.template_id IS NULL`). |
| Membership | A `(user, org, team?, role)` row — how access is granted; see §6. |
| Grace period | The window after a meeting during which the assigned owner can still edit its minutes before they lock. |
| Cluster | A group of meetings whose tag overlap crosses a configured threshold. |

### 1.4 References

- `README.md` — product requirements, features, NFRs, open questions, roadmap.
- `DESIGN.md` — storage architecture, entity/schema reference, permission-resolution query, minutes→PDF pipeline.
- `db/schema/` — Drizzle schema, source of truth for the data model when it and `DESIGN.md` disagree.

---

## 2. Overall Description

### 2.1 Product perspective

New system, not a replacement for an existing internal tool. It must be deployable either as one instance per organization or as a shared multi-tenant instance — this is a deployment choice, not two different codebases, so tenant isolation (§5, NFR-8) is a hard requirement rather than a nice-to-have.

### 2.2 User classes

The system does not hardcode user classes; access is entirely a function of the permissions attached to a user's assigned role(s) (§3.2, §6). Typical role shapes an org is expected to configure (not fixed in code):

- **Org admin** — `manage_roles`, `manage_members`, `manage_org`, usually org-wide (`team_id IS NULL`).
- **Team lead / secretary** — `approve_minutes`, `edit_after_grace_period`, scoped to one team.
- **Contributor** — `create_minutes`, scoped to one team.
- **Read-only / auditor** — a `search_scope:*` permission with no write permissions.
- **External participant** — attendance-only, no account, unless the org opts into granting a restricted role (open question, §7).

### 2.3 Constraints

- Stack is fixed for v1: Bun, Next.js, PostgreSQL (Drizzle ORM), object storage (S3-compatible) for generated files only — see `DESIGN.md` §1.
- Minute content and all structured records live in Postgres; only generated binaries (PDF/DOCX exports, uploaded logos) go to object storage.
- Templates and their sections are data (rows), not code — adding a template must never require a deploy.

### 2.4 Assumptions and dependencies

- An external auth provider supplies `auth_provider_id` for `users`; the system does not implement its own credential store.
- Reliable outbound email delivery is available for invites, reminders, and bulk-export attachments (NFR-7).
- A headless-Chromium-capable environment is available for the PDF export pipeline (`DESIGN.md` §7).

---

## 3. Functional Requirements

Each requirement has an ID, a one-line statement, and the schema/design section it depends on. Priority: **M**ust (core build, per README roadmap) or **S**hould (next sprint / stretch).

### 3.1 Templates & minutes (FR-1.x)

| ID | Requirement | Priority | Depends on |
|---|---|---|---|
| FR-1.1 | An admin (role with `manage_templates`) can create a template as an ordered list of typed sections, each with a `title` and section-specific `config`, without a code change or deploy. | M | `templates`, `template_sections` |
| FR-1.2 | An admin can reorder, add, remove, and reconfigure a template's sections at any time. | M | `template_sections.order`, `.config` |
| FR-1.3 | A user with `create_minutes` can start minutes against any template visible to their org/team, or with no template (freeform). | M | `meetings.template_id`, `minutes.template_id` |
| FR-1.4 | Minutes content is captured **per section**: each `(minutes, template_section)` pair has its own content record, editable independently of other sections. | M | `minutes_sections` |
| FR-1.5 | Editing a template after minutes already exist against it must not corrupt or retroactively change those minutes' recorded content. Since templates are unversioned by design, this is achieved by admins duplicating a template before making breaking changes, not by the system auto-versioning. | M | `DESIGN.md` §2, §6 |
| FR-1.6 | The system must support minutes that deviate from their template (extra ad-hoc content) without breaking export or search. | S | Open — see §7 |
| FR-1.7 | Freeform (template-less) minutes must have a defined place to store their content. **Currently unresolved** — `minutes_sections.section_id` cannot be null (composite PK), so there is no schema-backed home for freeform content yet. | M | §7 open issue |

### 3.2 Roles & access control (FR-2.x)

| ID | Requirement | Priority | Depends on |
|---|---|---|---|
| FR-2.1 | An org admin can create custom roles, each a name plus a chosen subset of a fixed permission catalog (`create_minutes`, `approve_minutes`, `manage_roles`, `search_scope:*`, etc.). | M | `roles`, `permissions`, `role_permissions` |
| FR-2.2 | A role belongs to exactly one org; two orgs' roles never share identity beyond the name string. | M | `roles.org_id` |
| FR-2.3 | A user can hold different roles in different orgs, and different roles in different teams within the same org (including one org-wide role plus per-team overrides), via independent `membership` rows. | M | `memberships`, `DESIGN.md` §3 |
| FR-2.4 | Every access decision (view/edit/approve/export/search) is resolved by unioning a user's org-wide membership (if any) with their team-specific membership for the team in question — no separate hardcoded "is admin" flag. | M | `DESIGN.md` §3 authorization query |
| FR-2.5 | A specific meeting or sub-team can have an owner/secretary distinct from the org/team default, without granting that person broader access. | S | `meeting_overrides` (proposed, not yet in schema — §7) |
| FR-2.6 | Role names are renameable per org without affecting the underlying permission set. | S (next sprint, per roadmap) | `roles.name` |

### 3.3 Meetings, scheduling & attendance (FR-3.x)

| ID | Requirement | Priority | Depends on |
|---|---|---|---|
| FR-3.1 | A user with the right permission can schedule a meeting under an org and, optionally, a team, picking a template at scheduling time. | M | `meetings`, `meeting_teams` |
| FR-3.2 | The system sends email invites and reminders for scheduled meetings. | M | NFR-7 |
| FR-3.3 | Attendance is recorded per meeting for both system users and external (non-account) attendees. | M | `attendance` — **note:** current schema (`meeting_id`, `user_id` composite PK) only supports user attendees; external-attendee fields described in `DESIGN.md` are not yet in `db/schema/attendance.ts` (§7). |
| FR-3.4 | A meeting can be marked as a continuation of a prior meeting. | S | `meetings.continuation_of` |

### 3.4 Approval & immutability (FR-4.x)

| ID | Requirement | Priority | Depends on |
|---|---|---|---|
| FR-4.1 | Minutes have a `draft` / `published` status; only a role with `approve_minutes` can publish. | M | `minutes.status` |
| FR-4.2 | After a configurable grace period from `meetings.grace_period_ends_at`, the assigned owner's write access is automatically revoked; only a role with an explicit override permission (e.g. `edit_after_grace_period`) can still mutate. | M | `meetings.grace_period_ends_at` |
| FR-4.3 | Every edit, approval, and post-grace-period override is logged with actor, timestamp, and a before/after diff. | M | `audit_log` — **not yet in `db/schema/`**, table is TODO in `DESIGN.md` (§7). |

### 3.5 Tagging, clustering & search (FR-5.x)

| ID | Requirement | Priority | Depends on |
|---|---|---|---|
| FR-5.1 | A meeting can be tagged with one or more org-scoped tags. | M | `tags`, `meeting_tags` |
| FR-5.2 | When tag overlap between meetings crosses a threshold, they are grouped into a cluster; the threshold's tunability (fixed vs. per-org) is an open question. | M | `clusters`, `cluster_meetings`; §7 |
| FR-5.3 | When a new meeting's tags cross that threshold against an existing cluster, related past minutes are surfaced to the person drafting it. | S | `cluster_meetings` |
| FR-5.4 | Search results are bounded by the searching user's `search_scope:*` permission (entire org vs. own team), enforced server-side — not just hidden in the UI. | M | FR-2.4, NFR-8 |
| FR-5.5 | Search supports filtering by attendee and by date range, in addition to tag/topic. | S | `attendance`, `meetings.scheduled_at` |

### 3.6 Export & agenda generation (FR-6.x)

| ID | Requirement | Priority | Depends on |
|---|---|---|---|
| FR-6.1 | Minutes can be exported on demand to PDF via server-side HTML rendering + headless Chromium. | M | `DESIGN.md` §7, `exports` (TODO table) |
| FR-6.2 | Minutes can be exported to DOCX via a separate renderer over the same template/content data (not a PDF→DOCX conversion). | S | `DESIGN.md` §7 |
| FR-6.3 | Bulk export can generate files for many minutes at once and attach each to a bulk email automatically. | S | `exports`, email delivery |
| FR-6.4 | Given rough, informally-written notes, the system generates a grammatically correct, structured agenda in the org's configured language(s). | S | Open — no schema/design yet (§7) |

### 3.7 Localization (FR-7.x)

| ID | Requirement | Priority | Depends on |
|---|---|---|---|
| FR-7.1 | UI, templates, and generated exports must render correctly in every language an org configures, including non-Latin scripts (e.g. Devanagari). | M | `DESIGN.md` §7 (font handling) |
| FR-7.2 | The data model must support multiple languages as first-class data. Whether that means one language per minutes record (tagged) or multiple language versions per record is unresolved (§7). | M | Open |

### 3.8 Bulk contact management (FR-8.x)

| ID | Requirement | Priority | Depends on |
|---|---|---|---|
| FR-8.1 | Email addresses for teams, sub-teams, and external participants can be bulk-imported and bulk-exported (CSV or similar). | S | No dedicated schema yet |

---

## 4. External Interface Requirements

### 4.1 User interface

Web application (Next.js), accessed via browser at a deployment-configured URL. Template authoring is a drag-and-drop builder — admins never hand-edit JSON (FR-1.1, `DESIGN.md` §6).

### 4.2 Software interfaces

| Interface | Purpose |
|---|---|
| PostgreSQL (via Drizzle) | All structured/relational data (§6). |
| S3-compatible object storage | Generated PDF/DOCX exports, uploaded logos/attachments. DB stores a `file_key`, never the bytes. |
| Email delivery provider | Invites, reminders, bulk-export attachment delivery. Provider not yet chosen. |
| External auth provider | User identity/login (`users.auth_provider_id`). Provider not yet chosen. |
| Headless Chromium (Puppeteer/Playwright) | HTML → PDF rendering for exports. |

### 4.3 Communications interfaces

Standard HTTPS for the web app and API routes; outbound SMTP or an email API for notifications.

---

## 5. Non-Functional Requirements

Restated from `README.md` with the acceptance angle made explicit.

| ID | Requirement | Acceptance signal |
|---|---|---|
| NFR-1 | Data durability | A failed export or crashed email job never loses the underlying minutes/attendance record; only the derived artifact (PDF, email) needs a retry. |
| NFR-2 | Auditability | Every edit/approval/override has a corresponding `audit_log` row with actor, action, and diff (FR-4.3). |
| NFR-3 | Localization | Sorting, date formats, and font rendering are correct per-language, not just translated strings. |
| NFR-4 | Bulk contact import/export | CSV round-trip for team/external-participant email lists works without manual per-row entry. |
| NFR-5 | Post-grace-period immutability | Write attempts by the (former) owner past `grace_period_ends_at` are rejected server-side, not just hidden in the UI. |
| NFR-6 | Scalable tag clustering | Clustering stays responsive as meeting history grows over years — implies clusters are precomputed/stored (`cluster_meetings`), not recomputed live per request (`DESIGN.md` §8). |
| NFR-7 | Scheduling-window availability | Invite/reminder delivery has retry/backoff; failures are surfaced, not silently dropped. |
| NFR-8 | Role- and tenant-scoped data isolation | A scoped query never returns another team's or another org's rows, even via guessed IDs/URLs — enforced by always filtering on `org_id`/`team_id` from the resolved membership server-side, never a client-supplied value (`AGENTS.md`). |
| NFR-9 | Stable export format | Exported PDF/DOCX remain readable independent of which system version generated them. |
| NFR-10 | Low operational burden | Backup/update/maintenance procedures are simple enough for non-specialist staff. |
| NFR-11 | Multi-tenancy readiness | Roles, templates, tags, and data are isolated per org by default in a shared deployment (same mechanism as NFR-8, applied at the org boundary). |

---

## 6. Data Requirements

Full entity list and column-level detail live in `DESIGN.md` §2 — not duplicated here to avoid the two docs drifting apart again. Summary of the core relationships this SRS's functional requirements depend on:

- `organizations` → `teams` (self-nesting) → `memberships` (user × org × team × role) — the whole access-control model (§3.2) rests on this one join, no separate admin flag.
- `templates` → `template_sections` (ordered, typed) — the whole template model (§3.1); no version table exists by design (FR-1.5).
- `meetings` → `minutes` (shares `meetings.id` as its PK) → `minutes_sections` (content per section, composite PK) — how a meeting's content is actually stored (FR-1.4).
- `tags`/`meeting_tags` and `clusters`/`cluster_meetings` — the clustering model (§3.5).
- Tables referenced in requirements above but **not yet present** in `db/schema/`: `exports`, `audit_log`, `meeting_overrides`. These are marked TODO in `DESIGN.md` and block FR-4.3, FR-6.1, FR-6.3, FR-2.5 respectively until added.

---

## 7. Open Issues / Unresolved Requirements

Carried from `README.md` → Open Questions and `DESIGN.md` §8, plus one this SRS surfaced:

- **Freeform minutes storage** — no schema-backed place for content when `minutes.template_id` is null, since `minutes_sections.section_id` can't be null (composite PK). Blocks FR-1.7. Needs a decision (virtual sections / a fallback content column / require a minimal default template) before freeform meetings can be implemented.
- **External participants** — full accounts vs. attendee-only records: configurable per org, or one fixed policy? Affects FR-3.3.
- **Tag-overlap threshold** — fixed constant vs. per-org configurable. Affects FR-5.2.
- **Post-grace-period edits** — should admin overrides still be logged, given the point of the grace period is immutability? (Leaning yes, per NFR-2 — but not confirmed.)
- **Template authoring** — restricted to `manage_templates` only, or can any team lead define their own?
- **Clustering scope** — global per org, scoped per sub-team, or cross-org in SaaS mode?
- **Language storage shape** — one language per minutes record (tagged) vs. multiple language versions per record. Affects FR-7.2.
- **Agenda generator scope** — single configured language, or auto-detect/structure whichever language(s) the input notes are in?
- **Role presets** — should the system ship default role templates ("Admin," "Team Lead," "Member") an org can start from and rename, instead of a blank permission set?
- **`meeting_overrides` shape** — separate table (recommended in `DESIGN.md`) vs. extending `memberships` to reference a meeting.

None of these block the core data model or roadmap's first milestones, but each should be resolved before the feature it blocks is built, per the FR table above.

---

## 8. Traceability

| Feature area (README) | FR IDs | Primary schema |
|---|---|---|
| Template-based minutes, freeform handling | FR-1.1–1.7 | `templates`, `template_sections`, `minutes`, `minutes_sections` |
| Custom roles & RBAC | FR-2.1–2.6 | `roles`, `permissions`, `role_permissions`, `memberships` |
| Scheduling, attendance | FR-3.1–3.4 | `meetings`, `meeting_teams`, `attendance` |
| Approval / immutability / audit | FR-4.1–4.3 | `minutes.status`, `meetings.grace_period_ends_at`, `audit_log` (TODO) |
| Clustering, search | FR-5.1–5.5 | `tags`, `meeting_tags`, `clusters`, `cluster_meetings` |
| Export, agenda generator | FR-6.1–6.4 | `exports` (TODO), rendering pipeline (`DESIGN.md` §7) |
| Localization | FR-7.1–7.2 | Not yet schema-backed |
| Bulk contact import/export | FR-8.1 | Not yet schema-backed |
