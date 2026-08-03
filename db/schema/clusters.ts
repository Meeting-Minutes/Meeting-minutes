import { pgTable, uuid, varchar, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const clusters = pgTable(
  "clusters",
  {
    id: uuid("id").primaryKey(),
    orgID: uuid("orgID").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 255 }),
  },
  (table) => [
    // List clusters for an org (and the clustering job scans per-org).
    index("clusters_org_idx").on(table.orgID),
  ],
);
