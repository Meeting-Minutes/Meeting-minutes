// Pure invite logic — deliberately free of "server-only"/email imports so
// check scripts (`db:check:shares`) can exercise resolveInviteTargets.
import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invitations, memberships, users } from "@/db/schema";

export const INVITE_TTL_DAYS = 7;

export function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Public base URL for links in emails. Prefers an explicit APP_URL, then the
 *  Vercel-provided production/deployment domain, then localhost — so invite
 *  links don't silently point at localhost when APP_URL isn't configured. */
export function appBaseUrl(): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export function inviteUrl(token: string): string {
  return `${appBaseUrl()}/join/${token}`;
}

export function isExpired(row: { expiresAt: Date }): boolean {
  return row.expiresAt.getTime() < Date.now();
}

/** Pending = not consumed (targeted) and not expired. Open links stay until
 *  revoked; `acceptedAt` only marks targeted invites as used. */
export function pendingCondition() {
  return and(isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date()));
}

/**
 * Split a list of invite emails into direct adds vs invitation tokens:
 * existing accounts are added to the org right away (no credential ceremony —
 * people already own their passwords); unknown emails get a join link.
 */
export async function resolveInviteTargets(
  orgId: string,
  emails: string[],
  teamId: string | null,
  roleId: string | null,
  createdBy: string,
): Promise<{
  added: string[];
  invited: { email: string; token: string }[];
}> {
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const added: string[] = [];
  const invited: { email: string; token: string }[] = [];

  for (const email of unique) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      const [membership] = await db
        .insert(memberships)
        .values({ userId: user.id, organizationId: orgId, teamId, roleId })
        .onConflictDoNothing()
        .returning();
      if (membership) added.push(email);
      continue;
    }

    const [row] = await db
      .insert(invitations)
      .values({
        organizationId: orgId,
        teamId,
        roleId,
        email,
        token: newInviteToken(),
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        createdBy,
      })
      .returning({ token: invitations.token });
    invited.push({ email, token: row!.token });
  }

  return { added, invited };
}
