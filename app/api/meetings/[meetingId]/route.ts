import { NextResponse } from "next/server";
import { db } from "@/db";
import { meetings, meetingTeams, templates, minutes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import {
  hasPermission,
  resolveTeamAccess,
  resolveOrganizationAccess,
} from "@/lib/permissions";

// Resolve the org a meeting belongs to and verify the user can see it via any
// of its teams (or org-wide access). Returns null when the user has no path.
async function resolveMeetingAccess(userId: string, meetingId: string) {
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);
  if (!meeting || !meeting.orgId) return null;

  const orgId = meeting.orgId;
  const orgWide = await resolveOrganizationAccess(userId, orgId);

  if (orgWide?.orgWide) {
    return { meeting, orgId };
  }

  const teamRows = await db
    .select({ teamId: meetingTeams.teamId })
    .from(meetingTeams)
    .where(eq(meetingTeams.meetingId, meetingId));

  for (const { teamId } of teamRows) {
    if (!teamId) continue;
    const access = await resolveTeamAccess(userId, teamId);
    if (access && access.orgId === orgId) {
      return { meeting, orgId };
    }
  }

  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { meetingId } = await params;
  const access = await resolveMeetingAccess(user.id, meetingId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [template] = access.meeting.templateId
    ? await db
        .select()
        .from(templates)
        .where(eq(templates.id, access.meeting.templateId!))
        .limit(1)
    : [null];

  const [minutesRow] = await db
    .select()
    .from(minutes)
    .where(eq(minutes.id, meetingId))
    .limit(1);

  return NextResponse.json({
    meeting: {
      id: access.meeting.id,
      orgId: access.meeting.orgId,
      title: access.meeting.title,
      description: access.meeting.description,
      location: access.meeting.location,
      scheduledAt: access.meeting.scheduledAt,
      createdAt: access.meeting.createdAt,
    },
    template: template,
    minutes: minutesRow ?? null,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { meetingId } = await params;
  const access = await resolveMeetingAccess(user.id, meetingId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (
    !(await hasPermission(
      { userId: user.id, orgId: access.orgId },
      "edit_meeting",
    ))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, description, location, scheduledAt } = await req.json();

  const [updated] = await db
    .update(meetings)
    .set({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description || null }),
      ...(location !== undefined && { location: location || null }),
      ...(scheduledAt !== undefined && { scheduledAt: new Date(scheduledAt) }),
    })
    .where(eq(meetings.id, meetingId))
    .returning();

  return NextResponse.json(updated);
}