import { randomUUID } from "node:crypto";
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
} from "../schema";
import { eq, ne } from "drizzle-orm";
import { bootstrapOrgAdmin } from "@/lib/permissions";

// ─── standard committee template ───────────────────────────────────────────

const COMMITTEE_FIELDS = [
  { name: "title", label: "Meeting Title", type: "text" },
  { name: "date", label: "Date", type: "date" },
  { name: "subject", label: "Subject", type: "textarea" },
  { name: "attendees", label: "Attendees", type: "table", config: { columns: [{ key: "name", label: "Name" }, { key: "role", label: "Role" }, { key: "notes", label: "Notes" }] } },
  { name: "agenda", label: "Agenda", type: "table", config: { columns: [{ key: "item", label: "Item" }, { key: "decision", label: "Decision" }] } },
  { name: "notes", label: "Notes", type: "textarea" },
  { name: "signatures", label: "Signatures", type: "table", config: { columns: [{ key: "name", label: "Name" }] } },
];

// ─── daily standup template ────────────────────────────────────────────────

const STANDUP_FIELDS = [
  { name: "title", label: "Title", type: "text" },
  { name: "date", label: "Date", type: "date" },
  { name: "updates", label: "Team Updates", type: "table", config: { columns: [{ key: "name", label: "Name" }, { key: "yesterday", label: "Yesterday" }, { key: "today", label: "Today" }, { key: "blockers", label: "Blockers" }] } },
  { name: "actions", label: "Action Items", type: "table", config: { columns: [{ key: "item", label: "Item" }, { key: "owner", label: "Owner" }] } },
];

// ─── HOA template ──────────────────────────────────────────────────────────

const HOA_FIELDS = [
  { name: "title", label: "Meeting Title", type: "text" },
  { name: "date", label: "Date", type: "date" },
  { name: "agenda", label: "Agenda", type: "table", config: { columns: [{ key: "item", label: "Item" }, { key: "decision", label: "Decision" }] } },
  { name: "action_items", label: "Action Items", type: "table", config: { columns: [{ key: "action", label: "Action" }, { key: "owner", label: "Owner" }, { key: "due", label: "Due Date" }] } },
  { name: "notes", label: "Notes", type: "textarea" },
  { name: "signers", label: "Signatures", type: "table", config: { columns: [{ key: "name", label: "Name" }] } },
];

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

async function createSecretaryRole(orgId: string, userId: string) {
  const perms = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(ne(permissions.key, "superuser"));
  const [r] = await db
    .insert(roles)
    .values({ id: randomUUID(), name: "Secretary", orgId })
    .onConflictDoNothing()
    .returning();
  if (!r) return;
  await db.insert(rolePermissions).values(perms.map((p) => ({ roleId: r.id, permissionId: p.id })));
  await db.insert(memberships).values({ userId, organizationId: orgId, roleId: r.id }).onConflictDoNothing();
}

async function createTemplate(
  orgId: string, userId: string, name: string, desc: string, fields: unknown[], texPath: string,
) {
  const [t] = await db.select({ id: templates.id, fields: templates.fields }).from(templates).where(eq(templates.name, name)).limit(1);
  if (t) {
    if (!t.fields || (t.fields as unknown[]).length === 0) {
      await db.update(templates).set({ fields: fields as never }).where(eq(templates.id, t.id));
    }
    return t.id;
  }
  const id = randomUUID();
  await db.insert(templates).values({ id, orgId, name, description: desc, createdBy: userId, fields: fields as never, texPath });
  return id;
}

async function createMeeting(
  orgId: string, teamId: string, templateId: string | null, title: string, scheduledAt: string,
  createdBy: string, content: Record<string, unknown>,
) {
  const id = randomUUID();
  await db.insert(meetings).values({ id, orgId, templateId, title, scheduledAt: new Date(scheduledAt), createdBy });
  await db.insert(meetingTeams).values({ meetingId: id, teamId }).onConflictDoNothing();
  if (templateId && Object.keys(content).length > 0) {
    await db.insert(minutes).values({ id, templateId, status: "published", content }).onConflictDoNothing();
  }
  return id;
}

// ─── main seed ─────────────────────────────────────────────────────────────

export async function seedDemo() {
  const adminId = await getUserId("admin@pcampus.edu.np");
  const secretaryId = await getUserId("secretary@pcampus.edu.np");
  const viewerId = await getUserId("viewer@pcampus.edu.np");
  if (!adminId) return;

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

    const teamNames = ["Engineering", "Design", "Marketing"];
    for (const name of teamNames) {
      const teamId = randomUUID();
      await db.insert(teams).values({ id: teamId, orgId: pcampusId, name });
      for (const uid of [adminId, secretaryId, viewerId]) {
        if (uid) await db.insert(memberships).values({ userId: uid, organizationId: pcampusId, teamId }).onConflictDoNothing();
      }
    }
    if (secretaryId) await createSecretaryRole(pcampusId, secretaryId);
  }

  const [eng] = await db.select({ id: teams.id }).from(teams).where(eq(teams.name, "Engineering")).limit(1);
  const teamId = eng?.id ?? "";

  // ── templates ───────────────────────────────────────────────────────────

  const committeeId = await createTemplate(pcampusId, adminId,
    "Standard Meeting", "Formal meeting with attendance, agenda, notes, and signatures",
    COMMITTEE_FIELDS, "db/seed/templates/standard-meeting.hbs");

  const standupId = await createTemplate(pcampusId, adminId,
    "Daily Standup", "Quick daily update with team updates and action items",
    STANDUP_FIELDS, "db/seed/templates/daily-standup.hbs");

  const pcampusMinuteId = await createTemplate(pcampusId, adminId,
    "PCampus Minute", "नेपाली क्याम्पस समिति बैठकको कार्यविवरण — उपस्थिति, प्रस्ताव, निर्णय र हस्ताक्षर",
    PCAMPUS_FIELDS, "db/seed/templates/pcampus-minute.hbs");

  // ── meetings with content ───────────────────────────────────────────────

  await createMeeting(pcampusId, teamId, committeeId, "Q3 Budget Review", "2026-07-20T10:00:00Z", adminId, {
    title: "Q3 Budget Review",
    date: "2026-07-20",
    subject: "Quarterly budget allocation and spending forecast",
    attendees: [
      { name: "Aarav Sharma", role: "Chair", notes: "" },
      { name: "Bina Adhikari", role: "Secretary", notes: "" },
      { name: "Chirag Thapa", role: "Finance Lead", notes: "Presented budget slides" },
    ],
    agenda: [
      { item: "Review Q2 spending vs budget", decision: "On track; Rs 1.2L under" },
      { item: "Approve Q3 hiring budget", decision: "Approved — Rs 8L for 2 new hires" },
      { item: "Infrastructure upgrade proposal", decision: "Deferred to next meeting for cost analysis" },
    ],
    notes: "Meeting ran on schedule. Bina will send updated budget spreadsheet by Friday. Next meeting: August 17.",
    signatures: [{ name: "Aarav Sharma" }, { name: "Bina Adhikari" }],
  });

  await createMeeting(pcampusId, teamId, committeeId, "Sprint 12 Retrospective", "2026-07-28T14:00:00Z", adminId, {
    title: "Sprint 12 Retrospective",
    date: "2026-07-28",
    subject: "What went well, what didn't, and action items for Sprint 13",
    attendees: [
      { name: "Aarav Sharma", role: "Scrum Master", notes: "" },
      { name: "Deepak Rai", role: "Developer", notes: "" },
      { name: "Elisha Gurung", role: "Developer", notes: "Remote via Teams" },
    ],
    agenda: [
      { item: "What went well", decision: "CI pipeline improvements saved 2h/week; team velocity up 15%" },
      { item: "What needs improvement", decision: "Code review turnaround too slow; aim for 24h SLA" },
      { item: "Sprint 13 commitments", decision: "6 story points per dev; focus on auth module refactor" },
    ],
    notes: "Team morale is high. Deepak volunteered to draft a code-review SLA for team discussion.",
    signatures: [{ name: "Aarav Sharma" }],
  });

  await createMeeting(pcampusId, teamId, standupId, "Daily Standup — Aug 1", "2026-08-01T09:00:00Z", adminId, {
    title: "Daily Standup — Aug 1",
    date: "2026-08-01",
    updates: [
      { name: "Aarav", yesterday: "Finalized sprint goals with PM", today: "Start auth module refactor", blockers: "None" },
      { name: "Deepak", yesterday: "Fixed CI flaky test", today: "Code review backlog", blockers: "Waiting on staging access" },
      { name: "Elisha", yesterday: "API docs update", today: "Auth module pairing with Aarav", blockers: "None" },
    ],
    actions: [
      { item: "Grant Deepak staging access", owner: "Aarav" },
      { item: "Schedule auth module architecture review", owner: "Elisha" },
    ],
  });

  await createMeeting(pcampusId, teamId, null, "Coffee Chat", "2026-08-03T15:00:00Z", adminId, {});

  await createMeeting(pcampusId, teamId, pcampusMinuteId,
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

  console.log("Seeded \"PCampus\" with teams, templates, and meetings");

  // ── PCampus Administration Board ────────────────────────────────────────

  const existingH = await db.select({ id: organizations.id }).from(organizations)
    .where(eq(organizations.name, "PCampus Administration Board")).limit(1);

  let boardId: string;
  if (existingH.length > 0) {
    boardId = existingH[0].id;
  } else {
    boardId = randomUUID();
    await db.insert(organizations).values({ id: boardId, name: "PCampus Administration Board", slug: "pcampus-admin-board" });
    // In this org, secretary is admin — showing different roles per org
    const boardAdmin = secretaryId ?? adminId;
    await bootstrapOrgAdmin(boardId, boardAdmin);
    const boardTeamId = randomUUID();
    await db.insert(teams).values({ id: boardTeamId, orgId: boardId, name: "Board" });
    for (const uid of [adminId, secretaryId, viewerId]) {
      if (uid) await db.insert(memberships).values({ userId: uid, organizationId: boardId, teamId: boardTeamId }).onConflictDoNothing();
    }
    // viewer gets editor role in this org (different from viewer-only in PCampus)
    if (viewerId) await createSecretaryRole(boardId, viewerId);
  }

  const [bt] = await db.select({ id: teams.id }).from(teams).where(eq(teams.orgId, boardId)).limit(1);
  const boardTeamId = bt?.id ?? "";

  const boardTemplateId = await createTemplate(boardId, adminId,
    "Board Meeting", "Campus administration board meeting agenda and action items",
    HOA_FIELDS, "db/seed/templates/hoa-meeting.hbs");

  await createMeeting(boardId, boardTeamId, boardTemplateId,
    "August 2026 Board Meeting", "2026-08-05T18:30:00Z", adminId, {
    title: "August 2026 Board Meeting",
    date: "2026-08-05",
    agenda: [
      { item: "Campus infrastructure maintenance contracts", decision: "Approved — 2-year extension with CampusCare Services" },
      { item: "Library renovation budget increase", decision: "Approved — 10% increase for digital resources" },
      { item: "New department proposal", decision: "Approved with conditions — must submit plan by Sept 1" },
    ],
    action_items: [
      { action: "Sign infrastructure contract", owner: "Finance Officer", due: "2026-08-15" },
      { action: "Review department plan", owner: "Board Secretary", due: "2026-09-01" },
      { action: "Send renovation notice to faculty", owner: "Campus Manager", due: "2026-08-10" },
    ],
    notes: "Quorum was met (4 of 5 board members present). Next meeting scheduled for October 7.",
    signers: [{ name: "Board President" }, { name: "Board Secretary" }],
  });

  console.log("Seeded \"PCampus Administration Board\" with template and meeting");
}
