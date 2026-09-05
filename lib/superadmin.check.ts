// Self-check for the Superadmin lockout-safe org bootstrap —
// `bun run db:check:superadmin`.
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { memberships, organizations, permissions, rolePermissions, roles, users } from "../db/schema";
import {
  bootstrapOrgAdmin,
  countSuperadminHolders,
  getOrgSuperadminRoleId,
  isSystemRole,
} from "./permissions";

function q(s = 8) {
  return crypto.randomUUID().slice(0, s);
}

// console.assert alone is not a gate — failed asserts only print and the
// script would still exit 0. Count failures and exit non-zero at the end.
let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) failures++;
  console.assert(cond, msg);
}

async function main() {
  const orgId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  await db.insert(organizations).values({
    id: orgId,
    name: "SuperadminCheck Org",
    slug: `superadmin-${q(8)}`,
  });
  await db.insert(users).values({
    id: userId,
    email: `founder_${q()}@test`,
    name: "Founder",
  });

  await bootstrapOrgAdmin(orgId, userId);

  // ── All four default roles exist with the right shape ────────────────────
  const named = async (name: string) =>
    (await db.select().from(roles).where(and(eq(roles.orgId, orgId), eq(roles.name, name))))[0];
  const [superRole, adminRole, secretaryRole, memberRole] = await Promise.all([
    named("Superadmin"),
    named("Admin"),
    named("Secretary"),
    named("Member"),
  ]);
  check(
    !!superRole && !!adminRole && !!secretaryRole && !!memberRole,
    "FAIL: bootstrap must create Superadmin, Admin, Secretary and Member roles",
  );
  check(superRole?.isSystem === true, "FAIL: Superadmin role must be marked is_system");
  for (const r of [adminRole, secretaryRole, memberRole]) {
    check(r?.isSystem === false, `FAIL: ${r?.name} must NOT be flagged as a system role`);
  }

  const catalog = await db.select({ id: permissions.id, key: permissions.key }).from(permissions);
  const permKeys = async (roleId: string) => {
    const rows = await db
      .select({ key: permissions.key })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(rolePermissions.roleId, roleId));
    return rows.map((r) => r.key).sort();
  };
  const superKeys = await permKeys(superRole.id);
  const adminKeys = await permKeys(adminRole.id);
  check(
    superKeys.length === catalog.length && superKeys.length > 0,
    "FAIL: Superadmin must hold every catalog permission",
  );
  check(
    adminKeys.length === catalog.length - 1 && !adminKeys.includes("superuser"),
    "FAIL: Admin must hold every catalog permission except superuser",
  );
  const SECRETARY_DEFAULT_PERMS = ["create_meeting", "edit_meeting", "export_minutes", "manage_tags", "manage_templates"];
  const MEMBER_DEFAULT_PERMS = ["export_minutes"];
  check(
    JSON.stringify(await permKeys(secretaryRole.id)) === JSON.stringify([...SECRETARY_DEFAULT_PERMS].sort()),
    "FAIL: Secretary must ship with its default permission set",
  );
  check(
    JSON.stringify(await permKeys(memberRole.id)) === JSON.stringify(MEMBER_DEFAULT_PERMS),
    "FAIL: Member must ship with its default permission set",
  );

  // ── Founder holds Superadmin org-wide, and only one org-wide membership ──
  const [founderRow] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.organizationId, orgId), eq(memberships.userId, userId)));
  check(
    founderRow?.teamId === null && founderRow?.roleId === superRole.id,
    "FAIL: founder must hold an org-wide membership carrying Superadmin",
  );
  const holderCount = await countSuperadminHolders(orgId);
  check(holderCount === 1, "FAIL: exactly one Superadmin holder expected");
  check(
    (await getOrgSuperadminRoleId(orgId)) === superRole.id,
    "FAIL: getOrgSuperadminRoleId must resolve the system role",
  );
  check(
    (await isSystemRole(superRole.id)) === true && (await isSystemRole(adminRole.id)) === false,
    "FAIL: isSystemRole must match the is_system flag",
  );

  // A second org-wide membership for the same user must be rejected by the
  // org-wide unique index (this is what keeps founder = one role).
  let conflictThrown = false;
  try {
    await db.insert(memberships).values({
      userId,
      organizationId: orgId,
      teamId: null,
      roleId: adminRole.id,
    });
  } catch {
    conflictThrown = true;
  }
  check(conflictThrown, "FAIL: a user can't hold two org-wide memberships in one org");
  const orgWideCount = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.organizationId, orgId), isNull(memberships.teamId)));
  check(orgWideCount.length === 1, "FAIL: exactly one org-wide membership row per user");

  // ── Cleanup ──
  await db.delete(memberships).where(eq(memberships.organizationId, orgId));
  const orgRoles = await db.select({ id: roles.id }).from(roles).where(eq(roles.orgId, orgId));
  for (const r of orgRoles) {
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, r.id));
  }
  await db.delete(roles).where(eq(roles.orgId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await db.delete(users).where(eq(users.id, userId));

  if (failures > 0) {
    console.error(`\n${failures} superadmin check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll superadmin checks passed");
  process.exit(0);
}

main().catch((err) => {
  console.error("Superadmin check failed:", err);
  process.exit(1);
});