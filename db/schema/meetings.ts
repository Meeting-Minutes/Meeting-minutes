import {
  uuid,
  pgTable,
  text,
  timestamp,
  foreignKey,
} from "drizzle-orm/pg-core";
import { templates } from "./templates";
import { organizations } from "./organizations";
import { users } from "./users";

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    templateId: uuid("template_id").references(() => templates.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    continuationOf: uuid("continuation_of"),
    sheduledAt: timestamp("sheduled_at").notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.continuationOf],
      foreignColumns: [table.id],
    }).onDelete("set null"),
  ],
);
