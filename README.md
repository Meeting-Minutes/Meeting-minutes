# Minutes Management System

> Status: **Planning / pre-development.** Nothing is built yet — this document describes the intended system so the design can be reviewed and refined before implementation starts.

A template-based meeting minutes management system for **any organization made of departments, committees, or teams** — universities, companies, NGOs, government offices. It replaces ad-hoc minute-taking (scattered docs, manual emailing, no searchable history) with a structured, permission-aware system that still leaves room for minutes that don't fit any template.

Originally scoped to a single university department, the design is now **organization-agnostic**: any group that runs recurring meetings and wants a searchable, role-controlled minutes archive can deploy it — with no assumptions baked in about who the roles are or what they're called.

## Table of Contents

- [Why this exists](#why-this-exists)
- [Core concepts](#core-concepts)
- [Roles & Permissions](#roles--permissions)
- [Search](#search)
- [Features](#features)
- [Non-Functional Requirements](#non-functional-requirements)
- [Open Questions](#open-questions)
- [Roadmap](#roadmap)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

## Why this exists

Any organization that runs recurring and one-off meetings — departmental, sub-committee, cross-team — produces minutes that need to be drafted, approved, distributed, and referenced later. That process is usually manual and undiscoverable. This system aims to:

- Standardize minutes around **templates**, without forcing every meeting into the same mold.
- Make **who can see/edit/search what** explicit and configurable, instead of hardcoded.
- Make related meetings (by topic) **discoverable** instead of buried in old emails.
- Handle the boring-but-critical parts: attendance, scheduling, bulk email, bulk export.
- Work for **one organization or many** — a single department, or a SaaS deployment serving several independent organizations, each with their own roles, templates, and data boundaries.

## Core concepts

### Template-based minutes

Meetings are drafted against a **minutes template**, and templates are meant to be easy to add — new meeting types shouldn't require code changes to get a usable template. Not every meeting fits a template cleanly, so the system needs to support **deviations from a template** (extra sections, freeform notes) without breaking exports or search.

### Tagging & clustering

Every meeting gets tagged by topic/domain. When tag overlap between meetings crosses a set threshold, those meetings are grouped into a cluster. When a _new_ meeting's tags cross that same threshold against an existing cluster, the system surfaces the related past minutes to whoever is drafting — so decisions/history aren't reinvented or contradicted meeting to meeting.

### Multi-language by design

The system is built to hold content in multiple languages as first-class data, not English-with-a-translation-bolted-on. Which languages matter is a per-deployment choice (e.g. an org could run English-only, or English + a local language), but the data model — templates and stored minutes — supports multiple languages or per-record language tagging from the start.

### Agenda generator

Given rough, informally-written notes, the system drafts a grammatically correct, well-structured agenda in the organization's configured language(s). This turns a scribbled point list into a properly formatted agenda ready to attach to a meeting, instead of someone hand-editing it into shape every time.

## Roles & Permissions

Roles are **not hardcoded**. Instead of a fixed set of named roles baked into the system, an admin defines **custom roles**, each of which _has_ a set of permissions — rather than the system assuming a role _is_ a fixed job title. This is what makes the system usable outside a single department: "Secretary," "Committee Lead," "Department Head," "HOD," or whatever an organization calls its people are just role names an admin creates and configures, not concepts wired into the code.

- **Role = name + a set of permissions**, e.g. `create_minutes`, `approve_minutes`, `edit_after_grace_period`, `manage_templates`, `manage_members`, `search_scope:own_committee`, `search_scope:entire_org`, `export_minutes`, `manage_roles`.
- **Roles are assignable per person, per scope** — a person can hold one role department-wide and a different (or no) role in a specific sub-committee or meeting.
- **Scoped ownership**: any meeting or sub-committee can have its own designated owner/secretary role, distinct from the organization-wide admin, without granting that person org-wide access.
- **Renaming**: role _names_ are cosmetic and organization-specific ("Secretary" vs "Coordinator" vs "Registrar") — the underlying permission set is what the system actually enforces. (Renaming custom roles is planned for the next sprint; see [Roadmap](#roadmap).)
- **Org admin**: at least one role in each organization must hold `manage_roles` and `manage_members` — this is the bootstrap admin. Nothing else about "admin" is assumed to be permanent or singular; an organization can have several admin-equivalent roles if it wants.
- **External participants**: people attending specific meetings from outside the organization can be recorded as attendee metadata without needing a system account, or granted a restricted role — this is deployment-configurable rather than fixed. _(See [Open Questions](#open-questions).)_

Access is enforced per meeting, per minute, and per organization — a person only sees/edits/searches what their assigned role's permissions and scope allow.

## Search

Search results are bounded by the searching user's role and scope, not by a single global permission level:

- A role with organization-wide search permission (e.g. an admin role) can search across the entire system.
- A role scoped to a specific committee or sub-committee can only search within that committee's meetings and minutes — even by guessing IDs or URLs.
- Search scope is a permission like any other (`search_scope:own_committee`, `search_scope:own_department`, `search_scope:entire_org`), so it's configurable per custom role rather than hardcoded to a job title.

On top of scope, search supports **filters**:

- **Attendees** — find minutes where a specific person was present.
- **Time frame** — restrict results to a date range.
- (Existing) tag/topic filtering, via the clustering system above.

## Features

1. Template-based minute creation, with easy addition of new templates and graceful handling of non-template ("freeform") minutes.
2. **Custom roles** — admin defines roles and assigns permissions per role, instead of the system hardcoding a fixed set of job titles.
3. Role-based access control, scoped per organization, per meeting, and per minute — not just a single global permission level.
4. Meeting clustering by topic, so related meetings are linked rather than siloed.
5. Support for external (outside-organization) meeting participants.
6. Meeting **scheduling**, including an emailing/notification mechanism for invites and reminders.
7. Tag-based similarity detection: meetings sharing enough tags are grouped, and future meetings crossing that threshold surface related past minutes.
8. **Attendance tracking** per meeting.
9. Per-meeting/per-committee role overrides — any meeting or sub-team can have its own designated owner, distinct from an organization-wide admin.
10. **Sub-committee / sub-team support** — each has its own assignable roles, with minutes and access scoped accordingly.
11. **Bulk export** of minutes using a pre-designed export template, with content injected automatically (attendees, agenda, decisions, etc.), and the exported file attached automatically to bulk emails.
12. **Multi-language support** as a first-class, per-deployment-configurable data model concern — not an English-only system with translation added later.
13. **Agenda generator** — turns rough/informal input into a grammatically correct, properly structured agenda in the organization's configured language(s).
14. **Scoped search with filters** — search boundary depends on the searcher's role (entire system vs. own committee), with filtering by attendees and time frame.

## Non-Functional Requirements

1. **Data durability** — Minutes and attendance records must never be silently lost, even on failed exports or crashed email jobs. Once approved, a minute should be as safe as an official record.
2. **Auditability** — Every edit, approval, and admin override (especially post-grace-period ones) should be logged with who/when/what changed. This matters more here than in a typical CRUD app since minutes are quasi-legal records.
3. **Localization** — UI, templates, and generated content must render correctly in every language an organization configures (including non-Latin scripts), covering sorting, date formats, and font rendering — not just string translation.
4. **Bulk contact import/export** — Email addresses for committees, sub-teams, and external participants can be bulk-imported/exported (CSV or similar), so lists don't have to be built one contact at a time.
5. **Post-grace-period immutability** — After a configurable grace period (e.g. 5–7 days), only roles with an override permission can mutate a meeting's minutes; the assigned owner loses write access automatically.
6. **Scalable tag clustering** — Tag-overlap clustering must stay responsive as the number of meetings grows over years of history, not just for a small pilot dataset.
7. **Availability during scheduling windows** — Email/scheduling delivery should be reliable enough that invites and reminders aren't silently dropped, since meeting turnout depends on it.
8. **Role-scoped data isolation** — A role scoped to one committee/organization should never see or accidentally query another committee's or organization's private minutes, even by URL/ID guessing. This includes isolation **between organizations** if the system is deployed as multi-tenant SaaS.
9. **Exportable in a stable format** — Bulk-exported minutes should use a template format (e.g. PDF/DOCX) that stays readable and printable for years, independent of which version of the system generated it.
10. **Low operational burden** — Backups, updates, and routine maintenance should be simple enough for non-specialist staff (not dedicated IT) to keep running.
11. **Multi-tenancy readiness** — If deployed as SaaS across multiple organizations, each organization's roles, templates, tags, and data must stay fully isolated by default.

## Open Questions

Things flagged during planning that need a decision before/while building:

- **External participants**: full accounts with login, or attendee-only records with no system access — configurable per organization, or one fixed policy?
- **Tag-overlap threshold**: fixed constant, or configurable per-organization/per-admin?
- **Post-grace-period edits**: should admin overrides be logged/audited given the whole point of the grace period is immutability?
- **Template authoring**: who can create/edit templates by default — only a role with `manage_templates`, or can any sub-team lead define their own?
- **Clustering scope**: are clusters global across an organization, or can they be scoped per sub-committee? And across organizations in a SaaS deployment, or always tenant-isolated?
- **Language storage**: are minutes stored in one language per record (with a language tag), or should each minute hold multiple language versions?
- **Agenda generator scope**: single configured language, or should it detect and structure whichever language(s) the input is in?
- **Role templates**: should the system ship default role presets (e.g. "Admin," "Committee Lead," "Member") that an org can rename/adjust, so new organizations aren't starting from a blank permission set?

If you have opinions on any of these, open an issue — the design is still fluid.

## Roadmap

### Core build

- [ ] Finalize data model (organizations, meetings, minutes, templates, tags, roles, permissions)
- [ ] Custom-role & permission engine (define roles, assign permissions, scope roles per org/committee/meeting)
- [ ] Template engine (creation + rendering + freeform fallback)
- [ ] Tagging + clustering + related-minutes surfacing
- [ ] Scheduling + email notifications
- [ ] Attendance module
- [ ] Bulk import/export (contacts + minutes)
- [ ] Edit-lock/grace-period enforcement
- [ ] Scoped search with attendee and time-frame filters
- [ ] Localization framework (UI + stored content, multi-language)
- [ ] Agenda generator (raw notes → structured agenda)

### Next sprint

- [ ] Export/print feature for minutes
- [ ] Fully working end-to-end prototype
- [ ] Custom roles: support renaming roles and permission labels per organization

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Next.js](https://nextjs.org)
- **Database**: [PostgreSQL](https://www.postgresql.org), run via [Docker Compose](https://docs.docker.com/compose/) for local dev
- **ORM**: [Drizzle](https://orm.drizzle.team) (schema + migrations via `drizzle-kit`)

Nothing beyond this is decided yet (hosting, email delivery, auth provider, etc.) — those will be filled in as they're chosen.

## Contributing

This project is in early design. Feedback on the requirements above — especially the [Open Questions](#open-questions) — is welcome before implementation begins.
