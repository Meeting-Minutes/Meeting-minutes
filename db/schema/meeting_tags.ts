import { pgTable, uuid } from "drizzle-orm/pg-core";
import { meetings } from "./meetings";
import { tags } from "./tags";

export const meeting_tags = pgTable("meeting_tags", {
  id: uuid("id").primaryKey(),
  meetingId: uuid("meeting_id").references(() => meetings.id, {
    onDelete: "cascade",
  }),
  tagId: uuid("tag_id").references(() => tags.id, { onDelete: "cascade" }),
});
