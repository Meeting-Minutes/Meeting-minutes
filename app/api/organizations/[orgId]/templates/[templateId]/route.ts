import { NextResponse } from "next/server";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, join } from "path";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

const UPLOADS_DIR = resolve("uploads/templates");

function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; templateId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orgId, templateId } = await params;
  const [tmpl] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.orgId, orgId)))
    .limit(1);
  if (!tmpl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...tmpl, fields: tmpl.fields ?? [] });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string; templateId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orgId, templateId } = await params;
  if (!(await hasPermission({ userId: user.id, orgId }, "manage_templates"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [existing] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.orgId, orgId)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await req.formData();
  const name = formData.get("name") as string | null;
  const description = formData.get("description") as string | null;
  const fieldsRaw = formData.get("fields") as string | null;
  const texFile = formData.get("tex") as File | null;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (name?.trim()) update.name = name.trim();
  if (description !== null) update.description = description.trim() || null;

  if (fieldsRaw) {
    let fields;
    try { fields = JSON.parse(fieldsRaw); } catch { return NextResponse.json({ error: "Invalid fields JSON" }, { status: 400 }); }
    if (!Array.isArray(fields)) return NextResponse.json({ error: "fields must be an array" }, { status: 400 });
    update.fields = fields;
  }

  if (texFile && texFile.name) {
    ensureUploadsDir();
    const ext = texFile.name.endsWith(".hbs") ? ".hbs" : texFile.name.endsWith(".html") ? ".html" : "";
    const fileName = `${randomUUID()}${ext}`;
    const texPath = join(UPLOADS_DIR, fileName);
    writeFileSync(texPath, Buffer.from(await texFile.arrayBuffer()));
    update.texPath = texPath;
  }

  const [updated] = await db
    .update(templates)
    .set(update)
    .where(eq(templates.id, templateId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; templateId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orgId, templateId } = await params;
  if (!(await hasPermission({ userId: user.id, orgId }, "manage_templates"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await db
    .delete(templates)
    .where(and(eq(templates.id, templateId), eq(templates.orgId, orgId)));
  return NextResponse.json({ success: true });
}
