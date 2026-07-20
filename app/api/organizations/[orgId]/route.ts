import { NextResponse } from "next/server";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(org);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const { name, description } = await req.json();

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const [org] = await db
    .update(organizations)
    .set({ name, description: description || null, slug })
    .where(eq(organizations.id, orgId))
    .returning();

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(org);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  await db.delete(organizations).where(eq(organizations.id, orgId));
  return NextResponse.json({ success: true });
}
