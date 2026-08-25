import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  meetings,
  meetingTeams,
  minutes,
  templates,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import {
  hasPermission,
  resolveTeamAccess,
  resolveOrganizationAccess,
} from "@/lib/permissions";

async function resolveMeetingAccess(userId: string, meetingId: string) {
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);
  if (!meeting) return null;
  const orgAccess = await resolveOrganizationAccess(userId, meeting.orgId!);
  if (orgAccess?.orgWide) return { meeting, orgId: meeting.orgId! };
  const teamRows = await db
    .select({ teamId: meetingTeams.teamId })
    .from(meetingTeams)
    .where(eq(meetingTeams.meetingId, meetingId));
  for (const { teamId } of teamRows) {
    if (!teamId) continue;
    const accessRow = await resolveTeamAccess(userId, teamId);
    if (accessRow && accessRow.orgId === meeting.orgId) {
      return { meeting, orgId: meeting.orgId! };
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

  const [minutesRow] = await db
    .select()
    .from(minutes)
    .where(eq(minutes.id, meetingId))
    .limit(1);

  const templateId = minutesRow?.templateId ?? access.meeting.templateId;
  let template: { id: string; name: string; fields: unknown; texSource: string | null } | null = null;
  if (templateId) {
    const [tmpl] = await db
      .select({ id: templates.id, name: templates.name, fields: templates.fields, texSource: templates.texSource })
      .from(templates)
      .where(eq(templates.id, templateId))
      .limit(1);
    template = tmpl ? { ...tmpl, fields: tmpl.fields ?? [] } : null;
  }

  return NextResponse.json({
    minutes: minutesRow,
    template,
    templateSource: template?.texSource ?? null,
    content: (minutesRow?.content as Record<string, unknown>) ?? {},
    meetingTitle: access.meeting.title,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { meetingId } = await params;
  const access = await resolveMeetingAccess(user.id, meetingId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await hasPermission({ userId: user.id, orgId: access.orgId }, "edit_meeting"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { templateId, status, content } = body as {
    templateId?: string | null;
    status?: "draft" | "published";
    content?: Record<string, unknown>;
  };

  const [minutesRow] = await db
    .select()
    .from(minutes)
    .where(eq(minutes.id, meetingId))
    .limit(1);

  const templateIdToStore = templateId ?? minutesRow?.templateId ?? access.meeting.templateId ?? null;

  const data = {
    templateId: templateIdToStore,
    ...(status !== undefined && { status }),
    ...(content !== undefined && { content }),
    updatedAt: new Date(),
  };

  if (minutesRow) {
    await db.update(minutes).set(data).where(eq(minutes.id, meetingId));
  } else {
    await db.insert(minutes).values({
      id: meetingId,
      templateId: templateIdToStore,
      status: status ?? "draft",
      content: content ?? {},
    });
  }

  return NextResponse.json({ success: true });
}


export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { meetingId } = await params;
  const access = await resolveMeetingAccess(user.id, meetingId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await hasPermission({ userId: user.id, orgId: access.orgId }, "delete_meeting"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Shares cascade-delete with their minutes row (FK onDelete cascade).
  await db.delete(minutes).where(eq(minutes.id, meetingId));
  return NextResponse.json({ success: true });
}
