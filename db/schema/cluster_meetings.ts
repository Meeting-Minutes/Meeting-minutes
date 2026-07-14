import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core";
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
  (table) => {
    return [primaryKey({ columns: [table.clusterID, table.meetingID] })];
  },
);
