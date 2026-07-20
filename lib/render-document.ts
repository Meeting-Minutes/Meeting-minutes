// The canonical "render document": one structured JSONB the PDF/DOCX engine
// consumes, assembled from a template's ordered `template_sections` + the
// per-section `minutes_sections.content` (DESIGN §6/§7).
//
// Why a separate envelope instead of feeding the engine raw rows: the engine
// should walk ONE self-contained, already-validated document — not re-join
// tables, re-sort by `order`, or trust client JSON at render time. Assembly
// happens once (validating untrusted content at the trust boundary); rendering
// is then a pure, deterministic pass shared by screen preview and PDF.
//
// Each of the 6 section types has its own content contract below. `rich_text`
// reuses the existing model in ./rich-text — this file does not re-derive it.

import {
  validateRichText,
  renderRichText,
  escapeHtml,
  type RichTextDoc,
  type RichTextConfig,
} from "./rich-text";

export const SECTION_TYPES = [
  "meeting_info",
  "attendance",
  "agenda",
  "rich_text",
  "table",
  "signature",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

// --- per-section content contracts -----------------------------------------
// Each is the validated shape stored in minutes_sections.content for that type.

// meeting_info: flat label/value pairs (date, location, chair, …). No config.
export type MeetingInfoContent = { fields: { label: string; value: string }[] };

// attendance: one row per attendee; `present` drives the checkbox in the export.
export type AttendanceContent = {
  attendees: { name: string; present: boolean; role?: string }[];
};

// agenda / table: both are column-keyed rows. agenda numbers its rows; table
// does not. Columns come from the section's config so admins shape them without
// code (DESIGN §6). A cell missing from a row renders empty, not an error.
export type Column = { key: string; label: string };
export type RowsContent = { rows: Record<string, string>[] };
export type AgendaContent = RowsContent;
export type TableContent = RowsContent;

// rich_text: the ProseMirror-flavoured doc from ./rich-text, unchanged.
export type RichTextContent = RichTextDoc;

// signature: one block per signer; `name`/`signedAt` filled once actually signed.
export type SignatureContent = {
  signatures: { label: string; name?: string; signedAt?: string }[];
};

export type SectionContent =
  | { type: "meeting_info"; data: MeetingInfoContent }
  | { type: "attendance"; data: AttendanceContent }
  | { type: "agenda"; data: AgendaContent; columns: Column[] }
  | { type: "rich_text"; data: RichTextContent }
  | { type: "table"; data: TableContent; columns: Column[] }
  | { type: "signature"; data: SignatureContent };

export type RenderSection = {
  id: string;
  order: number;
  type: SectionType;
  title: string;
  content: SectionContent;
};

// The whole thing. `version` lets the engine and future migrations pin a shape.
export type RenderDocument = {
  version: 1;
  minutesId: string;
  status: "draft" | "published";
  meeting: { org: string; title: string; scheduledAt: string | null };
  sections: RenderSection[];
};

// The three inputs the assembler needs. `sections` mirrors template_sections
// rows; `contentBySectionId` mirrors the joined minutes_sections.content.
export type TemplateSectionRow = {
  id: string;
  order: number;
  type: string;
  title: string;
  config: unknown;
};
export type AssembleInput = {
  minutesId: string;
  status: "draft" | "published";
  meeting: { org: string; title: string; scheduledAt: string | null };
  sections: TemplateSectionRow[];
  contentBySectionId: Record<string, unknown>;
};

// --- validation (trust boundary) -------------------------------------------

export class RenderDocumentError extends Error {}
function fail(msg: string): never {
  throw new RenderDocumentError(msg);
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const asArray = (v: unknown, what: string): unknown[] =>
  Array.isArray(v) ? v : fail(`${what} must be an array`);
const asStr = (v: unknown, what: string): string =>
  typeof v === "string" ? v : fail(`${what} must be a string`);
// Optional string cell: absent/empty is fine, wrong type is not.
const optStr = (v: unknown, what: string): string | undefined =>
  v === undefined || v === null ? undefined : asStr(v, what);

// columns live in template_sections.config; admin-authored but still shape-checked.
function parseColumns(config: unknown): Column[] {
  if (!isObj(config)) fail("section config must be an object with `columns`");
  const cols = asArray(config.columns, "config.columns").map((c, i) => {
    // Accept both ["topic", …] shorthand and [{key,label}, …] full form.
    if (typeof c === "string") return { key: c, label: c };
    if (isObj(c)) return { key: asStr(c.key, `columns[${i}].key`), label: asStr(c.label ?? c.key, `columns[${i}].label`) };
    return fail(`columns[${i}] must be a string or {key,label}`);
  });
  if (!cols.length) fail("section needs at least one column");
  return cols;
}

// Rows keep only declared columns, coerced to strings — drops any smuggled keys.
function validateRows(raw: unknown, columns: Column[]): RowsContent {
  if (!isObj(raw)) fail("content must be an object with `rows`");
  const keys = new Set(columns.map((c) => c.key));
  const rows = asArray(raw.rows, "rows").map((r, i) => {
    if (!isObj(r)) fail(`rows[${i}] must be an object`);
    const row: Record<string, string> = {};
    for (const k of Object.keys(r)) {
      if (!keys.has(k)) continue; // ignore undeclared columns rather than trust them
      row[k] = optStr(r[k], `rows[${i}].${k}`) ?? "";
    }
    return row;
  });
  return { rows };
}

function validateSectionContent(
  type: SectionType,
  raw: unknown,
  config: unknown,
): SectionContent {
  switch (type) {
    case "meeting_info": {
      if (!isObj(raw)) fail("meeting_info content must be an object");
      const fields = asArray(raw.fields, "meeting_info.fields").map((f, i) => {
        if (!isObj(f)) fail(`fields[${i}] must be an object`);
        return { label: asStr(f.label, `fields[${i}].label`), value: optStr(f.value, `fields[${i}].value`) ?? "" };
      });
      return { type, data: { fields } };
    }
    case "attendance": {
      if (!isObj(raw)) fail("attendance content must be an object");
      const attendees = asArray(raw.attendees, "attendance.attendees").map((a, i) => {
        if (!isObj(a)) fail(`attendees[${i}] must be an object`);
        const role = optStr(a.role, `attendees[${i}].role`);
        return { name: asStr(a.name, `attendees[${i}].name`), present: a.present === true, ...(role !== undefined ? { role } : {}) };
      });
      return { type, data: { attendees } };
    }
    case "agenda":
    case "table": {
      const columns = parseColumns(config);
      return { type, data: validateRows(raw, columns), columns };
    }
    case "rich_text":
      // Delegates to the existing trust-boundary validator; config gates marks/levels.
      return { type, data: validateRichText(raw, (config ?? undefined) as RichTextConfig | undefined) };
    case "signature": {
      if (!isObj(raw)) fail("signature content must be an object");
      const signatures = asArray(raw.signatures, "signature.signatures").map((s, i) => {
        if (!isObj(s)) fail(`signatures[${i}] must be an object`);
        const name = optStr(s.name, `signatures[${i}].name`);
        const signedAt = optStr(s.signedAt, `signatures[${i}].signedAt`);
        return { label: asStr(s.label, `signatures[${i}].label`), ...(name !== undefined ? { name } : {}), ...(signedAt !== undefined ? { signedAt } : {}) };
      });
      return { type, data: { signatures } };
    }
  }
}

// Assemble untrusted rows + content into the one canonical, validated document.
// Throws RenderDocumentError on any malformed section — nothing half-valid is
// ever persisted or handed to the engine.
export function assembleRenderDocument(input: AssembleInput): RenderDocument {
  const sections = [...input.sections]
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      if (!SECTION_TYPES.includes(s.type as SectionType)) fail(`unknown section type: ${s.type}`);
      const type = s.type as SectionType;
      const raw = input.contentBySectionId[s.id];
      if (raw === undefined) fail(`missing content for section ${s.id}`);
      return { id: s.id, order: s.order, type, title: s.title, content: validateSectionContent(type, raw, s.config) };
    });
  return {
    version: 1,
    minutesId: input.minutesId,
    status: input.status,
    meeting: input.meeting,
    sections,
  };
}

// --- rendering (screen preview + PDF share this path, DESIGN §7) ------------

const th = (c: Column) => `<th>${escapeHtml(c.label)}</th>`;
const cell = (v: string) => `<td>${escapeHtml(v)}</td>`;

function renderRows(columns: Column[], rows: Record<string, string>[], numbered: boolean): string {
  const head = `<thead><tr>${numbered ? "<th>#</th>" : ""}${columns.map(th).join("")}</tr></thead>`;
  const body = rows
    .map((r, i) => `<tr>${numbered ? `<td>${i + 1}</td>` : ""}${columns.map((c) => cell(r[c.key] ?? "")).join("")}</tr>`)
    .join("");
  return `<table><colgroup></colgroup>${head}<tbody>${body}</tbody></table>`;
}

function renderContent(c: SectionContent): string {
  switch (c.type) {
    case "meeting_info":
      return `<dl class="meeting-info">${c.data.fields
        .map((f) => `<dt>${escapeHtml(f.label)}</dt><dd>${escapeHtml(f.value)}</dd>`)
        .join("")}</dl>`;
    case "attendance":
      return `<table class="attendance"><thead><tr><th>Name</th><th>Role</th><th>Present</th></tr></thead><tbody>${c.data.attendees
        .map((a) => `<tr>${cell(a.name)}${cell(a.role ?? "")}<td>${a.present ? "☑" : "☐"}</td></tr>`)
        .join("")}</tbody></table>`;
    case "agenda":
      return renderRows(c.columns, c.data.rows, true);
    case "table":
      return renderRows(c.columns, c.data.rows, false);
    case "rich_text":
      return renderRichText(c.data);
    case "signature":
      return `<div class="signatures">${c.data.signatures
        .map(
          (s) =>
            `<div class="signature"><div class="signature-name">${escapeHtml(s.name ?? "")}</div>` +
            `<div class="signature-label">${escapeHtml(s.label)}${s.signedAt ? ` — ${escapeHtml(s.signedAt)}` : ""}</div></div>`,
        )
        .join("")}</div>`;
  }
}

// Render the assembled document to an HTML fragment (sections in order). The PDF
// pipeline wraps this in its page shell + print CSS; the screen preview reuses it
// verbatim. Text is escaped here; structure was validated at assembly time.
export function renderDocument(doc: RenderDocument): string {
  return doc.sections
    .map(
      (s) =>
        `<section class="section section-${s.type}" data-section-id="${escapeHtml(s.id)}">` +
        `<h2>${escapeHtml(s.title)}</h2>${renderContent(s.content)}</section>`,
    )
    .join("\n");
}
