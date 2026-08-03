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

console.log(`ok — ${n} checks passed`);
