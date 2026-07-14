import { pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const clusters = pgTable("clusters", {
  id: uuid("id").primaryKey(),
  orgID: uuid("orgID").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  name: varchar("name", { length: 255 }),
});
