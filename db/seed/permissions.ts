import { randomUUID } from "node:crypto";

import { db } from "../index";
import { permissions } from "../schema";

export async function seedPermissions() {
  await db
    .insert(permissions)
    .values([
      { id: randomUUID(), key: "create_meeting", description: "Schedule a meeting" },
      { id: randomUUID(), key: "edit_meeting", description: "Edit a meeting's details" },
      { id: randomUUID(), key: "delete_meeting", description: "Delete a meeting" },
      { id: randomUUID(), key: "edit_after_grace_period", description: "Edit minutes after the edit-lock grace period" },
      { id: randomUUID(), key: "manage_members", description: "Add or remove organization/team members" },
      { id: randomUUID(), key: "manage_org", description: "Edit organization settings" },
      { id: randomUUID(), key: "manage_teams", description: "Create, edit, or delete teams" },
      { id: randomUUID(), key: "manage_templates", description: "Create, edit, or delete minute templates" },
      { id: randomUUID(), key: "manage_tags", description: "Manage the organization's tag catalog" },
      { id: randomUUID(), key: "export_minutes", description: "Generate PDF/DOCX exports of minutes" },
      { id: randomUUID(), key: "view_audit_log", description: "View the organization's audit log" },
      { id: randomUUID(), key: "superuser", description: "Complete control over the organization" }
      ,])
    .onConflictDoNothing();
}
