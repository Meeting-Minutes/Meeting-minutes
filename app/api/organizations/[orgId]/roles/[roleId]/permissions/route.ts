import { NextResponse } from "next/server";
import { db } from "@/db";
import { rolePermissions, permissions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; roleId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { roleId } = await params;
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

  const { roleId } = await params;
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

  const { roleId } = await params;
  const { permissionId } = await req.json();

  if (!permissionId) {
    return NextResponse.json({ error: "permissionId is required" }, { status: 400 });
  }

  await db
    .delete(rolePermissions)
    .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)));

  return NextResponse.json({ success: true });
}
