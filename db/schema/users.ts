import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // Profile extras (honorific like Mr./Dr., designation) — not yet rendered
  // into minutes; kept on the user so every org sees the same identity.
  title: text("title"),
  post: text("post"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
