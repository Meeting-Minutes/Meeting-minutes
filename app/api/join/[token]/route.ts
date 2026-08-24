import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { invitations, memberships, organizations } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isExpired } from "@/lib/invitations";

/** Accept an invitation as the signed-in user. Targeted invites are
 *  single-use and bound to the invited email; open links are multi-use. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await params;
  const [invite] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);
  if (!invite || isExpired(invite)) {
    return NextResponse.json({ error: "This invite link is invalid or expired" }, { status: 404 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json({ error: "This invite has already been used" }, { status: 409 });
  }

  // Targeted invites are only redeemable by the invited account.
  if (invite.email && invite.email !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: `This invite was sent to ${invite.email} — sign in with that account` },
      { status: 403 },
    );
  }

  const [membership] = await db
    .insert(memberships)
    .values({
      userId: user.id,
      organizationId: invite.organizationId,
      teamId: invite.teamId,
      roleId: invite.roleId,
    })
    .onConflictDoNothing()
    .returning();

  if (invite.email && !membership) {
    return NextResponse.json(
      { error: "You are already a member of this organization" },
      { status: 409 },
    );
  }

  if (invite.email) {
    await db
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(and(eq(invitations.id, invite.id)));
  }

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, invite.organizationId))
    .limit(1);

  return NextResponse.json({ orgName: org?.name ?? "the organization" });
}
