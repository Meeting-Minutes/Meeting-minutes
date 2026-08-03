import { pgTable, uuid, primaryKey, index } from "drizzle-orm/pg-core";
import { clusters } from "./clusters";
import { meetings } from "./meetings";

export const clusterMeetings = pgTable(
  "cluster_meetings",
  {
    clusterID: uuid("clusterID").references(() => clusters.id, {
      onDelete: "cascade",
    }),
    meetingID: uuid("meetingID").references(() => meetings.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [
    primaryKey({ columns: [table.clusterID, table.meetingID] }),
    // "Which clusters does this meeting belong to?" (related-minutes surfacing)
    // and "which meetings are in this cluster?" — both hot lookups, indexed.
    index("cluster_meetings_meeting_idx").on(table.meetingID),
  ],
);
