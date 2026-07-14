import { uuid, pgTable, primaryKey } from "drizzle-orm/pg-core";
import { meetings } from "./meetings";
import { teams } from "./teams";

export const meetingTeams = pgTable(
  // If there is a meeting with no team assigned its for the whole org
  "meeting_teams",
  {
    meetingId: uuid("meeting_id").references(() => meetings.id, {
      onDelete: "cascade",
    }),
    teamId: uuid("team_id").references(() => teams.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [primaryKey({ columns: [table.meetingId, table.teamId] })],
);
