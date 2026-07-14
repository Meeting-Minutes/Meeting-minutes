# DoECE Minutes Management System

> Status: **Planning / pre-development.** Nothing is built yet — this document describes the intended system so the design can be reviewed and refined before implementation starts.

A template-based meeting minutes management system for the **Department of Electronics and Computer Engineering (DoECE), Pulchowk Campus**. It replaces ad-hoc minute-taking (scattered docs, manual emailing, no searchable history) with a structured, role-aware system that still leaves room for minutes that don't fit any template.

## Table of Contents

- [Why this exists](#why-this-exists)
- [Core concepts](#core-concepts)
- [Roles & Access](#roles--access)
- [Features](#features)
- [Non-Functional Requirements](#non-functional-requirements)
- [Open Questions](#open-questions)
- [Roadmap](#roadmap)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

## Why this exists

The department runs many recurring and one-off meetings — departmental, sub-committee, and cross-committee — each producing minutes that need to be drafted, approved, distributed, and referenced later. Today that process is manual and undiscoverable. This system aims to:

- Standardize minutes around **templates**, without forcing every meeting into the same mold.
- Make **who can see/edit what** explicit instead of implicit.
- Make related meetings (by topic) **discoverable** instead of buried in old emails.
- Handle the boring-but-critical parts: attendance, scheduling, bulk email, bulk export.

## Core concepts

### Template-based minutes
Meetings are drafted against a **minutes template**, and templates are meant to be easy to add — new committees or meeting types shouldn't require code changes to get a usable template. Not every meeting fits a template cleanly, so the system needs to support **deviations from a template** (extra sections, freeform notes) without breaking exports or search.

### Tagging & clustering
Every meeting gets tagged by field/domain. When tag overlap between meetings crosses a set threshold, those meetings are grouped into a cluster. When a *new* meeting's tags cross that same threshold against an existing cluster, the system surfaces the related past minutes to whoever is drafting — so decisions/history aren't reinvented or contradicted meeting to meeting.

### Bilingual by design (Nepali + English)
Nepali and English are both first-class languages — not English with a translation bolted on later. This affects the data model (templates and stored minutes need to hold both, or be taggable by language), not just the UI strings.

### Agenda generator
Given rough, informally-written notes (in Nepali, English, or mixed), the system drafts a grammatically correct, well-structured agenda — primarily in Nepali. This turns a scribbled point list into a properly formatted agenda ready to attach to a meeting, instead of someone hand-editing it into shape every time.

## Roles & Access

- **Secretary** — one department-wide secretary. Also the default **admin**, for now (see below).
- **Member secretaries** — multiple; assist across meetings.
- **Per-meeting secretary** — a meeting can have its own designated secretary/admin, distinct from the department secretary. This is how sub-committees and one-off meetings get scoped ownership without giving out department-wide admin.
- **Sub-committees** — each has its own leader and its own secretary, operating semi-independently within the system.
- **External members** — participants from outside the department who attend specific meetings. *(Open question: do they get accounts, or are they just recorded attendee metadata? See [Open Questions](#open-questions).)*
- **Admin** — currently == the department secretary, but this is explicitly **not permanent**; RBAC is designed so admin can be split out from the secretary role later without restructuring permissions.

Access is role-based per meeting and per minute — a member secretary or sub-committee lead only sees/edits what their role and meeting scope allow.

## Features

1. Template-based minute creation, with easy addition of new templates and graceful handling of non-template ("freeform") minutes.
2. One secretary + multiple member secretaries per department.
3. Admin currently equals the secretary; role is separable later.
4. Role-based access control, scoped to specific meetings and minutes — not just a single global permission level.
5. Meeting clustering by topic, so related meetings are linked rather than siloed.
6. Support for external (non-department) meeting members.
7. Meeting **scheduling**, including an emailing/notification mechanism for invites and reminders.
8. Tag-based similarity detection: meetings sharing enough tags are grouped, and future meetings crossing that threshold surface related past minutes.
9. **Attendance tracking** per meeting.
10. Per-meeting admin/secretary override — a specific meeting can have its own designated secretary/admin distinct from the department-wide one.
11. **Sub-committee support** — each sub-committee has its own leader and secretary, with minutes and access scoped accordingly.
12. **Bulk export** of minutes using a pre-designed export template, with content injected automatically (attendees, agenda, decisions, etc.), and the exported file attached automatically to bulk emails.
13. **Nepali + English support** as primary languages throughout — not an English-only system with translation added later.
14. **Agenda generator** — turns rough/informal input (Nepali, English, or mixed) into a grammatically correct, properly structured agenda, primarily in Nepali.

## Non-Functional Requirements

1. **Data durability** — Minutes and attendance records must never be silently lost, even on failed exports or crashed email jobs. Once approved, a minute should be as safe as an official record.
2. **Auditability** — Every edit, approval, and admin override (especially post-grace-period ones) should be logged with who/when/what changed. This matters more here than in a typical CRUD app since minutes are quasi-legal records.
3. **Bilingual localization** — UI, templates, and generated content must render correctly in both Nepali (Devanagari) and English, including sorting, date formats, and font rendering — not just string translation.
4. **Bulk contact import/export** — Email addresses for committees, sub-committees, and external members can be bulk-imported/exported (CSV or similar), so lists don't have to be built one contact at a time.
5. **Post-grace-period immutability** — After a configurable grace period (5–7 days), only admin can mutate a meeting's minutes; the assigned secretary loses write access automatically.
6. **Scalable tag clustering** — Tag-overlap clustering must stay responsive as the number of meetings grows over years of departmental history, not just for a small pilot dataset.
7. **Availability during scheduling windows** — Email/scheduling delivery should be reliable enough that invites and reminders aren't silently dropped, since meeting turnout depends on it.
8. **Role-scoped data isolation** — A sub-committee secretary should never be able to see or accidentally query another sub-committee's or department's private minutes, even by URL/ID guessing.
9. **Exportable in a stable format** — Bulk-exported minutes should use a template format (e.g. PDF/DOCX) that stays readable and printable for years, independent of which version of the system generated it.
10. **Low operational burden** — Given this is run by department staff (not dedicated IT), backups, updates, and routine maintenance should be simple enough for a non-specialist secretary/admin to keep running.
11. **Batch users creation** - Provide a feature to the admin to add users in a batch providing batch user details in a CSV format. Also, per the committee , a secretary should have option to add guest members in batch.

## Open Questions

Things flagged during planning that need a decision before/while building:

- **External members**: full accounts with login, or attendee-only records with no system access?
- **Tag-overlap threshold**: fixed constant, or configurable per-department/per-admin?
- **Post-grace-period edits**: should admin overrides be logged/audited given the whole point of the grace period is immutability?
- **Template authoring**: who can create/edit templates — admin only, or can sub-committee leads define their own?
- **Clustering scope**: are clusters global across the department, or can they be scoped per sub-committee?
- **Language storage**: are minutes stored in one language per record (with a language tag), or should each minute hold both a Nepali and an English version?
- **Agenda generator scope**: is it Nepali-only output, or should it also clean up/structure English input into English agendas?

If you have opinions on any of these, open an issue — the design is still fluid.

## Tech Stack

|- Next.js v16.2
|- PostgreSQL v16
|- Docker v29.6
|- Docker Compose v5.3.1
|- Bun v1.3.14

## Contributing

This project is in early design. Feedback on the requirements above — especially the [Open Questions](#open-questions) — is welcome before implementation begins.
