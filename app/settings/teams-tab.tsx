"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { PermissionGrid } from "./permission-grid";
import type { Perm } from "./permission-grid";

type Team = {
  id: string;
  orgId: string;
  parentTeamId: string | null;
  name: string;
  description: string | null;
  createdAt: string;
};
type Role = { id: string; orgId: string; teamId: string | null; name: string; createdAt: string };
type Member = {
  id: string;
  userId: string;
  roleId: string | null;
  teamId: string | null;
  user: { id: string; email: string; name: string };
};

export default function TeamsTab({
  orgId,
  fetchJson,
  onError,
  can,
}: {
  orgId: string;
  fetchJson: (url: string, init?: RequestInit) => Promise<unknown>;
  onError: (e: string) => void;
  can: (key: string, teamId?: string | null) => boolean;
}) {
  // UI-only gates mirroring the API checks for this tab's actions.
  const canManageTeams = can("manage_teams");
  const [teams, setTeams] = useState<Team[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"overview" | "members" | "roles">("overview");

  // members (per selected team)
  const [members, setMembers] = useState<Member[]>([]);
  const [addEmail, setAddEmail] = useState("");
  const [addRoleId, setAddRoleId] = useState("");
  const [membersNote, setMembersNote] = useState<string | null>(null);

  // roles (per selected team scope)
  const [perms, setPerms] = useState<Perm[]>([]);
  const [orgRoles, setOrgRoles] = useState<Role[]>([]);
  const [teamRoles, setTeamRoles] = useState<Role[]>([]);
  const [rolePerms, setRolePerms] = useState<Record<string, string[]>>({});
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [rolesNote, setRolesNote] = useState<string | null>(null);

  // UI-only gates mirroring the API checks for this tab's actions.
  const team = selectedId ? teams.find((t) => t.id === selectedId) ?? null : null;
  const canManageTeamMembers = team ? can("manage_members", team.id) : false;
  const canEditTeamRoles =
    !!team && (can("manage_team_roles", team.id) || can("manage_roles"));

  // Node tree: children keyed by parent (null = org root)
  const childrenBy = useMemo(() => {
    const map = new Map<string | null, Team[]>();
    for (const t of teams) {
      const key = t.parentTeamId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [teams]);

  function depthOf(id: string): number {
    let d = 0;
    let cur = teams.find((x) => x.id === id);
    while (cur?.parentTeamId) {
      d++;
      cur = teams.find((x) => x.id === cur!.parentTeamId);
    }
    return d;
  }

  function subtreeIds(id: string): Set<string> {
    const set = new Set<string>();
    const stack = [...(childrenBy.get(id) ?? [])];
    while (stack.length) {
      const t = stack.pop()!;
      set.add(t.id);
      stack.push(...(childrenBy.get(t.id) ?? []));
    }
    return set;
  }

  // Load teams once; expand top level, select the first.
  useEffect(() => {
    (async () => {
      try {
        const data = (await fetchJson(`/api/organizations/${orgId}/teams`)) as Team[];
        setTeams(data);
        const roots = data.filter((t) => !t.parentTeamId).map((t) => t.id);
        setExpanded(new Set(roots));
        setSelectedId((prev) => prev ?? data[0]?.id ?? null);
      } catch (e) {
        onError((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // Selection loads the panel data for that team.
  useEffect(() => {
    if (selectedId) void load(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function selectTeam(id: string | null) {
    setSelectedId(id);
    setSubTab("overview");
    setSelectedRoleId(null);
  }

  async function load(teamId: string) {
    // Members
    try {
      const data = (await fetchJson(`/api/organizations/${orgId}/members?teamId=${teamId}`)) as Member[];
      setMembers(data);
      setMembersNote(null);
    } catch (e) {
      setMembers([]);
      setMembersNote((e as Error).message);
    }
    // Roles for this scope: org-wide roles + this team's roles
    const denied: string[] = [];
    try {
      const org = (await fetchJson(`/api/organizations/${orgId}/roles`)) as Role[];
      setOrgRoles(org);
    } catch {
      denied.push("organization roles");
    }
    try {
      const tr = (await fetchJson(`/api/teams/${teamId}/roles`)) as Role[];
      setTeamRoles(tr);
    } catch {
      denied.push("team roles");
    }
    setRolesNote(
      denied.length > 0
        ? `Couldn't load ${denied.join(" and ")} — you may not have manage_roles permission.`
        : null,
    );
  }

  async function loadPerms() {
    if (perms.length > 0) return perms;
    const data = (await fetchJson("/api/permissions")) as Perm[];
    setPerms(data);
    return data;
  }

  // ── tree ops ────────────────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createTeam(name: string, parentTeamId: string | null) {
    try {
      const t = (await fetchJson(`/api/organizations/${orgId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentTeamId }),
      })) as Team;
      setTeams((prev) => [...prev, t]);
      if (parentTeamId) setExpanded((prev) => new Set(prev).add(parentTeamId));
      selectTeam(t.id);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  function addRootTeam() {
    const name = window.prompt("Team name");
    if (name?.trim()) void createTeam(name.trim(), null);
  }

  function addSubTeam(parentId: string) {
    const name = window.prompt("Sub-team name");
    if (name?.trim()) void createTeam(name.trim(), parentId);
  }

  async function deleteTeam(t: Team) {
    const subs = subtreeIds(t.id).size;
    const msg =
      subs > 0
        ? `Delete "${t.name}" and its ${subs} sub-team${subs === 1 ? "" : "s"}? This cannot be undone.`
        : `Delete team "${t.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await fetchJson(`/api/organizations/${orgId}/teams?teamId=${t.id}`, { method: "DELETE" });
      const remaining = teams.filter((x) => x.id !== t.id && !subtreeIds(t.id).has(x.id));
      setTeams(remaining);
      if (selectedId === t.id || subtreeIds(t.id).has(selectedId ?? "")) {
        selectTeam(remaining[0]?.id ?? null);
      }
    } catch (e) {
      onError((e as Error).message);
    }
  }

  // ── overview ────────────────────────────────────────────────────────────

  async function saveOverview(t: Team, values: { name: string; description: string; parentTeamId: string | null }) {
    if (!values.name.trim()) return;
    try {
      const body: Record<string, unknown> = {
        teamId: t.id,
        name: values.name.trim(),
        description: values.description.trim() || null,
      };
      // Always send parent so an un-modified select (default "no parent") is a no-op move.
      if (values.parentTeamId !== t.parentTeamId) body.parentTeamId = values.parentTeamId;
      const updated = (await fetchJson(`/api/organizations/${orgId}/teams`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })) as Team;
      setTeams((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      onError("");
    } catch (e) {
      onError((e as Error).message);
    }
  }

  // ── members ─────────────────────────────────────────────────────────────

  async function addTeamMember() {
    if (!team || !addEmail.trim()) return;
    try {
      await fetchJson(`/api/organizations/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail.trim(), teamId: team.id, roleId: addRoleId || null }),
      });
      setAddEmail("");
      setAddRoleId("");
      await load(team.id);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  async function assignMemberRole(userId: string, roleId: string | null) {
    if (!team) return;
    try {
      await fetchJson(`/api/organizations/${orgId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, teamId: team.id, roleId }),
      });
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, roleId } : m)));
    } catch (e) {
      onError((e as Error).message);
    }
  }

  async function removeTeamMember(userId: string) {
    if (!team || !window.confirm("Remove this member from the team?")) return;
    try {
      await fetchJson(`/api/organizations/${orgId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, teamId: team.id }),
      });
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (e) {
      onError((e as Error).message);
    }
  }

  // ── team roles ──────────────────────────────────────────────────────────

  async function selectRole(roleId: string) {
    setSelectedRoleId(roleId);
    try {
      const data = (await fetchJson(`/api/organizations/${orgId}/roles/${roleId}/permissions`)) as Perm[];
      setRolePerms((prev) => ({ ...prev, [roleId]: data.map((p) => p.id) }));
    } catch (e) {
      onError((e as Error).message);
    }
    void loadPerms();
  }

  async function createTeamRole() {
    if (!team || !newRoleName.trim()) return;
    try {
      const r = (await fetchJson(`/api/teams/${team.id}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoleName.trim() }),
      })) as Role;
      setTeamRoles((prev) => [...prev, r]);
      setNewRoleName("");
      setRolePerms((prev) => ({ ...prev, [r.id]: [] }));
      setSelectedRoleId(r.id);
      void loadPerms();
    } catch (e) {
      onError((e as Error).message);
    }
  }

  async function renameTeamRole(roleId: string) {
    if (!team) return;
    const name = window.prompt("Rename role");
    if (!name?.trim()) return;
    try {
      await fetchJson(`/api/teams/${team.id}/roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId, name: name.trim() }),
      });
      setTeamRoles((prev) => prev.map((r) => (r.id === roleId ? { ...r, name: name.trim() } : r)));
    } catch (e) {
      onError((e as Error).message);
    }
  }

  async function deleteTeamRole(roleId: string) {
    if (!team || !window.confirm("Delete this team role?")) return;
    try {
      await fetchJson(`/api/teams/${team.id}/roles`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      setTeamRoles((prev) => prev.filter((r) => r.id !== roleId));
      if (selectedRoleId === roleId) setSelectedRoleId(null);
    } catch (e) {
      onError((e as Error).message);
    }
  }

  async function togglePermission(roleId: string, permId: string, on: boolean) {
    try {
      await fetchJson(`/api/organizations/${orgId}/roles/${roleId}/permissions`, {
        method: on ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId: permId }),
      });
      setRolePerms((prev) => {
        const cur = prev[roleId] ?? [];
        return { ...prev, [roleId]: on ? [...cur, permId] : cur.filter((id) => id !== permId) };
      });
    } catch (e) {
      onError((e as Error).message);
    }
  }

  const assignableRoles = [...orgRoles, ...teamRoles];
  const selectedRole = [...teamRoles].find((r) => r.id === selectedRoleId) ?? null;

  const inputClass =
    "bg-bg-input border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none";

  function renderNode(t: Team, depth: number): ReactNode {
    const kids = childrenBy.get(t.id) ?? [];
    const isOpen = expanded.has(t.id);
    const isSel = selectedId === t.id;
    return (
      <Fragment key={t.id}>
        <div
          className={`group flex items-center gap-1 rounded-lg pr-1 transition-colors ${
            isSel ? "bg-accent/15" : "hover:bg-surface/60"
          }`}
          style={{ paddingLeft: 6 + depth * 16 }}
        >
          {kids.length > 0 ? (
            <button
              onClick={() => toggleExpand(t.id)}
              className="w-5 shrink-0 py-2 text-[10px] text-text-muted hover:text-text-normal"
            >
              {isOpen ? "▾" : "▸"}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}
          <button
            onClick={() => {
              selectTeam(t.id);
              setMenuFor(null);
            }}
            className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
          >
            <svg className="w-3.5 h-3.5 shrink-0 text-accent" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3l1.2 1.6H13a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 13 12.6H3A1.5 1.5 0 0 1 1.5 11V3.5Z" />
            </svg>
            <span className={`truncate text-sm ${isSel ? "text-accent font-medium" : "text-text-normal"}`}>
              {t.name}
            </span>
          </button>
          {kids.length > 0 && (
            <span className="shrink-0 text-[10px] text-text-muted/60">{kids.length}</span>
          )}
          <div className="relative shrink-0">
            {canManageTeams && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor(menuFor === t.id ? null : t.id);
                  }}
                  className="px-1.5 py-2 text-sm text-text-muted opacity-0 transition-opacity hover:text-text-normal group-hover:opacity-100"
                  title="Team actions"
                >
                  ⋯
                </button>
                {menuFor === t.id && (
                  <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-lg border border-border/50 bg-bg-primary py-1 shadow-xl animate-pop-in">
                    <button
                      className="block w-full px-3 py-1.5 text-left text-sm text-text-normal hover:bg-surface/60"
                      onClick={() => {
                        addSubTeam(t.id);
                        setMenuFor(null);
                      }}
                    >
                      New sub-team
                    </button>
                    <button
                      className="block w-full px-3 py-1.5 text-left text-sm text-text-normal hover:bg-surface/60"
                      onClick={() => {
                        selectTeam(t.id);
                        setMenuFor(null);
                      }}
                    >
                      Rename / move
                    </button>
                    <button
                      className="block w-full px-3 py-1.5 text-left text-sm text-danger hover:bg-danger/10"
                      onClick={() => {
                        deleteTeam(t);
                        setMenuFor(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {isOpen && kids.map((k) => renderNode(k, depth + 1))}
      </Fragment>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="max-w-3xl flex flex-col gap-5">
        <div className="animate-fade-up flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Teams</h1>
          </div>
          {canManageTeams && (
            <button onClick={addRootTeam} className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold text-white">
              New team
            </button>
          )}
        </div>
        <div className="text-sm text-text-muted">No teams yet. Create the first one to start organizing members.</div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 items-start h-[calc(100%-2rem)]">
      {/* ── team tree ─────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 rounded-2xl border border-border/40 bg-surface/40 p-3 animate-fade-up">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Teams</span>
          {canManageTeams && (
            <button onClick={addRootTeam} className="text-accent hover:text-accent-hover text-sm" title="New team">
              +
            </button>
          )}
        </div>
        <div className="flex flex-col">
          <div
            className={`group flex items-center gap-2 rounded-lg px-2 py-2 ${selectedId === null ? "bg-accent/15" : "hover:bg-surface/60"}`}
          >
            <button
              onClick={() => selectTeam(null)}
              className="flex min-w-0 flex-1 items-center gap-2 py-0.5"
            >
              <svg className="w-3.5 h-3.5 shrink-0 text-text-muted" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="8" r="6.5" opacity="0.9" />
              </svg>
              <span className="truncate text-sm text-text-muted">Organization</span>
            </button>
          </div>
          {childrenBy.get(null)?.map((t) => renderNode(t, 0))}
        </div>
      </div>

      {/* ── detail panel ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 animate-fade-up" style={{ animationDelay: "40ms" }}>
        {!team ? (
          <div className="text-sm text-text-muted">
            Select a team to manage its members and roles.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* header */}
            <div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6b76ff] to-[#3d49e8] flex items-center justify-center text-white text-sm shadow-[0_2px_8px_-2px_rgba(88,101,242,0.6)]">
                  #
                </span>
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold truncate">{team.name}</h1>
                  <p className="text-xs text-text-muted truncate">
                    {team.parentTeamId
                      ? `${teams.find((p) => p.id === team.parentTeamId)?.name ?? "Sub-team"} · sub-team`
                      : "Top-level team"}
                  </p>
                </div>
              </div>
            </div>

            {/* internal tabs */}
            <div className="flex gap-1 border-b border-border/50">
              {(["overview", "members", "roles"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSubTab(t)}
                  className={`relative px-3 py-2 text-sm transition-colors ${
                    subTab === t ? "text-text-normal font-medium" : "text-text-muted hover:text-text-normal"
                  }`}
                >
                  {t === "overview" ? "Overview" : t === "members" ? "Members" : "Roles"}
                  {t === "members" && members.length > 0 && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent">
                      {members.length}
                    </span>
                  )}
                  {subTab === t && (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-[#6b76ff] to-[#3d49e8]" />
                  )}
                </button>
              ))}
            </div>

            {subTab === "overview" && (
              <OverviewForm
                key={team.id}
                team={team}
                teams={teams}
                depthOf={depthOf}
                subtreeIds={subtreeIds}
                canEdit={canManageTeams}
                onSave={saveOverview}
                onDelete={deleteTeam}
              />
            )}

            {subTab === "members" && (
              <div className="max-w-xl flex flex-col gap-4">
                {membersNote && (
                  <div className="px-3 py-2 rounded-lg bg-warning/10 border border-warning/25 text-xs text-warning">{membersNote}</div>
                )}
                {canManageTeamMembers && (
                  <div className="flex gap-2">
                    <input
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      placeholder="member@example.com"
                      className={`flex-1 ${inputClass}`}
                      onKeyDown={(e) => e.key === "Enter" && addTeamMember()}
                    />
                    <select
                      value={addRoleId}
                      onChange={(e) => setAddRoleId(e.target.value)}
                      className={`${inputClass} cursor-pointer`}
                    >
                      <option value="">No role</option>
                      {assignableRoles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <button onClick={addTeamMember} className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold text-white shrink-0">
                      Add
                    </button>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-xl border border-border/40 bg-surface/50 px-4 py-3"
                    >
                      <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-accent/40 to-success/25 flex items-center justify-center text-accent text-sm font-semibold">
                        {(m.user.name || m.user.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{m.user.name || m.user.email}</div>
                        <div className="text-xs text-text-muted truncate">{m.user.email}</div>
                      </div>
                      {canManageTeamMembers && (
                        <select
                          value={m.roleId ?? ""}
                          onChange={(e) => assignMemberRole(m.userId, e.target.value || null)}
                          className={`${inputClass} cursor-pointer`}
                        >
                          <option value="">No role</option>
                          {assignableRoles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      )}
                      {canManageTeamMembers && (
                        <button
                          onClick={() => removeTeamMember(m.userId)}
                          className="px-1 text-text-muted hover:text-danger text-sm"
                          title="Remove from team"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {members.length === 0 && !membersNote && (
                    <div className="text-sm text-text-muted">No members in this team yet.</div>
                  )}
                </div>
              </div>
            )}

            {subTab === "roles" && (
              <div className="flex gap-8 items-start">
                <div className="w-64 shrink-0">
                  <div className="flex flex-col gap-1">
                    {rolesNote && (
                      <div className="mb-1 px-3 py-2 rounded-lg bg-warning/10 border border-warning/25 text-xs text-warning">{rolesNote}</div>
                    )}
                    {teamRoles.map((r) => (
                      <div
                        key={r.id}
                        className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors ${
                          selectedRoleId === r.id ? "bg-gradient-to-r from-surface to-surface/60 shadow-sm" : "hover:bg-surface/50"
                        }`}
                      >
                        <button onClick={() => selectRole(r.id)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                          <span className="w-6 h-6 shrink-0 rounded-md bg-gradient-to-br from-accent/30 to-success/15 flex items-center justify-center text-[10px] font-bold text-accent">
                            {r.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate">{r.name}</span>
                        </button>
                        {canEditTeamRoles && (
                          <span className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => renameTeamRole(r.id)} className="text-text-muted hover:text-text-normal text-xs" title="Rename">✎</button>
                            <button onClick={() => deleteTeamRole(r.id)} className="text-text-muted hover:text-danger text-xs" title="Delete">✕</button>
                          </span>
                        )}
                      </div>
                    ))}
                    {teamRoles.length === 0 && !rolesNote && (
                      <div className="text-sm text-text-muted">No team roles yet.</div>
                    )}
                  </div>
                  {canEditTeamRoles && (
                    <div className="mt-3 flex gap-2">
                      <input
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        placeholder="New team role"
                        onKeyDown={(e) => e.key === "Enter" && createTeamRole()}
                        className={`flex-1 ${inputClass}`}
                      />
                      <button onClick={createTeamRole} className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold text-white">
                        Add
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {selectedRole ? (
                    <>
                      <h1 className="text-xl font-semibold mb-4 animate-fade-up">
                        <span className="flex items-center gap-2">
                          {selectedRole.name}
                          <span className="text-sm font-normal text-text-muted">permissions (team scope)</span>
                        </span>
                      </h1>
                      {perms.length > 0 ? (
                        <PermissionGrid
                          perms={perms}
                          selected={rolePerms[selectedRole.id] ?? []}
                          readOnly={!canEditTeamRoles}
                          onToggle={(permId, on) => togglePermission(selectedRole.id, permId, on)}
                        />
                      ) : (
                        <div className="text-sm text-text-muted">Loading permissions…</div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-text-muted">Select a team role to edit its permissions.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewForm({
  team,
  teams,
  depthOf,
  subtreeIds,
  canEdit,
  onSave,
  onDelete,
}: {
  team: Team;
  teams: Team[];
  depthOf: (id: string) => number;
  subtreeIds: (id: string) => Set<string>;
  canEdit: boolean;
  onSave: (t: Team, values: { name: string; description: string; parentTeamId: string | null }) => void;
  onDelete: (t: Team) => void;
}) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [parentId, setParentId] = useState(team.parentTeamId ?? "");

  const inputClass =
    "bg-bg-input border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none";

  return (
    <div className="max-w-md flex flex-col gap-4">
      <div>
        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Name</label>
        <input value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} className={`w-full ${inputClass} disabled:opacity-60`} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Description</label>
        <textarea
          value={description}
          disabled={!canEdit}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={`w-full ${inputClass} resize-y disabled:opacity-60`}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Parent team</label>
        <select value={parentId} disabled={!canEdit} onChange={(e) => setParentId(e.target.value)} className={`w-full ${inputClass} cursor-pointer disabled:opacity-60`}>
          <option value="">None — top-level team</option>
          {teams
            .filter((t) => t.id !== team.id && !subtreeIds(team.id).has(t.id))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {"  ".repeat(depthOf(t.id))}
                {t.name}
              </option>
            ))}
        </select>
        <p className="mt-1 text-[11px] text-text-muted">Moving a team keeps its sub-teams.</p>
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <button
            onClick={() => onSave(team, { name, description, parentTeamId: parentId || null })}
            className="btn-primary px-5 py-2 rounded-lg text-sm font-semibold text-white self-start"
          >
            Save
          </button>
          <button
            onClick={() => onDelete(team)}
            className="px-4 py-2 rounded-lg border border-danger/30 text-sm text-danger hover:bg-danger/10 self-start transition-colors"
          >
            Delete team
          </button>
        </div>
      )}
    </div>
  );
}