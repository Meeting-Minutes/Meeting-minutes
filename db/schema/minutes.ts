import { pgTable, uuid, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { meetings } from "./meetings";
import { templates } from "./templates";

export const minute_status = pgEnum("minute_status", ["draft", "published"]);

export const minutes = pgTable("minutes", {
  id: uuid("id")
    .primaryKey()
    .references(() => meetings.id),
  templateId: uuid("template_id").references(() => templates.id),
  status: minute_status("status").default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  publishedAt: timestamp("published_at"),
});
