import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orgId } = await params;
  const rows = await db
    .select()
    .from(templates)
    .where(eq(templates.orgId, orgId))
    .orderBy(templates.name);
  return NextResponse.json(rows.map((r) => ({ ...r, fields: r.fields ?? [] })));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orgId } = await params;
  if (!(await hasPermission({ userId: user.id, orgId }, "manage_templates"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const name = formData.get("name") as string | null;
  const description = formData.get("description") as string | null;
  const fieldsRaw = formData.get("fields") as string | null;
  const texFile = formData.get("tex") as File | null;

  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  let fields = [];
  if (fieldsRaw) {
    try { fields = JSON.parse(fieldsRaw); } catch { return NextResponse.json({ error: "Invalid fields JSON" }, { status: 400 }); }
    if (!Array.isArray(fields)) return NextResponse.json({ error: "fields must be an array" }, { status: 400 });
  }

  let texSource: string | null = null;
  if (texFile && texFile.name) {
    texSource = await texFile.text();
  }

  const templateId = randomUUID();
  const [created] = await db
    .insert(templates)
    .values({
      id: templateId,
      orgId,
      name: name.trim(),
      description: description?.trim() || null,
      createdBy: user.id,
      fields,
      texSource,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
