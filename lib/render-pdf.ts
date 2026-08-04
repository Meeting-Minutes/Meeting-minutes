import Handlebars from "handlebars";

Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
Handlebars.registerHelper("not", (val: unknown) => !val);
Handlebars.registerHelper("has", (arr: unknown) => Array.isArray(arr) && arr.length > 0);
Handlebars.registerHelper("add", (a: number, b: number) => a + b);
Handlebars.registerHelper("devnagari", (n: number) =>
  String(n).replace(/\d/g, (d) => "०१२३४५६७८९"[Number(d)]),
);

export function renderTemplate(
  template: string,
  values: Record<string, unknown>,
): string {
  const compiled = Handlebars.compile(template);
  return compiled({ ...values, values });
}
