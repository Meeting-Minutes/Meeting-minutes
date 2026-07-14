import { pgTable, primaryKey, uuid, timestamp } from "drizzle-orm/pg-core";

import { organizations } from "./organizations";
import { users } from "./users";
import { teams } from "./teams";

export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "cascade",
      }),
    teamId: uuid("team_id") // null: org-wide membership
      .references(() => teams.id, {
        onDelete: "cascade",
      }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.organizationId, table.teamId],
    }),
  ],
);
