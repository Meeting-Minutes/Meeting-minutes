import Handlebars from "handlebars";

Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
Handlebars.registerHelper("not", (val: unknown) => !val);
Handlebars.registerHelper("has", (arr: unknown) => Array.isArray(arr) && arr.length > 0);

export function renderTemplate(
  template: string,
  values: Record<string, unknown>,
): string {
  const compiled = Handlebars.compile(template);
  return compiled({ ...values, values });
}
