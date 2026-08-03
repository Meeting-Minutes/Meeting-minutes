"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Org = { id: string; name: string; description?: string | null; slug: string };
type Team = { id: string; name: string; description?: string | null };
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
    <a
      href="/"
      className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-normal transition-colors"
    >
      <span>←</span> {label}
    </a>
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
  const [addEmail, setAddEmail] = useState("");

  // Teams
  const [teams, setTeams] = useState<Team[]>([]);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);

  const fetchJson = useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, init);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || `Request failed (${res.status})`);
    }
    return res.json();
  }, []);

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
    if (!orgId || tab !== "teams") return;
    fetchJson(`/api/organizations/${orgId}/teams`)
      .then(setTeams)
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

  async function addMember() {
    if (!orgId || !addEmail.trim()) return;
    try {
      await fetchJson(`/api/organizations/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail.trim(), teamId: null }),
      });
      setAddEmail("");
      setMembers(await fetchJson(`/api/organizations/${orgId}/members`));
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

  async function createTeam() {
    const name = window.prompt("Team name");
    if (!orgId || !name?.trim()) return;
    try {
      const team = await fetchJson(`/api/organizations/${orgId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      setTeams((prev) => [...prev, team]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function openTemplateBuilder(template?: Template) {
    const id = template?.id ?? "new";
    router.push(`/settings/templates/${id}?org=${orgId}`);
  }

  const canManageRoles = true; // gate at the API; UI hides nothing

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-border/50 bg-bg-secondary">
        <div className="flex items-center gap-3">
          <BackLink label={org?.name || "Back"} />
          <span className="text-text-muted">/</span>
          <span className="text-sm font-semibold">Settings</span>
        </div>
        <select
          value={orgId ?? ""}
          onChange={(e) => setOrg(orgs.find((o) => o.id === e.target.value) ?? null)}
          className="bg-bg-input border border-border rounded-md px-2 py-1.5 text-sm text-text-normal focus:border-accent focus:outline-none"
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-52 shrink-0 bg-bg-secondary border-r border-border/50 py-4 px-2 flex flex-col gap-0.5">
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
              className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                tab === key
                  ? "bg-surface text-text-normal"
                  : "text-text-muted hover:bg-surface/50 hover:text-text-normal"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <main className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 px-4 py-2.5 rounded-lg bg-danger/15 text-danger text-sm">
              {error}
            </div>
          )}
          {!org && !error && (
            <div className="text-sm text-text-muted">Loading…</div>
          )}

          {org && tab === "overview" && <OverviewTab org={org} onError={setError} onOrg={setOrg} />}
          {org && tab === "roles" && (
            <RolesTab
              orgId={org.id}
              roles={roles}
              perms={perms}
              rolePerms={rolePerms}
              selectedRoleId={selectedRoleId}
              newRoleName={newRoleName}
              onSelectRole={setSelectedRoleId}
              onNewRoleName={setNewRoleName}
              onCreateRole={createRole}
              onTogglePermission={togglePermission}
              onDeleteRole={deleteRole}
            />
          )}
          {org && tab === "members" && (
            <MembersTab
              members={members}
              roles={roles}
              addEmail={addEmail}
              onAddEmail={setAddEmail}
              onAddMember={addMember}
              onAssignRole={assignRole}
              onRemoveMember={removeMember}
              onError={setError}
            />
          )}
          {org && tab === "teams" && (
            <TeamsTab teams={teams} onCreateTeam={createTeam} />
          )}
          {org && tab === "templates" && (
            <TemplatesTab
              templates={templates}
              onCreate={() => openTemplateBuilder()}
              onEdit={(t) => openTemplateBuilder(t)}
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
  onError,
  onOrg,
}: {
  org: Org;
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
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Organization</h1>
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-bg-input border border-border rounded-md px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full bg-bg-input border border-border rounded-md px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function RolesTab({
  orgId,
  roles,
  perms,
  rolePerms,
  selectedRoleId,
  newRoleName,
  onSelectRole,
  onNewRoleName,
  onCreateRole,
  onTogglePermission,
  onDeleteRole,
}: {
  orgId: string;
  roles: Role[];
  perms: Perm[];
  rolePerms: Record<string, string[]>;
  selectedRoleId: string | null;
  newRoleName: string;
  onSelectRole: (id: string) => void;
  onNewRoleName: (v: string) => void;
  onCreateRole: () => void;
  onTogglePermission: (roleId: string, permId: string, on: boolean) => void;
  onDeleteRole: (roleId: string) => void;
}) {
  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const selectedPerms = selectedRoleId ? (rolePerms[selectedRoleId] ?? []) : [];

  return (
    <div className="flex gap-6">
      <div className="w-64 shrink-0">
        <h1 className="text-xl font-semibold mb-4">Roles</h1>
        <div className="flex flex-col gap-1 mb-3">
          {roles.map((r) => (
            <div
              key={r.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer ${
                selectedRoleId === r.id
                  ? "bg-surface text-text-normal"
                  : "text-text-muted hover:bg-surface/50 hover:text-text-normal"
              }`}
              onClick={() => onSelectRole(r.id)}
            >
              <span>{r.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteRole(r.id); }}
                className="text-text-muted hover:text-danger text-xs px-1"
                title="Delete role"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newRoleName}
            onChange={(e) => onNewRoleName(e.target.value)}
            placeholder="New role name"
            onKeyDown={(e) => e.key === "Enter" && onCreateRole()}
            className="flex-1 bg-bg-input border border-border rounded-md px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
          <button
            onClick={onCreateRole}
            className="px-3 py-1.5 rounded-md bg-accent text-white text-sm hover:bg-accent-hover"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex-1">
        <h1 className="text-xl font-semibold mb-4">
          {selectedRole ? `${selectedRole.name} permissions` : "Select a role"}
        </h1>
        {selectedRole && (
          <div className="flex flex-col gap-1.5">
            {perms.map((p) => {
              const on = selectedPerms.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={`flex items-start gap-3 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                    on
                      ? "border-accent/40 bg-accent/5"
                      : "border-border/50 hover:border-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => onTogglePermission(selectedRole.id, p.id, e.target.checked)}
                    className="mt-0.5 accent-[var(--color-accent)]"
                  />
                  <span>
                    <span className="block font-medium text-text-normal">{p.key}</span>
                    {p.description && (
                      <span className="block text-xs text-text-muted">{p.description}</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MembersTab({
  members,
  roles,
  addEmail,
  onAddEmail,
  onAddMember,
  onAssignRole,
  onRemoveMember,
  onError,
}: {
  members: Member[];
  roles: Role[];
  addEmail: string;
  onAddEmail: (v: string) => void;
  onAddMember: () => void;
  onAssignRole: (userId: string, teamId: string | null, roleId: string | null) => void;
  onRemoveMember: (userId: string, teamId: string | null) => void;
  onError: (e: string) => void;
}) {
  useEffect(() => {
    if (roles.length === 0 && members.length > 0) {
      onError("Could not load roles — role assignment may be unavailable.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, members]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold mb-4">Members</h1>
      <div className="flex gap-2 mb-5">
        <input
          value={addEmail}
          onChange={(e) => onAddEmail(e.target.value)}
          placeholder="user@example.com"
          onKeyDown={(e) => e.key === "Enter" && onAddMember()}
          className="flex-1 bg-bg-input border border-border rounded-md px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <button
          onClick={onAddMember}
          className="px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover"
        >
          Add member
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{m.user.name || m.user.email}</div>
              <div className="text-xs text-text-muted truncate">{m.user.email}</div>
            </div>
            <select
              value={m.roleId ?? ""}
              onChange={(e) => onAssignRole(m.userId, m.teamId, e.target.value || null)}
              className="bg-bg-input border border-border rounded-md px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
            >
              <option value="">No role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button
              onClick={() => onRemoveMember(m.userId, m.teamId)}
              className="text-text-muted hover:text-danger text-sm px-1"
              title="Remove member"
            >
              ✕
            </button>
          </div>
        ))}
        {members.length === 0 && (
          <div className="text-sm text-text-muted">No members yet.</div>
        )}
      </div>
    </div>
  );
}

function TeamsTab({
  teams,
  onCreateTeam,
}: {
  teams: Team[];
  onCreateTeam: () => void;
}) {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Teams</h1>
        <button
          onClick={onCreateTeam}
          className="px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover"
        >
          New team
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {teams.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50"
          >
            <span className="text-lg text-text-muted/60">#</span>
            <span className="text-sm font-medium">{t.name}</span>
            {t.description && (
              <span className="text-xs text-text-muted truncate">{t.description}</span>
            )}
          </div>
        ))}
        {teams.length === 0 && (
          <div className="text-sm text-text-muted">No teams yet.</div>
        )}
      </div>
    </div>
  );
}

function TemplatesTab({
  templates,
  onCreate,
  onEdit,
}: {
  templates: Template[];
  onCreate: () => void;
  onEdit: (t: Template) => void;
}) {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Templates</h1>
        <button
          onClick={onCreate}
          className="px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover"
        >
          New template
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => onEdit(t)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50 text-left hover:border-accent/40 transition-colors"
          >
            <span className="text-sm font-medium flex-1">{t.name}</span>
            <span className="text-xs text-text-muted">
              {(t.fields?.length ?? 0)} field{(t.fields?.length ?? 0) === 1 ? "" : "s"}
            </span>
          </button>
        ))}
        {templates.length === 0 && (
          <div className="text-sm text-text-muted">No templates yet.</div>
        )}
      </div>
    </div>
  );
}
