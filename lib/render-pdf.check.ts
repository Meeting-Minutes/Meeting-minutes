// Self-check for lib/render-pdf.ts — run with `bun run lib/render-pdf.check.ts`.
import { renderTemplate } from "./render-pdf";

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

console.log(`ok — ${n} checks passed`);
