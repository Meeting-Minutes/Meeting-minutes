# Export Document Assembly — stitching section JSONB for minutes export

> Audience: someone new to this codebase who needs to understand how a minutes
> record becomes one structured document ready for the PDF/DOCX engine.
> Companion code: [`lib/render-document.ts`](../lib/render-document.ts),
> [`lib/rich-text.ts`](../lib/rich-text.ts). Companion spec: `DESIGN.md` §6–§7.
>
> Naming note: the code type is called `RenderDocument` and lives in
> `render-document.ts`, but "render" here means *the document handed to the
> renderer*, **not** the act of drawing HTML. This module produces data only —
> the HTML/PDF rendering is a separate, later module (see §8).

---

## 1. What problem this solves

A meeting's minutes are **not** one blob of text. They are an ordered list of
**sections**, each of a fixed **type**, and each type stores its content in its
own shape:

| Section type   | What it holds                                  |
| -------------- | ---------------------------------------------- |
| `meeting_info` | label/value pairs (date, location, chair, …)   |
| `attendance`   | who attended and whether they were present     |
| `agenda`       | numbered rows across admin-defined columns     |
| `rich_text`    | formatted prose (bold, links, headings, …)     |
| `table`        | un-numbered rows across admin-defined columns  |
| `signature`    | signer blocks (label, optional name + date)    |

These live in the database across **two** tables (see `DESIGN.md` §2):

- **`template_sections`** — the *structure*: for each section, its `id`,
  `order`, `type`, `title`, and a `config` blob (e.g. which columns a table has).
  Owned by the template.
- **`minutes_sections`** — the *content*: for each `(minutes_id, section_id)`
  pair, a `content` JSONB holding what the secretary actually typed.

To export a minutes record, the PDF engine needs **one** self-contained,
already-validated document — not two tables it has to re-join, re-sort, and
re-trust at export time. Producing that one document is this module's whole job.

```
template_sections (structure, ordered)  ┐
                                         ├──► ONE export document (this module)
minutes_sections  (content per section) ┘
```

---

## 2. The two-layer JSONB model

There are **two levels** of JSONB, and keeping them straight is the key to the
whole design.

### Layer 1 — the per-section content contract (one per type)

Each of the 6 types has a **standard shape** for its content. These are the
`*Content` types in `render-document.ts`:

```ts
type MeetingInfoContent = { fields: { label: string; value: string }[] };
type AttendanceContent  = { attendees: { name: string; present: boolean; role?: string }[] };
type RowsContent        = { rows: Record<string, string>[] };   // agenda + table
type RichTextContent    = RichTextDoc;                          // reused from rich-text.ts
type SignatureContent   = { signatures: { label: string; name?: string; signedAt?: string }[] };
```

Every `minutes_sections.content` row is expected to match the contract for its
section's `type`. Nothing else is a valid content shape.

### Layer 2 — the envelope that stitches them together

Once each section's content is validated, they're wrapped — **in `order`** —
into the single document the engine consumes:

```ts
type RenderSection = {
  id: string;
  order: number;
  type: SectionType;
  title: string;
  content: SectionContent;   // the validated Layer-1 shape, tagged by type
};

type RenderDocument = {
  version: 1;                                 // pin the shape for the engine + migrations
  minutesId: string;
  status: "draft" | "published";
  meeting: { org: string; title: string; scheduledAt: string | null };
  sections: RenderSection[];                  // the individuals, in order
};
```

`SectionContent` is a **discriminated union** — the `type` field tells the
consumer which `data` shape to expect, so no guessing:

```ts
type SectionContent =
  | { type: "meeting_info"; data: MeetingInfoContent }
  | { type: "attendance";   data: AttendanceContent }
  | { type: "agenda";       data: AgendaContent; columns: Column[] }
  | { type: "rich_text";    data: RichTextContent }
  | { type: "table";        data: TableContent; columns: Column[] }
  | { type: "signature";    data: SignatureContent };
```

> Note: the individual per-section JSONBs are **not** merged/flattened into each
> other. They sit side-by-side in `sections[]`, each still tagged with its own
> `type`. That tag is what lets the future render step be a simple `switch`.

---

## 3. The flow, end to end

```
 minutes_sections.content        template_sections
 (untrusted, one per section)    (id, order, type, title, config)
            │                              │
            └──────────────┬───────────────┘
                           ▼
            assembleRenderDocument(input)          ◄── the one entry point
                           │
        for each section, sorted by `order`:
                           │
                           ▼
            validateSectionContent(type, raw, config)
                           │
                  ┌────────┴─────────┐
                  ▼                  ▼
             valid?  ── no ──►  throw RenderDocumentError   (stop — nothing partial escapes)
                  │ yes
                  ▼
     stitch the validated section into sections[]
                           │
                           ▼
                  ONE export document
                           │
                           ▼
         [ LATER, separate module, not here ]
         walk sections[] → HTML → headless Chromium → PDF   (DESIGN §7)
```

**In words:**

1. Each `template_section` is matched to its content from `minutes_sections`.
2. That content is **verified against its type's contract**.
3. If any section fails, the whole assembly throws — you never get a
   half-valid document.
4. If all pass, they're **stitched in `order`** into one export document.
5. That document is handed to the PDF engine (built separately, later).

---

## 4. The input and the entry point

The assembler takes exactly what a query over the two tables produces:

```ts
type TemplateSectionRow = { id: string; order: number; type: string; title: string; config: unknown };

type AssembleInput = {
  minutesId: string;
  status: "draft" | "published";
  meeting: { org: string; title: string; scheduledAt: string | null };
  sections: TemplateSectionRow[];             // template_sections rows
  contentBySectionId: Record<string, unknown>;// minutes_sections.content, keyed by section id
};

function assembleRenderDocument(input: AssembleInput): RenderDocument
```

`sections` is the structure; `contentBySectionId` maps each section's `id` to
its raw, **untrusted** content. Caller fetches both (scoped by `org_id`/`team_id`
per the membership — see `AGENTS.md`) and hands them in.

---

## 5. Why validation matters (the trust boundary)

`minutes_sections.content` is **client-supplied JSON**. It reached the database
from a browser, so at assembly time it is untrusted. `assembleRenderDocument`
is the **trust boundary**: everything downstream (the HTML render, the PDF) may
assume the document is well-formed *only because this step guaranteed it*.

What the validators enforce (all in `render-document.ts`):

| Guard                              | Where                          | Why                                             |
| ---------------------------------- | ------------------------------ | ----------------------------------------------- |
| Unknown section `type` rejected    | `assembleRenderDocument`       | only the 6 known types can render               |
| Missing content rejected           | `assembleRenderDocument`       | a section with no content is a data error       |
| Required fields are strings        | `asStr` / `optStr`             | a numeric `label` would break rendering         |
| `present` coerced to real boolean  | `attendance` branch            | `present === true`; anything else is `false`    |
| Rows keep **only declared columns**| `validateRows`                 | drops smuggled/extra keys — no trusting client  |
| `rich_text` delegated to its own validator | `rich-text.ts`         | href scheme allow-list, HTML escaping, etc.     |

On any violation the code calls `fail(msg)`, which throws
`RenderDocumentError`. The caller catches it and returns a validation error —
nothing partial is ever persisted or rendered.

> `rich_text` is special: this module does **not** re-implement its rules. It
> calls `validateRichText` from `lib/rich-text.ts`, which already handles the
> hard parts (blocking `javascript:` links, escaping HTML, gating which marks
> and heading levels the section's `config` allows). Errors from there surface
> as `RichTextError` rather than `RenderDocumentError` — both are thrown, both
> stop assembly; the distinction is just which layer caught it.

---

## 6. Where the tests live (and what they are)

`lib/render-document.check.ts` is a **self-check**, not part of the runtime.

- It is **not** the verifier. The real verification is
  `validateSectionContent` / `assembleRenderDocument` inside
  `render-document.ts`. The `.check.ts` file exists to *prove those work*.
- It feeds known-good and known-bad inputs to `assembleRenderDocument` and
  asserts it accepts the good and rejects the bad (unknown type, missing
  content, non-string label, undeclared columns, malformed rich_text, …).
- No test framework — plain `assert`-style checks, per `AGENTS.md`.

Run it:

```bash
bun run lib/render-document.check.ts     # -> "ok — 14 checks passed"
bun run lib/rich-text.check.ts           # the delegated validator's own checks
```

If either exits non-zero, the validation logic changed in a way that broke a
guarantee — read the `FAIL:` line it prints.

---

## 7. A worked example

**Template** (2 sections): an agenda with two columns, then a signature.

```jsonc
// template_sections rows
[
  { "id": "s1", "order": 1, "type": "agenda",    "title": "Agenda",   "config": { "columns": ["topic", "decision"] } },
  { "id": "s2", "order": 0, "type": "signature", "title": "Approved", "config": null }
]
// minutes_sections content, keyed by section id
{
  "s1": { "rows": [ { "topic": "Budget", "decision": "Approved", "junk": "ignore me" } ] },
  "s2": { "signatures": [ { "label": "Chair", "name": "Ana", "signedAt": "2026-07-21" } ] }
}
```

**Output** of `assembleRenderDocument` — note: sorted by `order` (signature
first), and the `junk` column dropped because it wasn't declared:

```jsonc
{
  "version": 1,
  "minutesId": "m1",
  "status": "draft",
  "meeting": { "org": "Acme", "title": "Q3 Review", "scheduledAt": "2026-07-20T10:00:00Z" },
  "sections": [
    {
      "id": "s2", "order": 0, "type": "signature", "title": "Approved",
      "content": { "type": "signature", "data": { "signatures": [ { "label": "Chair", "name": "Ana", "signedAt": "2026-07-21" } ] } }
    },
    {
      "id": "s1", "order": 1, "type": "agenda", "title": "Agenda",
      "content": {
        "type": "agenda",
        "columns": [ { "key": "topic", "label": "topic" }, { "key": "decision", "label": "decision" } ],
        "data": { "rows": [ { "topic": "Budget", "decision": "Approved" } ] }
      }
    }
  ]
}
```

That object is the deliverable — the single structured document the export
pipeline consumes.

---

## 8. Scope — what this module is and isn't

**Is:** the content contracts for all 6 section types, the `RenderDocument`
envelope, and `assembleRenderDocument` (validate + stitch).

**Isn't (built separately, later, by someone else):**

- HTML rendering of the document.
- The headless-Chromium (Playwright/Puppeteer) HTML → PDF step.
- The `exports` table / object-storage upload.
- DOCX export.

This module stops at the validated JSONB. The render/PDF code will import
`RenderDocument`, walk `sections[]`, and `switch` on each `content.type`. Because
assembly already validated everything, that code never has to re-check trust or
re-join tables — it just draws.

---

## 9. File map

| File                            | Role                                                         |
| ------------------------------- | ----------------------------------------------------------- |
| `lib/render-document.ts`        | contracts + envelope + `assembleRenderDocument` (this doc)   |
| `lib/render-document.check.ts`  | assert-based self-check for the above                       |
| `lib/rich-text.ts`              | the `rich_text` content model + its own validator (reused)  |
| `lib/rich-text.check.ts`        | self-check for the rich_text validator                      |
| `DESIGN.md` §6–§7               | template format + the minutes → PDF pipeline this feeds      |
