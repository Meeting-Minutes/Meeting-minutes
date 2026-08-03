import { NextResponse } from "next/server";
import { db } from "@/db";
import { teams, roles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { canManageTeamRoles } from "@/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  if (!(await canManageTeamRoles(user.id, team.orgId, teamId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(roles)
    .where(and(eq(roles.orgId, team.orgId), eq(roles.teamId, teamId)))
    .orderBy(roles.name);

  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;
  const { name } = await req.json();

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  if (!(await canManageTeamRoles(user.id, team.orgId, teamId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [role] = await db
    .insert(roles)
    .values({ id: crypto.randomUUID(), orgId: team.orgId, teamId, name })
    .returning();

  return NextResponse.json(role, { status: 201 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;
  const { roleId, name } = await req.json();

  if (!roleId || !name || typeof name !== "string") {
    return NextResponse.json({ error: "roleId and name are required" }, { status: 400 });
  }

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  if (!(await canManageTeamRoles(user.id, team.orgId, teamId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [role] = await db
    .update(roles)
    .set({ name })
    .where(and(eq(roles.id, roleId), eq(roles.teamId, teamId)))
    .returning();

  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(role);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;
  const { roleId } = await req.json();

  if (!roleId) {
    return NextResponse.json({ error: "roleId is required" }, { status: 400 });
  }

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  if (!(await canManageTeamRoles(user.id, team.orgId, teamId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .delete(roles)
    .where(and(eq(roles.id, roleId), eq(roles.teamId, teamId)));

  return NextResponse.json({ success: true });
}
