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
  meetingOverrides,
} from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getPermissionKeys, hasPermission } from "./permissions";

async function main() {
  const permId = crypto.randomUUID();
  const permKey = `_test_p_${crypto.randomUUID().slice(0, 8)}`;

  const orgId = crypto.randomUUID();
  const userId1 = crypto.randomUUID();
  const userId2 = crypto.randomUUID();
  const userId3 = crypto.randomUUID();
  const teamId1 = crypto.randomUUID();
  const teamId2 = crypto.randomUUID();
  const roleId = crypto.randomUUID();
  const meetingId = crypto.randomUUID();

  // --- Setup ---
  await db.insert(organizations).values({ id: orgId, name: "PermCheck Org", slug: `permcheck-${crypto.randomUUID().slice(0, 8)}` });

  for (const u of [
    { id: userId1, email: `u1_${crypto.randomUUID().slice(0, 8)}@test`, name: "U1" },
    { id: userId2, email: `u2_${crypto.randomUUID().slice(0, 8)}@test`, name: "U2" },
    { id: userId3, email: `u3_${crypto.randomUUID().slice(0, 8)}@test`, name: "U3" },
  ]) {
    await db.insert(users).values(u);
  }

  await db.insert(permissions).values({ id: permId, key: permKey, description: "test permission" });

  await db.insert(roles).values({ id: roleId, name: "TestRole", orgId });
  await db.insert(rolePermissions).values({ roleId, permissionId: permId });

  await db.insert(teams).values([
    { id: teamId1, orgId, name: "Team A" },
    { id: teamId2, orgId, name: "Team B" },
  ]);

  await db.insert(memberships).values([
    { userId: userId1, organizationId: orgId, roleId },
    { userId: userId2, organizationId: orgId, teamId: teamId1, roleId },
  ]);

  await db.insert(meetings).values({ id: meetingId, orgId, title: "PermCheck Meeting", scheduledAt: new Date() });
  await db.insert(meetingOverrides).values({ meetingId, userId: userId3, roleId });

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

  // --- Cleanup ---
  await db.delete(meetingOverrides).where(
    and(eq(meetingOverrides.meetingId, meetingId), eq(meetingOverrides.userId, userId3)),
  );
  await db.delete(meetings).where(eq(meetings.id, meetingId));
  await db.delete(memberships).where(eq(memberships.organizationId, orgId));
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  await db.delete(roles).where(eq(roles.id, roleId));
  await db.delete(teams).where(eq(teams.orgId, orgId));
  await db.delete(permissions).where(eq(permissions.id, permId));
  await db.delete(users).where(inArray(users.id, [userId1, userId2, userId3]));
  await db.delete(organizations).where(eq(organizations.id, orgId));

  console.log("\nAll permission checks passed");
  process.exit(0);
}

main().catch((err) => {
  console.error("Permission check failed:", err);
  process.exit(1);
});
