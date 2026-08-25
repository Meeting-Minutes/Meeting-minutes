"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PermissionGrid } from "./permission-grid";
import ThemeToggle from "../theme-toggle";
import TeamsTab from "./teams-tab";
import { useMyPermissions } from "../use-my-permissions";

type Org = { id: string; name: string; description?: string | null; slug: string };
type Role = { id: string; name: string; orgId: string; teamId: string | null };
type Perm = { id: string; key: string; description: string | null };
type Member = {
  id: string;
  userId: string;
  roleId: string | null;
  teamId: string | null;
  user: { id: string; email: string; name: string };
};
type Template = {
  id: string;
  name: string;
  description: string | null;
  fields: { name: string; label: string; type: string }[];
};

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-normal transition-colors"
    >
      <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span> {label}
    </Link>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-bg-primary" />}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgParam = searchParams.get("org");

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [org, setOrg] = useState<Org | null>(null);
  const [tab, setTab] = useState<string>("overview");
  const [error, setError] = useState("");

  // Roles & permissions
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [rolePerms, setRolePerms] = useState<Record<string, string[]>>({});
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");

  // Members
  const [members, setMembers] = useState<Member[]>([]);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);

  // UI-only gate; the API enforces the real checks.
  const { can, refresh: refreshPerms } = useMyPermissions(org?.id);

  const fetchJson = useCallback(
    async (url: string, init?: RequestInit) => {
      const res = await fetch(url, init);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Request failed (${res.status})`);
      }
      // Mutations can change the current user's own permissions (role edits,
      // membership changes, new teams) — re-sync the UI gate afterwards.
      if (init?.method && init.method !== "GET") refreshPerms();
      return res.json();
    },
    [refreshPerms],
  );

  // Load orgs, pick active one
  useEffect(() => {
    fetchJson("/api/organizations").then((data: Org[]) => {
      setOrgs(data);
      const target = orgParam ? data.find((o) => o.id === orgParam) : data[0];
      if (target) {
        setOrg(target);
        setError("");
      } else {
        setError("You are not a member of any organization yet.");
      }
    }).catch(() => setError("Failed to load organizations"));
  }, [fetchJson, orgParam]);

  const orgId = org?.id;

  // Load per-tab data

  useEffect(() => {
    if (!orgId || (tab !== "roles" && tab !== "members")) return;
    fetchJson(`/api/organizations/${orgId}/roles`)
      .then((data: Role[]) => {
        setRoles(data);
        if (data.length > 0 && !selectedRoleId) setSelectedRoleId(data[0].id);
      })
      .catch((e) => setError(e.message));
  }, [orgId, tab, selectedRoleId, fetchJson]);

  useEffect(() => {
    if (!orgId || tab !== "roles") return;
    fetchJson("/api/permissions").then(setPerms).catch((e) => setError(e.message));
  }, [orgId, tab, fetchJson]);

  useEffect(() => {
    if (!orgId || !selectedRoleId || tab !== "roles") return;
    fetchJson(`/api/organizations/${orgId}/roles/${selectedRoleId}/permissions`)
      .then((data: Perm[]) =>
        setRolePerms((prev) => ({ ...prev, [selectedRoleId]: data.map((p) => p.id) })),
      )
      .catch((e) => setError(e.message));
  }, [orgId, selectedRoleId, tab, fetchJson]);

  useEffect(() => {
    if (!orgId || tab !== "members") return;
    fetchJson(`/api/organizations/${orgId}/members`)
      .then(setMembers)
      .catch((e) => setError(e.message));
  }, [orgId, tab, fetchJson]);

  useEffect(() => {
    if (!orgId || tab !== "templates") return;
    fetchJson(`/api/organizations/${orgId}/templates`)
      .then(setTemplates)
      .catch((e) => setError(e.message));
  }, [orgId, tab, fetchJson]);

  // Actions ---------------------------------------------------------------

  async function createRole() {
    if (!orgId || !newRoleName.trim()) return;
    try {
      const role = await fetchJson(`/api/organizations/${orgId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoleName.trim() }),
      });
      setRoles((prev) => [...prev, role]);
      setSelectedRoleId(role.id);
      setNewRoleName("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function togglePermission(roleId: string, permId: string, on: boolean) {
    if (!orgId) return;
    try {
      await fetchJson(`/api/organizations/${orgId}/roles/${roleId}/permissions`, {
        method: on ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId: permId }),
      });
      setRolePerms((prev) => {
        const cur = prev[roleId] ?? [];
        const next = on ? [...cur, permId] : cur.filter((id) => id !== permId);
        return { ...prev, [roleId]: next };
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteRole(roleId: string) {
    if (!orgId || !window.confirm("Delete this role?")) return;
    try {
      await fetchJson(`/api/organizations/${orgId}/roles?roleId=${roleId}`, {
        method: "DELETE",
      });
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      if (selectedRoleId === roleId) {
        setSelectedRoleId(roles.find((r) => r.id !== roleId)?.id ?? null);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function assignRole(userId: string, teamId: string | null, roleId: string | null) {
    if (!orgId) return;
    try {
      await fetchJson(`/api/organizations/${orgId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, teamId, roleId }),
      });
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, roleId } : m)),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeMember(userId: string, teamId: string | null) {
    if (!orgId || !window.confirm("Remove this member?")) return;
    try {
      await fetchJson(`/api/organizations/${orgId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, teamId }),
      });
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function openTemplateBuilder(template?: Template) {
    const id = template?.id ?? "new";
    router.push(`/settings/templates/${id}?org=${orgId}`);
  }

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      <header className="frost h-14 shrink-0 flex items-center justify-between px-5 border-b border-border/50 z-10">
        <div className="flex items-center gap-3">
          <BackLink label={org?.name || "Back"} />
          <span className="text-text-muted/50">/</span>
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="w-5 h-5 rounded-md bg-gradient-to-br from-[#6b76ff] to-[#3d49e8] flex items-center justify-center text-white text-[10px] shadow-[0_4px_14px_-4px_rgba(88,101,242,0.7)]">
              ⚙
            </span>
            Settings
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <select
            value={orgId ?? ""}
            onChange={(e) => setOrg(orgs.find((o) => o.id === e.target.value) ?? null)}
            className="bg-bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-text-normal focus:border-accent focus:outline-none hover:border-border transition-colors cursor-pointer"
          >
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-56 shrink-0 bg-bg-secondary border-r border-border/50 py-5 px-3 flex flex-col gap-1">
          {[
            ["overview", "Overview"],
            ["roles", "Roles & Permissions"],
            ["members", "Members"],
            ["teams", "Teams"],
            ["templates", "Templates"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative group text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                tab === key
                  ? "bg-gradient-to-r from-surface to-surface/60 text-text-normal shadow-sm"
                  : "text-text-muted hover:bg-surface/50 hover:text-text-normal"
              }`}
            >
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r bg-gradient-to-b from-[#6b76ff] to-[#3d49e8] transition-all duration-200 ${
                  tab === key ? "h-5" : "h-0 group-hover:h-3 opacity-0 group-hover:opacity-60"
                }`}
              />
              {label}
            </button>
          ))}
        </nav>

        <main className="flex-1 overflow-y-auto p-8">
          {error && (
            <div className="animate-fade-up mb-5 px-4 py-2.5 rounded-lg bg-danger/15 border border-danger/25 text-danger text-sm">
              {error}
            </div>
          )}
          {!org && !error && (
            <div className="text-sm text-text-muted animate-fade-up">Loading…</div>
          )}

          {org && tab === "overview" && <OverviewTab key={org.id} org={org} canEdit={can("manage_org")} onError={setError} onOrg={setOrg} />}
          {org && tab === "roles" && (
            <RolesTab
              roles={roles}
              perms={perms}
              rolePerms={rolePerms}
              selectedRoleId={selectedRoleId}
              newRoleName={newRoleName}
              canManage={can("manage_roles")}
              onSelectRole={setSelectedRoleId}
              onNewRoleName={setNewRoleName}
              onCreateRole={createRole}
              onTogglePermission={togglePermission}
              onDeleteRole={deleteRole}
            />
          )}
          {orgId && tab === "members" && (
            <MembersTab
              orgId={orgId}
              members={members}
              roles={roles}
              canManage={can("manage_members")}
              onAssignRole={assignRole}
              onRemoveMember={removeMember}
              onError={setError}
            />
          )}
          {org && tab === "teams" && (
            <TeamsTab
              key={org.id}
              orgId={org.id}
              fetchJson={fetchJson}
              onError={setError}
              can={(key, teamId) => can(key, teamId)}
            />
          )}
          {org && tab === "templates" && (
            <TemplatesTab
              orgId={org.id}
              templates={templates}
              canManage={can("manage_templates")}
              onCreate={() => openTemplateBuilder()}
              onEdit={(t) => openTemplateBuilder(t)}
              onRefresh={() =>
                fetchJson(`/api/organizations/${org.id}/templates`)
                  .then(setTemplates)
                  .catch((e) => setError((e as Error).message))
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}

// --- Tabs --------------------------------------------------------------

function OverviewTab({
  org,
  canEdit,
  onError,
  onOrg,
}: {
  org: Org;
  canEdit: boolean;
  onError: (e: string) => void;
  onOrg: (o: Org) => void;
}) {
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return onError("Name is required");
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save");
      }
      onOrg(await res.json());
      onError("");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div className="animate-fade-up card-hover bg-gradient-to-br from-surface to-bg-secondary border border-border/40 rounded-2xl p-6 flex items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6b76ff] to-[#3d49e8] flex items-center justify-center text-white text-2xl font-bold shadow-[0_8px_24px_-8px_rgba(88,101,242,0.8)] shrink-0">
          {(org.name || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{org.name}</h1>
          {org.description ? (
            <p className="text-sm text-text-muted mt-0.5 line-clamp-2">{org.description}</p>
          ) : (
            <p className="text-sm text-text-muted mt-0.5">No description yet.</p>
          )}
          <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent font-medium">
            {org.slug}
          </span>
        </div>
      </div>

      <div className="animate-fade-up card-hover bg-surface border border-border/40 rounded-2xl p-6 flex flex-col gap-4" style={{ animationDelay: "60ms" }}>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Edit details</h2>
        <div>
          <label className="block text-sm font-medium mb-1.5">Name</label>
          <input
            value={name}
            disabled={!canEdit}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Description</label>
          <textarea
            value={description}
            disabled={!canEdit}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none resize-y disabled:opacity-60"
          />
        </div>
        <button
          onClick={save}
          disabled={saving || !canEdit}
          className="btn-primary self-start px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function RolesTab({
  roles,
  perms,
  rolePerms,
  selectedRoleId,
  newRoleName,
  canManage,
  onSelectRole,
  onNewRoleName,
  onCreateRole,
  onTogglePermission,
  onDeleteRole,
}: {
  roles: Role[];
  perms: Perm[];
  rolePerms: Record<string, string[]>;
  selectedRoleId: string | null;
  newRoleName: string;
  canManage: boolean;
  onSelectRole: (id: string) => void;
  onNewRoleName: (v: string) => void;
  onCreateRole: () => void;
  onTogglePermission: (roleId: string, permId: string, on: boolean) => void;
  onDeleteRole: (roleId: string) => void;
}) {
  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const selectedPerms = selectedRoleId ? (rolePerms[selectedRoleId] ?? []) : [];

  return (
    <div className="flex gap-8 items-start">
      <div className="w-72 shrink-0 animate-fade-up">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-xl font-semibold">Roles</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent font-medium">
            {roles.length}
          </span>
        </div>
        <div className="flex flex-col gap-1 mb-4">
          {roles.map((r, i) => (
            <div
              key={r.id}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all duration-200 animate-fade-up ${
                selectedRoleId === r.id
                  ? "bg-gradient-to-r from-surface to-surface/60 text-text-normal shadow-sm"
                  : "text-text-muted hover:bg-surface/50 hover:text-text-normal"
              }`}
              style={{ animationDelay: `${Math.min(i * 25, 200)}ms` }}
              onClick={() => onSelectRole(r.id)}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold transition-all duration-200 ${
                    selectedRoleId === r.id
                      ? "bg-gradient-to-br from-[#6b76ff] to-[#3d49e8] text-white shadow-[0_2px_8px_-2px_rgba(88,101,242,0.6)]"
                      : "bg-surface text-text-muted group-hover:text-text-normal"
                  }`}
                >
                  {r.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{r.name}</span>
              </span>
              {canManage && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteRole(r.id); }}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all duration-200 text-xs px-1"
                  title="Delete role"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {roles.length === 0 && (
            <div className="text-sm text-text-muted">No roles yet.</div>
          )}
        </div>
        {canManage && (
          <div className="flex gap-2">
            <input
              value={newRoleName}
              onChange={(e) => onNewRoleName(e.target.value)}
              placeholder="New role name"
              onKeyDown={(e) => e.key === "Enter" && onCreateRole()}
              className="flex-1 bg-bg-input border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
            <button
              onClick={onCreateRole}
              className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              Add
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold mb-4 animate-fade-up">
          {selectedRole ? (
            <span className="flex items-center gap-2">
              {selectedRole.name}
              <span className="text-sm font-normal text-text-muted">permissions</span>
            </span>
          ) : (
            "Select a role"
          )}
        </h1>
        {selectedRole && (
          <PermissionGrid
            perms={perms}
            selected={selectedPerms}
            readOnly={!canManage}
            onToggle={(permId, on) => onTogglePermission(selectedRole.id, permId, on)}
          />
        )}
      </div>
    </div>
  );
}

type InviteRow = {
  id: string;
  email: string | null;
  token: string;
  expiresAt: string;
  teamName: string | null;
  roleName: string | null;
};

function MembersTab({
  orgId,
  members,
  roles,
  canManage,
  onAssignRole,
  onRemoveMember,
  onError,
}: {
  orgId: string;
  members: Member[];
  roles: Role[];
  canManage: boolean;
  onAssignRole: (userId: string, teamId: string | null, roleId: string | null) => void;
  onRemoveMember: (userId: string, teamId: string | null) => void;
  onError: (e: string) => void;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [me, setMe] = useState<{ id: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d?.user ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!canManage || !orgId || !inviteOpen) return;
    let alive = true;
    fetch(`/api/organizations/${orgId}/invitations`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: InviteRow[]) => {
        if (alive) setInvites(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [orgId, canManage, inviteOpen]);

  async function revokeInvite(id: string) {
    if (!window.confirm("Revoke this invite link?")) return;
    const res = await fetch(`/api/organizations/${orgId}/invitations?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) setInvites((prev) => prev.filter((i) => i.id !== id));
  }

  async function leaveOrg() {
    if (!me || !window.confirm("Leave this organization? You will lose access to all its teams and meetings.")) return;
    const res = await fetch(`/api/organizations/${orgId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: me.id, all: true }),
    });
    if (res.ok) {
      window.location.href = "/";
    } else {
      const d = await res.json().catch(() => ({}));
      onError(d.error || "Failed to leave organization");
    }
  }
  useEffect(() => {
    if (roles.length === 0 && members.length > 0) {
      onError("Could not load roles — role assignment may be unavailable.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, members]);

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      <div className="animate-fade-up flex items-center gap-2">
        <h1 className="text-xl font-semibold">Members</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent font-medium">
          {members.length}
        </span>
      </div>
      {canManage && (
        <div className="animate-fade-up flex items-center gap-2" style={{ animationDelay: "40ms" }}>
          <button
            onClick={() => setInviteOpen(true)}
            className="btn-primary px-5 py-2 rounded-lg text-sm font-semibold text-white"
          >
            + Invite people
          </button>
          <span className="text-xs text-text-muted">
            New people get a join link — they create their own account.
          </span>
        </div>
      )}
      {inviteOpen && (
        <InviteModal
          orgId={orgId}
          roles={roles}
          onClose={() => setInviteOpen(false)}
        />
      )}
      <div className="flex flex-col gap-2">
        {members.map((m, i) => (
          <div
            key={m.id}
            className="card-hover group flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-surface/50 animate-fade-up"
            style={{ animationDelay: `${Math.min(i * 30, 250)}ms` }}
          >
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent/40 to-success/25 flex items-center justify-center text-accent text-sm font-semibold">
                {(m.user.name || m.user.email).charAt(0).toUpperCase()}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-bg-tertiary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{m.user.name || m.user.email}</div>
              <div className="text-xs text-text-muted truncate">{m.user.email}</div>
            </div>
            {canManage && (
              <select
                value={m.roleId ?? ""}
                onChange={(e) => onAssignRole(m.userId, m.teamId, e.target.value || null)}
                className="bg-bg-input border border-border rounded-lg px-2 py-1.5 text-sm focus:border-accent focus:outline-none cursor-pointer"
              >
                <option value="">No role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
            {canManage && (
              <button
                onClick={() => onRemoveMember(m.userId, m.teamId)}
                className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all duration-200 text-sm px-1"
                title="Remove member"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {members.length === 0 && (
          <div className="text-sm text-text-muted animate-fade-up">No members yet.</div>
        )}
      </div>
      {me && members.some((m) => m.userId === me.id) && (
        <div className="pt-3 border-t border-border/40 flex justify-end">
          <button
            onClick={leaveOrg}
            className="text-sm text-danger/80 hover:text-danger transition-colors"
          >
            Leave organization
          </button>
        </div>
      )}
      {canManage && invites.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Pending invites
          </span>
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="group flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border/40 bg-surface/50 text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">
                  {inv.email ?? "Open link — anyone with it can join"}
                </div>
                <div className="text-xs text-text-muted">
                  {[inv.teamName ?? "Organization-wide", inv.roleName, `expires ${new Date(inv.expiresAt).toLocaleDateString()}`]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/join/${inv.token}`);
                  window.alert("Invite link copied");
                }}
                className="shrink-0 px-3 py-1 rounded-lg bg-accent/10 border border-accent/25 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
              >
                Copy link
              </button>
              <button
                onClick={() => revokeInvite(inv.id)}
                className="shrink-0 text-text-muted hover:text-danger transition-colors text-sm px-1"
                title="Revoke invite"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InviteModal({
  orgId,
  roles,
  onClose,
}: {
  orgId: string;
  roles: Role[];
  onClose: () => void;
}) {
  const [emails, setEmails] = useState("");
  const [teamId, setTeamId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    added: string[];
    invited: { email: string; token: string }[];
    alreadyMembers: string[];
    emailErrors: { email: string; error: string }[];
    emailed: string[];
    openLink?: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/organizations/${orgId}/teams`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setTeams)
      .catch(() => {});
  }, [orgId]);

  const scopedRoles = roles.filter((r) => !r.teamId || r.teamId === teamId);

  async function invite(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/organizations/${orgId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: teamId || null, roleId: roleId || null, ...body }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to invite");
      // Normalize: the /invitations endpoint omits some arrays the emails path
      // never fills (e.g. alreadyMembers), so default every field — otherwise
      // the result view crashes on `.length` of undefined (no error boundary).
      setResult({
        added: d.added ?? [],
        invited: d.invited ?? [],
        alreadyMembers: d.alreadyMembers ?? [],
        emailErrors: d.emailErrors ?? [],
        emailed: d.emailed ?? [],
        openLink: d.openLink,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function send() {
    const list = emails.split(/[\n,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (list.length === 0) return;
    invite({ emails: list });
  }

  function sendOpen() {
    invite({ open: true });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative animate-pop-in bg-bg-primary w-full max-w-md p-6 rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] border border-border/50 flex flex-col gap-4 max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-semibold">Invite people</h2>
        {!result ? (
          <>
            <textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder={"one@example.com\ntwo@example.com"}
              rows={3}
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none resize-y"
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted uppercase tracking-wide">
                Team
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="bg-bg-input border border-border rounded-lg px-2 py-2 text-sm text-text-normal normal-case tracking-normal focus:border-accent focus:outline-none cursor-pointer"
                >
                  <option value="">Organization-wide</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted uppercase tracking-wide">
                Role
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  className="bg-bg-input border border-border rounded-lg px-2 py-2 text-sm text-text-normal normal-case tracking-normal focus:border-accent focus:outline-none cursor-pointer"
                >
                  <option value="">No role</option>
                  {scopedRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-text-muted -mt-2">
              People who already have an account are added directly. Everyone else gets a
              single-use join link valid for 7 days.
            </p>
            {error && <p className="text-danger text-sm">{error}</p>}
            <div className="flex items-center gap-2">
              <button
                onClick={sendOpen}
                disabled={busy}
                className="text-xs text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
              >
                or create an open join link (anyone with it can join)
              </button>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-surface/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={send}
                  disabled={busy || emails.trim() === ""}
                  className="btn-primary px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Inviting…" : "Send invites"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {result.openLink && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Open join link:</span>
                <div className="flex items-center gap-2 bg-bg-input border border-border/40 rounded-lg px-3 py-2">
                  <code className="flex-1 min-w-0 truncate text-[11px] text-text-muted">
                    {typeof window !== "undefined" ? `${window.location.origin}/join/${result.openLink}` : ""}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join/${result.openLink}`)}
                    className="shrink-0 px-3 py-1 rounded-lg bg-accent/10 border border-accent/25 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-text-muted">
                  Anyone with this link can join — revoke it from the pending list when done.
                </p>
              </div>
            )}
            {result.added.length > 0 && (
              <div className="text-sm">
                <span className="font-medium text-success">Added directly:</span>{" "}
                <span className="text-text-muted">{result.added.join(", ")}</span>
              </div>
            )}
            {result.invited.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Join links for new people:</span>
                {result.invited.map((i) => (
                  <div
                    key={i.token}
                    className="flex items-center gap-2 bg-bg-input border border-border/40 rounded-lg px-3 py-2"
                  >
                    <code className="flex-1 min-w-0 truncate text-[11px] text-text-muted">
                      {i.email}: {`${typeof window !== "undefined" ? window.location.origin : ""}/join/${i.token}`}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join/${i.token}`)}
                      className="shrink-0 px-3 py-1 rounded-lg bg-accent/10 border border-accent/25 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                ))}
                <p className="text-xs text-text-muted">
                  Links expire in 7 days and work once per person.
                </p>
              </div>
            )}
            {result.alreadyMembers.length > 0 && (
              <div className="text-xs text-warning">
                Already members: {result.alreadyMembers.join(", ")}
              </div>
            )}
            {result.emailed.length > 0 && (
              <div className="text-xs text-success">
                Emailed to: {result.emailed.join(", ")}
              </div>
            )}
            {result.emailErrors.map((e) => (
              <div key={e.email} className="text-xs text-danger">
                {e.email}: {e.error}
              </div>
            ))}
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="btn-primary px-5 py-2 rounded-lg text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TemplatesTab({
  orgId,
  templates,
  canManage,
  onCreate,
  onEdit,
  onRefresh,
}: {
  orgId: string;
  templates: Template[];
  canManage: boolean;
  onCreate: () => void;
  onEdit: (t: Template) => void;
  onRefresh: () => void;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [catalog, setCatalog] = useState<
    { key: string; name: string; description: string | null; fieldCount: number }[]
  >([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [libError, setLibError] = useState("");

  useEffect(() => {
    if (!libraryOpen || catalog.length > 0) return;
    fetch("/api/templates/catalog")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCatalog)
      .catch(() => setLibError("Couldn't load the template library."));
  }, [libraryOpen, catalog.length]);

  async function addStarter(key: string) {
    setAdding(key);
    setLibError("");
    try {
      const res = await fetch(`/api/organizations/${orgId}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starterKey: key }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to add template");
      }
      onRefresh();
      setLibraryOpen(false);
    } catch (e) {
      setLibError((e as Error).message);
    } finally {
      setAdding(null);
    }
  }

  // Names already in the org — offer re-adding but flag the duplicate.
  const existingNames = new Set(templates.map((t) => t.name));

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      <div className="animate-fade-up flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Templates</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent font-medium">
            {templates.length}
          </span>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLibraryOpen(true)}
              className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-surface/60 transition-colors"
            >
              Add from library
            </button>
            <button
              onClick={onCreate}
              className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold text-white"
            >
              New template
            </button>
          </div>
        )}
      </div>
      {libraryOpen && (
        <StarterLibrary
          catalog={catalog}
          existingNames={existingNames}
          adding={adding}
          error={libError}
          onAdd={addStarter}
          onClose={() => setLibraryOpen(false)}
        />
      )}
      <div className="flex flex-col gap-2">
        {templates.map((t, i) => {
          const fieldCount = t.fields?.length ?? 0;
          return (
            <button
              key={t.id}
              onClick={() => onEdit(t)}
              className="group card-hover flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-surface/50 text-left animate-fade-up"
              style={{ animationDelay: `${Math.min(i * 30, 250)}ms` }}
            >
              <span className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-[#6b76ff] to-[#3d49e8] flex items-center justify-center text-white text-xs shadow-[0_2px_8px_-2px_rgba(88,101,242,0.6)]">
                ðŸ“„
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{t.name}</span>
                {t.description && (
                  <span className="block text-xs text-text-muted truncate">{t.description}</span>
                )}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border/50 text-text-muted shrink-0">
                {fieldCount} field{fieldCount === 1 ? "" : "s"}
              </span>
              <span className="shrink-0 text-text-muted transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-accent">›</span>
            </button>
          );
        })}
        {templates.length === 0 && (
          <div className="text-sm text-text-muted animate-fade-up">No templates yet.</div>
        )}
      </div>
    </div>
  );
}

function StarterLibrary({
  catalog,
  existingNames,
  adding,
  error,
  onAdd,
  onClose,
}: {
  catalog: { key: string; name: string; description: string | null; fieldCount: number }[];
  existingNames: Set<string>;
  adding: string | null;
  error: string;
  onAdd: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative animate-pop-in bg-bg-primary w-full max-w-lg p-6 rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] border border-border/50 flex flex-col gap-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Template library</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-normal text-sm px-1">✕</button>
        </div>
        <p className="text-xs text-text-muted -mt-2">
          Add a ready-made template to this organization. It becomes an editable copy owned by this org.
        </p>
        {error && <p className="text-danger text-sm">{error}</p>}
        <div className="flex flex-col gap-2">
          {catalog.map((c) => {
            const already = existingNames.has(c.name);
            return (
              <div
                key={c.key}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-surface/50"
              >
                <span className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-[#6b76ff] to-[#3d49e8] flex items-center justify-center text-white text-xs shadow-[0_2px_8px_-2px_rgba(88,101,242,0.6)]">
                  ◈
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{c.name}</span>
                  {c.description && (
                    <span className="block text-xs text-text-muted truncate">{c.description}</span>
                  )}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border/50 text-text-muted shrink-0">
                  {c.fieldCount} field{c.fieldCount === 1 ? "" : "s"}
                </span>
                <button
                  onClick={() => onAdd(c.key)}
                  disabled={adding !== null}
                  title={already ? "Already added — this creates another copy" : undefined}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/25 text-accent text-xs font-medium hover:bg-accent/20 transition-colors disabled:opacity-50"
                >
                  {adding === c.key ? "Adding…" : already ? "Add again" : "Add"}
                </button>
              </div>
            );
          })}
          {catalog.length === 0 && !error && (
            <div className="text-sm text-text-muted">Loading library…</div>
          )}
        </div>
      </div>
    </div>
  );
}
