// Self-check for lib/rich-text.ts — run with `bun run lib/rich-text.check.ts`.
// No framework: plain asserts. Exits non-zero on the first failure.
import {
  validateRichText,
  renderRichText,
  RichTextError,
  type RichTextConfig,
} from "./rich-text";

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
    if (e instanceof RichTextError) return;
    console.error(`FAIL (wrong error type): ${msg} -> ${e}`);
    process.exit(1);
  }
  console.error(`FAIL (expected throw): ${msg}`);
  process.exit(1);
}

// --- valid doc round-trips through validate + render, all marks + headings ---
const doc = validateRichText({
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "b", marks: [{ type: "bold" }] },
        { type: "text", text: "i", marks: [{ type: "italic" }] },
        { type: "text", text: "s", marks: [{ type: "strike" }] },
        { type: "text", text: "sp", marks: [{ type: "spoiler" }] },
        { type: "hard_break" },
        {
          type: "text",
          text: "link",
          marks: [{ type: "link", attrs: { href: "https://example.com" } }],
        },
      ],
    },
  ],
});
const html = renderRichText(doc);
ok(html.includes("<h2>Title</h2>"), "heading level renders");
ok(html.includes("<strong>b</strong>"), "bold renders");
ok(html.includes("<em>i</em>"), "italic renders");
ok(html.includes("<s>s</s>"), "strike renders");
ok(html.includes('<span class="spoiler">sp</span>'), "spoiler renders");
ok(html.includes("<br>"), "hard_break renders");
ok(
  html.includes('href="https://example.com"') && html.includes('rel="noopener noreferrer nofollow"'),
  "link renders with safe rel",
);

// --- combined marks nest with link outermost ---
const combo = renderRichText(
  validateRichText({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "x",
            marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://a.com" } }],
          },
        ],
      },
    ],
  }),
);
ok(/<a [^>]*><strong>x<\/strong><\/a>/.test(combo), "link wraps bold (outermost)");

// --- XSS: text is escaped ---
const escaped = renderRichText(
  validateRichText({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: '<script>&"' }] }],
  }),
);
ok(!escaped.includes("<script>"), "raw script tag escaped");
ok(escaped.includes("&lt;script&gt;&amp;&quot;"), "html entities escaped");

// --- XSS: dangerous link schemes rejected ---
for (const bad of [
  "javascript:alert(1)",
  "JavaScript:alert(1)",
  "data:text/html,<script>",
  "vbscript:msgbox",
  "  javascript:alert(1)",
  "java\tscript:alert(1)",
  "java\nscript:alert(1)",
]) {
  throws(
    () =>
      validateRichText({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: bad } }] }],
          },
        ],
      }),
    `reject link href: ${JSON.stringify(bad)}`,
  );
}

// --- safe schemes and relative links allowed ---
for (const good of ["https://x.com", "http://x.com", "mailto:a@b.com", "/rel", "#anchor"]) {
  const d = validateRichText({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: good } }] }],
      },
    ],
  });
  ok(renderRichText(d).includes(`href="${good}"`), `allow link href: ${good}`);
}

// --- unknown node / mark types rejected ---
throws(
  () => validateRichText({ type: "doc", content: [{ type: "blockquote" }] }),
  "reject unknown block type",
);
throws(
  () =>
    validateRichText({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "image" }] }],
    }),
  "reject unknown inline type",
);
throws(
  () =>
    validateRichText({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "blink" }] }] },
      ],
    }),
  "reject unknown mark type",
);
throws(() => validateRichText({ type: "paragraph" }), "reject non-doc root");

// --- config gating: disabled mark + disallowed heading level rejected ---
const cfg: RichTextConfig = { marks: ["bold"], headingLevels: [1, 2] };
throws(
  () =>
    validateRichText(
      {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "italic" }] }] },
        ],
      },
      cfg,
    ),
  "reject mark disabled by config",
);
throws(
  () =>
    validateRichText(
      { type: "doc", content: [{ type: "heading", attrs: { level: 4 }, content: [] }] },
      cfg,
    ),
  "reject heading level disabled by config",
);
ok(
  validateRichText(
    {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [] },
        { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "bold" }] }] },
      ],
    },
    cfg,
  ).content.length === 2,
  "allow marks/levels enabled by config",
);

console.log(`ok — ${n} assertions passed`);
