import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { db } from "../index";
import {
  organizations,
  teams,
  memberships,
  users,
  templates,
  meetings,
  meetingTeams,
  minutes,
  roles,
  rolePermissions,
  permissions,
  shares,
} from "../schema";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { bootstrapOrgAdmin } from "@/lib/permissions";

// ─── PCampus minute (Nepali committee minutes) template ────────────────────

const PCAMPUS_FIELDS = [
  { name: "title", label: "बैठकको शीर्षक", type: "text" },
  { name: "date_np", label: "मिति (नेपाली)", type: "text" },
  { name: "date_ad", label: "मिति (अंग्रेजी)", type: "date" },
  { name: "day", label: "दिन", type: "text" },
  { name: "time", label: "समय", type: "text" },
  { name: "location", label: "स्थान", type: "text" },
  { name: "committee", label: "समितिको विवरण", type: "textarea" },
  { name: "committee_name", label: "समितिको नाम", type: "text" },
  { name: "chair", label: "संयोजकको नाम", type: "text" },
  { name: "attendees", label: "उपस्थिति", type: "table", config: { columns: [{ key: "name", label: "नाम" }, { key: "designation", label: "पद/विभाग" }, { key: "post", label: "समिति पद" }] } },
  { name: "proposals", label: "प्रस्तावहरु", type: "table", config: { columns: [{ key: "item", label: "प्रस्ताव" }] } },
  { name: "decisions", label: "निर्णयहरू", type: "table", config: { columns: [{ key: "item", label: "निर्णय" }] } },
];

// ─── helpers ───────────────────────────────────────────────────────────────

async function getUserId(email: string) {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return u?.id ?? null;
}

// Find-or-create patterns so the seed stays re-runnable: orgs are created once,
// everything else is keyed by name+scope and never duplicated.

async function ensureTeam(orgId: string, name: string, parentTeamId: string | null = null) {
  const [t] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.orgId, orgId), eq(teams.name, name)))
    .limit(1);
  if (t) return t.id;
  const id = randomUUID();
  await db.insert(teams).values({ id, orgId, name, parentTeamId });
  return id;
}

// `permKeys` = subset of catalog keys; "all" = every catalog key except superuser.
async function ensureRole(
  orgId: string, name: string, teamId: string | null, permKeys: string[] | "all",
) {
  const [existing] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.orgId, orgId), eq(roles.name, name), teamId ? eq(roles.teamId, teamId) : isNull(roles.teamId)))
    .limit(1);
  if (existing) return existing.id;

  const id = randomUUID();
  await db.insert(roles).values({ id, orgId, name, teamId });
  const perms = permKeys === "all"
    ? await db.select({ id: permissions.id }).from(permissions).where(ne(permissions.key, "superuser"))
    : await db.select({ id: permissions.id }).from(permissions).where(inArray(permissions.key, permKeys));
  await db.insert(rolePermissions)
    .values(perms.map((p) => ({ roleId: id, permissionId: p.id })))
    .onConflictDoNothing();
  return id;
}

async function ensureMember(userId: string, orgId: string, teamId: string | null, roleId: string | null) {
  await db
    .insert(memberships)
    .values({ userId, organizationId: orgId, teamId, roleId })
    .onConflictDoNothing();
}

async function createTemplate(
  orgId: string, userId: string, name: string, desc: string, fields: unknown[], texPath: string,
) {
  const texSource = readFileSync(texPath, "utf-8");
  const [t] = await db.select({ id: templates.id, fields: templates.fields }).from(templates).where(eq(templates.name, name)).limit(1);
  if (t) {
    if (!t.fields || (t.fields as unknown[]).length === 0) {
      await db.update(templates).set({ fields: fields as never, texSource }).where(eq(templates.id, t.id));
    }
    return t.id;
  }
  const id = randomUUID();
  await db.insert(templates).values({ id, orgId, name, description: desc, createdBy: userId, fields: fields as never, texSource });
  return id;
}

// Idempotent: skips a meeting that already exists with the same title+org.
// `content` empty = scheduled meeting with no minutes yet; non-empty = minutes
// row inserted (templateId null for freeform). `status` controls draft/published.
async function createMeeting(
  orgId: string, teamId: string, templateId: string | null, title: string, scheduledAt: string,
  createdBy: string, content: Record<string, unknown> = {}, status: "draft" | "published" = "published",
) {
  const [existing] = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(and(eq(meetings.orgId, orgId), eq(meetings.title, title)))
    .limit(1);
  if (existing) return existing.id;

  const id = randomUUID();
  await db.insert(meetings).values({ id, orgId, templateId, title, scheduledAt: new Date(scheduledAt), createdBy });
  await db.insert(meetingTeams).values({ meetingId: id, teamId }).onConflictDoNothing();
  if (Object.keys(content).length > 0) {
    await db.insert(minutes).values({ id, templateId, status, content }).onConflictDoNothing();
  }
  return id;
}

async function ensureShare(minutesId: string, token: string, email: string | null, createdBy: string) {
  await db
    .insert(shares)
    .values({ id: randomUUID(), minutesId, token, email, createdBy })
    .onConflictDoNothing();
}

async function deleteMeeting(meetingId: string) {
  await db.delete(minutes).where(eq(minutes.id, meetingId));
  await db.delete(meetingTeams).where(eq(meetingTeams.meetingId, meetingId));
  await db.delete(meetings).where(eq(meetings.id, meetingId));
}

async function deleteOrg(orgId: string) {
  const orgMeetings = await db.select({ id: meetings.id }).from(meetings).where(eq(meetings.orgId, orgId));
  for (const m of orgMeetings) await deleteMeeting(m.id);
  await db.delete(memberships).where(eq(memberships.organizationId, orgId));
  const orgRoles = await db.select({ id: roles.id }).from(roles).where(eq(roles.orgId, orgId));
  if (orgRoles.length > 0) {
    await db.delete(rolePermissions).where(inArray(rolePermissions.roleId, orgRoles.map((r) => r.id)));
    await db.delete(roles).where(inArray(roles.id, orgRoles.map((r) => r.id)));
  }
  await db.delete(teams).where(eq(teams.orgId, orgId));
  await db.delete(templates).where(eq(templates.orgId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
}

// Remove everything a previous seed version created that the current demo no
// longer wants, so re-running the seed is repeatable.
// ponytail: demo-only nukes, matched by exact seed names — nothing user-made
// collides; if the demo ever grows real org data this becomes a fresh-DB script.
async function cleanupLegacyDemo() {
  const [board] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.name, "PCampus Administration Board"))
    .limit(1);
  if (board) await deleteOrg(board.id);

  const [pc] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.name, "PCampus"))
    .limit(1);
  if (!pc) return;

  const genericTemplates = ["Standard Meeting", "Daily Standup"];
  const tmpl = await db
    .select({ id: templates.id })
    .from(templates)
    .where(and(eq(templates.orgId, pc.id), inArray(templates.name, genericTemplates)));
  if (tmpl.length > 0) {
    const oldMeetings = await db
      .select({ id: meetings.id })
      .from(meetings)
      .where(inArray(meetings.templateId, tmpl.map((t) => t.id)));
    for (const m of oldMeetings) await deleteMeeting(m.id);
    await db.delete(templates).where(inArray(templates.id, tmpl.map((t) => t.id)));
  }

  const freeform = await db
    .select({ id: meetings.id })
    .from(meetings)
    .where(and(eq(meetings.orgId, pc.id), isNull(meetings.templateId)));
  for (const m of freeform) {
    const [row] = await db
      .select({ title: meetings.title })
      .from(meetings)
      .where(eq(meetings.id, m.id))
      .limit(1);
    if (row?.title === "Coffee Chat") await deleteMeeting(m.id);
  }

  const dropTeams = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.orgId, pc.id), inArray(teams.name, ["Design", "Marketing"])));
  for (const t of dropTeams) {
    await db.delete(memberships).where(eq(memberships.teamId, t.id));
    await db.delete(teams).where(eq(teams.id, t.id));
  }
}

// ─── main seed ─────────────────────────────────────────────────────────────

export async function seedDemo() {
  const adminId = await getUserId("admin@pcampus.edu.np");
  const secretaryId = await getUserId("secretary@pcampus.edu.np");
  const viewerId = await getUserId("viewer@pcampus.edu.np");
  const leadId = await getUserId("lead@pcampus.edu.np");
  if (!adminId) return;

  await cleanupLegacyDemo();

  // ── PCampus ─────────────────────────────────────────────────────────────

  const existing = await db.select({ id: organizations.id }).from(organizations)
    .where(eq(organizations.name, "PCampus")).limit(1);

  let pcampusId: string;
  if (existing.length > 0) {
    pcampusId = existing[0].id;
  } else {
    pcampusId = randomUUID();
    await db.insert(organizations).values({ id: pcampusId, name: "PCampus", slug: "pcampus" });
    await bootstrapOrgAdmin(pcampusId, adminId);
  }

  // org-wide admin + secretary roles, nested teams, memberships
  const adminRoleId = (await db.select({ id: roles.id }).from(roles)
    .where(and(eq(roles.orgId, pcampusId), eq(roles.name, "Admin"), isNull(roles.teamId))).limit(1))[0]?.id ?? null;
  if (adminRoleId && adminId) await ensureMember(adminId, pcampusId, null, adminRoleId);

  const engId = await ensureTeam(pcampusId, "Engineering");
  const rdId = await ensureTeam(pcampusId, "Research & Development", engId);

  for (const uid of [adminId, secretaryId, viewerId]) {
    if (uid) await ensureMember(uid, pcampusId, engId, null);
  }
  if (secretaryId) {
    const secRoleId = await ensureRole(pcampusId, "Secretary", null, "all");
    await ensureMember(secretaryId, pcampusId, null, secRoleId);
  }
  // Team-scoped role + holder on the Research & Development sub-team.
  if (leadId) {
    const leadRoleId = await ensureRole(pcampusId, "R&D Lead", rdId,
      ["create_meeting", "edit_meeting", "export_minutes", "manage_members"]);
    await ensureMember(leadId, pcampusId, rdId, leadRoleId);
  }

  // ── template ─────────────────────────────────────────────────────────────

  const pcampusMinuteId = await createTemplate(pcampusId, adminId,
    "PCampus Minute", "नेपाली क्याम्पस समिति बैठकको कार्यविवरण — उपस्थिति, प्रस्ताव, निर्णय र हस्ताक्षर",
    PCAMPUS_FIELDS, "db/seed/templates/pcampus-minute.hbs");

  // ── meetings: one per state the UI surfaces ──────────────────────────────

  // 1. Published Nepali template minutes (existing).
  const committee = await createMeeting(pcampusId, engId, pcampusMinuteId,
    "अनुसन्धान परियोजना कार्यान्वयन समितिको बैठक", "2026-03-18T02:45:00Z", adminId, {
    title: "अनुसन्धान परियोजना कार्यान्वयन समितिको बैठक",
    date_np: "२०८२/१२/०४",
    date_ad: "2026-03-18",
    day: "बुधबार",
    time: "राति ०२:४५ बजे",
    location: "क्याम्पस कार्यालय",
    committee: "University Grants Commission (UGC) द्वारा स्वीकृत अनुसन्धान परियोजना सञ्चालन गर्न का लागि गठित अनुसन्धान परियोजना कार्यान्वयन समिति",
    committee_name: "अनुसन्धान परियोजना कार्यान्वयन समिति",
    chair: "प्रा. विजय गुरुङ",
    attendees: [
      { name: "प्रा. विजय गुरुङ", designation: "EEC Chief", post: "संयोजक" },
      { name: "प्रा. हरि बहादुर", designation: "Campus Chief", post: "सचिव" },
      { name: "डा. गिता ओली", designation: "IOM Delegate", post: "सह सचिव" },
      { name: "डा. विकाश लामा", designation: "IMO Chief", post: "सचिव" },
      { name: "प्रा. सुनिता महार्जन", designation: "MSc Environmental Science", post: "सदस्य" },
      { name: "डा. कमल पाण्डे", designation: "PhD Civil Engineering", post: "आमन्त्रित" },
      { name: "प्रा. नवि तामाङ", designation: "MSc Computer Science", post: "आमन्त्रित" },
    ],
    proposals: [
      { item: "UGC द्वारा स्वीकृत अनुसन्धान परियोजना कार्यान्वयन सम्बन्धी छलफल" },
      { item: "अनुसन्धान टोली (PI, Co-I) गठन तथा जिम्मेवारी निर्धारण" },
      { item: "परियोजना सञ्चालन प्रक्रिया र समन्वयबारे निर्णय" },
      { item: "प्रशासनिक तथा प्राविधिक सहयोग सम्बन्धी छलफल" },
    ],
    decisions: [
      { item: "अनुसन्धान परियोजना कार्यान्वयनका लागि समिति गठन गर्ने निर्णय गरियो" },
      { item: "Principal Investigator र Co-Investigators नियुक्त गरियो" },
      { item: "परियोजना निर्धारित प्रस्ताव अनुसार सञ्चालन गर्ने निर्णय गरियो" },
      { item: "सम्बन्धित निकायहरूसँग समन्वय गरी कार्य अगाडि बढाउने निर्णय गरियो" },
    ],
  });

  // 2. Upcoming template meeting (scheduled, no minutes yet) — shows in «Upcoming».
  await createMeeting(pcampusId, engId, pcampusMinuteId,
    "Quarterly Planning Review — 2026", "2026-09-25T06:00:00Z", secretaryId ?? adminId);

  // 3. Draft minutes on the R&D sub-team — shows the Draft badge.
  await createMeeting(pcampusId, rdId, pcampusMinuteId,
    "Research Grant Proposal Review", "2026-08-05T08:00:00Z", leadId ?? adminId, {
    title: "Research Grant Proposal Review",
    date_ad: "2026-08-05",
    attendees: [{ name: "Diksha (R&D Lead)", designation: "R&D", post: "Coordinator" }],
    proposals: [{ item: "Proposal drafts circulated for comment" }],
    decisions: [],
  }, "draft");

  // 4. Freeform (no template) English minutes — shows the «No template» path.
  await createMeeting(pcampusId, engId, null,
    "Faculty Induction — Welcome Sync", "2026-07-30T09:00:00Z", adminId, {
    objective: "Welcome new faculty and walk through the onboarding checklist.",
    discussed: ["Course loads", "Mentorship pairing", "Lab access"],
    decisions: ["Hire two lab assistants", "Hold monthly faculty sync"],
  });

  // 5. Pre-seeded share on the published minutes — Share dialog shows it.
  if (adminId) await ensureShare(committee, randomUUID(), null, adminId);

  // ── Second org: shows org-agnostic / multi-tenant, English, no extra login ──

  const org2 = await db.select({ id: organizations.id }).from(organizations)
    .where(eq(organizations.name, "Riverside NGO")).limit(1);
  let riversideId: string;
  if (org2.length > 0) {
    riversideId = org2[0].id;
  } else {
    riversideId = randomUUID();
    await db.insert(organizations).values({ id: riversideId, name: "Riverside NGO", slug: "riverside-ngo" });
    await bootstrapOrgAdmin(riversideId, adminId);
  }

  const opsId = await ensureTeam(riversideId, "Field Operations");
  await createMeeting(riversideId, opsId, null,
    "Community Health Outreach — Planning", "2026-07-30T09:00:00Z", adminId, {
    agenda: ["Vaccination drive scheduling", "Volunteer roster"],
    decisions: ["Run weekly mobile clinics in Ward 4", "Partner with local health post"],
  });
  await createMeeting(riversideId, opsId, null,
    "Field Visit — Lamjung District", "2026-09-18T07:00:00Z", adminId);

  console.log("Seeded \"PCampus\" (teams, roles, template, minutes) and \"Riverside NGO\"");
}