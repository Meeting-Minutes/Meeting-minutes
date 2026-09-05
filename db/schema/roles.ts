import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { teams } from "./teams";

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().notNull(),
  orgId: uuid("org_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Protected/immutable role (the org's Superadmin). Its permissions can't be
  // edited and it can't be renamed or deleted — the "at least one superadmin
  // holder" invariant guarantees the org can never be locked out.
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
