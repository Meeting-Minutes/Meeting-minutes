import { uuid, pgTable, text, integer, jsonb } from "drizzle-orm/pg-core";
import { templates } from "./templates";

export const templateSections = pgTable("template_sections", {
  id: uuid("id").primaryKey(),
  templateId: uuid("template_id").references(() => templates.id, {
    onDelete: "cascade",
  }),
  order: integer("order").notNull(),
  type: text("type").$type<
    | "meeting_info"
    | "attendance"
    | "agenda"
    | "rich_text"
    | "table"
    | "signature"
  >(),
  title: text("title").notNull(),
  config: jsonb("config"),
});
