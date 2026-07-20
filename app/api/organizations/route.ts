import { NextResponse } from "next/server";
import { db } from "@/db";
import { organizations, memberships } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      description: organizations.description,
      slug: organizations.slug,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .innerJoin(memberships, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, user.id));

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description } = await req.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const [org] = await db
    .insert(organizations)
    .values({ name, description: description || null, slug })
    .returning();

  await db.insert(memberships).values({
    userId: user.id,
    organizationId: org.id,
  });

  return NextResponse.json(org, { status: 201 });
}
