import {
  pgTable,
  uuid,
  text,
  timestamp,
  foreignKey,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().notNull(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    parentTeamId: uuid("parent_team_id"),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentTeamId],
      foreignColumns: [table.id],
      name: "teams_parent_team_fk",
    }).onDelete("cascade"),
  ],
);
