import { randomUUID } from "node:crypto";

import { db } from "../index";
import { permissions } from "../schema";

export async function seedPermissions() {
  await db
    .insert(permissions)
    .values([
      {
        id: randomUUID(),
        key: "create_minutes",
        description: "Create meeting minutes",
      },
      {
        id: randomUUID(),
        key: "edit_minutes",
        description: "Edit meeting minutes",
      },
      {
        id: randomUUID(),
        key: "approve_minutes",
        description: "Approve meeting minutes",
      },
      {
        id: randomUUID(),
        key: "manage_roles",
        description: "Manage roles",
      },
      {
        id: randomUUID(),
        key: "search_scope:team",
        description: "Search within assigned teams",
      },
      {
        id: randomUUID(),
        key: "search_scope:org",
        description: "Search across the organization",
      },
    ])
    .onConflictDoNothing();
}
