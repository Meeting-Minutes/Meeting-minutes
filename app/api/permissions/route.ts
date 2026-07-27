import { NextResponse } from "next/server";
import { db } from "@/db";
import { permissions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(permissions)
    .orderBy(permissions.key);

  return NextResponse.json(rows);
}
