import { pgTable, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { isNull, isNotNull } from "drizzle-orm/sql/expressions/conditions";

import { organizations } from "./organizations";
import { users } from "./users";
import { teams } from "./teams";

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unique_membership_org_wide")
      .on(table.userId, table.organizationId)
      .where(isNull(table.teamId)),
    uniqueIndex("unique_membership_per_team")
      .on(table.userId, table.organizationId, table.teamId)
      .where(isNotNull(table.teamId)),
  ],
);
