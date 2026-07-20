// Self-check for lib/render-document.ts — run with `bun run lib/render-document.check.ts`.
// No framework: plain asserts. Exits non-zero on the first failure.
// Covers assembly + trust-boundary validation only; HTML/PDF rendering is a
// separate later concern and is not in this module.
import {
  assembleRenderDocument,
  RenderDocumentError,
  type AssembleInput,
  type TemplateSectionRow,
} from "./render-document";

let n = 0;
function ok(cond: unknown, msg: string) {
  n++;
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}
function throws(fn: () => unknown, msg: string) {
  n++;
  try {
    fn();
  } catch (e) {
    if (e instanceof RenderDocumentError) return;
    console.error(`FAIL (wrong error type): ${msg} -> ${e}`);
    process.exit(1);
  }
  console.error(`FAIL (expected throw): ${msg}`);
  process.exit(1);
}

const meeting = { org: "Acme", title: "Q3 Review", scheduledAt: "2026-07-20T10:00:00Z" };
function build(sections: TemplateSectionRow[], content: Record<string, unknown>): AssembleInput {
  return { minutesId: "m1", status: "draft", meeting, sections, contentBySectionId: content };
}

// --- happy path: one of every section type assembles into the envelope -----
const full = build(
  [
    { id: "s1", order: 0, type: "meeting_info", title: "Info", config: null },
    { id: "s2", order: 1, type: "attendance", title: "Present", config: null },
    { id: "s3", order: 2, type: "agenda", title: "Agenda", config: { columns: ["topic", "decision"] } },
    { id: "s4", order: 3, type: "rich_text", title: "Notes", config: null },
    { id: "s5", order: 4, type: "table", title: "Actions", config: { columns: [{ key: "task", label: "Task" }, { key: "owner", label: "Owner" }] } },
    { id: "s6", order: 5, type: "signature", title: "Approved", config: null },
  ],
  {
    s1: { fields: [{ label: "Date", value: "2026-07-20" }, { label: "Location", value: "Room 1" }] },
    s2: { attendees: [{ name: "Ana", present: true, role: "Chair" }, { name: "Bob", present: false }] },
    s3: { rows: [{ topic: "Budget", decision: "Approved" }, { topic: "Hiring", decision: "Deferred" }] },
    s4: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hi", marks: [{ type: "bold" }] }] }] },
    s5: { rows: [{ task: "Ship", owner: "Ana" }] },
    s6: { signatures: [{ label: "Chair", name: "Ana", signedAt: "2026-07-21" }] },
  },
);
const doc = assembleRenderDocument(full);
ok(doc.version === 1 && doc.sections.length === 6, "assembles all 6 sections");
ok(doc.minutesId === "m1" && doc.meeting.org === "Acme", "carries envelope metadata");
ok(doc.sections.every((s, i) => s.content.type === s.type), "each section keeps its own typed content");
const s3 = doc.sections[2];
ok(s3.content.type === "agenda" && s3.content.columns.length === 2 && s3.content.data.rows.length === 2, "agenda content + columns validated");
ok(doc.sections[3].content.type === "rich_text", "rich_text delegates to its own validator and keeps the doc");

// --- ordering: out-of-order rows sort by `order` ---------------------------
const ordered = assembleRenderDocument(
  build(
    [
      { id: "b", order: 5, type: "meeting_info", title: "B", config: null },
      { id: "a", order: 1, type: "meeting_info", title: "A", config: null },
    ],
    { a: { fields: [] }, b: { fields: [] } },
  ),
);
ok(ordered.sections[0].id === "a" && ordered.sections[1].id === "b", "sorts sections by order");

// --- trust boundary: undeclared columns dropped ----------------------------
const filtered = assembleRenderDocument(
  build(
    [{ id: "s1", order: 0, type: "table", title: "T", config: { columns: ["a"] } }],
    { s1: { rows: [{ a: "keep", evil: "drop" }] } },
  ),
);
ok(
  filtered.sections[0].content.type === "table" &&
    !("evil" in filtered.sections[0].content.data.rows[0]) &&
    filtered.sections[0].content.data.rows[0].a === "keep",
  "drops undeclared columns from rows",
);

// --- present coercion: non-true is false -----------------------------------
const att = assembleRenderDocument(
  build([{ id: "s1", order: 0, type: "attendance", title: "A", config: null }], { s1: { attendees: [{ name: "X", present: "yes" }] } }),
);
ok(att.sections[0].content.type === "attendance" && att.sections[0].content.data.attendees[0].present === false, "coerces non-true `present` to false");

// --- rejection cases -------------------------------------------------------
throws(() => assembleRenderDocument(build([{ id: "s1", order: 0, type: "bogus", title: "X", config: null }], { s1: {} })), "rejects unknown section type");
throws(() => assembleRenderDocument(build([{ id: "s1", order: 0, type: "meeting_info", title: "X", config: null }], {})), "rejects missing content");
throws(() => assembleRenderDocument(build([{ id: "s1", order: 0, type: "agenda", title: "X", config: null }], { s1: { rows: [] } })), "rejects rows section with no columns config");
throws(() => assembleRenderDocument(build([{ id: "s1", order: 0, type: "attendance", title: "X", config: null }], { s1: { attendees: [{ present: true }] } })), "rejects attendee missing name");
throws(() => assembleRenderDocument(build([{ id: "s1", order: 0, type: "meeting_info", title: "X", config: null }], { s1: { fields: [{ label: 3, value: "x" }] } })), "rejects non-string field label");
// rich_text errors surface from the delegated validator (RichTextError, not
// RenderDocumentError) — any throw is correct here.
n++;
try {
  assembleRenderDocument(build([{ id: "s1", order: 0, type: "rich_text", title: "X", config: null }], { s1: { type: "not-a-doc" } }));
  console.error("FAIL (expected throw): rejects malformed rich_text");
  process.exit(1);
} catch {
  /* delegated validator threw — correct */
}

console.log(`ok — ${n} checks passed`);
