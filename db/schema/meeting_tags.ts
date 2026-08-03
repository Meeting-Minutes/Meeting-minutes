import { pgTable, uuid, index } from "drizzle-orm/pg-core";
import { meetings } from "./meetings";
import { tags } from "./tags";

export const meeting_tags = pgTable(
  "meeting_tags",
  {
    id: uuid("id").primaryKey(),
    meetingId: uuid("meeting_id").references(() => meetings.id, {
      onDelete: "cascade",
    }),
    tagId: uuid("tag_id").references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    // The tag-overlap clustering job finds all meetings sharing a tag (tag_id
    // scan) and per-meeting tag sets (meeting_id scan). Both stay index-only
    // as meeting count grows over years of history.
    index("meeting_tags_tag_id_idx").on(table.tagId),
    index("meeting_tags_meeting_id_idx").on(table.meetingId),
  ],
);
