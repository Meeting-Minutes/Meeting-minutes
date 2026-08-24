import { NextResponse } from "next/server";
import { desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  meetings,
  meetingTeams,
  memberships,
  minutes,
  organizations,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

// Cross-org dashboard feed: everything the signed-in user may see, mirroring
// resolveOrganizationAccess semantics — org-wide members get their orgs'
// meetings; team-scoped members get meetings attached to their teams.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({ organizationId: memberships.organizationId, teamId: memberships.teamId })
    .from(memberships)
    .where(eq(memberships.userId, user.id));
  if (rows.length === 0) {
    return NextResponse.json({ upcoming: [], recent: [] });
  }

  const orgWideOrgs = [
    ...new Set(rows.filter((r) => r.teamId === null).map((r) => r.organizationId)),
  ];
  const myTeamIds = [
    ...new Set(rows.flatMap((r) => (r.teamId ? [r.teamId] : []))),
  ];

  const conditions = [];
  if (orgWideOrgs.length > 0) conditions.push(inArray(meetings.orgId, orgWideOrgs));
  if (myTeamIds.length > 0) conditions.push(inArray(meetingTeams.teamId, myTeamIds));

  // ponytail: single 60-row window split client-side instead of two queries —
  // fine until an org outgrows it; upgrade path is two bounded queries here.
  const rowsAll = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      description: meetings.description,
      scheduledAt: meetings.scheduledAt,
      location: meetings.location,
      orgName: organizations.name,
      status: minutes.status,
    })
    .from(meetings)
    .innerJoin(organizations, eq(organizations.id, meetings.orgId))
    .innerJoin(meetingTeams, eq(meetingTeams.meetingId, meetings.id))
    .leftJoin(minutes, eq(minutes.id, meetings.id))
    .where(or(...conditions))
    .orderBy(desc(meetings.scheduledAt))
    .limit(60);

  const seen = new Set<string>();
  const unique = rowsAll.filter((r) => !seen.has(r.id) && seen.add(r.id));
  const now = Date.now();
  const upcoming = unique
    .filter((r) => new Date(r.scheduledAt).getTime() > now)
    .reverse()
    .slice(0, 8);
  const recent = unique
    .filter((r) => new Date(r.scheduledAt).getTime() <= now)
    .slice(0, 8);

  return NextResponse.json({ upcoming, recent });
}
