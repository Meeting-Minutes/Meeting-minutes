"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Org = { id: string; name: string };
type Team = { id: string; name: string };
type User = { id: string; email: string; name: string };

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

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
    if (!activeOrgId) return;
    fetch(`/api/organizations/${activeOrgId}/teams`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setTeams);
  }, [activeOrgId]);

  async function createOrg(name: string) {
    setError("");
    setCreating(true);
    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
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

  async function createTeam(name: string) {
    if (!activeOrgId) return;
    setError("");
    setCreating(true);
    const res = await fetch(`/api/organizations/${activeOrgId}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
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
          onClick={() => {
            setError("");
            setShowNewOrg(true);
          }}
          title="New organization"
          className="w-12 h-12 rounded-2xl hover:rounded-xl hover:bg-success transition-all flex items-center justify-center text-text-muted hover:text-white text-2xl font-light border-2 border-dashed border-border hover:border-success"
        >
          +
        </button>
      </nav>

      {/* Channel sidebar */}
      <aside className="w-60 bg-bg-secondary flex flex-col shrink-0">
        <div className="h-12 flex items-center px-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-text-normal truncate">
            {activeOrg?.name || "Minutes"}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {activeOrgId && (
            <div>
              <div className="flex items-center px-2 py-1 mt-2 mb-0.5">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                  Teams
                </span>
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
                  <span className="text-text-muted w-4 text-center text-lg leading-none shrink-0">
                    #
                  </span>
                  <span className="truncate text-left">{t.name}</span>
                </button>
              ))}
              <button
                onClick={() => {
                  setError("");
                  setShowNewTeam(true);
                }}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-text-muted hover:bg-bg-hover hover:text-text-normal transition-colors mt-0.5"
              >
                <span className="text-lg leading-none mr-0.5">+</span>
                Add team
              </button>
            </div>
          )}
          {!activeOrgId && (
            <p className="text-text-muted text-sm px-2 mt-4">
              {user
                ? "Create an organization to get started."
                : "Sign in to get started."}
            </p>
          )}
        </div>

        {user && (
          <div className="h-14 shrink-0 bg-bg-tertiary/50 px-2 flex items-center gap-2 border-t border-border">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-normal truncate">
                {user.name}
              </p>
              <p className="text-xs text-text-muted truncate">{user.email}</p>
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
        <div className="h-12 border-b border-border flex items-center px-4 shrink-0 bg-bg-primary">
          {activeTeam ? (
            <>
              <span className="text-text-muted mr-2 font-semibold">#</span>
              <span className="font-semibold text-text-normal">
                {activeTeam.name}
              </span>
            </>
          ) : activeOrg ? (
            <>
              <span className="text-text-muted mr-2 font-semibold">#</span>
              <span className="font-semibold text-text-normal">
                {activeOrg.name}
              </span>
            </>
          ) : (
            <span className="text-text-muted text-sm">
              No organization selected
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!user ? (
            <div className="max-w-md mx-auto mt-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                M
              </div>
              <h1 className="text-2xl font-bold text-text-normal">
                Minutes
              </h1>
              <p className="text-text-muted mt-2">
                Meeting minutes management for your organization.
              </p>
            </div>
          ) : !activeOrgId ? (
            <div className="max-w-md mx-auto mt-24 text-center">
              <h1 className="text-2xl font-bold text-text-normal">
                Welcome, {user.name}
              </h1>
              <p className="text-text-muted mt-2">
                Create an organization to start managing meetings and minutes.
              </p>
              <button
                onClick={() => {
                  setError("");
                  setShowNewOrg(true);
                }}
                className="mt-6 px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded transition-colors"
              >
                Create organization
              </button>
            </div>
          ) : activeTeam ? (
            <div className="max-w-3xl mx-auto mt-8">
              <h1 className="text-2xl font-bold text-text-normal">
                # {activeTeam.name}
              </h1>
              <p className="text-text-muted mt-1">
                Team under {activeOrg?.name}
              </p>
              <div className="bg-bg-secondary rounded-lg border border-border p-8 mt-8 text-center">
                <p className="text-text-muted">
                  No meetings yet. Schedule your first meeting to get started.
                </p>
                <button
                  disabled
                  title="Coming soon"
                  className="mt-4 px-4 py-2 bg-accent/50 text-white/50 rounded cursor-not-allowed"
                >
                  Schedule meeting
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto mt-8">
              <h1 className="text-2xl font-bold text-text-normal">
                {activeOrg?.name}
              </h1>
              <p className="text-text-muted mt-1">
                {teams.length} team{teams.length !== 1 ? "s" : ""}
              </p>
              <div className="grid gap-3 mt-8">
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
                    <p className="text-text-muted text-sm mt-1">
                      No teams yet.
                    </p>
                  )}
                  <button
                    onClick={() => {
                      setError("");
                      setShowNewTeam(true);
                    }}
                    className="mt-3 text-sm text-accent hover:underline"
                  >
                    + Add team
                  </button>
                </div>

                <div className="bg-bg-secondary rounded-lg border border-border p-4">
                  <h3 className="text-text-normal font-medium">
                    Quick actions
                  </h3>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        setError("");
                        setShowNewTeam(true);
                      }}
                      className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded transition-colors"
                    >
                      New team
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* New org modal */}
      {showNewOrg && (
        <OrgModal
          title="Create organization"
          placeholder="Organization name"
          buttonLabel="Create"
          onSubmit={createOrg}
          onClose={() => setShowNewOrg(false)}
          error={error}
          creating={creating}
        />
      )}

      {/* New team modal */}
      {showNewTeam && (
        <OrgModal
          title="Create team"
          placeholder="Team name"
          buttonLabel="Create"
          onSubmit={createTeam}
          onClose={() => setShowNewTeam(false)}
          error={error}
          creating={creating}
        />
      )}
    </div>
  );
}

function OrgModal({
  title,
  placeholder,
  buttonLabel,
  onSubmit,
  onClose,
  error,
  creating,
}: {
  title: string;
  placeholder: string;
  buttonLabel: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
  error: string;
  creating: boolean;
}) {
  const [name, setName] = useState("");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-bg-primary rounded-lg p-6 w-96 shadow-2xl">
        <h2 className="text-lg font-semibold text-text-normal mb-4">{title}</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-text-normal placeholder:text-text-muted/50 mb-4"
          onKeyDown={(e) => e.key === "Enter" && !creating && onSubmit(name)}
          autoFocus
          disabled={creating}
        />
        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 text-text-muted hover:text-text-normal transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(name)}
            disabled={creating || !name.trim()}
            className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-accent/50 text-white rounded transition-colors disabled:cursor-not-allowed"
          >
            {creating ? "Creating..." : buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
