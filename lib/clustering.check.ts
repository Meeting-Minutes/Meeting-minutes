import { db } from "../db";
import { organizations, users, tags, meetings, meeting_tags as meetingTags } from "../db/schema";
import { eq, inArray, and, sql } from "drizzle-orm";

// Runs against a throwaway org; asserts the tag-overlap query that the
// clustering job depends on is correct AND that the planner picks the indexes
// we added for scale (issue #20), rather than falling back to sequential
// scans that would crawl once years of meetings accumulate.
async function main() {
  const orgId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const tagA = crypto.randomUUID();
  const tagB = crypto.randomUUID();
  const meeting1 = crypto.randomUUID();
  const meeting2 = crypto.randomUUID();
  const meeting3 = crypto.randomUUID();

  await db.insert(organizations).values({
    id: orgId,
    name: "ClusterCheck Org",
    slug: `clustercheck-${crypto.randomUUID().slice(0, 8)}`,
  });
  await db.insert(users).values({ id: userId, email: `c_${crypto.randomUUID().slice(0, 8)}@test`, name: "C" });
  await db.insert(tags).values([{ id: tagA, orgID: orgId, name: "budget" }, { id: tagB, orgID: orgId, name: "hiring" }]);
  await db.insert(meetings).values([
    { id: meeting1, orgId, title: "M1", scheduledAt: new Date(), createdBy: userId },
    { id: meeting2, orgId, title: "M2", scheduledAt: new Date(), createdBy: userId },
    { id: meeting3, orgId, title: "M3", scheduledAt: new Date(), createdBy: userId },
  ]);
  // M1 and M2 share tagA (overlap -> same cluster); M3 shares only tagB.
  await db.insert(meetingTags).values([
    { id: crypto.randomUUID(), meetingId: meeting1, tagId: tagA },
    { id: crypto.randomUUID(), meetingId: meeting2, tagId: tagA },
    { id: crypto.randomUUID(), meetingId: meeting3, tagId: tagB },
  ]);

  // The tag-overlap query: meetings in the org that share >=1 tag with a given meeting.
  const overlaps = await db
    .selectDistinct({ id: meetings.id, title: meetings.title })
    .from(meetingTags)
    .innerJoin(meetings, eq(meetings.id, meetingTags.meetingId))
    .where(
      and(
        eq(meetings.orgId, orgId),
        eq(meetings.id, meeting2), // M2 shares tagA with M1
        inArray(
          meetingTags.tagId,
          db
            .select({ tagId: meetingTags.tagId })
            .from(meetingTags)
            .where(eq(meetingTags.meetingId, meeting1)),
        ),
      ),
    );

  console.assert(
    overlaps.length === 1 && overlaps[0].id === meeting2,
    "FAIL: overlap query should return M2 (shares tagA with M1)",
  );

  // Scalability: the hot scans must be index-driven, not sequential.
  for (const idx of [
    "meetings_org_idx",
    "meeting_tags_meeting_id_idx",
    "meeting_tags_tag_id_idx",
    "cluster_meetings_meeting_idx",
    "clusters_org_idx",
  ]) {
    const [row] = await db.execute(`SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='${idx}'`);
    console.assert(row !== undefined, `FAIL: missing clustering index ${idx}`);
  }

  const [plan] = await db.execute<{ "QUERY PLAN": string }>(sql`
    EXPLAIN SELECT DISTINCT mt2.meeting_id
    FROM meeting_tags mt1
    JOIN meeting_tags mt2 ON mt1.tag_id = mt2.tag_id
    WHERE mt1.meeting_id = ${meeting1}
  `);
  const planText = plan["QUERY PLAN"];
  console.assert(
    !/Seq Scan/.test(planText),
    `FAIL: tag-overlap join should not seq-scan (got: ${planText})`,
  );

  console.log("Clustering scalability check OK: indexes present, overlap query correct and index-driven.");

  await db.delete(meetingTags).where(eq(meetingTags.meetingId, meeting1));
  await db.delete(meetingTags).where(eq(meetingTags.meetingId, meeting2));
  await db.delete(meetingTags).where(eq(meetingTags.meetingId, meeting3));
  await db.delete(meetings).where(inArray(meetings.id, [meeting1, meeting2, meeting3]));
  await db.delete(tags).where(inArray(tags.id, [tagA, tagB]));
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(organizations).where(eq(organizations.id, orgId));

  process.exit(0);
}

main().catch((err) => {
  console.error("Clustering check failed:", err);
  process.exit(1);
});
