import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core";

import { meetings } from "./meetings";
import { users } from "./users";
import { roles } from "./roles";

export const meetingOverrides = pgTable(
  "meeting_overrides",
  {
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.meetingId, table.userId] }),
  ],
);
