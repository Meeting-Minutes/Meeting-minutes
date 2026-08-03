import { eq, ne, isNull, and } from "drizzle-orm";
import { db } from "../db";
import { permissions, roles, rolePermissions } from "../db/schema";

// One-off backfill: orgs created while the bootstrap Admin role granted only a
// static subset of permissions (PR #63) are missing keys like create_meeting.
// Grant every catalog permission except superuser to each org's org-wide
// "Admin" role, matching what new orgs now get at creation.
const allPerms = await db
  .select({ id: permissions.id, key: permissions.key })
  .from(permissions)
  .where(ne(permissions.key, "superuser"));

const adminRoles = await db
  .select({ id: roles.id })
  .from(roles)
  .where(and(isNull(roles.teamId), eq(roles.name, "Admin")));

let granted = 0;
for (const role of adminRoles) {
  const existing = await db
    .select({ permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, role.id));

  const existingSet = new Set(existing.map((e) => e.permissionId));
  const missing = allPerms.filter((p) => !existingSet.has(p.id));
  if (missing.length === 0) continue;

  await db.insert(rolePermissions).values(
    missing.map((p) => ({ roleId: role.id, permissionId: p.id })),
  );
  granted += missing.length;
}

console.log(`Backfilled ${granted} missing permissions across ${adminRoles.length} Admin roles`);
process.exit(0);
