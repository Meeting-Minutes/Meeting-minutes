import { NextResponse } from "next/server";
import { db } from "@/db";
import { roles, rolePermissions, permissions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { canManageOrgRoles, canManageTeamRoles, isSystemRole } from "@/lib/permissions";

async function assertCanManageRole(userId: string, orgId: string, roleId: string) {
  const [role] = await db
    .select({ id: roles.id, orgId: roles.orgId, teamId: roles.teamId })
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.orgId, orgId)))
    .limit(1);

  if (!role) return { error: "Not found" as const, status: 404 as const };
  if (role.teamId !== null) {
    const ok = await canManageTeamRoles(userId, orgId, role.teamId);
    if (!ok) return { error: "Forbidden" as const, status: 403 as const };
  } else {
    const ok = await canManageOrgRoles(userId, orgId);
    if (!ok) return { error: "Forbidden" as const, status: 403 as const };
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; roleId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, roleId } = await params;
  const denied = await assertCanManageRole(user.id, orgId, roleId);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const rows = await db
    .select({
      id: permissions.id,
      key: permissions.key,
      description: permissions.description,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(eq(rolePermissions.roleId, roleId))
    .orderBy(permissions.key);

  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; roleId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, roleId } = await params;
  const denied = await assertCanManageRole(user.id, orgId, roleId);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  if (await isSystemRole(roleId)) {
    return NextResponse.json(
      { error: "Superadmin is a protected role — its permissions cannot be changed" },
      { status: 400 },
    );
  }

  const { permissionId } = await req.json();

  if (!permissionId) {
    return NextResponse.json({ error: "permissionId is required" }, { status: 400 });
  }

  const [rp] = await db
    .insert(rolePermissions)
    .values({ roleId, permissionId })
    .onConflictDoNothing()
    .returning();

  if (!rp) {
    return NextResponse.json({ error: "Permission already assigned" }, { status: 409 });
  }

  return NextResponse.json(rp, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgId: string; roleId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, roleId } = await params;
  const denied = await assertCanManageRole(user.id, orgId, roleId);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  if (await isSystemRole(roleId)) {
    return NextResponse.json(
      { error: "Superadmin is a protected role — its permissions cannot be changed" },
      { status: 400 },
    );
  }

  const { permissionId } = await req.json();

  if (!permissionId) {
    return NextResponse.json({ error: "permissionId is required" }, { status: 400 });
  }

  await db
    .delete(rolePermissions)
    .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)));

  return NextResponse.json({ success: true });
}
