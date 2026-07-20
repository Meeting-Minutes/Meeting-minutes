// rich_text section content model + trust-boundary validator + safe HTML renderer.
//
// The document shape is ProseMirror/TipTap-flavoured JSON (doc → block nodes →
// inline text nodes carrying marks). A future drag-drop editor emits exactly this,
// and the renderer below is the single code path shared by screen preview and the
// PDF pipeline (DESIGN §7). Nothing here trusts its input: client-supplied JSON is
// validated node-by-node and every href is checked before it reaches HTML.

export const MARK_TYPES = [
  "bold",
  "italic",
  "strike",
  "spoiler",
  "link",
] as const;
export type MarkType = (typeof MARK_TYPES)[number];

export type Mark =
  | { type: Exclude<MarkType, "link"> }
  | { type: "link"; attrs: { href: string } };

export type TextNode = { type: "text"; text: string; marks?: Mark[] };
export type HardBreak = { type: "hard_break" };
export type Inline = TextNode | HardBreak;

export type Paragraph = { type: "paragraph"; content?: Inline[] };
export type Heading = {
  type: "heading";
  attrs: { level: number };
  content?: Inline[];
};
export type Block = Paragraph | Heading;

export type RichTextDoc = { type: "doc"; content: Block[] };

// Stored in template_sections.config for a rich_text section. Absent config = all on.
export type RichTextConfig = {
  marks?: MarkType[];
  headingLevels?: number[]; // subset of 1..6
};

const DEFAULT_MARKS: readonly MarkType[] = MARK_TYPES;
const DEFAULT_HEADING_LEVELS: readonly number[] = [1, 2, 3, 4, 5, 6];

// --- validation (trust boundary) -------------------------------------------

export class RichTextError extends Error {}

function fail(msg: string): never {
  throw new RichTextError(msg);
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Only these schemes may appear in a link. javascript:, data:, vbscript: etc. are
// the XSS vectors — anything not explicitly allowed is rejected.
function safeHref(raw: unknown): string {
  if (typeof raw !== "string") fail("link href must be a string");
  const href = raw.trim();
  // Reject control chars (incl. the tab/newline tricks that smuggle "java\tscript:").
  if (/[\x00-\x20]/.test(href)) fail("link href contains control characters");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href)?.[1]?.toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https" && scheme !== "mailto") {
    fail(`link href scheme not allowed: ${scheme}`);
  }
  return href; // relative/anchor hrefs (no scheme) are allowed
}

function validateMarks(raw: unknown, allowed: Set<MarkType>): Mark[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) fail("marks must be an array");
  const seen = new Set<MarkType>();
  const marks: Mark[] = [];
  for (const m of raw) {
    if (!isObj(m) || typeof m.type !== "string") fail("mark must have a type");
    const type = m.type as MarkType;
    if (!MARK_TYPES.includes(type)) fail(`unknown mark type: ${m.type}`);
    if (!allowed.has(type)) fail(`mark type not enabled: ${type}`);
    if (seen.has(type)) continue; // idempotent: a mark can't apply twice
    seen.add(type);
    if (type === "link") {
      if (!isObj(m.attrs)) fail("link mark requires attrs.href");
      marks.push({ type, attrs: { href: safeHref(m.attrs.href) } });
    } else {
      marks.push({ type });
    }
  }
  return marks.length ? marks : undefined;
}

function validateInline(raw: unknown, allowed: Set<MarkType>): Inline {
  if (!isObj(raw) || typeof raw.type !== "string") fail("inline node needs a type");
  if (raw.type === "hard_break") return { type: "hard_break" };
  if (raw.type === "text") {
    if (typeof raw.text !== "string") fail("text node requires a string `text`");
    const marks = validateMarks(raw.marks, allowed);
    return marks ? { type: "text", text: raw.text, marks } : { type: "text", text: raw.text };
  }
  fail(`unknown inline node type: ${raw.type}`);
}

function validateBlock(
  raw: unknown,
  allowed: Set<MarkType>,
  levels: Set<number>,
): Block {
  if (!isObj(raw) || typeof raw.type !== "string") fail("block node needs a type");
  const content = raw.content === undefined
    ? undefined
    : (() => {
        if (!Array.isArray(raw.content)) fail("block content must be an array");
        return raw.content.map((c) => validateInline(c, allowed));
      })();
  if (raw.type === "paragraph") {
    return content ? { type: "paragraph", content } : { type: "paragraph" };
  }
  if (raw.type === "heading") {
    const level = isObj(raw.attrs) ? raw.attrs.level : undefined;
    if (typeof level !== "number" || !Number.isInteger(level)) {
      fail("heading requires an integer attrs.level");
    }
    if (!levels.has(level)) fail(`heading level not enabled: ${level}`);
    return content
      ? { type: "heading", attrs: { level }, content }
      : { type: "heading", attrs: { level } };
  }
  fail(`unknown block node type: ${raw.type}`);
}

// Validate untrusted JSON into a typed RichTextDoc, or throw RichTextError.
// Call this before persisting a rich_text section's content.
export function validateRichText(raw: unknown, config?: RichTextConfig): RichTextDoc {
  const allowed = new Set<MarkType>(config?.marks ?? DEFAULT_MARKS);
  const levels = new Set<number>(config?.headingLevels ?? DEFAULT_HEADING_LEVELS);
  if (!isObj(raw) || raw.type !== "doc") fail("root node must be a doc");
  if (!Array.isArray(raw.content)) fail("doc content must be an array");
  return { type: "doc", content: raw.content.map((b) => validateBlock(b, allowed, levels)) };
}

// --- rendering (screen preview + PDF share this path) ----------------------

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Deterministic nesting order; link stays outermost so the whole span is clickable.
const MARK_ORDER: MarkType[] = ["link", "bold", "italic", "strike", "spoiler"];

function wrapMarks(inner: string, marks: Mark[] | undefined): string {
  if (!marks?.length) return inner;
  const byType = new Map(marks.map((m) => [m.type, m]));
  let html = inner;
  for (const type of [...MARK_ORDER].reverse()) {
    const mark = byType.get(type);
    if (!mark) continue;
    switch (mark.type) {
      case "bold": html = `<strong>${html}</strong>`; break;
      case "italic": html = `<em>${html}</em>`; break;
      case "strike": html = `<s>${html}</s>`; break;
      case "spoiler": html = `<span class="spoiler">${html}</span>`; break;
      case "link":
        html = `<a href="${escapeHtml(mark.attrs.href)}" rel="noopener noreferrer nofollow" target="_blank">${html}</a>`;
        break;
    }
  }
  return html;
}

function renderInline(node: Inline): string {
  if (node.type === "hard_break") return "<br>";
  return wrapMarks(escapeHtml(node.text), node.marks);
}

function renderBlock(block: Block): string {
  const inner = (block.content ?? []).map(renderInline).join("");
  if (block.type === "heading") return `<h${block.attrs.level}>${inner}</h${block.attrs.level}>`;
  return `<p>${inner}</p>`;
}

// Render a validated doc to HTML. Pass docs through validateRichText first; this
// escapes text but assumes structure is already trusted.
export function renderRichText(doc: RichTextDoc): string {
  return doc.content.map(renderBlock).join("");
}
