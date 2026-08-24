import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invitations, organizations, roles, teams, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  hasPermission,
  resolveOrganizationAccess,
  resolveTeamAccess,
  validateRole,
} from "@/lib/permissions";
import {
  INVITE_TTL_DAYS,
  newInviteToken,
  pendingCondition,
  resolveInviteTargets,
} from "@/lib/invitations";
import { emailInviteLinks } from "@/lib/email";

async function requireManager(
  userId: string,
  orgId: string,
  teamId: string | null,
): Promise<Response | null> {
  const access = teamId
    ? await resolveTeamAccess(userId, teamId)
    : await resolveOrganizationAccess(userId, orgId);
  const ok = teamId
    ? access !== null && (access as { orgId: string }).orgId === orgId
    : access !== null;
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await hasPermission({ userId, orgId, ...(teamId ? { teamId } : {}) }, "manage_members"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  if (!(await resolveOrganizationAccess(user.id, orgId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      token: invitations.token,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
      teamName: teams.name,
      roleName: roles.name,
      creatorName: users.name,
    })
    .from(invitations)
    .leftJoin(teams, eq(teams.id, invitations.teamId))
    .leftJoin(roles, eq(roles.id, invitations.roleId))
    .innerJoin(users, eq(users.id, invitations.createdBy))
    .where(and(eq(invitations.organizationId, orgId), pendingCondition()))
    .orderBy(desc(invitations.createdAt));

  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const body = await req.json();
  const { emails, open, teamId, roleId } = body as {
    emails?: string[];
    open?: boolean;
    teamId?: string | null;
    roleId?: string | null;
  };

  const denied = await requireManager(currentUser.id, orgId, teamId || null);
  if (denied) return denied;

  const role = await validateRole(orgId, teamId, roleId);
  if ("error" in role) {
    return NextResponse.json({ error: role.error }, { status: role.status });
  }

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  const orgName = org?.name ?? "the organization";

  // Open invite link: one multi-use row anyone with the link can redeem.
  if (open) {
    const [row] = await db
      .insert(invitations)
      .values({
        organizationId: orgId,
        teamId: teamId || null,
        roleId: role.roleId,
        email: null,
        token: newInviteToken(),
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        createdBy: currentUser.id,
      })
      .returning({ token: invitations.token });
    return NextResponse.json({ openLink: row!.token, added: [], invited: [] }, { status: 201 });
  }

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json(
      { error: "emails is required (or open: true for a link)" },
      { status: 400 },
    );
  }

  const result = await resolveInviteTargets(orgId, emails, teamId || null, role.roleId, currentUser.id);
  const { emailed, emailErrors } = await emailInviteLinks(orgName, result.invited);

  return NextResponse.json({ ...result, emailed, emailErrors }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const denied = await requireManager(currentUser.id, orgId, null);
  if (denied) return denied;

  await db
    .delete(invitations)
    .where(and(eq(invitations.id, id), eq(invitations.organizationId, orgId)));
  return NextResponse.json({ success: true });
}
