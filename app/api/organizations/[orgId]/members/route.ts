import { NextResponse } from "next/server";
import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import {
  hasPermission,
  resolveOrganizationAccess,
  resolveTeamAccess,
} from "@/lib/permissions";

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
  const { email, teamId } = await req.json();

  if (teamId) {
    const teamAccess = await resolveTeamAccess(currentUser.id, teamId);
    if (teamAccess?.orgId !== orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }
  if (
    !(await hasPermission(
      { userId: currentUser.id, orgId, ...(teamId ? { teamId } : {}) },
      "manage_members",
    ))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const [membership] = await db
    .insert(memberships)
    .values({
      userId: targetUser.id,
      organizationId: orgId,
      teamId: teamId || null,
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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const { userId, teamId } = await req.json();

  if (teamId) {
    const teamAccess = await resolveTeamAccess(currentUser.id, teamId);
    if (teamAccess?.orgId !== orgId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
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
