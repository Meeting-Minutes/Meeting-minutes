import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  shares,
  minutes,
  meetings,
  organizations,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, resolveMeetingAccess } from "@/lib/permissions";
import { sendEmail, emailConfigured, appUrl } from "@/lib/email";

function shareUrl(token: string) {
  return `${appUrl()}/share/${token}`;
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
  if (
    !(await hasPermission({ userId: user.id, orgId: access.orgId }, "export_minutes"))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(shares)
    .where(eq(shares.minutesId, meetingId))
    .orderBy(shares.createdAt);

  return NextResponse.json({
    shares: rows.map((r) => ({
      id: r.id,
      email: r.email,
      url: shareUrl(r.token),
      createdAt: r.createdAt,
    })),
  });
}

export async function POST(
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
      "export_minutes",
    ))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const emails = Array.isArray(body.emails) ? body.emails : [];
  const anyone = body.anyone === true;
  if (emails.length === 0 && !anyone) {
    return NextResponse.json(
      { error: "Provide emails or anyone:true" },
      { status: 400 },
    );
  }

  const [meeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);
  const [minutesRow] = await db
    .select()
    .from(minutes)
    .where(eq(minutes.id, meetingId))
    .limit(1);
  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, access.orgId))
    .limit(1);
  if (!minutesRow || !org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const title = meeting?.title ?? "Minutes";

  const created: { id: string; email: string | null; url: string }[] = [];
  const emailsList: string[] = Array.isArray(body.emails)
    ? body.emails.filter((e: unknown): e is string => typeof e === "string")
    : [];
  for (const email of [
    ...new Set(emailsList.map((e) => e.trim()).filter((e) => e.includes("@"))),
  ]) {
    const [row] = await db
      .insert(shares)
      .values({
        id: randomUUID(),
        minutesId: meetingId,
        token: randomBytes(16).toString("base64url"),
        email,
        createdBy: user.id,
      })
      .returning();
    created.push({ id: row.id, email, url: shareUrl(row.token) });
  }
  if (anyone) {
    const [row] = await db
      .insert(shares)
      .values({
        id: randomUUID(),
        minutesId: meetingId,
        token: randomBytes(16).toString("base64url"),
        email: null,
        createdBy: user.id,
      })
      .returning();
    created.push({ id: row.id, email: null, url: shareUrl(row.token) });
  }

  const emailed: string[] = [];
  const emailErrors: { email: string; error: string }[] = [];
  if (emailConfigured()) {
    for (const share of created.filter((s) => s.email)) {
      try {
        await sendEmail({
          to: share.email!,
          subject: `Shared minutes: ${title}`,
          text: `${title} has been shared with you.\n\nOpen it at ${share.url}`,
        });
        emailed.push(share.email!);
      } catch (e) {
        emailErrors.push({ email: share.email!, error: (e as Error).message });
      }
    }
  }

  return NextResponse.json({
    shareWith: emails,
    anyone,
    shares: created,
    emailed,
    emailErrors,
    smtpEnabled: emailConfigured(),
  });
}

export async function DELETE(
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
      "export_minutes",
    ))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { shareId } = await req.json();
  if (!shareId) {
    return NextResponse.json({ error: "shareId is required" }, { status: 400 });
  }
  await db
    .delete(shares)
    .where(and(eq(shares.id, shareId), eq(shares.minutesId, meetingId)));
  return NextResponse.json({ success: true });
}