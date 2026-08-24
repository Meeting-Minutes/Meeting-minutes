// Self-check for lib/render-pdf.ts — run with `bun run lib/render-pdf.check.ts`.
import { renderTemplate, defaultTemplateSource } from "./render-pdf";

let n = 0;
function ok(cond: unknown, msg: string) {
  n++;
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const template = [
  "<!DOCTYPE html><html><body>",
  "<h1>{{title}}</h1>",
  "<ul>",
  "{{#each items}}",
  "<li>{{text}}</li>",
  "{{/each}}",
  "</ul>",
  "<p>Signed: {{signer}}</p>",
  "</body></html>",
].join("\n");

const values = {
  title: "Q3 & Review",
  items: [{ text: "Budget $100k" }, { text: "Hiring < 5 devs" }],
  signer: "Alice #1",
};

const out = renderTemplate(template, values);

// Handlebars auto-escapes HTML by default (& → &amp; < → &lt; > → &gt;)
ok(out.includes("Q3 &amp; Review"), "escapes & in title");
ok(!out.includes("< 5"), "escapes < in table column");
ok(out.includes("&lt; 5 devs"), "renders escaped &lt;");
ok(!out.includes("{{"), "no unprocessed handlebars tokens");
ok(out.includes("<li>Budget $100k</li>"), "table loop produces items");
ok(out.includes("<li>Hiring &lt; 5 devs</li>"), "escapes HTML in table row");
ok(out.includes("Alice #1"), "plain text passes through unchanged");

// Devanagari numbering helpers
ok(renderTemplate("<p>{{devnagari (add 4 1)}}</p>", {}) === "<p>५</p>", "devnagari converts 5 → ५");
ok(renderTemplate("<p>{{devnagari 10}}</p>", {}) === "<p>१०</p>", "devnagari handles multi-digit numbers");
ok(
  renderTemplate("{{#each items}}<li>{{devnagari (add @index 1)}}</li>{{/each}}", {
    items: [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}],
  }) === "<li>१</li><li>२</li><li>३</li><li>४</li><li>५</li><li>६</li><li>७</li><li>८</li><li>९</li><li>१०</li>",
  "devnagari numbering १..१० across a table",
);

// BS calendar helper
ok(
  renderTemplate("<p>{{bs d}}</p>", { d: "2026-03-18" }) === "<p>२०८२/१२/०४</p>",
  "bs converts AD ISO to Devanagari BS",
);
ok(
  renderTemplate("{{bs 'not-a-date'}}", {}) === "not-a-date",
  "bs falls back to raw value for invalid dates",
);
ok(renderTemplate("{{bs missing}}", {}) === "", "bs renders empty for missing values");

// AD calendar helper (inverse of bs)
ok(
  renderTemplate("{{ad d}}", { d: "2026-03-18" }) === "2026-03-18",
  "ad passes through AD ISO",
);
ok(
  renderTemplate("{{ad d}}", { d: "२०८२/१२/०४" }) === "2026-03-18",
  "ad converts Devanagari BS to AD ISO",
);
ok(
  renderTemplate("{{ad d}}", { d: "2082/12/4" }) === "2026-03-18",
  "ad converts ASCII BS to AD ISO",
);

// Generic fallback document (no-template meetings)
const generic = defaultTemplateSource("Sync <Notes>", {
  objective: "Onboard & orient",
  discussed: ["Course loads", "Lab access"],
  decisions: [{ item: "Hire two lab assistants" }, { item: "Monthly sync" }],
  empty: [],
  blank: "",
});
ok(generic.includes("<h1>Sync &lt;Notes&gt;</h1>"), "fallback escapes title");
ok(generic.includes("<p>Onboard &amp; orient</p>"), "fallback renders scalars as paragraphs");
ok(generic.includes("<li>Course loads</li>"), "fallback renders string arrays as lists");
ok(
  generic.includes("<th>Item</th>") && generic.includes("<td>Hire two lab assistants</td>"),
  "fallback renders object arrays as tables with labeled headers",
);
ok(!generic.includes("Empty") && !generic.includes("Blank"), "fallback omits empty values");

// Fallback uses display labels from template fields when provided
const labeled = defaultTemplateSource(
  "T",
  { date_ad: "2026-03-18", attendees: [{ name: "X", post: "Y" }] },
  [
    { name: "date_ad", label: "मिति" },
    { name: "attendees", label: "उपस्थिति", config: { columns: [{ key: "name", label: "नाम" }, { key: "post" }] } },
  ],
);
ok(labeled.includes("<h2>मिति</h2>"), "fallback shows field label instead of name");
ok(labeled.includes("<h2>उपस्थिति</h2>") && labeled.includes("<th>नाम</th>"), "fallback labels table section and columns");
ok(labeled.includes("<th>Post</th>"), "fallback falls back per-column when column has no label");

console.log(`ok — ${n} checks passed`);
