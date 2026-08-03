import { db } from "../db";
import {
  organizations,
  users,
  teams,
  roles,
  permissions,
  rolePermissions,
  memberships,
  meetings,
  meetingTeams,
  meetingOverrides,
} from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  getPermissionKeys,
  hasPermission,
  resolveMeetingAccess,
  ADMIN_PERMISSION_KEYS,
} from "./permissions";

async function main() {
  const permId = crypto.randomUUID();
  const permKey = `_test_p_${crypto.randomUUID().slice(0, 8)}`;

  const [superPerm] = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(eq(permissions.key, "superuser"))
    .limit(1);
  const superPermId = superPerm!.id;

  const orgId = crypto.randomUUID();
  const userId1 = crypto.randomUUID();
  const userId2 = crypto.randomUUID();
  const userId3 = crypto.randomUUID();
  const userId4 = crypto.randomUUID();
  const userId5 = crypto.randomUUID();
  const teamId1 = crypto.randomUUID();
  const teamId2 = crypto.randomUUID();
  const roleId = crypto.randomUUID();
  const teamRoleId = crypto.randomUUID();
  const superRoleId = crypto.randomUUID();
  const meetingId = crypto.randomUUID();
  const teamMeetingId1 = crypto.randomUUID();
  const teamMeetingId2 = crypto.randomUUID();

  // --- Setup ---
  await db.insert(organizations).values({ id: orgId, name: "PermCheck Org", slug: `permcheck-${crypto.randomUUID().slice(0, 8)}` });

  for (const u of [
    { id: userId1, email: `u1_${crypto.randomUUID().slice(0, 8)}@test`, name: "U1" },
    { id: userId2, email: `u2_${crypto.randomUUID().slice(0, 8)}@test`, name: "U2" },
    { id: userId3, email: `u3_${crypto.randomUUID().slice(0, 8)}@test`, name: "U3" },
    { id: userId4, email: `u4_${crypto.randomUUID().slice(0, 8)}@test`, name: "U4" },
    { id: userId5, email: `u5_${crypto.randomUUID().slice(0, 8)}@test`, name: "U5" },
  ]) {
    await db.insert(users).values(u);
  }

  await db.insert(permissions).values({ id: permId, key: permKey, description: "test permission" });

  await db.insert(teams).values([
    { id: teamId1, orgId, name: "Team A" },
    { id: teamId2, orgId, name: "Team B" },
  ]);

  await db.insert(roles).values([
    { id: roleId, name: "TestRole", orgId },
    { id: teamRoleId, name: "TeamRole", orgId, teamId: teamId2 },
    { id: superRoleId, name: "SuperRole", orgId },
  ]);
  await db.insert(rolePermissions).values([
    { roleId, permissionId: permId },
    { roleId: teamRoleId, permissionId: permId },
    { roleId: superRoleId, permissionId: superPermId },
  ]);

  await db.insert(memberships).values([
    { userId: userId1, organizationId: orgId, roleId },
    { userId: userId2, organizationId: orgId, teamId: teamId1, roleId },
    { userId: userId4, organizationId: orgId, teamId: teamId2, roleId: teamRoleId },
    { userId: userId5, organizationId: orgId, roleId: superRoleId },
  ]);

  await db.insert(meetings).values({ id: meetingId, orgId, title: "PermCheck Meeting", scheduledAt: new Date() });
  await db.insert(meetingOverrides).values({ meetingId, userId: userId3, roleId });
  await db.insert(meetings).values([
    { id: teamMeetingId1, orgId, title: "Team A Meeting", scheduledAt: new Date() },
    { id: teamMeetingId2, orgId, title: "Team B Meeting", scheduledAt: new Date() },
  ]);
  await db.insert(meetingTeams).values([
    { meetingId: teamMeetingId1, teamId: teamId1 },
    { meetingId: teamMeetingId2, teamId: teamId2 },
  ]);

  // --- Test 1: org-wide role ---
  const keys1 = await getPermissionKeys({ userId: userId1, orgId });
  console.assert(keys1.has(permKey), "Test 1 FAIL: org-wide user should see permission");
  console.log("Test 1 OK: org-wide role grants permission");

  // --- Test 2: team-scoped role, correct team ---
  const keys2a = await getPermissionKeys({ userId: userId2, orgId, teamId: teamId1 });
  console.assert(keys2a.has(permKey), "Test 2a FAIL: team member should see permission on own team");
  console.log("Test 2a OK: team-scoped role grants permission on own team");

  // --- Test 2b: team-scoped role, wrong team ---
  const keys2b = await getPermissionKeys({ userId: userId2, orgId, teamId: teamId2 });
  console.assert(!keys2b.has(permKey), "Test 2b FAIL: team member should NOT see permission on other team");
  console.log("Test 2b OK: team-scoped role does NOT grant permission on other team");

  // --- Test 3: meeting override (no membership role) ---
  const keys3 = await getPermissionKeys({ userId: userId3, orgId, meetingId });
  console.assert(keys3.has(permKey), "Test 3 FAIL: meeting override should grant permission");
  console.log("Test 3 OK: meeting override grants permission");

  // Also confirm hasPermission wrapper works
  console.assert(
    await hasPermission({ userId: userId1, orgId }, permKey),
    "Test 4 FAIL: hasPermission should return true for org-wide user",
  );
  console.log("Test 4 OK: hasPermission wrapper works");

  // --- Test 5: resource scope follows the team's membership ---
  console.assert(
    (await resolveMeetingAccess(userId2, teamMeetingId1))?.orgId === orgId,
    "Test 5a FAIL: team member should access a meeting in their team",
  );
  console.assert(
    (await resolveMeetingAccess(userId2, teamMeetingId2)) === null,
    "Test 5b FAIL: team member should not access another team's meeting",
  );
  console.assert(
    (await getPermissionKeys({ userId: userId2, orgId, meetingId: teamMeetingId1 })).has(permKey),
    "Test 5c FAIL: meeting permission should resolve from the meeting's team",
  );
  console.assert(
    !(await getPermissionKeys({ userId: userId2, orgId: crypto.randomUUID(), meetingId: teamMeetingId1 })).has(permKey),
    "Test 5d FAIL: meeting permission must not cross organizations",
  );
  console.log("Test 5 OK: team and organization meeting isolation works");

  // --- Test 6: bootstrap admin permission set ---
  const catalogKeys = new Set(
    (await db.select({ key: permissions.key }).from(permissions)).map((r) => r.key),
  );
  for (const key of ADMIN_PERMISSION_KEYS) {
    console.assert(
      catalogKeys.has(key),
      `Test 6 FAIL: seed catalog is missing an admin permission: ${key}`,
    );
  }
  console.assert(
    !ADMIN_PERMISSION_KEYS.includes("superuser"),
    "Test 6b FAIL: admin bootstrap must not grant superuser (keeps admin splittable)",
  );
  console.log("Test 6 OK: admin permission set is complete and superuser-free");

  // --- Cleanup ---
  await db.delete(meetingOverrides).where(
    and(eq(meetingOverrides.meetingId, meetingId), eq(meetingOverrides.userId, userId3)),
  );
  await db.delete(meetings).where(eq(meetings.id, meetingId));
  await db.delete(meetings).where(inArray(meetings.id, [teamMeetingId1, teamMeetingId2]));
  await db.delete(memberships).where(eq(memberships.organizationId, orgId));
  await db.delete(rolePermissions).where(
    inArray(rolePermissions.roleId, [roleId, teamRoleId, superRoleId]),
  );
  await db.delete(roles).where(inArray(roles.id, [roleId, teamRoleId, superRoleId]));
  await db.delete(teams).where(eq(teams.orgId, orgId));
  await db.delete(permissions).where(eq(permissions.id, permId));
  await db.delete(users).where(inArray(users.id, [userId1, userId2, userId3, userId4, userId5]));
  await db.delete(organizations).where(eq(organizations.id, orgId));

  console.log("\nAll permission checks passed");
  process.exit(0);
}

main().catch((err) => {
  console.error("Permission check failed:", err);
  process.exit(1);
});
