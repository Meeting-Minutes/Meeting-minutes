// Built-in demo/starter templates an admin can add into a specific org.
// Single source of truth — the demo seed and the "add from library" feature
// both read from here. Kept dependency-free (only a type import) and with the
// Handlebars source inlined so it works identically in the seed script, in
// server routes, and on serverless (no runtime filesystem reads).
import type { Field } from "@/db/schema/templates";

export type StarterTemplate = {
  key: string;
  name: string;
  description: string;
  fields: Field[];
  texSource: string;
};

const PCAMPUS_MINUTE_HBS = `<!DOCTYPE html>
<html lang="ne">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Noto Sans Devanagari', 'Mangal', 'Helvetica Neue', Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 22px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 6px; margin-bottom: 16px; }
  .opening { font-size: 14px; text-align: justify; margin-bottom: 18px; }
  h2 { font-size: 15px; margin-top: 16px; text-transform: uppercase; letter-spacing: 1px; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 13px; }
  th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  ol.nepali-list { list-style: none; padding-left: 0; font-size: 14px; margin: 6px 0 12px; }
  li { margin: 4px 0; text-align: justify; }
  .signature { margin-top: 32px; page-break-inside: avoid; }
  .sig-box { width: 300px; margin-left: auto; text-align: center; }
  .sig-label { font-size: 13px; color: #555; margin-bottom: 6px; }
  .sig-line { border-bottom: 1px solid #333; margin-bottom: 6px; padding-bottom: 24px; }
  .sig-name { font-size: 14px; font-weight: 600; margin: 4px 0 2px; }
  .sig-org { font-size: 13px; color: #555; margin: 0; }
</style>
</head>
<body>

<h1>{{title}}</h1>

<p class="opening">
  आज मिति {{bs date_ad}} ({{date_ad}}), {{day}} {{time}} बजे, {{location}} मा
  {{committee}} का संयोजक {{chair}}को संयोजकत्वमा बैठक बसी देहाय बमोजिमका छलफल तथा निर्णय गरियो।
</p>

<h2>उपस्थितिः</h2>
{{#if attendees}}
<table>
  <thead><tr><th>क्र.सं.</th><th>नाम</th><th>पद</th><th>हस्ताक्षर</th></tr></thead>
  <tbody>
    {{#each attendees}}
    <tr>
      <td>{{devnagari (add @index 1)}}</td>
      <td>{{name}}{{#if designation}}, {{designation}}{{/if}}</td>
      <td>{{post}}</td>
      <td></td>
    </tr>
    {{/each}}
  </tbody>
</table>
{{/if}}

<h2>प्रस्तावहरु:</h2>
{{#if proposals}}
<ol class="nepali-list">
  {{#each proposals}}
  <li>{{devnagari (add @index 1)}}.&nbsp;&nbsp;{{item}}</li>
  {{/each}}
</ol>
{{/if}}

<h2>निर्णयहरूः</h2>
{{#if decisions}}
<ol class="nepali-list">
  {{#each decisions}}
  <li>{{devnagari (add @index 1)}}.&nbsp;&nbsp;{{item}}</li>
  {{/each}}
</ol>
{{/if}}

<br>
<br>

</body>
</html>
`;

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: "pcampus-minute",
    name: "PCampus Minute",
    description:
      "नेपाली क्याम्पस समिति बैठकको कार्यविवरण — उपस्थिति, प्रस्ताव, निर्णय र हस्ताक्षर",
    fields: [
      { name: "title", label: "बैठकको शीर्षक", type: "text" },
      { name: "date_ad", label: "मिति", type: "date" },
      { name: "day", label: "दिन", type: "text" },
      { name: "time", label: "समय", type: "text" },
      { name: "location", label: "स्थान", type: "text" },
      { name: "committee", label: "समितिको विवरण", type: "textarea" },
      { name: "committee_name", label: "समितिको नाम", type: "text" },
      { name: "chair", label: "संयोजकको नाम", type: "text" },
      {
        name: "attendees",
        label: "उपस्थिति",
        type: "table",
        config: {
          columns: [
            { key: "name", label: "नाम" },
            { key: "designation", label: "पद/विभाग" },
            { key: "post", label: "समिति पद" },
          ],
        },
      },
      {
        name: "proposals",
        label: "प्रस्तावहरु",
        type: "table",
        config: { columns: [{ key: "item", label: "प्रस्ताव" }] },
      },
      {
        name: "decisions",
        label: "निर्णयहरू",
        type: "table",
        config: { columns: [{ key: "item", label: "निर्णय" }] },
      },
    ],
    texSource: PCAMPUS_MINUTE_HBS,
  },
];

export function findStarterTemplate(key: string): StarterTemplate | undefined {
  return STARTER_TEMPLATES.find((t) => t.key === key);
}
