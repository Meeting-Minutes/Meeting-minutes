import { NextResponse } from "next/server";
import { db } from "@/db";
import { memberships, users, organizations, roles } from "@/db/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import {
  resolveTeamAccess,
  resolveOrganizationAccess,
  hasPermission,
  validateRole,
  getOrgSuperadminRoleId,
  countSuperadminHolders,
} from "@/lib/permissions";
import { resolveInviteTargets } from "@/lib/invitations";
import { emailInviteLinks } from "@/lib/email";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const url = new URL(_req.url);
  const teamId = url.searchParams.get("teamId");

  if (teamId) {
    const teamAccess = await resolveTeamAccess(user.id, teamId);
    if (teamAccess?.orgId !== orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rows = await db
      .select({
        id: memberships.id,
        userId: memberships.userId,
        roleId: memberships.roleId,
        teamId: memberships.teamId,
        createdAt: memberships.createdAt,
        user: { id: users.id, email: users.email, name: users.name },
        roleName: roles.name,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .leftJoin(roles, eq(memberships.roleId, roles.id))
      .where(and(eq(memberships.organizationId, orgId), eq(memberships.teamId, teamId)))
      .orderBy(users.name);
    return NextResponse.json(rows);
  }

  const access = await resolveOrganizationAccess(user.id, orgId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await db
    .selectDistinctOn([memberships.userId], {
      id: memberships.id,
      userId: memberships.userId,
      roleId: memberships.roleId,
      teamId: memberships.teamId,
      createdAt: memberships.createdAt,
      user: { id: users.id, email: users.email, name: users.name },
      roleName: roles.name,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .leftJoin(roles, eq(memberships.roleId, roles.id))
    .where(
      access.orgWide
        ? eq(memberships.organizationId, orgId)
        : and(
          eq(memberships.organizationId, orgId),
          inArray(memberships.teamId, access.teamIds),
        ),
    )
    // Org-wide row wins for multi-membership users so the collapsed view
    // shows their base role, not an arbitrary team role.
    .orderBy(memberships.userId, sql`${memberships.teamId} nulls first`);

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
  const { email, teamId, roleId } = body as {
    email?: string;
    teamId?: string | null;
    roleId?: string | null;
  };
  const emails: string[] | undefined = Array.isArray(body.emails)
    ? body.emails
    : email
      ? [email]
      : undefined;

  const access = teamId
    ? await resolveTeamAccess(currentUser.id, teamId)
    : await resolveOrganizationAccess(currentUser.id, orgId);
  const ok = teamId
    ? access !== null && (access as { orgId: string }).orgId === orgId
    : access !== null;
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (
    !(await hasPermission(
      { userId: currentUser.id, orgId, ...(teamId ? { teamId } : {}) },
      "manage_members",
    ))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!emails || emails.length === 0) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const role = await validateRole(orgId, teamId, roleId);
  if ("error" in role) {
    return NextResponse.json({ error: role.error }, { status: role.status });
  }

  // Accounts are self-created: known users join directly, unknown emails get
  // a single-use join link (emailed when SMTP is configured, returned for the
  // UI to display otherwise).
  const result = await resolveInviteTargets(orgId, emails, teamId || null, role.roleId, currentUser.id);

  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  const { emailed, emailErrors } = await emailInviteLinks(org?.name ?? "the organization", result.invited);

  const alreadyMembers = emails
    .map((e) => e.trim().toLowerCase())
    .filter((e) => !result.added.includes(e) && !result.invited.some((i) => i.email === e));

  return NextResponse.json({
    added: result.added,
    invited: result.invited,
    alreadyMembers,
    emailed,
    emailErrors,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const { userId, teamId, roleId } = await req.json();

  const access = teamId
    ? await resolveTeamAccess(currentUser.id, teamId)
    : await resolveOrganizationAccess(currentUser.id, orgId);
  const ok = teamId
    ? access !== null && (access as { orgId: string }).orgId === orgId
    : access !== null;
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (
    !(await hasPermission(
      { userId: currentUser.id, orgId, ...(teamId ? { teamId } : {}) },
      "manage_members",
    ))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const role = await validateRole(orgId, teamId, roleId);
  if ("error" in role) {
    return NextResponse.json({ error: role.error }, { status: role.status });
  }

  const conditions = [
    eq(memberships.userId, userId),
    eq(memberships.organizationId, orgId),
  ];
  if (teamId) {
    conditions.push(eq(memberships.teamId, teamId));
  } else {
    conditions.push(isNull(memberships.teamId));
  }

  // Lockout guard: demoting an ORG-WIDE Superadmin holder away from the
  // Superadmin role must not leave the org with zero Superadmin holders.
  // (Team-scoped demotions never touch org-wide holders, so nothing to guard.)
  const superadminRoleId = await getOrgSuperadminRoleId(orgId);
  if (superadminRoleId && !teamId && role.roleId !== superadminRoleId) {
    const [target] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(...conditions, eq(memberships.roleId, superadminRoleId)))
      .limit(1);
    if (target) {
      const others = await countSuperadminHolders(orgId);
      if (others <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last Superadmin — the org would lose all admin access." },
          { status: 400 },
        );
      }
    }
  }

  const [membership] = await db
    .update(memberships)
    .set({ roleId: role.roleId })
    .where(and(...conditions))
    .returning();

  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(membership);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const { userId, teamId, all } = await req.json();

  // Self-leave is always allowed; removing someone else needs manage_members.
  if (userId !== currentUser.id) {
    const access = teamId
      ? await resolveTeamAccess(currentUser.id, teamId)
      : await resolveOrganizationAccess(currentUser.id, orgId);
    const ok = teamId
      ? access !== null && (access as { orgId: string }).orgId === orgId
      : access !== null;
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (
      !(await hasPermission(
        { userId: currentUser.id, orgId, ...(teamId ? { teamId } : {}) },
        "manage_members",
      ))
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // An org with no org-wide members has nobody who can manage it (team
  // members only see their teams) — block removal of the last one.
  // (Leaving entirely, `all: true`, drops every row but still hits this guard.)
  if (!teamId) {
    const [target] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.organizationId, orgId),
          isNull(memberships.teamId),
        ),
      )
      .limit(1);
    if (target) {
      const others = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.organizationId, orgId),
            isNull(memberships.teamId),
          ),
        );
      if (others.length <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last organization-wide member" },
          { status: 400 },
        );
      }
    }
  }

  const conditions = [
    eq(memberships.userId, userId),
    eq(memberships.organizationId, orgId),
  ];
  if (all === true && userId === currentUser.id) {
    // Lockout guard: leaving the org entirely can't drop the last Superadmin.
    const superadminRoleId = await getOrgSuperadminRoleId(orgId);
    if (superadminRoleId) {
      const [holds] = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, userId),
            eq(memberships.organizationId, orgId),
            isNull(memberships.teamId),
            eq(memberships.roleId, superadminRoleId),
          ),
        )
        .limit(1);
      if (holds) {
        const others = await countSuperadminHolders(orgId);
        if (others <= 1) {
          return NextResponse.json(
            { error: "Cannot leave — you are the last Superadmin. Assign Superadmin to someone else first." },
            { status: 400 },
          );
        }
      }
    }
    await db.delete(memberships).where(and(...conditions));
    return NextResponse.json({ success: true });
  }
  if (teamId) {
    conditions.push(eq(memberships.teamId, teamId));
  } else {
    conditions.push(isNull(memberships.teamId));
  }

  // Lockout guard: removing an org-wide member who is the last Superadmin.
  const superadminRoleId2 = await getOrgSuperadminRoleId(orgId);
  if (superadminRoleId2 && !teamId) {
    const [target] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(...conditions, eq(memberships.roleId, superadminRoleId2)))
      .limit(1);
    if (target) {
      const others = await countSuperadminHolders(orgId);
      if (others <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last Superadmin — the org would lose all admin access." },
          { status: 400 },
        );
      }
    }
  }

  await db.delete(memberships).where(and(...conditions));
  return NextResponse.json({ success: true });
}