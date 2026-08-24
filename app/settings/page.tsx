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
  const [addEmail, setAddEmail] = useState("");

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

  // UI-only gate; the API enforces the real checks.
  const { can } = useMyPermissions(orgId);

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

  async function bulkAddMembers(emails: string[], sendInvite: boolean) {
    const d = await fetchJson(`/api/organizations/${orgId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails, teamId: null, sendInvite }),
    });
    setMembers(await fetchJson(`/api/organizations/${orgId}/members`));
    return d;
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
          {org && tab === "members" && (
            <MembersTab
              members={members}
              roles={roles}
              addEmail={addEmail}
              canManage={can("manage_members")}
              onAddEmail={setAddEmail}
              onAddMember={addMember}
              onBulkAdd={bulkAddMembers}
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
              templates={templates}
              canManage={can("manage_templates")}
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

function MembersTab({
  members,
  roles,
  addEmail,
  canManage,
  onAddEmail,
  onAddMember,
  onBulkAdd,
  onAssignRole,
  onRemoveMember,
  onError,
}: {
  members: Member[];
  roles: Role[];
  addEmail: string;
  canManage: boolean;
  onAddEmail: (v: string) => void;
  onAddMember: () => void;
  onBulkAdd: (
    emails: string[],
    sendInvite: boolean,
  ) => Promise<{
    created: { email: string; name?: string; password?: string }[];
    alreadyMembers: string[];
    emailed: string[];
    emailErrors: { email: string; error: string }[];
  }>;
  onAssignRole: (userId: string, teamId: string | null, roleId: string | null) => void;
  onRemoveMember: (userId: string, teamId: string | null) => void;
  onError: (e: string) => void;
}) {
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkSendInvite, setBulkSendInvite] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<null | Awaited<ReturnType<typeof onBulkAdd>>>(null);

  function onCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const emails = text
        .split(/[\n,;\t]+/)
        .map((e) => e.trim().replace(/^"?|"?$/g, "").toLowerCase())
        .filter((e) => e.includes("@"));
      if (emails.length > 0) setBulkEmails(emails.join("\n"));
    };
    reader.readAsText(file);
  }

  function downloadCredentialsCsv() {
    if (!bulkResult) return;
    const rows = bulkResult.created
      .filter((c) => c.password)
      .map((c) => `${c.email},${c.password}`);
    if (rows.length === 0) return;
    const blob = new Blob(["email,password\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "credentials.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function bulkAdd() {
    const emails = bulkEmails.split("\n").map((e) => e.trim()).filter(Boolean);
    if (!emails.length) return;
    setBulkBusy(true);
    setBulkResult(null);
    try {
      setBulkResult(await onBulkAdd(emails, bulkSendInvite));
      setBulkEmails("");
      onError("");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBulkBusy(false);
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
        <div className="animate-fade-up card-hover bg-surface border border-border/40 rounded-2xl p-3 flex gap-2" style={{ animationDelay: "40ms" }}>
          <input
            value={addEmail}
            onChange={(e) => onAddEmail(e.target.value)}
            placeholder="user@example.com"
            onKeyDown={(e) => e.key === "Enter" && onAddMember()}
            className="flex-1 bg-bg-input border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <button
            onClick={onAddMember}
            className="btn-primary px-5 py-2 rounded-lg text-sm font-semibold text-white"
          >
            Add member
          </button>
        </div>
      )}
      {canManage && (
        <div className="animate-fade-up card-hover bg-surface border border-border/40 rounded-2xl p-3 flex flex-col gap-2" style={{ animationDelay: "80ms" }}>
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Bulk add (one email per line)</span>
        <textarea
          value={bulkEmails}
          onChange={(e) => setBulkEmails(e.target.value)}
          placeholder={"alice@example.com\nbob@example.com"}
          rows={3}
          className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none resize-y"
        />
        <label className="flex items-center gap-2 text-xs text-accent hover:text-accent-hover cursor-pointer self-start">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
            <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" />
          </svg>
          Upload .csv
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onCsvFile(f);
              e.target.value = "";
            }}
          />
        </label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-text-normal cursor-pointer">
            <input
              type="checkbox"
              checked={bulkSendInvite}
              onChange={(e) => setBulkSendInvite(e.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            Create accounts and email credentials
          </label>
          <button
            onClick={bulkAdd}
            disabled={bulkBusy}
            className="btn-primary px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          >
            {bulkBusy ? "Adding…" : "Add all"}
          </button>
        </div>
        {bulkResult && (
          <div className="flex flex-col gap-1.5 border-t border-border/40 pt-2">
            <div className="text-sm text-text-normal flex items-center gap-2">
              <span>
                {bulkResult.created.length} created · {bulkResult.alreadyMembers.length} already members
                {bulkResult.emailed.length > 0 && ` · ${bulkResult.emailed.length} emailed`}
                {bulkResult.emailErrors.length > 0 && ` · ${bulkResult.emailErrors.length} email errors`}
              </span>
              {bulkResult.created.some((c) => c.password) && (
                <button
                  onClick={downloadCredentialsCsv}
                  className="ml-auto shrink-0 px-3 py-1 rounded-lg bg-accent/10 border border-accent/25 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
                >
                  ↓ Download credentials .csv
                </button>
              )}
            </div>
            {bulkResult.created.some((c) => c.password) && (
              <div className="overflow-auto max-h-40 rounded-lg bg-bg-input border border-border/40 p-2 text-[11px] font-mono text-text-muted">
                {bulkResult.created.map((c) => (
                  <div key={c.email}>
                    {c.email}
                    {c.password ? `  /  ${c.password}` : ""}
                  </div>
                ))}
              </div>
            )}
            {bulkResult.created.length > 0 && !bulkResult.created.some((c) => c.password) && (
              <div className="text-xs text-text-muted">Passwords emailed — copy from the invite.</div>
            )}
            {bulkResult.emailErrors.map((e) => (
              <div key={e.email} className="text-xs text-danger">{e.email}: {e.error}</div>
            ))}
          </div>
        )}
        </div>
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
    </div>
  );
}

function TemplatesTab({
  templates,
  canManage,
  onCreate,
  onEdit,
}: {
  templates: Template[];
  canManage: boolean;
  onCreate: () => void;
  onEdit: (t: Template) => void;
}) {
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
          <button
            onClick={onCreate}
            className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold text-white"
          >
            New template
          </button>
        )}
      </div>
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
                📄
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
