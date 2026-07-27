import { NextResponse } from "next/server";
import { db } from "@/db";
import { roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const rows = await db
    .select()
    .from(roles)
    .where(eq(roles.orgId, orgId))
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
  const { roleId, name } = await req.json();

  if (!roleId) {
    return NextResponse.json({ error: "roleId is required" }, { status: 400 });
  }

  const [role] = await db
    .update(roles)
    .set({ name })
    .where(eq(roles.id, roleId))
    .returning();

  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(role);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const url = new URL(_req.url);
  const roleId = url.searchParams.get("roleId");

  if (!roleId) {
    return NextResponse.json({ error: "roleId is required" }, { status: 400 });
  }

  await db.delete(roles).where(eq(roles.id, roleId));
  return NextResponse.json({ success: true });
}
