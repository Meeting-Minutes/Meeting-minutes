import { NextResponse } from "next/server";
import { db } from "@/db";
import { meetings, meetingTeams, templates } from "@/db/schema";
import { eq, desc, and, or, ilike, gte, lte } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, resolveTeamAccess } from "@/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;
  const access = await resolveTeamAccess(user.id, teamId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(_req.url);
  const q = url.searchParams.get("q")?.trim();
  const from = url.searchParams.get("from")?.trim();
  const to = url.searchParams.get("to")?.trim();

  const conditions = [
    eq(meetingTeams.teamId, teamId),
    eq(meetings.orgId, access.orgId),
  ];

  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        ilike(meetings.title, pattern),
        ilike(meetings.description, pattern),
        ilike(meetings.location, pattern),
      )!,
    );
  }

  if (from) conditions.push(gte(meetings.scheduledAt, new Date(from)));
  if (to) conditions.push(lte(meetings.scheduledAt, new Date(to)));

  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      description: meetings.description,
      scheduledAt: meetings.scheduledAt,
      location: meetings.location,
      createdAt: meetings.createdAt,
    })
    .from(meetings)
    .innerJoin(meetingTeams, eq(meetingTeams.meetingId, meetings.id))
    .where(and(...conditions))
    .orderBy(desc(meetings.scheduledAt));

  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;
  const access = await resolveTeamAccess(currentUser.id, teamId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (
    !(await hasPermission(
      { userId: currentUser.id, orgId: access.orgId, teamId },
      "create_meeting",
    ))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, description, scheduledAt, location, templateId } = await req.json();

  if (!title || !scheduledAt) {
    return NextResponse.json({ error: "title and scheduledAt are required" }, { status: 400 });
  }

  if (templateId) {
    const [template] = await db
      .select({ id: templates.id, orgId: templates.orgId })
      .from(templates)
      .where(eq(templates.id, templateId))
      .limit(1);
    if (!template || template.orgId !== access.orgId) {
      return NextResponse.json({ error: "Template not found" }, { status: 400 });
    }
  }

  const meetingId = crypto.randomUUID();

  await db.insert(meetings).values({
    id: meetingId,
    orgId: access.orgId,
    title,
    description: description || null,
    scheduledAt: new Date(scheduledAt),
    location: location || null,
    createdBy: currentUser.id,
    ...(templateId ? { templateId } : {}),
  });

  await db.insert(meetingTeams).values({ meetingId, teamId });

  const [created] = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      description: meetings.description,
      scheduledAt: meetings.scheduledAt,
      location: meetings.location,
      templateId: meetings.templateId,
      createdAt: meetings.createdAt,
    })
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);

  return NextResponse.json(created, { status: 201 });
}
