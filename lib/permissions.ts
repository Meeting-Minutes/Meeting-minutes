import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  memberships,
  meetingOverrides,
  rolePermissions,
  permissions,
} from "@/db/schema";

export interface PermissionParams {
  userId: string;
  orgId: string;
  teamId?: string;
  meetingId?: string;
}

export async function getPermissionKeys(
  params: PermissionParams,
): Promise<Set<string>> {
  const { userId, orgId, teamId, meetingId } = params;

  if (meetingId) {
    const rows = await db
      .select({ key: permissions.key })
      .from(meetingOverrides)
      .innerJoin(
        rolePermissions,
        eq(rolePermissions.roleId, meetingOverrides.roleId),
      )
      .innerJoin(
        permissions,
        eq(permissions.id, rolePermissions.permissionId),
      )
      .where(
        and(
          eq(meetingOverrides.meetingId, meetingId),
          eq(meetingOverrides.userId, userId),
        ),
      );

    if (rows.length > 0) {
      return new Set(rows.map((r) => r.key).filter((k): k is string => k !== null));
    }
  }

  const rows = await db
    .select({ key: permissions.key })
    .from(memberships)
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
  return keys.has("superuser") || keys.has(key);
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
