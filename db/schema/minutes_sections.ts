import { pgTable, uuid, jsonb, primaryKey } from "drizzle-orm/pg-core";

import { minutes } from "./minutes";
import { templateSections } from "./template_sections";

export const minutesSections = pgTable(
  "minutes_sections",
  {
    minutes_id: uuid("minutes_id").references(() => minutes.id, {
      onDelete: "cascade",
    }),
    section_id: uuid("section_id").references(() => templateSections.id, {
      onDelete: "cascade",
    }),
    content: jsonb("content").notNull(),
  },
  (table) => [primaryKey({ columns: [table.minutes_id, table.section_id] })],
);
