import {
  uuid,
  pgTable,
  text,
  timestamp,
  jsonb,
  foreignKey,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    fields: jsonb("fields").$type<Field[]>().notNull().default([]),
    texPath: text("tex_path"),
    texSource: text("tex_source"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.orgId],
      foreignColumns: [organizations.id],
    }).onDelete("cascade"),
    index("templates_org_idx").on(table.orgId),
  ],
);

export type Field =
  | { name: string; label: string; type: "text" }
  | { name: string; label: string; type: "textarea" }
  | { name: string; label: string; type: "number" }
  | { name: string; label: string; type: "date" }
  | { name: string; label: string; type: "boolean" }
  | { name: string; label: string; type: "select"; config: { options: string[] } }
  | {
      name: string;
      label: string;
      type: "table";
      config: { columns: { key: string; label: string }[] };
    };
