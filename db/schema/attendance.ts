import { pgTable, uuid, primaryKey, boolean } from "drizzle-orm/pg-core";
import { meetings } from "./meetings";
import { users } from "./users";

// just this table entry means they attended the meeting
export const attendance = pgTable(
  "attendance",
  {
    meetingID: uuid("meeting_id").references(() => meetings.id, {
      onDelete: "cascade",
    }),
    userID: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
  },
  (table) => {
    return [primaryKey({ columns: [table.meetingID, table.userID] })];
  },
);
