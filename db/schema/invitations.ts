import { pgTable, uuid, timestamp, text, uniqueIndex } from "drizzle-orm/pg-core";

import { organizations } from "./organizations";
import { users } from "./users";
import { teams } from "./teams";
import { roles } from "./roles";

/**
 * Member invitations. Two shapes share this table:
 * - Targeted: `email` set, single-use (`acceptedAt` marks consumption).
 * - Open link: `email` null, multi-use until revoked or expired.
 * Accounts are always self-created — invites hand out join links, never
 * credentials.
 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .references(() => roles.id, { onDelete: "set null" }),
    email: text("email"),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    acceptedAt: timestamp("accepted_at"),
  },
  (table) => [uniqueIndex("unique_invitation_token").on(table.token)],
);
