import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  organizations,
  memberships,
  roles,
  permissions as permissionsTable,
  rolePermissions,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { ADMIN_PERMISSION_KEYS } from "@/lib/permissions";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .selectDistinct({
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

  const adminPerms = await db
    .select({ id: permissionsTable.id })
    .from(permissionsTable)
    .where(inArray(permissionsTable.key, ADMIN_PERMISSION_KEYS));

  if (adminPerms.length !== ADMIN_PERMISSION_KEYS.length) {
    // A missing permission key means the seed catalog isn't applied — failing
    // here beats silently creating a founder role with an incomplete set.
    return NextResponse.json(
      { error: "Server misconfigured: permission catalog incomplete" },
      { status: 500 },
    );
  }

  const [org] = await db
    .insert(organizations)
    .values({ name, description: description || null, slug })
    .returning();

  const [adminRole] = await db
    .insert(roles)
    .values({ id: crypto.randomUUID(), name: "Admin", orgId: org.id })
    .returning();

  await db.insert(rolePermissions).values(
    adminPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
  );

  await db.insert(memberships).values({
    userId: user.id,
    organizationId: org.id,
    roleId: adminRole.id,
  });

  return NextResponse.json(org, { status: 201 });
}
