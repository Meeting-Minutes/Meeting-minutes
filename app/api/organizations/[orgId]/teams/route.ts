import { NextResponse } from "next/server";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { randomUUID } from "node:crypto";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await params;
  const rows = await db
    .select()
    .from(teams)
    .where(eq(teams.orgId, orgId))
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
  const { name, description, parentTeamId } = await req.json();

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const [team] = await db
    .insert(teams)
    .values({
      id: randomUUID(),
      orgId,
      name,
      description: description || null,
      parentTeamId: parentTeamId || null,
    })
    .returning();

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

  if (!teamId) {
    return NextResponse.json({ error: "teamId is required" }, { status: 400 });
  }

  const [team] = await db
    .update(teams)
    .set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description: description || null }),
    })
    .where(eq(teams.id, teamId))
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

  await db.delete(teams).where(eq(teams.id, teamId));
  return NextResponse.json({ success: true });
}
