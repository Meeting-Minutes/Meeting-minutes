"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Org = { id: string; name: string; description?: string | null; slug: string };
type Team = { id: string; name: string; description?: string | null };
type User = { id: string; email: string; name: string };
type Member = { id: string; userId: string; teamId: string | null; createdAt: string; user: User };

type FormModalProps = {
  title: string;
  fields: { key: string; label: string; placeholder: string; value: string; multiline?: boolean }[];
  buttonLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
  error: string;
  creating: boolean;
};

function FormModal({ title, fields, buttonLabel, onSubmit, onClose, error, creating }: FormModalProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.value])),
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-bg-primary rounded-lg p-6 w-96 shadow-2xl">
        <h2 className="text-lg font-semibold text-text-normal mb-4">{title}</h2>
        {fields.map((f) =>
          f.multiline ? (
            <textarea
              key={f.key}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              rows={3}
              className="w-full px-3 py-2 text-text-normal placeholder:text-text-muted/50 mb-4 resize-none"
              disabled={creating}
            />
          ) : (
            <input
              key={f.key}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full px-3 py-2 text-text-normal placeholder:text-text-muted/50 mb-4"
              onKeyDown={(e) => e.key === "Enter" && !creating && onSubmit(values)}
              autoFocus
              disabled={creating}
            />
          ),
        )}
        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={creating} className="px-4 py-2 text-text-muted hover:text-text-normal transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(values)}
            disabled={creating || !values[fields[0].key]?.trim()}
            className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-accent/50 text-white rounded transition-colors disabled:cursor-not-allowed"
          >
            {creating ? "Saving..." : buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type MemberListProps = {
  members: Member[];
  teamId: string | null;
  onRemove: (userId: string, teamId: string | null) => void;
};

function MemberList({ members, teamId, onRemove }: MemberListProps) {
  const scope = teamId ? "team" : "org";
  return (
    <div>
      <h3 className="text-text-normal font-medium mb-2">Members</h3>
      {members.length === 0 ? (
        <p className="text-text-muted text-sm">No members yet.</p>
      ) : (
        <div className="space-y-1">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded bg-bg-primary/50">
              <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold shrink-0">
                {m.user.name[0]}
              </div>
              <span className="text-sm text-text-normal flex-1 min-w-0 truncate">{m.user.name}</span>
              <span className="text-xs text-text-muted hidden sm:block">{m.user.email}</span>
              <button
                onClick={() => onRemove(m.userId, teamId)}
                className="text-xs text-text-muted hover:text-danger transition-colors px-1"
                title={`Remove from ${scope}`}
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

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingOrg, setEditingOrg] = useState<Org | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [addEmail, setAddEmail] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/organizations")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setOrgs(data);
        if (data.length > 0) setActiveOrgId((prev) => prev ?? data[0].id);
      });
  }, [user]);

  useEffect(() => {
    setActiveTeamId(null);
    setMembers([]);
    if (!activeOrgId) return;
    fetch(`/api/organizations/${activeOrgId}/teams`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setTeams);
  }, [activeOrgId]);

  const fetchMembers = useCallback(async (orgId: string, teamId?: string) => {
    const url = teamId
      ? `/api/organizations/${orgId}/members?teamId=${teamId}`
      : `/api/organizations/${orgId}/members`;
    const res = await fetch(url);
    if (res.ok) setMembers(await res.json());
  }, []);

  useEffect(() => {
    if (!activeOrgId) return;
    fetchMembers(activeOrgId, activeTeamId ?? undefined);
  }, [activeOrgId, activeTeamId, fetchMembers]);

  async function createOrg(values: Record<string, string>) {
    setError("");
    setCreating(true);
    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: values.name, description: values.description || null }),
    });
    setCreating(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to create organization");
      return;
    }
    const org = await res.json();
    setOrgs((prev) => [...prev, org]);
    setActiveOrgId(org.id);
    setShowNewOrg(false);
  }

  async function updateOrg(values: Record<string, string>) {
    if (!editingOrg) return;
    setError("");
    setCreating(true);
    const res = await fetch(`/api/organizations/${editingOrg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: values.name, description: values.description || null }),
    });
    setCreating(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to update organization");
      return;
    }
    const updated = await res.json();
    setOrgs((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setEditingOrg(null);
  }

  async function createTeam(values: Record<string, string>) {
    if (!activeOrgId) return;
    setError("");
    setCreating(true);
    const res = await fetch(`/api/organizations/${activeOrgId}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: values.name, description: values.description || null }),
    });
    setCreating(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to create team");
      return;
    }
    const team = await res.json();
    setTeams((prev) => [...prev, team]);
    setActiveTeamId(team.id);
    setShowNewTeam(false);
  }

  async function updateTeam(values: Record<string, string>) {
    if (!editingTeam || !activeOrgId) return;
    setError("");
    setCreating(true);
    const res = await fetch(`/api/organizations/${activeOrgId}/teams`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: editingTeam.id, name: values.name, description: values.description || null }),
    });
    setCreating(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to update team");
      return;
    }
    const updated = await res.json();
    setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditingTeam(null);
  }

  async function addMember() {
    if (!activeOrgId || !addEmail.trim()) return;
    setMemberError("");
    const res = await fetch(`/api/organizations/${activeOrgId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: addEmail.trim(), teamId: activeTeamId || null }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMemberError(d.error || "Failed to add member");
      return;
    }
    setAddEmail("");
    fetchMembers(activeOrgId, activeTeamId ?? undefined);
  }

  async function removeMember(userId: string, teamId: string | null) {
    if (!activeOrgId) return;
    const res = await fetch(`/api/organizations/${activeOrgId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, teamId }),
    });
    if (res.ok) {
      fetchMembers(activeOrgId, activeTeamId ?? undefined);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const activeTeam = teams.find((t) => t.id === activeTeamId);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Server bar */}
      <nav className="w-[72px] bg-bg-tertiary flex flex-col items-center gap-2 py-3 shrink-0">
        {orgs.map((org) => (
          <button
            key={org.id}
            onClick={() => setActiveOrgId(org.id)}
            title={org.name}
            className={`w-12 h-12 rounded-2xl hover:rounded-xl transition-all flex items-center justify-center font-bold text-lg ${
              activeOrgId === org.id
                ? "bg-accent text-white rounded-xl"
                : "bg-bg-secondary text-text-muted hover:bg-accent hover:text-white"
            }`}
          >
            {org.name[0].toUpperCase()}
          </button>
        ))}
        {orgs.length > 0 && <div className="w-8 h-px bg-border" />}
        <button
          onClick={() => { setError(""); setShowNewOrg(true); }}
          title="New organization"
          className="w-12 h-12 rounded-2xl hover:rounded-xl hover:bg-success transition-all flex items-center justify-center text-text-muted hover:text-white text-2xl font-light border-2 border-dashed border-border hover:border-success"
        >
          +
        </button>
      </nav>

      {/* Channel sidebar */}
      <aside className="w-60 bg-bg-secondary flex flex-col shrink-0">
        <div className="h-12 flex items-center px-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-text-normal truncate">{activeOrg?.name || "Minutes"}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {activeOrgId && (
            <div>
              <div className="flex items-center px-2 py-1 mt-2 mb-0.5">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Teams</span>
              </div>
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTeamId(t.id)}
                  className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors ${
                    activeTeamId === t.id
                      ? "bg-bg-hover text-text-normal"
                      : "text-text-muted hover:bg-bg-hover hover:text-text-normal"
                  }`}
                >
                  <span className="text-text-muted w-4 text-center text-lg leading-none shrink-0">#</span>
                  <span className="truncate text-left">{t.name}</span>
                </button>
              ))}
              <button
                onClick={() => { setError(""); setShowNewTeam(true); }}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-text-muted hover:bg-bg-hover hover:text-text-normal transition-colors mt-0.5"
              >
                <span className="text-lg leading-none mr-0.5">+</span>
                Add team
              </button>
            </div>
          )}
          {!activeOrgId && (
            <p className="text-text-muted text-sm px-2 mt-4">
              {user ? "Create an organization to get started." : "Sign in to get started."}
            </p>
          )}
        </div>
        {user && (
          <div className="h-14 shrink-0 bg-bg-tertiary/50 px-2 flex items-center gap-2 border-t border-border">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-normal truncate">{user.name}</p>
              <p className="text-xs text-text-muted truncate">{user.email}</p>
            </div>
            <button onClick={logout} title="Sign out" className="text-text-muted hover:text-text-normal transition-colors text-lg leading-none px-1">⏻</button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b border-border flex items-center px-4 shrink-0 bg-bg-primary gap-2">
          {activeTeam ? (
            <>
              <span className="text-text-muted mr-1 font-semibold">#</span>
              <span className="font-semibold text-text-normal">{activeTeam.name}</span>
              <button
                onClick={() => { setError(""); setEditingTeam(activeTeam); }}
                className="text-xs text-text-muted hover:text-text-normal ml-auto transition-colors"
              >
                Edit
              </button>
            </>
          ) : activeOrg ? (
            <>
              <span className="text-text-muted mr-1 font-semibold">#</span>
              <span className="font-semibold text-text-normal">{activeOrg.name}</span>
              <button
                onClick={() => { setError(""); setEditingOrg(activeOrg); }}
                className="text-xs text-text-muted hover:text-text-normal ml-auto transition-colors"
              >
                Edit
              </button>
            </>
          ) : (
            <span className="text-text-muted text-sm">No organization selected</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!user ? (
            <div className="max-w-md mx-auto mt-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">M</div>
              <h1 className="text-2xl font-bold text-text-normal">Minutes</h1>
              <p className="text-text-muted mt-2">Meeting minutes management for your organization.</p>
            </div>
          ) : !activeOrgId ? (
            <div className="max-w-md mx-auto mt-24 text-center">
              <h1 className="text-2xl font-bold text-text-normal">Welcome, {user.name}</h1>
              <p className="text-text-muted mt-2">Create an organization to start managing meetings and minutes.</p>
              <button
                onClick={() => { setError(""); setShowNewOrg(true); }}
                className="mt-6 px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded transition-colors"
              >
                Create organization
              </button>
            </div>
          ) : activeTeam ? (
            <div className="max-w-3xl mx-auto mt-8 space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-text-normal"># {activeTeam.name}</h1>
                {activeTeam.description && (
                  <p className="text-text-muted mt-1">{activeTeam.description}</p>
                )}
                <p className="text-text-muted text-sm mt-1">Team under {activeOrg?.name}</p>
              </div>

              <div className="bg-bg-secondary rounded-lg border border-border p-4">
                <MemberList members={members} teamId={activeTeam.id} onRemove={removeMember} />
                <div className="flex gap-2 mt-3">
                  <input
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="Add member by email..."
                    className="flex-1 px-3 py-1.5 text-sm text-text-normal placeholder:text-text-muted/50"
                    onKeyDown={(e) => e.key === "Enter" && addMember()}
                  />
                  <button onClick={addMember} disabled={!addEmail.trim()} className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover disabled:bg-accent/50 text-white rounded transition-colors disabled:cursor-not-allowed">
                    Add
                  </button>
                </div>
                {memberError && <p className="text-danger text-sm mt-2">{memberError}</p>}
              </div>

              <div className="bg-bg-secondary rounded-lg border border-border p-8 text-center">
                <p className="text-text-muted">No meetings yet. Schedule your first meeting to get started.</p>
                <button disabled title="Coming soon" className="mt-4 px-4 py-2 bg-accent/50 text-white/50 rounded cursor-not-allowed">
                  Schedule meeting
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto mt-8 space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-text-normal">{activeOrg?.name}</h1>
                {activeOrg?.description && (
                  <p className="text-text-muted mt-1">{activeOrg.description}</p>
                )}
                <p className="text-text-muted text-sm mt-1">{teams.length} team{teams.length !== 1 ? "s" : ""}</p>
              </div>

              <div className="bg-bg-secondary rounded-lg border border-border p-4">
                <MemberList members={members} teamId={null} onRemove={removeMember} />
                <div className="flex gap-2 mt-3">
                  <input
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="Add member by email..."
                    className="flex-1 px-3 py-1.5 text-sm text-text-normal placeholder:text-text-muted/50"
                    onKeyDown={(e) => e.key === "Enter" && addMember()}
                  />
                  <button onClick={addMember} disabled={!addEmail.trim()} className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover disabled:bg-accent/50 text-white rounded transition-colors disabled:cursor-not-allowed">
                    Add
                  </button>
                </div>
                {memberError && <p className="text-danger text-sm mt-2">{memberError}</p>}
              </div>

              <div className="bg-bg-secondary rounded-lg border border-border p-4">
                <h3 className="text-text-normal font-medium">Teams</h3>
                {teams.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {teams.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setActiveTeamId(t.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-text-muted hover:bg-bg-hover hover:text-text-normal transition-colors"
                      >
                        <span>#</span> {t.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-muted text-sm mt-1">No teams yet.</p>
                )}
              </div>

              <div className="bg-bg-secondary rounded-lg border border-border p-4">
                <h3 className="text-text-normal font-medium">Quick actions</h3>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => { setError(""); setShowNewTeam(true); }}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded transition-colors"
                  >
                    New team
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {showNewOrg && (
        <FormModal
          title="Create organization"
          fields={[
            { key: "name", label: "Name", placeholder: "Organization name", value: "" },
            { key: "description", label: "Description", placeholder: "Description (optional)", value: "", multiline: true },
          ]}
          buttonLabel="Create"
          onSubmit={createOrg}
          onClose={() => setShowNewOrg(false)}
          error={error}
          creating={creating}
        />
      )}

      {showNewTeam && (
        <FormModal
          title="Create team"
          fields={[
            { key: "name", label: "Name", placeholder: "Team name", value: "" },
            { key: "description", label: "Description", placeholder: "Description (optional)", value: "", multiline: true },
          ]}
          buttonLabel="Create"
          onSubmit={createTeam}
          onClose={() => setShowNewTeam(false)}
          error={error}
          creating={creating}
        />
      )}

      {editingTeam && (
        <FormModal
          title="Edit team"
          fields={[
            { key: "name", label: "Name", placeholder: "Team name", value: editingTeam.name },
            { key: "description", label: "Description", placeholder: "Description (optional)", value: editingTeam.description ?? "", multiline: true },
          ]}
          buttonLabel="Save"
          onSubmit={updateTeam}
          onClose={() => setEditingTeam(null)}
          error={error}
          creating={creating}
        />
      )}

      {editingOrg && (
        <FormModal
          title="Edit organization"
          fields={[
            { key: "name", label: "Name", placeholder: "Organization name", value: editingOrg.name },
            { key: "description", label: "Description", placeholder: "Description (optional)", value: editingOrg.description ?? "", multiline: true },
          ]}
          buttonLabel="Save"
          onSubmit={updateOrg}
          onClose={() => setEditingOrg(null)}
          error={error}
          creating={creating}
        />
      )}
    </div>
  );
}
