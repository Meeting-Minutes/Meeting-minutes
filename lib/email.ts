import "server-only";
import nodemailer from "nodemailer";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { INVITE_TTL_DAYS, inviteUrl } from "@/lib/invitations";

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

/** Emails of everyone who can see a team: org-wide members plus that team's. */
export async function teamEmails(orgId: string, teamId: string): Promise<string[]> {
  const rows = await db
    .select({ email: users.email })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(
      and(
        eq(memberships.organizationId, orgId),
        or(isNull(memberships.teamId), eq(memberships.teamId, teamId)),
      ),
    );
  return [...new Set(rows.map((r) => r.email))];
}

export function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error("SMTP not configured (set SMTP_HOST)");
  const port = Number(process.env.SMTP_PORT || 587);
  const auth = process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
    : undefined;
  const transport = nodemailer.createTransport(
    port === 465
      ? { host, port: 465, secure: true, auth }
      : { host, port, secure: false, auth },
  );
  await transport.sendMail({
    // Authenticated relays (Gmail, SES) reject a From they don't own, so the
    // login address is a better default than a synthetic no-reply@<host>.
    // `||` not `??`: blank env vars are "" and must fall through.
    from: process.env.SMTP_FROM || process.env.SMTP_USER || `no-reply@${host}`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });
}

/** Best-effort email of join links; returns per-email errors. */
export async function emailInviteLinks(
  orgName: string,
  invited: { email: string; token: string }[],
): Promise<{ emailed: string[]; emailErrors: { email: string; error: string }[] }> {
  const emailed: string[] = [];
  const emailErrors: { email: string; error: string }[] = [];
  for (const { email, token } of invited) {
    try {
      await sendEmail({
        to: email,
        subject: `Join ${orgName}`,
        text: `You've been invited to ${orgName}. Create your account or sign in with your existing one:\n\n${inviteUrl(token)}\n\nThe link expires in ${INVITE_TTL_DAYS} days.`,
      });
      emailed.push(email);
    } catch (e) {
      emailErrors.push({ email, error: (e as Error).message });
    }
  }
  return { emailed, emailErrors };
}