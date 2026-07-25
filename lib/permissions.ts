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
  return keys.has(key);
}
