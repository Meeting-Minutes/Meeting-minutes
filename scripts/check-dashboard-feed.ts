// Self-check for the dashboard feed visibility rules (app/api/meetings/route.ts)
// and the effective-permissions endpoint (app/api/me/permissions/route.ts +
// lib/use-my-permissions). Replicates their queries and asserts what each demo
// persona may see and do.
// Run with: bun run scripts/check-dashboard-feed.ts
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "../db/index";
import { meetings, meetingTeams, memberships, minutes, organizations, teams, users } from "../db/schema";
import { getPermissionKeys } from "../lib/permissions";

let n = 0;
function ok(cond: unknown, msg: string) {
  n++;
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

async function feedFor(email: string) {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  ok(user, `user ${email} exists`);
  const rows = await db
    .select({ organizationId: memberships.organizationId, teamId: memberships.teamId })
    .from(memberships)
    .where(eq(memberships.userId, user!.id));
  const orgWideOrgs = [...new Set(rows.filter((r) => r.teamId === null).map((r) => r.organizationId))];
  const myTeamIds = [...new Set(rows.flatMap((r) => (r.teamId ? [r.teamId] : [])))];
  const conditions = [];
  if (orgWideOrgs.length > 0) conditions.push(inArray(meetings.orgId, orgWideOrgs));
  if (myTeamIds.length > 0) conditions.push(inArray(meetingTeams.teamId, myTeamIds));
  const all = await db
    .select({ id: meetings.id, title: meetings.title, status: minutes.status, orgName: organizations.name })
    .from(meetings)
    .innerJoin(organizations, eq(organizations.id, meetings.orgId))
    .innerJoin(meetingTeams, eq(meetingTeams.meetingId, meetings.id))
    .leftJoin(minutes, eq(minutes.id, meetings.id))
    .where(or(...conditions))
    .orderBy(desc(meetings.scheduledAt));
  const seen = new Set<string>();
  return all.filter((r) => !seen.has(r.id) && seen.add(r.id));
}

const admin = await feedFor("admin@pcampus.edu.np");
const adminTitles = admin.map((m) => m.title);
for (const t of [
  "अनुसन्धान परियोजना कार्यान्वयन समितिको बैठक",
  "Quarterly Planning Review — 2026",
  "Research Grant Proposal Review",
  "Faculty Induction — Welcome Sync",
]) {
  ok(adminTitles.includes(t), `admin (org-wide) sees PCampus: ${t}`);
}
ok(adminTitles.includes("Community Health Outreach — Planning"), "admin sees Riverside minutes");
ok(adminTitles.includes("Field Visit — Lamjung District"), "admin sees Riverside upcoming");

const viewer = await feedFor("viewer@pcampus.edu.np");
const viewerTitles = viewer.map((m) => m.title);
ok(viewer.every((m) => m.orgName === "PCampus"), "viewer never sees other-org meetings");
ok(!viewerTitles.includes("Research Grant Proposal Review"), "viewer (Engineering-only) excluded from R&D sub-team meeting");
ok(viewerTitles.includes("अनुसन्धान परियोजना कार्यान्वयन समितिको बैठक"), "viewer sees own-team minutes");
ok(viewerTitles.includes("Faculty Induction — Welcome Sync"), "viewer sees own-team freeform meeting");

const lead = await feedFor("lead@pcampus.edu.np");
ok(lead.map((m) => m.title).includes("Research Grant Proposal Review"), "R&D Lead sees sub-team meeting");
ok(lead.every((m) => m.title !== "Community Health Outreach — Planning"), "R&D Lead does not see Riverside");

// ── effective permissions (what the UI gate hides per persona) ─────────────

async function userIdOf(email: string): Promise<string> {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  ok(u, `user ${email} exists`);
  return u!.id;
}

const [pcampus] = await db.select({ id: organizations.id }).from(organizations)
  .where(eq(organizations.name, "PCampus")).limit(1);
ok(pcampus, "PCampus org exists");
const [eng] = await db.select({ id: teams.id }).from(teams)
  .where(and(eq(teams.orgId, pcampus!.id), eq(teams.name, "Engineering"))).limit(1);
const [rd] = await db.select({ id: teams.id }).from(teams)
  .where(and(eq(teams.orgId, pcampus!.id), eq(teams.name, "Research & Development"))).limit(1);
ok(eng && rd, "Engineering and R&D teams exist");

const adminId = await userIdOf("admin@pcampus.edu.np");
const viewerId = await userIdOf("viewer@pcampus.edu.np");
const leadUserId = await userIdOf("lead@pcampus.edu.np");

const adminKeys = await getPermissionKeys({ userId: adminId, orgId: pcampus!.id });
for (const k of ["create_meeting", "edit_meeting", "export_minutes", "manage_members", "manage_teams", "manage_org"]) {
  ok(adminKeys.has(k), `admin org keys include ${k}`);
}
ok(!adminKeys.has("superuser"), "admin does not hold reserved superuser");

const viewerOrgKeys = await getPermissionKeys({ userId: viewerId, orgId: pcampus!.id });
ok(viewerOrgKeys.size === 0, "viewer has no org-scope permissions");
const viewerEngKeys = await getPermissionKeys({ userId: viewerId, orgId: pcampus!.id, teamId: eng!.id });
ok(viewerEngKeys.size === 0, "viewer has no Engineering-scope permissions");
if (rd) {
  const viewerRdKeys = await getPermissionKeys({ userId: viewerId, orgId: pcampus!.id, teamId: rd.id });
  ok(viewerRdKeys.size === 0, "viewer has no R&D-scope permissions");
}

const leadEngKeys = await getPermissionKeys({ userId: leadUserId, orgId: pcampus!.id, teamId: eng!.id });
ok(leadEngKeys.size === 0, "R&D Lead has no keys in Engineering context");
if (rd) {
  const leadRdKeys = await getPermissionKeys({ userId: leadUserId, orgId: pcampus!.id, teamId: rd.id });
  for (const k of ["create_meeting", "edit_meeting", "export_minutes", "manage_members"]) {
    ok(leadRdKeys.has(k), `R&D Lead keys in R&D context include ${k}`);
  }
  ok(!leadRdKeys.has("manage_teams"), "R&D Lead cannot manage teams even in own sub-team");
}

console.log(`ok — ${n} checks passed`);
process.exit(0);
