"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "./theme-toggle";
import DualDateInput from "./dual-date-input";
import { useMyPermissions } from "./use-my-permissions";

type Org = { id: string; name: string; description?: string | null; slug: string };
type Team = { id: string; name: string; description?: string | null };
type User = { id: string; email: string; name: string; title?: string | null; post?: string | null };
type Member = { id: string; userId: string; teamId: string | null; createdAt: string; user: User };
type Meeting = {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  location: string | null;
  orgName?: string | null;
  status?: string | null;
};
type Feed = { upcoming: Meeting[]; recent: Meeting[] };

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
      <div className="animate-pop-in bg-bg-primary rounded-xl p-6 w-100 shadow-2xl border border-border/50">
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
            className="btn-primary px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {creating ? "Saving\u2026" : buttonLabel}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function MemberRow({ member, onRemove, canManage }: { member: Member; onRemove: () => void; canManage: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-hover/50 transition-colors group">
      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-semibold shrink-0">
        {member.user.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-normal truncate">{member.user.name}</p>
        <p className="text-xs text-text-muted truncate">{member.user.email}</p>
      </div>
      {canManage && (
        <button
          onClick={onRemove}
          className="text-xs text-text-muted hover:text-danger transition-colors opacity-0 group-hover:opacity-100 px-1.5 py-1"
          title="Remove"
        >
          Remove
        </button>
      )}
    </div>
  );
}

function MembersSection({
  members, teamId, addEmail, onAddEmailChange, onAdd, onRemove, error, canManage,
}: {
  members: Member[];
  teamId: string | null;
  addEmail: string;
  onAddEmailChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (userId: string, teamId: string | null) => void;
  error: string;
  canManage: boolean;
}) {
  return (
    <div className="card-hover bg-surface rounded-xl border border-border/50 p-4">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="5.5" r="2.5" />
          <path d="M2.5 14c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" />
        </svg>
        Members &mdash; {members.length}
      </h3>
      <div className="space-y-0.5">
        {members.map((m) => (
          <MemberRow key={m.id} member={m} canManage={canManage} onRemove={() => onRemove(m.userId, teamId)} />
        ))}
      </div>
      {canManage && (
      <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
        <input
          value={addEmail}
          onChange={(e) => onAddEmailChange(e.target.value)}
          placeholder="Add by email"
          className="flex-1 px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
        <button
          onClick={onAdd}
          disabled={!addEmail.trim()}
          className="btn-primary px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
      )}
      {canManage && error && <p className="text-danger text-xs mt-2">{error}</p>}
    </div>
  );
}

function MeetingCard({ meeting, upcoming }: { meeting: Meeting; upcoming: boolean }) {
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className={`group card-hover bg-surface rounded-xl border border-border/50 p-4 flex items-start gap-4 block ${!upcoming ? "opacity-70 hover:opacity-95" : ""}`}
    >
      <div
        className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
          upcoming
            ? "bg-gradient-to-br from-[#6b76ff]/25 to-[#3d49e8]/10 border-accent/20 text-accent group-hover:from-[#6b76ff]/35 group-hover:to-[#3d49e8]/15 transition-all duration-300"
            : "bg-bg-secondary border-border/50 text-text-muted"
        }`}
      >
        <span className="text-lg font-bold leading-none">{new Date(meeting.scheduledAt).getDate()}</span>
        <span className="text-[9px] uppercase tracking-wide mt-0.5">
          {new Date(meeting.scheduledAt).toLocaleDateString("en-US", { month: "short" })}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-normal group-hover:text-accent transition-colors">{meeting.title}</p>
        {meeting.description && (
          <p className="text-xs text-text-muted mt-0.5 leading-relaxed line-clamp-2">{meeting.description}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <p className="text-xs text-text-muted flex items-center gap-1.5">
            <svg className="w-3 h-3 text-text-muted/60" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="1.5" y="2.5" width="11" height="10" rx="1.5" />
              <line x1="1.5" y1="5.5" x2="12.5" y2="5.5" />
              <line x1="4.5" y1="1" x2="4.5" y2="4" />
              <line x1="9.5" y1="1" x2="9.5" y2="4" />
            </svg>
            {new Date(meeting.scheduledAt).toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric",
            })}
            {" at "}
            {new Date(meeting.scheduledAt).toLocaleTimeString("en-US", {
              hour: "numeric", minute: "2-digit",
            })}
          </p>
          {!upcoming && meeting.status && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                meeting.status === "published"
                  ? "bg-success/15 border-success/25 text-success"
                  : "bg-accent/10 border-accent/25 text-accent"
              }`}
            >
              {meeting.status === "published" ? "Published" : "Draft"}
            </span>
          )}
          {meeting.orgName && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-hover border border-border/50 text-text-muted">
              {meeting.orgName}
            </span>
          )}
        </div>
        {meeting.location && (
          <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
            <svg className="w-3 h-3 text-text-muted/60" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M7 1.5a4 4 0 0 0-4 4c0 3 4 7 4 7s4-4 4-7a4 4 0 0 0-4-4z" />
              <circle cx="7" cy="5.5" r="1.3" />
            </svg>
            {meeting.location}
          </p>
        )}
      </div>
      <svg
        className="w-4 h-4 text-accent self-center -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-200 shrink-0"
        viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      >
        <path d="M3 8h10M9 4l4 4-4 4" />
      </svg>
    </Link>
  );
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileTitle, setProfileTitle] = useState("");
  const [profilePost, setProfilePost] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingOrg, setEditingOrg] = useState<Org | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addMode, setAddMode] = useState<"email" | "existing">("email");
  const [addUserId, setAddUserId] = useState("");
  const [orgMembers, setOrgMembers] = useState<Member[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [feed, setFeed] = useState<Feed>({ upcoming: [], recent: [] });
  const [orgTeams, setOrgTeams] = useState<Record<string, Team[]>>({});
  const [showSchedule, setShowSchedule] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingDescription, setMeetingDescription] = useState("");
  const [meetingTemplateId, setMeetingTemplateId] = useState("");
  const [meetingNotify, setMeetingNotify] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [showEmailTeam, setShowEmailTeam] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState("");

  // UI-only permission gate — the API enforces the real checks; this just
  // hides controls the user has no key for.
  const { can, refresh: refreshPerms } = useMyPermissions(activeOrgId);
  const canManageTeams = can("manage_teams");
  const canSchedule = can("create_meeting", activeTeamId);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user));
  }, []);

  useEffect(() => {
    if (!user) return;
    // Land on the personal dashboard — entering an org is an explicit click.
    fetch("/api/organizations")
      .then((r) => (r.ok ? r.json() : []))
      .then(setOrgs);
  }, [user]);

  useEffect(() => {
    if (!user || activeOrgId) return;
    fetch("/api/meetings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFeed(d));
  }, [user, activeOrgId]);

  useEffect(() => {
    if (!user || activeOrgId || orgs.length === 0) return;
    Promise.all(
      orgs.map((o) =>
        fetch(`/api/organizations/${o.id}/teams`).then((r) => (r.ok ? r.json() : [])),
      ),
    ).then((lists) =>
      setOrgTeams(Object.fromEntries(orgs.map((o, i) => [o.id, lists[i]]))),
    );
  }, [user, activeOrgId, orgs]);

  // ponytail: no reset branch here for the falsy-org case — state already
  // starts empty, and every place activeOrgId can become falsy-then-set
  // (org switch, org create) resets activeTeamId itself. That keeps this
  // effect's body to a single "update from external system" call, which is
  // what React's setState-in-effect check wants.
  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/organizations/${activeOrgId}/teams`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setTeams);
  }, [activeOrgId]);

  // Fetch templates for org
  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/organizations/${activeOrgId}/templates`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setTemplates);
  }, [activeOrgId]);

  const fetchMembers = useCallback(async (orgId: string, teamId?: string) => {
    const url = teamId
      ? `/api/organizations/${orgId}/members?teamId=${teamId}`
      : `/api/organizations/${orgId}/members`;
    const res = await fetch(url);
    if (res.ok) setMembers(await res.json());
  }, []);

  // ponytail: inlined (not calling fetchMembers) so the effect lint rule can
  // trace the .then() chain directly — same reason the teams effect above
  // inlines its fetch instead of calling out to a named async function.
  useEffect(() => {
    if (!activeOrgId) return;
    const url = activeTeamId
      ? `/api/organizations/${activeOrgId}/members?teamId=${activeTeamId}`
      : `/api/organizations/${activeOrgId}/members`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then(setMembers);
  }, [activeOrgId, activeTeamId]);

  // Org-wide roster for the "existing member" add mode — kept separate from
  // `members` (which narrows to the active team) so the picker can list org
  // members not yet on the team.
  useEffect(() => {
    if (!activeOrgId) return;
    fetch(`/api/organizations/${activeOrgId}/members`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setOrgMembers);
  }, [activeOrgId]);

  useEffect(() => {
    if (!activeTeamId) return;
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    fetch(`/api/teams/${activeTeamId}/meetings?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setMeetings);
  }, [activeTeamId, searchQuery, filterFrom, filterTo]);

  function selectOrg(orgId: string) {
    setActiveOrgId(orgId);
    setActiveTeamId(null);
  }

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
    setActiveTeamId(null);
    setShowNewOrg(false);
    refreshPerms();
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
    refreshPerms();
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
    if (!activeOrgId) return;
    const email =
      addMode === "existing"
        ? orgMembers.find((m) => m.userId === addUserId)?.user.email
        : addEmail.trim();
    if (!email) return;
    setMemberError("");
    const res = await fetch(`/api/organizations/${activeOrgId}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, teamId: activeTeamId || null }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMemberError(d.error || "Failed to add member"); return;
    }
    const d = await res.json().catch(() => ({}));
    setAddEmail("");
    setAddUserId("");
    setShowAddMember(false);
    fetchMembers(activeOrgId, activeTeamId ?? undefined);
    refreshPerms();
    if (d.invited && d.invited.length > 0) {
      window.alert(
        `${d.invited[0].email} has no account yet — share this join link:\n${window.location.origin}/join/${d.invited[0].token}`,
      );
    } else if (Array.isArray(d.alreadyMembers) && d.alreadyMembers.length > 0) {
      setMemberError(`${d.alreadyMembers[0]} is already a member`);
    }
  }

  async function removeMember(userId: string, teamId: string | null) {
    if (!activeOrgId) return;
    const res = await fetch(`/api/organizations/${activeOrgId}/members`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, teamId }),
    });
    if (res.ok) {
      fetchMembers(activeOrgId, activeTeamId ?? undefined);
      refreshPerms();
    }
  }

  async function scheduleMeeting() {
    if (!activeTeamId || !meetingTitle.trim() || !meetingDate || !meetingTime) return;
    setError(""); setScheduling(true);
    const scheduledAt = `${meetingDate}T${meetingTime}:00`;
    const res = await fetch(`/api/teams/${activeTeamId}/meetings`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: meetingTitle.trim(), description: meetingDescription.trim() || null, scheduledAt, location: meetingLocation.trim() || null, notify: meetingNotify, ...(meetingTemplateId ? { templateId: meetingTemplateId } : {}) }),
    });
    setScheduling(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to schedule meeting"); return;
    }
    const meeting = await res.json();
    setMeetings((prev) => [meeting, ...prev]);
    setShowSchedule(false);
    setMeetingTitle(""); setMeetingDescription(""); setMeetingDate(""); setMeetingTime(""); setMeetingLocation(""); setMeetingTemplateId(""); setMeetingNotify(false);
    if (meetingNotify && !meeting.smtpEnabled && meeting.emailErrors?.length > 0) {
      setError("Meeting scheduled — email invites not sent (SMTP not configured).");
    }
  }

  async function sendTeamEmail() {
    if (!activeTeamId || !emailSubject.trim() || !emailMessage.trim()) return;
    setError(""); setEmailSending(true); setEmailResult("");
    const res = await fetch(`/api/teams/${activeTeamId}/email`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: emailSubject.trim(), message: emailMessage.trim() }),
    });
    setEmailSending(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error || "Failed to send email"); return;
    }
    if (d.emailErrors?.length > 0) {
      setError(`${d.emailErrors.length} email(s) failed to send (SMTP not configured?).`);
    }
    setEmailResult(d.emailed.length > 0
      ? `Emailed ${d.emailed.length} member${d.emailed.length === 1 ? "" : "s"}.`
      : "No members found to email.");
    setEmailSubject(""); setEmailMessage("");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function openProfileEditor() {
    if (!user) return;
    setProfileName(user.name);
    setProfileTitle(user.title ?? "");
    setProfilePost(user.post ?? "");
    setShowProfileMenu(false);
    setShowProfile(true);
  }

  async function saveProfile() {
    if (!profileName.trim() || profileSaving) return;
    setProfileSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName, title: profileTitle, post: profilePost }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "Failed to save profile");
        return;
      }
      setUser((u) => (u ? { ...u, ...d.user } : u));
      setShowProfile(false);
      setError("");
    } finally {
      setProfileSaving(false);
    }
  }

  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const activeTeam = teams.find((t) => t.id === activeTeamId);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Server bar */}
      <nav className="w-18 bg-bg-tertiary flex flex-col items-center gap-1.5 py-3 shrink-0">
        <button
          onClick={() => setActiveOrgId(null)}
          title="Home"
          className={`group relative w-12 h-12 rounded-2xl transition-all duration-200 ease-out flex items-center justify-center hover:rounded-xl active:scale-95 ${
            !activeOrgId
              ? "bg-gradient-to-br from-[#6b76ff] to-[#3d49e8] text-white shadow-[0_4px_14px_-4px_rgba(88,101,242,0.7)]"
              : "bg-bg-secondary text-text-muted hover:bg-accent hover:text-white"
          }`}
        >
          <span className={`pill h-0 opacity-0 ${!activeOrgId ? "!h-10 opacity-100" : "group-hover:!h-5 group-hover:opacity-100"}`} />
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8.5L10 2.5l7 6v8a1 1 0 0 1-1 1h-4v-5h-4v5H4a1 1 0 0 1-1-1z" />
          </svg>
        </button>
        {orgs.length > 0 && <div className="w-8 h-px bg-border/50 my-1" />}
        {orgs.map((org) => (
          <button
            key={org.id}
            onClick={() => selectOrg(org.id)}
            title={org.name}
            className={`group relative w-12 h-12 rounded-2xl transition-all duration-200 ease-out flex items-center justify-center font-bold text-lg hover:rounded-xl active:scale-95 ${
              activeOrgId === org.id
                ? "bg-gradient-to-br from-[#6b76ff] to-[#3d49e8] text-white shadow-[0_4px_14px_-4px_rgba(88,101,242,0.7)]"
                : "bg-bg-secondary text-text-muted hover:bg-accent hover:text-white hover:shadow-[0_4px_14px_-4px_rgba(88,101,242,0.5)]"
            }`}
          >
            <span
              className={`pill h-0 opacity-0 ${
                activeOrgId === org.id ? "!h-10 opacity-100" : "group-hover:!h-5 group-hover:opacity-100"
              }`}
            />
            {org.name[0].toUpperCase()}
          </button>
        ))}
        {orgs.length > 0 && <div className="w-8 h-px bg-border/50 my-1" />}
        <button
          onClick={() => { setError(""); setShowNewOrg(true); }}
          title="New organization"
          className="w-12 h-12 rounded-2xl hover:rounded-xl hover:bg-success hover:shadow-[0_4px_14px_-4px_rgba(35,165,90,0.6)] transition-all duration-200 ease-out flex items-center justify-center text-text-muted hover:text-white text-2xl font-light border-2 border-dashed border-border hover:border-success active:scale-95"
        >
          +
        </button>
      </nav>

      {/* Channel sidebar */}
      <aside className="w-60 bg-bg-secondary flex flex-col shrink-0">
        <div className="h-12.25 flex items-center px-4 border-b border-border/50 shrink-0 relative">
          {activeOrg ? (
          <button
            onClick={() => { setActiveTeamId(null); setShowOrgMenu((v) => !v); }}
            className="text-[15px] font-semibold text-text-normal truncate hover:text-accent transition-colors w-full text-left flex items-center justify-between gap-2"
          >
            <span className="truncate">{activeOrg.name}</span>
            <svg className="w-4 h-4 text-text-muted shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 6l5 5 5-5" />
            </svg>
          </button>
          ) : (
          <span className="text-[15px] font-semibold text-text-normal truncate w-full">Minutes</span>
          )}
          {showOrgMenu && activeOrg && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowOrgMenu(false)} />
              <div className="absolute left-2 right-2 top-full mt-1.5 z-50 bg-bg-tertiary rounded-lg border border-border/50 shadow-xl py-1.5">
                <button
                  onClick={() => { setShowOrgMenu(false); setActiveTeamId(null); }}
                  className="w-full text-left px-3 py-1.5 text-sm text-text-normal hover:bg-surface/60 transition-colors"
                >
                  {activeOrg.name}
                </button>
                <button
                  onClick={() => { setShowOrgMenu(false); router.push(`/settings?org=${activeOrg.id}`); }}
                  className="w-full text-left px-3 py-1.5 text-sm text-text-normal hover:bg-surface/60 transition-colors"
                >
                  ⚙ Settings
                </button>
                {canManageTeams && (
                  <button
                    onClick={() => { setShowOrgMenu(false); setError(""); setShowNewTeam(true); }}
                    className="w-full text-left px-3 py-1.5 text-sm text-text-muted hover:bg-surface/60 transition-colors"
                  >
                    + New team
                  </button>
                )}
              </div>
            </>
          )}
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
                  className={`group relative w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 ${
                    activeTeamId === t.id
                      ? "bg-gradient-to-r from-surface to-surface/60 text-text-normal shadow-sm"
                      : "text-text-muted hover:bg-surface/50 hover:text-text-normal"
                  }`}
                >
                  <span
                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r bg-accent transition-all duration-200 ${
                      activeTeamId === t.id ? "h-5" : "h-0 group-hover:h-3.5"
                    }`}
                  />
                  <span className={`text-lg leading-none shrink-0 transition-colors group-hover:text-accent ${activeTeamId === t.id ? "text-accent" : "text-text-muted/60"}`}>#</span>
                  <span className="truncate text-left">{t.name}</span>
                </button>
              ))}
              {canManageTeams && (
                <button
                  onClick={() => { setError(""); setShowNewTeam(true); }}
                  className="group w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-text-muted hover:bg-success/10 hover:text-success transition-all duration-150 mt-0.5"
                >
                  <span className="text-lg leading-none text-text-muted/60 group-hover:text-success transition-colors shrink-0">+</span>
                  Add team
                </button>
              )}
            </>
          )}
          {!activeOrgId && user && (
            <div className="px-2 mt-2">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5 px-2">Recent</p>
              {feed.recent.slice(0, 4).map((m) => (
                <Link
                  key={m.id}
                  href={`/meetings/${m.id}`}
                  className="block px-2 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-normal hover:bg-surface/50 transition-colors truncate"
                >
                  {m.title}
                </Link>
              ))}
              {feed.recent.length === 0 && (
                <p className="text-xs text-text-muted px-2">Meetings will appear here.</p>
              )}
            </div>
          )}
          {!activeOrgId && !user && (
            <p className="text-sm text-text-muted px-2 mt-2">Sign in to get started.</p>
          )}
        </div>
        {user && (
          <div className="h-13.25 shrink-0 bg-bg-tertiary/30 px-3 flex items-center gap-2.5 border-t border-border/50">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/40 to-success/25 flex items-center justify-center text-accent text-sm font-semibold">
                {user.name[0]}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-bg-tertiary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-normal truncate leading-tight">{user.name}</p>
              <p className="text-[11px] text-text-muted truncate leading-tight">{user.email}</p>
            </div>
            <ThemeToggle />
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu((v) => !v)}
                title="Account options"
                className="text-text-muted hover:text-text-normal hover:bg-surface/60 transition-all text-lg leading-none px-1.5 py-1 rounded-md"
              >
                ⋯
              </button>
              {showProfileMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                  <div className="absolute right-0 bottom-full mb-2 z-50 w-44 bg-bg-tertiary rounded-lg border border-border/50 shadow-xl py-1.5 animate-pop-in origin-bottom-right">
                    <button
                      onClick={openProfileEditor}
                      className="w-full text-left px-3 py-1.5 text-sm text-text-normal hover:bg-surface/60 transition-colors"
                    >
                      ✏️ Edit profile
                    </button>
                    <button
                      onClick={logout}
                      className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-danger/10 transition-colors"
                    >
                      ⏻ Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="frost h-12.25 border-b border-border/50 flex items-center px-5 shrink-0 sticky top-0 z-10">
          {activeTeam ? (
            <>
              <button
                onClick={() => setActiveTeamId(null)}
                className="group text-text-muted hover:text-text-normal transition-colors text-sm font-semibold flex items-center gap-1.5"
              >
                {activeOrg?.name}
                <svg className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M4.5 2.5L8 6l-3.5 3.5" />
                </svg>
              </button>
              <span className="text-text-muted mx-2 text-sm">/</span>
              <span className="font-semibold text-[15px] text-text-normal flex items-center gap-1.5">
                <span className="text-accent">#</span> {activeTeam.name}
              </span>
              {canManageTeams && (
                <button
                  onClick={() => { setError(""); setEditingTeam(activeTeam); }}
                  className="ml-auto text-xs text-text-muted hover:text-text-normal transition-all px-2.5 py-1 rounded-md hover:bg-surface/50"
                >
                  ✎ Edit
                </button>
              )}
              {can("manage_members", activeTeamId) && (
                <button
                  onClick={() => { setError(""); setEmailResult(""); setShowEmailTeam(true); }}
                  className="text-xs text-text-muted hover:text-text-normal transition-all px-2.5 py-1 rounded-md hover:bg-surface/50"
                >
                  ✉ Email team
                </button>
              )}
            </>
          ) : activeOrg ? (
            <>
              <span className="font-semibold text-[15px] text-text-normal flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-gradient-to-br from-[#6b76ff] to-[#3d49e8] flex items-center justify-center text-white text-[10px] font-bold">
                  {activeOrg.name[0].toUpperCase()}
                </span>
                {activeOrg.name}
              </span>
              {can("manage_org") && (
                <button
                  onClick={() => { setError(""); setEditingOrg(activeOrg); }}
                  className="ml-auto text-xs text-text-muted hover:text-text-normal transition-all px-2.5 py-1 rounded-md hover:bg-surface/50"
                >
                  ✎ Edit
                </button>
              )}
            </>
          ) : (
            <span className="text-sm text-text-muted">No organization selected</span>
          )}
        </div>

        {/* Content area */}
        {activeTeam ? (
          <div className="flex flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
                <div className="animate-fade-up">
                  <h1 className="text-2xl font-bold text-text-normal flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center text-accent text-lg border border-accent/20">#</span>
                    {activeTeam.name}
                  </h1>
                  {activeTeam.description && (
                    <p className="text-sm text-text-muted mt-1.5 leading-relaxed">{activeTeam.description}</p>
                  )}
                </div>

                <div className="space-y-2.5">
                  {/* Search */}
                  <div className="relative group">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent/5 via-accent/10 to-accent/5 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                    <div className="relative flex items-center bg-bg-secondary/80 backdrop-blur-sm border border-border/60 rounded-xl overflow-hidden transition-all duration-300 shadow-sm group-focus-within:border-accent/50 group-focus-within:shadow-[0_0_20px_-4px_rgba(88,101,242,0.25)] group-focus-within:bg-bg-secondary">
                      <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-muted group-focus-within:text-accent transition-colors duration-300 pointer-events-none" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="9" cy="9" r="5.5" />
                        <line x1="13.5" y1="13.5" x2="18" y2="18" />
                      </svg>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search meetings..."
                        className="w-full bg-transparent border-none pl-[44px] pr-10 py-3 text-sm placeholder:text-text-muted/50 focus:outline-none focus:ring-0 rounded-xl shadow-none"
                      />
                      {searchQuery.trim() && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface hover:bg-surface-hover flex items-center justify-center text-text-muted hover:text-text-normal transition-all duration-200 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Date filter toggle + inputs */}
                  <div>
                    {showDateFilter ? (
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 relative group">
                          <div className="flex items-center bg-bg-secondary/60 backdrop-blur-sm border border-border/50 rounded-lg overflow-hidden transition-all duration-200 group-focus-within:border-accent/40 group-focus-within:shadow-[0_0_14px_-4px_rgba(88,101,242,0.15)]">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" />
                              <line x1="1.5" y1="6.5" x2="14.5" y2="6.5" />
                              <line x1="5" y1="1" x2="5" y2="4.5" />
                              <line x1="11" y1="1" x2="11" y2="4.5" />
                            </svg>
                            <input
                              type="date"
                              value={filterFrom}
                              onChange={(e) => setFilterFrom(e.target.value)}
                              className="w-full bg-transparent border-none pl-[34px] pr-2 py-2 text-xs text-text-normal focus:outline-none focus:ring-0 rounded-lg shadow-none [color-scheme:dark]"
                            />
                          </div>
                        </div>
                        <span className="text-text-muted text-xs shrink-0">to</span>
                        <div className="flex-1 relative group">
                          <div className="flex items-center bg-bg-secondary/60 backdrop-blur-sm border border-border/50 rounded-lg overflow-hidden transition-all duration-200 group-focus-within:border-accent/40 group-focus-within:shadow-[0_0_14px_-4px_rgba(88,101,242,0.15)]">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" />
                              <line x1="1.5" y1="6.5" x2="14.5" y2="6.5" />
                              <line x1="5" y1="1" x2="5" y2="4.5" />
                              <line x1="11" y1="1" x2="11" y2="4.5" />
                            </svg>
                            <input
                              type="date"
                              value={filterTo}
                              onChange={(e) => setFilterTo(e.target.value)}
                              className="w-full bg-transparent border-none pl-[34px] pr-2 py-2 text-xs text-text-normal focus:outline-none focus:ring-0 rounded-lg shadow-none [color-scheme:dark]"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => { setShowDateFilter(false); setFilterFrom(""); setFilterTo(""); }}
                          className="shrink-0 px-2.5 py-2 text-xs text-text-muted hover:text-text-normal hover:bg-surface/50 rounded-lg transition-all"
                        >
                          Close
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDateFilter(true)}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:text-text-normal hover:bg-surface/40 rounded-lg transition-all"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" />
                          <line x1="1.5" y1="6.5" x2="14.5" y2="6.5" />
                          <line x1="5" y1="1" x2="5" y2="4.5" />
                          <line x1="11" y1="1" x2="11" y2="4.5" />
                        </svg>
                        Filter by date
                      </button>
                    )}
                  </div>
                </div>

                {(() => {
                  if (!activeTeamId || meetings.length === 0) {
                    return (
                      <div className="card-hover bg-surface rounded-2xl border border-border/50 p-10 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/25 to-success/15 flex items-center justify-center mx-auto mb-4 shadow-[0_8px_24px_-8px_rgba(88,101,242,0.5)]">
                          <svg className="w-7 h-7 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <rect x="3" y="5" width="18" height="16" rx="2.5" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                            <line x1="8" y1="2.5" x2="8" y2="7" />
                            <line x1="16" y1="2.5" x2="16" y2="7" />
                            <path d="M8 15h3M14 15h2M8 18h2" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-text-normal">
                          {searchQuery.trim() ? "No meetings match your search." : "No meetings yet."}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          {searchQuery.trim()
                            ? "Try a different keyword or clear the date filter."
                            : "Schedule your first meeting to get started."}
                        </p>
                      </div>
                    );
                  }
                  if (searchQuery.trim()) {
                    return (
                      <div>
                        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                          {meetings.length} result{meetings.length !== 1 ? "s" : ""}
                        </h3>
                        <div className="space-y-2">{meetings.map((m) => <MeetingCard key={m.id} meeting={m} upcoming={new Date(m.scheduledAt) > new Date()} />)}</div>
                      </div>
                    );
                  }
                  const now = new Date();
                  const upcoming = meetings.filter((m) => new Date(m.scheduledAt) > now);
                  const past = meetings.filter((m) => new Date(m.scheduledAt) <= now);
                  return (
                    <div>
                      {upcoming.length > 0 && (
                        <div className="mb-6">
                          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Upcoming</h3>
                          <div className="space-y-2">{upcoming.map((m) => <MeetingCard key={m.id} meeting={m} upcoming />)}</div>
                        </div>
                      )}
                      {past.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Past</h3>
                          <div className="space-y-2">{past.map((m) => <MeetingCard key={m.id} meeting={m} upcoming={false} />)}</div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {canSchedule && (
                  <button
                    onClick={() => { setError(""); setShowSchedule(true); }}
                    className="btn-primary px-5 py-2.5 text-sm font-semibold text-white rounded-xl flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" />
                      <line x1="1.5" y1="6.5" x2="14.5" y2="6.5" />
                      <line x1="5" y1="1" x2="5" y2="4.5" />
                      <line x1="11" y1="1" x2="11" y2="4.5" />
                      <line x1="8" y1="9.5" x2="8" y2="13" />
                      <line x1="6.25" y1="11.25" x2="9.75" y2="11.25" />
                    </svg>
                    Schedule meeting
                  </button>
                )}
              </div>
            </div>

            <aside className="w-60 bg-bg-secondary border-l border-border/50 flex flex-col shrink-0">
              <div className="h-12.25 flex items-center px-4 border-b border-border/50 shrink-0">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Members &mdash; {members.length}
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-hover/50 transition-colors group">
                    <div className="relative shrink-0">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent/35 to-success/25 flex items-center justify-center text-accent text-xs font-semibold">
                        {m.user.name[0]}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-bg-secondary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-normal truncate">{m.user.name}</p>
                      <p className="text-[11px] text-text-muted truncate">{m.user.email}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-border/50">
                {can("manage_members", activeTeamId) && (showAddMember ? (
                  <>
                    <div className="flex gap-1 text-xs mb-2">
                      <button
                        type="button"
                        onClick={() => setAddMode("email")}
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          addMode === "email" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-normal"
                        }`}
                      >
                        By email
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddMode("existing")}
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          addMode === "existing" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-normal"
                        }`}
                      >
                        Existing member
                      </button>
                    </div>
                    {addMode === "email" ? (
                      <input
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                        placeholder="Email address"
                        className="w-full px-3 py-2 text-sm mb-2"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && addMember()}
                      />
                    ) : (
                      <select
                        value={addUserId}
                        onChange={(e) => setAddUserId(e.target.value)}
                        className="w-full px-3 py-2 text-sm mb-2 cursor-pointer"
                      >
                        <option value="">Select a member…</option>
                        {orgMembers
                          .filter((om) => !members.some((tm) => tm.userId === om.userId))
                          .map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.user.name || m.user.email} ({m.user.email})
                            </option>
                          ))}
                      </select>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={addMember}
                        disabled={addMode === "email" ? !addEmail.trim() : !addUserId}
                        className="btn-primary flex-1 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setShowAddMember(false); setAddEmail(""); setAddUserId(""); setMemberError(""); }}
                        className="px-3 py-2 text-sm text-text-muted hover:text-text-normal transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    {memberError && <p className="text-danger text-xs mt-2">{memberError}</p>}
                  </>
                ) : (
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="btn-primary w-full px-4 py-2 text-sm font-semibold text-white rounded-lg flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <circle cx="8" cy="5.5" r="2.5" />
                      <path d="M2.5 14c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" />
                      <line x1="12" y1="7.5" x2="14.5" y2="7.5" />
                      <line x1="13.25" y1="6.25" x2="13.25" y2="8.75" />
                    </svg>
                    Add member
                  </button>
                ))}
              </div>
            </aside>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {!user ? (
              <div className="max-w-md mx-auto mt-[15vh] text-center px-4 animate-fade-up">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/30 to-success/15 flex items-center justify-center mx-auto mb-5 shadow-[0_8px_30px_-8px_rgba(88,101,242,0.6)]">
                  <span className="text-accent text-2xl font-bold">M</span>
                </div>
                <h1 className="text-3xl font-bold text-text-normal">Minutes</h1>
                <p className="text-sm text-text-muted mt-2 leading-relaxed">
                  Meeting minutes management for your organization.
                </p>
                <button
                  onClick={() => router.push("/login")}
                  className="btn-primary mt-6 px-6 py-2.5 text-sm font-semibold text-white rounded-xl"
                >
                  Sign in
                </button>
              </div>
            ) : !activeOrgId ? (
              (() => {
                const h = new Date().getHours();
                const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
                const today = new Date().toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric",
                });
                return (
                  <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
                    {/* Greeting + stats */}
                    <header className="animate-fade-up">
                      <h1 className="text-2xl font-bold text-text-normal">
                        {greeting}, {user.name.split(" ")[0]}
                      </h1>
                      <p className="text-sm text-text-muted mt-1">{today}</p>
                      {feed.upcoming[0] && (
                        <Link href={`/meetings/${feed.upcoming[0].id}`} className="group inline-flex items-center gap-2 mt-3 text-sm text-text-muted hover:text-text-normal transition-colors">
                          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
                          <span className="truncate">
                            Next: {feed.upcoming[0].title} ·{" "}
                            {new Date(feed.upcoming[0].scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at{" "}
                            {new Date(feed.upcoming[0].scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </span>
                          <svg className="w-3.5 h-3.5 opacity-0 -translate-x-0.5 group-hover:opacity-100 group-hover:translate-x-0 transition-all" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M3 8h10M9 4l4 4-4 4" />
                          </svg>
                        </Link>
                      )}
                    </header>
                    {/* Organizations */}
                    <section className="animate-fade-up" style={{ animationDelay: "60ms" }}>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Your organizations</h2>
                        <button
                          onClick={() => { setError(""); setShowNewOrg(true); }}
                          className="text-xs text-accent hover:text-accent-hover transition-colors"
                        >
                          + New organization
                        </button>
                      </div>
                      {orgs.length > 0 ? (
                        <div className="grid sm:grid-cols-2 gap-3">
                          {orgs.map((o) => (
                            <div key={o.id} className="group relative card-hover bg-surface rounded-xl border border-border/50 p-4">
                              <button
                                onClick={() => selectOrg(o.id)}
                                className="absolute inset-0 z-10 rounded-xl"
                                aria-label={`Open ${o.name}`}
                              />
                              <div className="flex items-start gap-3">
                                <span className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#6b76ff] to-[#3d49e8] flex items-center justify-center text-white font-bold shrink-0 shadow-[0_4px_14px_-4px_rgba(88,101,242,0.7)]">
                                  {o.name[0].toUpperCase()}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-text-normal truncate">{o.name}</p>
                                  <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
                                    {o.description || `${(orgTeams[o.id] ?? []).length} team${(orgTeams[o.id] ?? []).length !== 1 ? "s" : ""}`}
                                  </p>
                                </div>
                                <button
                                  onClick={() => router.push(`/settings?org=${o.id}`)}
                                  title={`${o.name} settings`}
                                  className="relative z-20 text-text-muted hover:text-text-normal transition-colors px-1 py-0.5 rounded-md hover:bg-surface-hover shrink-0"
                                >
                                  ⚙
                                </button>
                              </div>
                              <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between">
                                <span className="text-[11px] text-text-muted">
                                  {(orgTeams[o.id] ?? []).length} team{(orgTeams[o.id] ?? []).length !== 1 ? "s" : ""}
                                </span>
                                <span className="text-[11px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                                  Open →
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-surface rounded-xl border border-dashed border-border/50 p-8 text-center">
                          <p className="text-sm text-text-normal">No organizations yet.</p>
                          <p className="text-xs text-text-muted mt-1">Create one to start scheduling meetings.</p>
                          <button
                            onClick={() => { setError(""); setShowNewOrg(true); }}
                            className="btn-primary mt-4 px-5 py-2 text-sm font-semibold text-white rounded-lg"
                          >
                            Create organization
                          </button>
                        </div>
                      )}
                    </section>

                    {/* Upcoming across all orgs */}
                    <section className="animate-fade-up" style={{ animationDelay: "120ms" }}>
                      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Upcoming</h2>
                      {feed.upcoming.length > 0 ? (
                        <div className="space-y-2">
                          {feed.upcoming.map((m) => <MeetingCard key={m.id} meeting={m} upcoming />)}
                        </div>
                      ) : (
                        <p className="text-sm text-text-muted">Nothing scheduled — pick a team and plan ahead.</p>
                      )}
                    </section>

                    {/* Recent minutes */}
                    <section className="animate-fade-up" style={{ animationDelay: "180ms" }}>
                      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Recent minutes</h2>
                      {feed.recent.length > 0 ? (
                        <div className="space-y-2">
                          {feed.recent.map((m) => (
                            <MeetingCard key={m.id} meeting={m} upcoming={false} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-text-muted">No past meetings yet.</p>
                      )}
                    </section>
                  </div>
                );
              })()
            ) : (
              <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">
                <div className="animate-fade-up">
                  <h1 className="text-2xl font-bold text-text-normal flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#6b76ff] to-[#3d49e8] flex items-center justify-center text-white text-base font-bold shadow-[0_4px_14px_-4px_rgba(88,101,242,0.7)]">
                      {activeOrg?.name[0].toUpperCase()}
                    </span>
                    {activeOrg?.name}
                  </h1>
                  {activeOrg?.description && (
                    <p className="text-sm text-text-muted mt-1.5 leading-relaxed">{activeOrg.description}</p>
                  )}
                  <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
                      <line x1="1.5" y1="6.5" x2="14.5" y2="6.5" />
                    </svg>
                    {teams.length} team{teams.length !== 1 ? "s" : ""} &middot; {members.length} member{members.length !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="animate-fade-up" style={{ animationDelay: "60ms" }}>
                  <MembersSection
                    members={members}
                    teamId={null}
                    addEmail={addEmail}
                    onAddEmailChange={setAddEmail}
                    onAdd={addMember}
                    onRemove={removeMember}
                    error={memberError}
                    canManage={can("manage_members")}
                  />
                </div>

                <div className="animate-fade-up card-hover bg-surface rounded-xl border border-border/50 p-5" style={{ animationDelay: "120ms" }}>
                  <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M2 8h12M2 4h12M2 12h7" />
                    </svg>
                    Teams
                  </h3>
                  {teams.length > 0 ? (
                    <div className="mt-3 space-y-0.5">
                      {teams.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setActiveTeamId(t.id)}
                          className="group w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-text-muted hover:bg-surface-hover/50 hover:text-text-normal transition-all"
                        >
                          <span className="text-lg leading-none text-text-muted/60 group-hover:text-accent transition-colors">#</span>
                          {t.name}
                          <svg className="w-3.5 h-3.5 ml-auto -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 text-accent transition-all" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M3 8h10M9 4l4 4-4 4" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted mt-2">No teams yet.</p>
                  )}
                  {canManageTeams && (
                    <button
                      onClick={() => { setError(""); setShowNewTeam(true); }}
                      className="mt-3 text-sm text-accent hover:text-accent-hover transition-colors flex items-center gap-1.5"
                    >
                      <span className="w-4 h-4 rounded bg-accent/15 flex items-center justify-center text-xs">+</span>
                      New team
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
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
      {showEmailTeam && activeTeam && (
        <ModalOverlay onClose={() => setShowEmailTeam(false)}>
          <div className="animate-pop-in bg-bg-primary rounded-xl p-6 w-100 shadow-2xl border border-border/50">
            <h2 className="text-[17px] font-semibold text-text-normal mb-5">Email {activeTeam.name}</h2>
            <input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Subject"
              className="w-full px-3.5 py-2.5 text-sm mb-4"
              autoFocus
              disabled={emailSending}
            />
            <textarea
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              placeholder="Message"
              rows={5}
              className="w-full px-3.5 py-2.5 text-sm mb-4 resize-none"
              disabled={emailSending}
            />
            {emailResult && <p className="text-success text-sm mb-4">{emailResult}</p>}
            {error && <p className="text-danger text-sm mb-4">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowEmailTeam(false)}
                disabled={emailSending}
                className="px-4 py-2 text-sm text-text-muted hover:text-text-normal transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={sendTeamEmail}
                disabled={emailSending || !emailSubject.trim() || !emailMessage.trim()}
                className="btn-primary px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {emailSending ? "Sending\u2026" : "Send to team"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
      {showSchedule && (
        <ModalOverlay onClose={() => setShowSchedule(false)}>
          <div className="animate-pop-in bg-bg-primary rounded-xl p-6 w-100 shadow-2xl border border-border/50">
            <h2 className="text-[17px] font-semibold text-text-normal mb-5">Schedule meeting</h2>
            <input
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="Meeting title"
              className="w-full px-3.5 py-2.5 text-sm mb-4"
              autoFocus
              disabled={scheduling}
            />
            <textarea
              value={meetingDescription}
              onChange={(e) => setMeetingDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-3.5 py-2.5 text-sm mb-4 resize-none"
              disabled={scheduling}
            />
            <select
              value={meetingTemplateId}
              onChange={(e) => setMeetingTemplateId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm mb-4"
              disabled={scheduling}
            >
              <option value="">No template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <DualDateInput value={meetingDate} onChange={setMeetingDate} className="mb-4" />
            <input
              type="time"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm mb-4"
              disabled={scheduling}
            />
            <input
              value={meetingLocation}
              onChange={(e) => setMeetingLocation(e.target.value)}
              placeholder="Location (optional)"
              className="w-full px-3.5 py-2.5 text-sm mb-4"
              disabled={scheduling}
            />
            <label className="flex items-center gap-2 text-sm text-text-normal mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={meetingNotify}
                onChange={(e) => setMeetingNotify(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              Email invite to team members
            </label>
            {error && <p className="text-danger text-sm mb-4">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSchedule(false)}
                disabled={scheduling}
                className="px-4 py-2 text-sm text-text-muted hover:text-text-normal transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={scheduleMeeting}
                disabled={scheduling || !meetingTitle.trim() || !meetingDate || !meetingTime}
                className="btn-primary px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {scheduling ? "Scheduling\u2026" : "Schedule"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showProfile && (
        <ModalOverlay onClose={() => setShowProfile(false)}>
          <div className="animate-pop-in bg-bg-primary rounded-xl p-6 w-100 shadow-2xl border border-border/50">
            <h2 className="text-[17px] font-semibold text-text-normal mb-5">Edit profile</h2>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Email</label>
            <input value={user?.email ?? ""} disabled className="w-full px-3.5 py-2.5 text-sm mb-4 opacity-60 cursor-not-allowed" />
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Full name</label>
            <input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              maxLength={120}
              className="w-full px-3.5 py-2.5 text-sm mb-4"
              autoFocus
            />
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Title (Mr., Dr., …)</label>
            <input
              value={profileTitle}
              onChange={(e) => setProfileTitle(e.target.value)}
              list="honorifics"
              maxLength={30}
              placeholder="Optional"
              className="w-full px-3.5 py-2.5 text-sm mb-4"
            />
            <datalist id="honorifics">
              {["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Er.", "Hon."].map((h) => (
                <option key={h} value={h} />
              ))}
            </datalist>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Post / designation</label>
            <input
              value={profilePost}
              onChange={(e) => setProfilePost(e.target.value)}
              maxLength={120}
              placeholder="Optional — e.g. Campus Chief"
              className="w-full px-3.5 py-2.5 text-sm mb-5"
            />
            <p className="text-xs text-text-muted mb-4 -mt-1">Shown across your organizations; not rendered into minutes yet.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowProfile(false)}
                disabled={profileSaving}
                className="px-4 py-2 text-sm text-text-muted hover:text-text-normal transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={profileSaving || !profileName.trim()}
                className="btn-primary px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {profileSaving ? "Saving\u2026" : "Save"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
