import { NextResponse } from "next/server";
import { db } from "@/db";
import { memberships, organizations, teams } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: memberships.organizationId,
      name: organizations.name,
      slug: organizations.slug,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, user.id));

  return NextResponse.json(rows);
}
