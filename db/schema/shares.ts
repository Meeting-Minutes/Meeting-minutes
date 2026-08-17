import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { minutes } from "./minutes";
import { users } from "./users";

export const shares = pgTable("shares", {
  id: uuid("id").primaryKey(),
  minutesId: uuid("minutes_id")
    .notNull()
    .references(() => minutes.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  email: text("email"),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow(),
});