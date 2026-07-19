import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  slug: text("slug").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
