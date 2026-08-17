import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { memberships, users, roles, organizations } from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { getCurrentUser, createUser } from "@/lib/auth";
import { sendEmail, appUrl } from "@/lib/email";
import {
  isRoleScopeValid,
  resolveTeamAccess,
  resolveOrganizationAccess,
  hasPermission,
} from "@/lib/permissions";
async function validateRole(
  orgId: string,
  teamId: string | null | undefined,
  roleId: string | null | undefined,
): Promise<{ roleId: string | null } | { error: string; status: number }> {
  if (!roleId) return { roleId: null };
  const [role] = await db
    .select()
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);
  if (!role) return { error: "Role not found", status: 404 };
  if (role.orgId !== orgId) return { error: "Role does not belong to this org", status: 400 };
  const membershipTeamId = teamId || null;
  if (!isRoleScopeValid(role.teamId, membershipTeamId)) {
    return { error: "Role scope does not match the membership's team", status: 400 };
  }
  return { roleId };
}

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
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
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
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(
      access.orgWide
        ? eq(memberships.organizationId, orgId)
        : and(
          eq(memberships.organizationId, orgId),
          inArray(memberships.teamId, access.teamIds),
        ),
    )
    .orderBy(memberships.userId);

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
  const emails: { email: string; name?: string }[] | undefined = body.emails;

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

  if (emails !== undefined) {
    const role = await validateRole(orgId, teamId, roleId);
    if ("error" in role) {
      return NextResponse.json({ error: role.error }, { status: role.status });
    }

    const sendInvite = body.sendInvite === true;
    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    const orgName = org?.name ?? "organization";

    const unique = [
      ...new Map(
        emails
          .map((e) =>
            typeof e === "string" ? { email: e } : e,
          )
          .filter((e) => typeof e.email === "string" && e.email.trim() !== "")
          .map((e) => [e.email.trim().toLowerCase(), e]),
      ).values(),
    ];

    const created: { email: string; name?: string; password: string }[] = [];
    const alreadyMembers: string[] = [];
    const emailed: string[] = [];
    const emailedSet = new Set<string>();
    const emailErrors: { email: string; error: string }[] = [];

    for (const { email, name } of unique) {
      let [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      let password = "";
      if (!user) {
        password = randomBytes(12).toString("base64url");
        user = await createUser(name ?? email, email, password);
        created.push({ email, name, password });
      }

      const [membership] = await db
        .insert(memberships)
        .values({
          userId: user.id,
          organizationId: orgId,
          teamId: teamId || null,
          roleId: role.roleId,
        })
        .onConflictDoNothing()
        .returning();

      if (!membership) {
        alreadyMembers.push(email);
        continue;
      }

      if (!sendInvite) continue;
      const isNew = created.some((c) => c.email === email);
      try {
        await sendEmail({
          to: email,
          subject: `Your ${orgName} account`,
          text: isNew
            ? `Your ${orgName} account has been created.\n\nSign in at ${appUrl()}\nEmail: ${email}\nPassword: ${password}`
            : `You've been added to ${orgName}. Sign in at ${appUrl()} with your existing account.`,
        });
        emailed.push(email);
        emailedSet.add(email);
      } catch (e) {
        emailErrors.push({ email, error: (e as Error).message });
      }
    }

    // If the password reached the recipient by email, don't echo it back.
    const createdForResponse = created.map((c) =>
      emailedSet.has(c.email)
        ? { email: c.email, name: c.name }
        : c,
    );

    return NextResponse.json({
      bulk: true,
      created: createdForResponse,
      alreadyMembers,
      emailed,
      emailErrors,
    });
  }

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const role = await validateRole(orgId, teamId, roleId);
  if ("error" in role) {
    return NextResponse.json({ error: role.error }, { status: role.status });
  }

  const [membership] = await db
    .insert(memberships)
    .values({
      userId: targetUser.id,
      organizationId: orgId,
      teamId: teamId || null,
      roleId: role.roleId,
    })
    .onConflictDoNothing()
    .returning();

  if (!membership) {
    return NextResponse.json(
      { error: "User is already a member" },
      { status: 409 },
    );
  }

  return NextResponse.json(membership, { status: 201 });
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
  const { userId, teamId } = await req.json();

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

  const conditions = [
    eq(memberships.userId, userId),
    eq(memberships.organizationId, orgId),
  ];
  if (teamId) {
    conditions.push(eq(memberships.teamId, teamId));
  } else {
    conditions.push(isNull(memberships.teamId));
  }

  await db.delete(memberships).where(and(...conditions));
  return NextResponse.json({ success: true });
}