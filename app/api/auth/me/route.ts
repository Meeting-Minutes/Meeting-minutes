import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const clean = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s && s.length <= max ? s : null;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}

// Self-service profile edit: display name, honorific, designation.
export async function PATCH(req: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const updates: Partial<typeof users.$inferInsert> = {};
  if (body.name !== undefined) {
    const name = clean(body.name, 120);
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    updates.name = name;
  }
  if (body.title !== undefined) updates.title = clean(body.title, 30);
  if (body.post !== undefined) updates.post = clean(body.post, 120);
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, current.id))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      title: users.title,
      post: users.post,
    });
  return NextResponse.json({ user: updated });
}
