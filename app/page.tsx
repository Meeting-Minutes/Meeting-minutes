"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Org = { id: string; name: string; description?: string | null; slug: string };
type Team = { id: string; name: string; description?: string | null };
type User = { id: string; email: string; name: string };
type Member = { id: string; userId: string; teamId: string | null; createdAt: string; user: User };

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function FormModal({
  title, fields, buttonLabel, onSubmit, onClose, error, creating,
}: {
  title: string;
  fields: { key: string; label: string; placeholder: string; value: string; multiline?: boolean }[];
  buttonLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
  error: string;
  creating: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.value])),
  );

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-bg-primary rounded-xl p-6 w-[400px] shadow-2xl border border-border/50">
        <h2 className="text-[17px] font-semibold text-text-normal mb-5">{title}</h2>
        {fields.map((f) =>
          f.multiline ? (
            <textarea
              key={f.key}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              rows={3}
              className="w-full px-3.5 py-2.5 text-sm mb-4 resize-none"
              disabled={creating}
            />
          ) : (
            <input
              key={f.key}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full px-3.5 py-2.5 text-sm mb-4"
              onKeyDown={(e) => e.key === "Enter" && !creating && onSubmit(values)}
              autoFocus
              disabled={creating}
            />
          ),
        )}
        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 text-sm text-text-muted hover:text-text-normal transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(values)}
            disabled={creating || !values[fields[0].key]?.trim()}
            className="px-5 py-2 text-sm font-medium bg-accent hover:bg-accent-hover disabled:bg-accent/50 text-white rounded-lg transition-all disabled:cursor-not-allowed"
          >
            {creating ? "Saving\u2026" : buttonLabel}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function MemberRow({ member, onRemove }: { member: Member; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-hover/50 transition-colors group">
      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-semibold shrink-0">
        {member.user.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-normal truncate">{member.user.name}</p>
        <p className="text-xs text-text-muted truncate">{member.user.email}</p>
      </div>
      <button
        onClick={onRemove}
        className="text-xs text-text-muted hover:text-danger transition-colors opacity-0 group-hover:opacity-100 px-1.5 py-1"
        title="Remove"
      >
        Remove
      </button>
    </div>
  );
}

function MembersSection({
  members, teamId, addEmail, onAddEmailChange, onAdd, onRemove, error,
}: {
  members: Member[];
  teamId: string | null;
  addEmail: string;
  onAddEmailChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (userId: string, teamId: string | null) => void;
  error: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border/50 p-4">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Members &mdash; {members.length}
      </h3>
      <div className="space-y-0.5">
        {members.map((m) => (
          <MemberRow key={m.id} member={m} onRemove={() => onRemove(m.userId, teamId)} />
        ))}
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
        <input
          value={addEmail}
          onChange={(e) => onAddEmailChange(e.target.value)}
          placeholder="Add by email\u2026"
          className="flex-1 px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
        <button
          onClick={onAdd}
          disabled={!addEmail.trim()}
          className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover disabled:bg-accent/50 text-white rounded-lg transition-all disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
      {error && <p className="text-danger text-xs mt-2">{error}</p>}
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
    setError(""); setCreating(true);
    const res = await fetch("/api/organizations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: values.name, description: values.description || null }),
    });
    setCreating(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to create organization"); return;
    }
    const org = await res.json();
    setOrgs((prev) => [...prev, org]);
    setActiveOrgId(org.id);
    setShowNewOrg(false);
  }

  async function updateOrg(values: Record<string, string>) {
    if (!editingOrg) return;
    setError(""); setCreating(true);
    const res = await fetch(`/api/organizations/${editingOrg.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: values.name, description: values.description || null }),
    });
    setCreating(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to update organization"); return;
    }
    const updated = await res.json();
    setOrgs((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setEditingOrg(null);
  }

  async function createTeam(values: Record<string, string>) {
    if (!activeOrgId) return;
    setError(""); setCreating(true);
    const res = await fetch(`/api/organizations/${activeOrgId}/teams`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: values.name, description: values.description || null }),
    });
    setCreating(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to create team"); return;
    }
    const team = await res.json();
    setTeams((prev) => [...prev, team]);
    setActiveTeamId(team.id);
    setShowNewTeam(false);
  }

  async function updateTeam(values: Record<string, string>) {
    if (!editingTeam || !activeOrgId) return;
    setError(""); setCreating(true);
    const res = await fetch(`/api/organizations/${activeOrgId}/teams`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: editingTeam.id, name: values.name, description: values.description || null }),
    });
    setCreating(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to update team"); return;
    }
    const updated = await res.json();
    setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditingTeam(null);
  }

  async function addMember() {
    if (!activeOrgId || !addEmail.trim()) return;
    setMemberError("");
    const res = await fetch(`/api/organizations/${activeOrgId}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: addEmail.trim(), teamId: activeTeamId || null }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMemberError(d.error || "Failed to add member"); return;
    }
    setAddEmail("");
    fetchMembers(activeOrgId, activeTeamId ?? undefined);
  }

  async function removeMember(userId: string, teamId: string | null) {
    if (!activeOrgId) return;
    const res = await fetch(`/api/organizations/${activeOrgId}/members`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, teamId }),
    });
    if (res.ok) fetchMembers(activeOrgId, activeTeamId ?? undefined);
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
      <nav className="w-[72px] bg-bg-tertiary flex flex-col items-center gap-1.5 py-3 shrink-0">
        {orgs.map((org) => (
          <button
            key={org.id}
            onClick={() => setActiveOrgId(org.id)}
            title={org.name}
            className={`w-12 h-12 rounded-2xl transition-all duration-150 flex items-center justify-center font-bold text-lg ${
              activeOrgId === org.id
                ? "bg-accent text-white rounded-xl"
                : "bg-bg-secondary text-text-muted hover:bg-accent hover:text-white hover:rounded-xl"
            }`}
          >
            {org.name[0].toUpperCase()}
          </button>
        ))}
        {orgs.length > 0 && <div className="w-8 h-px bg-border/50 my-1" />}
        <button
          onClick={() => { setError(""); setShowNewOrg(true); }}
          title="New organization"
          className="w-12 h-12 rounded-2xl hover:rounded-xl hover:bg-success transition-all duration-150 flex items-center justify-center text-text-muted hover:text-white text-2xl font-light border-2 border-dashed border-border hover:border-success"
        >
          +
        </button>
      </nav>

      {/* Channel sidebar */}
      <aside className="w-60 bg-bg-secondary flex flex-col shrink-0">
        <div className="h-[49px] flex items-center px-4 border-b border-border/50 shrink-0">
          <h2 className="text-[15px] font-semibold text-text-normal truncate">
            {activeOrg?.name || "Minutes"}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {activeOrgId && (
            <>
              <div className="flex items-center px-2 mb-1">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">
                  Teams
                </span>
              </div>
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTeamId(t.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 ${
                    activeTeamId === t.id
                      ? "bg-surface text-text-normal"
                      : "text-text-muted hover:bg-surface/50 hover:text-text-normal"
                  }`}
                >
                  <span className="text-lg leading-none text-text-muted/60 shrink-0">#</span>
                  <span className="truncate text-left">{t.name}</span>
                </button>
              ))}
              <button
                onClick={() => { setError(""); setShowNewTeam(true); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-text-muted hover:bg-surface/50 hover:text-text-normal transition-all duration-150 mt-0.5"
              >
                <span className="text-lg leading-none text-text-muted/60 shrink-0">+</span>
                Add team
              </button>
            </>
          )}
          {!activeOrgId && (
            <p className="text-sm text-text-muted px-2 mt-2">
              {user ? "Create an organization to get started." : "Sign in to get started."}
            </p>
          )}
        </div>
        {user && (
          <div className="h-[53px] shrink-0 bg-bg-tertiary/30 px-3 flex items-center gap-2.5 border-t border-border/50">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-semibold shrink-0">
              {user.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-normal truncate leading-tight">{user.name}</p>
              <p className="text-[11px] text-text-muted truncate leading-tight">{user.email}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="text-text-muted hover:text-text-normal transition-colors text-lg leading-none px-1"
            >
              ⏻
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="frost h-[49px] border-b border-border/50 flex items-center px-5 shrink-0 sticky top-0 z-10">
          {activeTeam ? (
            <>
              <span className="text-text-muted mr-1.5 text-lg font-semibold">#</span>
              <span className="font-semibold text-[15px] text-text-normal">{activeTeam.name}</span>
              <button
                onClick={() => { setError(""); setEditingTeam(activeTeam); }}
                className="ml-auto text-xs text-text-muted hover:text-text-normal transition-colors px-2 py-1 rounded-md hover:bg-surface/50"
              >
                Edit
              </button>
            </>
          ) : activeOrg ? (
            <>
              <span className="text-text-muted mr-1.5 text-lg font-semibold">#</span>
              <span className="font-semibold text-[15px] text-text-normal">{activeOrg.name}</span>
              <button
                onClick={() => { setError(""); setEditingOrg(activeOrg); }}
                className="ml-auto text-xs text-text-muted hover:text-text-normal transition-colors px-2 py-1 rounded-md hover:bg-surface/50"
              >
                Edit
              </button>
            </>
          ) : (
            <span className="text-sm text-text-muted">No organization selected</span>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {!user ? (
            <div className="max-w-md mx-auto mt-[15vh] text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
                <span className="text-accent text-xl font-bold">M</span>
              </div>
              <h1 className="text-2xl font-bold text-text-normal">Minutes</h1>
              <p className="text-sm text-text-muted mt-2 leading-relaxed">
                Meeting minutes management for your organization.
              </p>
            </div>
          ) : !activeOrgId ? (
            <div className="max-w-md mx-auto mt-[15vh] text-center px-4">
              <h1 className="text-2xl font-bold text-text-normal">Welcome, {user.name}</h1>
              <p className="text-sm text-text-muted mt-2 leading-relaxed">
                Create an organization to start managing meetings and minutes.
              </p>
              <button
                onClick={() => { setError(""); setShowNewOrg(true); }}
                className="mt-6 px-6 py-2.5 text-sm font-medium bg-accent hover:bg-accent-hover text-white rounded-lg transition-all"
              >
                Create organization
              </button>
            </div>
          ) : activeTeam ? (
            <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
              <div>
                <h1 className="text-xl font-bold text-text-normal"># {activeTeam.name}</h1>
                {activeTeam.description && (
                  <p className="text-sm text-text-muted mt-1 leading-relaxed">{activeTeam.description}</p>
                )}
                <p className="text-xs text-text-muted mt-1">Team under {activeOrg?.name}</p>
              </div>

              <MembersSection
                members={members}
                teamId={activeTeam.id}
                addEmail={addEmail}
                onAddEmailChange={setAddEmail}
                onAdd={addMember}
                onRemove={removeMember}
                error={memberError}
              />

              <div className="bg-surface rounded-xl border border-border/50 p-8 text-center">
                <p className="text-sm text-text-muted">No meetings yet.</p>
                <button
                  disabled
                  title="Coming soon"
                  className="mt-4 px-5 py-2 text-sm font-medium bg-accent/40 text-white/40 rounded-lg cursor-not-allowed"
                >
                  Schedule meeting
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
              <div>
                <h1 className="text-xl font-bold text-text-normal">{activeOrg?.name}</h1>
                {activeOrg?.description && (
                  <p className="text-sm text-text-muted mt-1 leading-relaxed">{activeOrg.description}</p>
                )}
                <p className="text-xs text-text-muted mt-1">
                  {teams.length} team{teams.length !== 1 ? "s" : ""}
                </p>
              </div>

              <MembersSection
                members={members}
                teamId={null}
                addEmail={addEmail}
                onAddEmailChange={setAddEmail}
                onAdd={addMember}
                onRemove={removeMember}
                error={memberError}
              />

              <div className="bg-surface rounded-xl border border-border/50 p-5">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Teams</h3>
                {teams.length > 0 ? (
                  <div className="mt-3 space-y-0.5">
                    {teams.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setActiveTeamId(t.id)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-text-muted hover:bg-surface-hover/50 hover:text-text-normal transition-colors"
                      >
                        <span className="text-lg leading-none text-text-muted/60">#</span>
                        {t.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted mt-2">No teams yet.</p>
                )}
                <button
                  onClick={() => { setError(""); setShowNewTeam(true); }}
                  className="mt-3 text-sm text-accent hover:text-accent-hover transition-colors"
                >
                  + New team
                </button>
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
