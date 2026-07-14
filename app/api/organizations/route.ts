import { NextResponse } from "next/server";
import { db } from "@/db";
import { organizations } from "@/db/schema";

export async function GET() {
  const rows = await db.select().from(organizations);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { name } = await req.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const [row] = await db.insert(organizations).values({ name }).returning();
  return NextResponse.json(row, { status: 201 });
}
