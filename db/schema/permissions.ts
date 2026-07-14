import { pgTable, uuid, text } from "drizzle-orm/pg-core";

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().notNull(),
  key: text("key").unique(),
  description: text("description"),
});
