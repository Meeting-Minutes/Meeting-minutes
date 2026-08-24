import { randomUUID } from "node:crypto";
import { and, eq, isNull, or, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  memberships,
  meetingOverrides,
  meetings,
  meetingTeams,
  rolePermissions,
  permissions,
  roles,
  teams,
} from "@/db/schema";

export interface PermissionParams {
  userId: string;
  orgId: string;
  teamId?: string;
  meetingId?: string;
}

export interface OrganizationAccess {
  orgWide: boolean;
  teamIds: string[];
}

// Bootstrap an org's founding admin: an org-wide "Admin" role holding every
// catalog permission except `superuser` (reserved, so admin stays splittable),
// plus the founder's org-wide membership carrying that role. Shared by org
// creation, the demo seed, and the one-off backfill so the model stays single.
export async function bootstrapOrgAdmin(
  orgId: string,
  userId: string,
): Promise<void> {
  const adminPerms = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(ne(permissions.key, "superuser"));
  if (adminPerms.length === 0) {
    throw new Error("Permission catalog is empty; run the seed");
  }
  const [adminRole] = await db
    .insert(roles)
    .values({ id: randomUUID(), name: "Admin", orgId })
    .returning();
  await db.insert(rolePermissions).values(
    adminPerms.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
  );
  await db.insert(memberships).values({
    userId,
    organizationId: orgId,
    roleId: adminRole.id,
  });
}

export async function resolveOrganizationAccess(
  userId: string,
  orgId: string,
): Promise<OrganizationAccess | null> {
  const rows = await db
    .select({ teamId: memberships.teamId })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, orgId),
      ),
    );

  if (rows.length === 0) return null;

  return {
    orgWide: rows.some(({ teamId }) => teamId === null),
    teamIds: rows.flatMap(({ teamId }) => (teamId ? [teamId] : [])),
  };
}

export async function canAccessOrganization(
  userId: string,
  orgId: string,
): Promise<boolean> {
  return Boolean(await resolveOrganizationAccess(userId, orgId));
}

export async function resolveTeamAccess(
  userId: string,
  teamId: string,
): Promise<{ orgId: string } | null> {
  const [scope] = await db
    .select({ orgId: teams.orgId })
    .from(teams)
    .innerJoin(
      memberships,
      and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, teams.orgId),
        or(isNull(memberships.teamId), eq(memberships.teamId, teams.id)),
      ),
    )
    .where(eq(teams.id, teamId))
    .limit(1);

  return scope ?? null;
}

export async function resolveMeetingAccess(
  userId: string,
  meetingId: string,
): Promise<{ orgId: string } | null> {
  const [override] = await db
    .select({ orgId: meetings.orgId })
    .from(meetingOverrides)
    .innerJoin(meetings, eq(meetings.id, meetingOverrides.meetingId))
    .innerJoin(
      roles,
      and(
        eq(roles.id, meetingOverrides.roleId),
        eq(roles.orgId, meetings.orgId),
      ),
    )
    .where(
      and(
        eq(meetingOverrides.meetingId, meetingId),
        eq(meetingOverrides.userId, userId),
      ),
    )
    .limit(1);

  if (override?.orgId) return { orgId: override.orgId };

  const [scope] = await db
    .select({ orgId: meetings.orgId })
    .from(meetings)
    .leftJoin(meetingTeams, eq(meetingTeams.meetingId, meetings.id))
    .innerJoin(
      memberships,
      and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, meetings.orgId),
        or(
          isNull(memberships.teamId),
          eq(memberships.teamId, meetingTeams.teamId),
        ),
      ),
    )
    .where(eq(meetings.id, meetingId))
    .limit(1);

  return scope?.orgId ? { orgId: scope.orgId } : null;
}

export async function getPermissionKeys(
  params: PermissionParams,
): Promise<Set<string>> {
  const { userId, orgId, teamId, meetingId } = params;

  if (meetingId) {
    const rows = await db
      .select({ key: permissions.key })
      .from(meetingOverrides)
      .innerJoin(meetings, eq(meetings.id, meetingOverrides.meetingId))
      .innerJoin(
        roles,
        and(
          eq(roles.id, meetingOverrides.roleId),
          eq(roles.orgId, meetings.orgId),
        ),
      )
      .leftJoin(
        rolePermissions,
        eq(rolePermissions.roleId, meetingOverrides.roleId),
      )
      .leftJoin(
        permissions,
        eq(permissions.id, rolePermissions.permissionId),
      )
      .where(
        and(
          eq(meetingOverrides.meetingId, meetingId),
          eq(meetingOverrides.userId, userId),
          eq(meetings.orgId, orgId),
        ),
      );

    if (rows.length > 0) {
      return new Set(rows.map((r) => r.key).filter((k): k is string => k !== null));
    }

    const membershipRows = await db
      .select({ key: permissions.key })
      .from(meetings)
      .leftJoin(meetingTeams, eq(meetingTeams.meetingId, meetings.id))
      .innerJoin(
        memberships,
        and(
          eq(memberships.userId, userId),
          eq(memberships.organizationId, meetings.orgId),
          or(
            isNull(memberships.teamId),
            eq(memberships.teamId, meetingTeams.teamId),
          ),
        ),
      )
      .innerJoin(
        roles,
        and(
          eq(roles.id, memberships.roleId),
          eq(roles.orgId, meetings.orgId),
        ),
      )
      .innerJoin(
        rolePermissions,
        eq(rolePermissions.roleId, memberships.roleId),
      )
      .innerJoin(
        permissions,
        eq(permissions.id, rolePermissions.permissionId),
      )
      .where(and(eq(meetings.id, meetingId), eq(meetings.orgId, orgId)));

    return new Set(
      membershipRows
        .map((row) => row.key)
        .filter((key): key is string => key !== null),
    );
  }

  const rows = await db
    .select({ key: permissions.key })
    .from(memberships)
    .innerJoin(
      roles,
      and(
        eq(roles.id, memberships.roleId),
        eq(roles.orgId, memberships.organizationId),
      ),
    )
    .innerJoin(
      rolePermissions,
      eq(rolePermissions.roleId, memberships.roleId),
    )
    .innerJoin(
      permissions,
      eq(permissions.id, rolePermissions.permissionId),
    )
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, orgId),
        teamId
          ? or(eq(memberships.teamId, teamId), isNull(memberships.teamId))
          : isNull(memberships.teamId),
      ),
    );

  return new Set(rows.map((r) => r.key).filter((k): k is string => k !== null));
}

export async function hasPermission(
  params: PermissionParams,
  key: string,
): Promise<boolean> {
  const keys = await getPermissionKeys(params);
  return keys.has(key) || keys.has("superuser");
}

/**
 * A membership scoped to `membershipTeamId` (null = org-wide) may only carry a
 * role whose own scope is compatible: an org-wide membership can only hold an
 * org-wide role, while a team membership can hold either an org-wide role or a
 * role scoped to that exact team. Prevents "promoting" a team-scoped role to
 * org-wide or borrowing a role from a sibling team.
 */
export function isRoleScopeValid(
  roleTeamId: string | null,
  membershipTeamId: string | null,
): boolean {
  if (membershipTeamId === null) return roleTeamId === null;
  return roleTeamId === null || roleTeamId === membershipTeamId;
}

/** Validate that `roleId` exists, belongs to `orgId`, and its scope fits the
 *  membership/invite team. Returns the normalized roleId or an HTTP error. */
export async function validateRole(
  orgId: string,
  teamId: string | null | undefined,
  roleId: string | null | undefined,
): Promise<{ roleId: string | null } | { error: string; status: number }> {
  if (!roleId) return { roleId: null };
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role) return { error: "Role not found", status: 404 };
  if (role.orgId !== orgId) return { error: "Role does not belong to this org", status: 400 };
  if (!isRoleScopeValid(role.teamId, teamId || null)) {
    return { error: "Role scope does not match the team", status: 400 };
  }
  return { roleId };
}

/** Can `userId` manage org-wide roles in `orgId`? (org-scoped `manage_roles`.) */
export async function canManageOrgRoles(
  userId: string,
  orgId: string,
): Promise<boolean> {
  const keys = await getPermissionKeys({ userId, orgId });
  return keys.has("superuser") || keys.has("manage_roles");
}

/** Can `userId` manage team-scoped roles of `teamId`? (org `manage_roles` or team `manage_team_roles`.) */
export async function canManageTeamRoles(
  userId: string,
  orgId: string,
  teamId: string,
): Promise<boolean> {
  const keys = await getPermissionKeys({ userId, orgId, teamId });
  return keys.has("superuser") || keys.has("manage_roles") || keys.has("manage_team_roles");
}
