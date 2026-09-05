import { NextResponse } from "next/server";
import { db } from "@/db";
import { roles } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { canAccessOrganization, canManageOrgRoles, isSystemRole } from "@/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  // Read-only: any org member should see role names (used to render member
  // lists). Mutations below stay gated on manage_roles.
  if (!(await canAccessOrganization(user.id, orgId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(roles)
    .where(and(eq(roles.orgId, orgId), isNull(roles.teamId)))
    .orderBy(roles.name);

  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  if (!(await canManageOrgRoles(user.id, orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await req.json();

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const [role] = await db
    .insert(roles)
    .values({ id: crypto.randomUUID(), orgId, name })
    .returning();

  return NextResponse.json(role, { status: 201 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  if (!(await canManageOrgRoles(user.id, orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { roleId, name } = await req.json();

  if (!roleId) {
    return NextResponse.json({ error: "roleId is required" }, { status: 400 });
  }

  if (await isSystemRole(roleId)) {
    return NextResponse.json(
      { error: "Superadmin is a protected role and cannot be renamed" },
      { status: 400 },
    );
  }

  const [role] = await db
    .update(roles)
    .set({ name })
    .where(and(eq(roles.id, roleId), eq(roles.orgId, orgId), isNull(roles.teamId)))
    .returning();

  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(role);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  if (!(await canManageOrgRoles(user.id, orgId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const roleId = url.searchParams.get("roleId");

  if (!roleId) {
    return NextResponse.json({ error: "roleId is required" }, { status: 400 });
  }

  if (await isSystemRole(roleId)) {
    return NextResponse.json(
      { error: "Superadmin is a protected role and cannot be deleted" },
      { status: 400 },
    );
  }

  await db
    .delete(roles)
    .where(and(eq(roles.id, roleId), eq(roles.orgId, orgId), isNull(roles.teamId)));

  return NextResponse.json({ success: true });
}
