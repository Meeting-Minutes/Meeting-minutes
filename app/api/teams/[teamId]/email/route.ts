import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, resolveTeamAccess } from "@/lib/permissions";
import { sendEmail, emailConfigured, teamEmails } from "@/lib/email";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;
  const access = await resolveTeamAccess(user.id, teamId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (
    !(await hasPermission(
      { userId: user.id, orgId: access.orgId, teamId },
      "manage_members",
    ))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { subject, message } = await req.json();
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "subject and message are required" }, { status: 400 });
  }

  const emailed: string[] = [];
  const emailErrors: { email: string; error: string }[] = [];
  for (const to of await teamEmails(access.orgId, teamId)) {
    try {
      await sendEmail({ to, subject: subject.trim(), text: message.trim() });
      emailed.push(to);
    } catch (e) {
      emailErrors.push({ email: to, error: (e as Error).message });
    }
  }

  return NextResponse.json({ emailed, emailErrors, smtpEnabled: emailConfigured() });
}
