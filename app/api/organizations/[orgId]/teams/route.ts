import { NextResponse } from "next/server";
import { db } from "@/db";
import { teams, memberships } from "@/db/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import { hasPermission, resolveOrganizationAccess } from "@/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const access = await resolveOrganizationAccess(user.id, orgId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const visibility = access.orgWide
    ? eq(teams.orgId, orgId)
    : and(eq(teams.orgId, orgId), inArray(teams.id, access.teamIds));
  const rows = await db
    .select()
    .from(teams)
    .where(visibility)
    .orderBy(teams.name);

  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  if (!(await hasPermission({ userId: user.id, orgId }, "manage_teams"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, description, parentTeamId } = await req.json();

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const teamId = randomUUID();

  if (parentTeamId) {
    const [parent] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, parentTeamId), eq(teams.orgId, orgId)))
      .limit(1);
    if (!parent) return NextResponse.json({ error: "Parent team not found" }, { status: 404 });
  }

  const [team] = await db
    .insert(teams)
    .values({
      id: teamId,
      orgId,
      name,
      description: description || null,
      parentTeamId: parentTeamId || null,
    })
    .returning();

  // Auto-add creator as team-specific member if not already an org-wide member
  const [existing] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, user.id), eq(memberships.organizationId, orgId), isNull(memberships.teamId)))
    .limit(1);

  if (existing) {
    await db.insert(memberships).values({
      userId: user.id,
      organizationId: orgId,
      teamId,
    }).onConflictDoNothing();
  }

  return NextResponse.json(team, { status: 201 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const { teamId, name, description } = await req.json();

  if (!(await hasPermission({ userId: user.id, orgId }, "manage_teams"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  const [team] = await db
    .update(teams)
    .set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description: description || null }),
    })
    .where(and(eq(teams.id, teamId), eq(teams.orgId, orgId)))
    .returning();

  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(team);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const url = new URL(_req.url);
  const teamId = url.searchParams.get("teamId");

  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  if (!(await hasPermission({ userId: user.id, orgId }, "manage_teams"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(teams).where(and(eq(teams.id, teamId), eq(teams.orgId, orgId)));
  return NextResponse.json({ success: true });
}
