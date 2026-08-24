import Handlebars from "handlebars";
import { adToBs, bsToAd, formatBsNp, parseBsString } from "./nepali-date";

Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
Handlebars.registerHelper("not", (val: unknown) => !val);
Handlebars.registerHelper("has", (arr: unknown) => Array.isArray(arr) && arr.length > 0);
Handlebars.registerHelper("add", (a: number, b: number) => a + b);
Handlebars.registerHelper("devnagari", (n: number) =>
  String(n).replace(/\d/g, (d) => "०१२३४५६७८९"[Number(d)]),
);
// {{bs date_ad}} -> २०८२/१२/०४ ; falls back to the raw value if not a valid AD date
Handlebars.registerHelper("bs", (v: unknown) => {
  const bs = adToBs(String(v ?? ""));
  return bs ? formatBsNp(bs) : String(v ?? "");
});
// {{ad v}} -> normalized "YYYY-MM-DD"; accepts an AD ISO string (passthrough)
// or a written BS date ("२०८२/१२/०४" or "2082/12/04") which gets converted.
Handlebars.registerHelper("ad", (v: unknown) => {
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = parseBsString(s);
  return (parsed && bsToAd(parsed)) || s;
});

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

type FallbackField = {
  name?: string;
  label?: string;
  config?: { columns?: { key?: string; label?: string }[]; options?: string[] };
};

/** Generic minutes document for meetings without an attached template:
 *  scalars become labeled paragraphs, object arrays become tables,
 *  string arrays become lists. Uses the template's display labels when
 *  available, falling back to prettified field names. */
export function defaultTemplateSource(
  title: string,
  content: Record<string, unknown>,
  fields?: FallbackField[],
): string {
  const pretty = (k: string) =>
    k.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  const fieldFor = (k: string) => fields?.find((f) => f.name === k);
  const labelFor = (k: string) => fieldFor(k)?.label || pretty(k);
  const headersFor = (k: string, cols: string[]) => {
    const conf = fieldFor(k)?.config?.columns;
    return cols
      .map((c) => conf?.find((col) => col.key === c)?.label || pretty(c))
      .map((l) => escHtml(l));
  };
  const sections = Object.entries(content)
    .map(([key, v]) => {
      const heading = `<h2>${escHtml(labelFor(key))}</h2>`;
      if (Array.isArray(v)) {
        if (v.length === 0) return "";
        if (v.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
          const cols = [...new Set(v.flatMap((r) => Object.keys(r as object)))];
          const headers = headersFor(key, cols);
          return `${heading}<table><thead><tr>${headers
            .map((h) => `<th>${h}</th>`)
            .join("")}</tr></thead><tbody>${v
            .map(
              (r) =>
                `<tr>${cols
                  .map((c) => `<td>${escHtml(String((r as Record<string, unknown>)[c] ?? ""))}</td>`)
                  .join("")}</tr>`,
            )
            .join("")}</tbody></table>`;
        }
        return `${heading}<ul>${v.map((s) => `<li>${escHtml(String(s))}</li>`).join("")}</ul>`;
      }
      if (v === null || v === undefined || v === "") return "";
      return `${heading}<p>${escHtml(String(v))}</p>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
</head>
<body>
<style>
  body { font-family: 'Noto Sans Devanagari', 'Helvetica Neue', Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 22px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 6px; margin-bottom: 16px; }
  h2 { font-size: 13px; margin-top: 16px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
  p { font-size: 14px; margin: 4px 0 0; white-space: pre-wrap; }
  ul { margin: 4px 0 12px; padding-left: 20px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 13px; }
  th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
</style>
<h1>${escHtml(title)}</h1>
${sections}
</body>
</html>`;
}

export function renderTemplate(
  template: string,
  values: Record<string, unknown>,
): string {
  const compiled = Handlebars.compile(template);
  return compiled({ ...values, values });
}
