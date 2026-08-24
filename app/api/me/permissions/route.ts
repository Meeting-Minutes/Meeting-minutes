import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  getPermissionKeys,
  resolveOrganizationAccess,
} from "@/lib/permissions";

/** Effective permission keys for the signed-in user in one organization,
 *  so the UI can hide controls the API would reject anyway.
 *  `orgKeys` = org-scope actions; `teamKeys[teamId]` = acting inside that team. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = new URL(req.url).searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }
  const access = await resolveOrganizationAccess(user.id, orgId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgKeys = [...(await getPermissionKeys({ userId: user.id, orgId }))];

  // ponytail: one query per team (skipped entirely for org-wide members) —
  // fine at demo scale; upgrade path is a single grouped role-permission join.
  const teamRows = await db.select({ id: teams.id }).from(teams).where(eq(teams.orgId, orgId));
  const teamKeys: Record<string, string[]> = {};
  for (const t of teamRows) {
    teamKeys[t.id] = access.orgWide
      ? orgKeys
      : access.teamIds.includes(t.id)
        ? [...(await getPermissionKeys({ userId: user.id, orgId, teamId: t.id }))]
        : [];
  }

  return NextResponse.json({ orgKeys, teamKeys });
}
