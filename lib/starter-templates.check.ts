// Self-check: bun run lib/starter-templates.check.ts
import Handlebars from "handlebars";
import { STARTER_TEMPLATES, findStarterTemplate } from "./starter-templates";

let failures = 0;
function check(name: string, cond: boolean) {
  if (!cond) {
    failures++;
    console.error(`FAIL ${name}`);
  }
}

// Stub the custom helpers render-pdf registers, so compile+render exercises the
// template structure without depending on the real helper logic.
for (const h of ["eq", "not", "has", "add", "devnagari", "bs", "ad"]) {
  Handlebars.registerHelper(h, () => "");
}

// Catalog is non-empty and every entry is well-formed — this is what the
// "add from library" copy relies on (name/description/fields/texSource).
check("catalog non-empty", STARTER_TEMPLATES.length > 0);

const keys = new Set<string>();
for (const t of STARTER_TEMPLATES) {
  check(`${t.key}: unique key`, !keys.has(t.key));
  keys.add(t.key);
  check(`${t.key}: has name`, t.name.trim().length > 0);
  check(`${t.key}: has fields`, Array.isArray(t.fields) && t.fields.length > 0);
  check(`${t.key}: has texSource`, t.texSource.trim().length > 0);
  check(`${t.key}: fields have name+label+type`,
    t.fields.every((f) => f.name && f.label && f.type));
  // texSource must actually compile — a broken template would fail PDF export
  // only later, at render time, for whichever org copied it.
  try {
    Handlebars.compile(t.texSource)({});
    check(`${t.key}: texSource compiles`, true);
  } catch {
    check(`${t.key}: texSource compiles`, false);
  }
}

check("findStarterTemplate hit", findStarterTemplate(STARTER_TEMPLATES[0].key) !== undefined);
check("findStarterTemplate miss", findStarterTemplate("does-not-exist") === undefined);

if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("All starter-template checks passed.");
