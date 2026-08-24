"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { renderTemplate, defaultTemplateSource } from "@/lib/render-pdf";
import DualDateInput from "@/app/dual-date-input";
import { useMyPermissions } from "@/app/use-my-permissions";

type Field =
  | { name: string; label: string; type: "text" }
  | { name: string; label: string; type: "textarea" }
  | { name: string; label: string; type: "number" }
  | { name: string; label: string; type: "date" }
  | { name: string; label: string; type: "boolean" }
  | { name: string; label: string; type: "select"; config: { options: string[] } }
  | { name: string; label: string; type: "table"; config: { columns: { key: string; label: string }[] } };

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = Array.isArray(params.meetingId) ? params.meetingId[0] : (params.meetingId ?? "");

  const [meeting, setMeeting] = useState<{
    id: string; orgId: string; title: string; description: string | null;
    scheduledAt: string;
    teamIds?: string[];
  } | null>(null);
  const [template, setTemplate] = useState<{ id: string; name: string; fields: Field[] } | null>(null);
  const [templateSource, setTemplateSource] = useState<string | null>(null);
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ user: { name: string }; roleName: string | null; postRole?: string | null }[]>([]);
  const [minutesExists, setMinutesExists] = useState(false);
  const [orgTemplates, setOrgTemplates] = useState<{ id: string; name: string }[]>([]);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmails, setShareEmails] = useState("");
  const [shareAnyone, setShareAnyone] = useState(false);
  const [existingShares, setExistingShares] = useState<
    { id: string; email: string | null; url: string }[]
  >([]);
  const [lastShares, setLastShares] = useState<
    { id: string; email: string | null; url: string }[]
  >([]);
  const [shareMsg, setShareMsg] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const { can } = useMyPermissions(meeting?.orgId);
  const canEdit = can("edit_meeting");
  const canExport = can("export_minutes");

  useEffect(() => {
    fetch(`/api/meetings/${meetingId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setMeeting(d.meeting ?? null); })
      .catch(() => setError("Failed to load meeting"));
  }, [meetingId]);

  // The meeting's team's members — one-click source for attendance tables.
  const orgId = meeting?.orgId;
  const firstTeamId = meeting?.teamIds?.[0];
  useEffect(() => {
    if (!orgId) return;
    const url = `/api/organizations/${orgId}/members`;
    if (!firstTeamId) {
      // No team → org-wide roster is the whole list.
      fetch(url)
        .then((r) => (r.ok ? r.json() : []))
        .then(setTeamMembers)
        .catch(() => {});
      return;
    }
    // Team meeting: team members + org-wide members (secretary etc.), team
    // role winning when a user holds both.
    Promise.all([
      fetch(`${url}?teamId=${firstTeamId}`).then((r) => (r.ok ? r.json() : [])),
      fetch(url).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([teamRows, allRows]) => {
        // समिति पद only comes from a role held in THIS meeting's team;
        // org-wide roles (Admin/Secretary) are access levels, not posts.
        const byUser = new Map<string, { user: { name: string }; roleName: string | null; postRole: string | null }>();
        for (const row of allRows) byUser.set(row.userId, { user: row.user, roleName: row.roleName, postRole: null });
        for (const row of teamRows) {
          const entry = byUser.get(row.userId);
          if (entry) entry.postRole = row.roleName;
          else byUser.set(row.userId, { user: row.user, roleName: row.roleName, postRole: row.roleName });
        }
        setTeamMembers([...byUser.values()]);
      })
      .catch(() => {});
  }, [orgId, firstTeamId]);

  useEffect(() => {
    fetch(`/api/meetings/${meetingId}/minutes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setTemplate(d.template);
        setTemplateSource(d.templateSource);
        setContent(d.content ?? {});
        setStatus(d.minutes?.status ?? "draft");
        setMinutesExists(!!d.minutes);
      })
      .catch(() => setError("Failed to load minutes"));
  }, [meetingId]);

  // Freeform meeting: offer the org's templates so one can be attached after
  // scheduling. Only until minutes exist (the API enforces the same window).
  useEffect(() => {
    if (!orgId || template || minutesExists || !canEdit) return;
    fetch(`/api/organizations/${orgId}/templates`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setOrgTemplates)
      .catch(() => {});
  }, [orgId, template, minutesExists, canEdit]);

  async function chooseTemplate(templateId: string) {
    setError("");
    const res = await fetch(`/api/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to attach template");
      return;
    }
    const d = await fetch(`/api/meetings/${meetingId}/minutes`).then((r) => (r.ok ? r.json() : null));
    if (d) {
      setTemplate(d.template);
      setTemplateSource(d.templateSource);
      setContent(d.content ?? {});
      setStatus(d.minutes?.status ?? "draft");
      setMinutesExists(!!d.minutes);
    }
  }

  function setField(name: string, value: unknown) {
    setContent((prev) => ({ ...prev, [name]: value }));
  }

  // One-click attendance: append a row per team member, skipping names that
  // are already listed.
  function addTeamMembersToField(fieldName: string, columns: { key: string; label: string }[]) {
    const rows = Array.isArray(content[fieldName]) ? (content[fieldName] as Record<string, string>[]) : [];
    const existing = new Set(
      rows.map((r) => (r.name ?? "").trim().toLowerCase()).filter(Boolean),
    );
    const additions = teamMembers
      .filter((m) => !existing.has(m.user.name.trim().toLowerCase()))
      .map((m) => {
        const row: Record<string, string> = {};
        for (const col of columns) {
          row[col.key] =
            col.key === "name"
              ? m.user.name
              : col.key === "post"
                ? (m.postRole ?? "")
                : "";
        }
        return row;
      });
    if (additions.length > 0) setField(fieldName, [...rows, ...additions]);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/meetings/${meetingId}/minutes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template?.id ?? null, status, content }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function showPreview() {
    const html = renderTemplate(source, content);
    setPreviewHtml(html.replace(/^[\s\S]*<body[^>]*>/i, "").replace(/<\/body>\s*<\/html>\s*$/i, ""));
  }

  async function exportPdf() {
    const html = renderTemplate(source, content);
    const wrapper = document.createElement("div");
    wrapper.style.width = "210mm";
    wrapper.style.padding = "0";
    wrapper.innerHTML = html;
    const style = document.createElement("style");
    style.textContent = `* { word-wrap: break-word; overflow-wrap: break-word; max-width: 100%; } table { table-layout: fixed; width: 100%; } td, th { overflow: hidden; }`;
    wrapper.prepend(style);
    document.body.appendChild(wrapper);

    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const blob = await html2pdf().set({
        margin: [10, 10, 10, 10],
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      }).from(wrapper).outputPdf("blob");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "minutes.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      document.body.removeChild(wrapper);
    }
  }

  function openShare() {
    setShareOpen(true);
    setShareMsg("");
    setShareEmails("");
    setShareAnyone(false);
    fetch(`/api/meetings/${meetingId}/minutes/share`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setExistingShares(d?.shares ?? []))
      .catch(() => setShareMsg("Failed to load shares"));
  }

  async function createShares() {
    const emails = shareEmails.split(/[\s,]+/).map((e) => e.trim()).filter(Boolean);
    setShareMsg("");
    try {
      const res = await fetch(`/api/meetings/${meetingId}/minutes/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, anyone: shareAnyone }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to share");
      setLastShares(d.shares ?? []);
      const notes: string[] = [];
      if (emails.length > 0 && !d.smtpEnabled) {
        notes.push("SMTP not configured — emails not sent, copy the links instead.");
      } else if (d.emailed?.length > 0) {
        notes.push(`Emailed ${d.emailed.length} recipient${d.emailed.length === 1 ? "" : "s"}.`);
      }
      if (d.emailErrors?.length > 0) notes.push(`${d.emailErrors.length} email failed to send.`);
      setShareMsg(notes.join(" "));
      const updated = await fetch(`/api/meetings/${meetingId}/minutes/share`).then((r) => r.json());
      setExistingShares(updated.shares ?? []);
    } catch (e) {
      setShareMsg((e as Error).message);
    }
  }

  async function revokeShare(shareId: string) {
    const res = await fetch(`/api/meetings/${meetingId}/minutes/share`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId }),
    });
    if (res.ok) setExistingShares((prev) => prev.filter((s) => s.id !== shareId));
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  }

  if (!meeting) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary text-text-muted text-sm">
        {error || "Loading meeting…"}
      </div>
    );
  }

  // Meetings without an attached template render through the generic
  // document layout instead of hiding Preview/Export.
  const source = templateSource ?? defaultTemplateSource(meeting.title, content, template?.fields);

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      <header className="frost h-12 shrink-0 flex items-center justify-between px-4 border-b border-border/50">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push("/")} className="group flex items-center gap-1 text-sm text-text-muted hover:text-text-normal transition-all px-2 py-1 rounded-md hover:bg-surface/40 shrink-0">
            <svg className="w-3.5 h-3.5 -translate-x-0.5 group-hover:-translate-x-1 transition-transform" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 3l-5 5 5 5" />
            </svg>
            Back
          </button>
          <span className="text-sm font-semibold truncate">{meeting.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-text-muted hidden md:block">
            {new Date(meeting.scheduledAt).toLocaleString()}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full border border-accent/25 bg-accent/10 text-accent hidden sm:block">
            {template ? template.name : "No template"}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full border ${status === "published" ? "bg-success/15 border-success/25 text-success" : "bg-surface border-border/50 text-text-muted"}`}>
            {status === "published" ? "Published" : "Draft"}
          </span>
          <button onClick={showPreview} className="px-4 py-1.5 rounded-lg border border-border text-sm text-text-normal hover:bg-surface/50 hover:border-accent/40 transition-all active:scale-95">
            Preview
          </button>
          {canExport && (
            <>
              <button onClick={exportPdf} className="btn-primary px-4 py-1.5 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M8 2v8M4.5 7L8 10.5 11.5 7M2.5 13h11" />
                </svg>
                Export PDF
              </button>
              <button
                onClick={openShare}
                className="px-4 py-1.5 rounded-lg border border-border text-sm text-text-normal hover:bg-surface/50 hover:border-accent/40 transition-all active:scale-95"
              >
                Share
              </button>
            </>
          )}
          {canEdit && (
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </header>

      {previewHtml && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setPreviewHtml(null)}>
          <div className="animate-pop-in bg-white rounded-lg w-full max-w-4xl h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-800">Preview</span>
              <button onClick={() => setPreviewHtml(null)} className="text-sm text-gray-500 hover:text-gray-800">
                Close
              </button>
            </div>
            <div
              className="flex-1 overflow-auto p-8"
              style={{ color: "#1a1a1a", background: "#fff" }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      )}

      {shareOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setShareOpen(false)}>
          <div className="animate-pop-in bg-bg-primary rounded-xl w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
              <span className="text-sm font-semibold text-text-normal">Share minutes</span>
              <button onClick={() => setShareOpen(false)} className="text-text-muted hover:text-text-normal text-sm px-1">✕</button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <textarea
                value={shareEmails}
                onChange={(e) => setShareEmails(e.target.value)}
                placeholder="recipient@example.com, another@example.com"
                rows={3}
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none resize-y"
              />
              <label className="flex items-center gap-2 text-sm text-text-normal cursor-pointer">
                <input type="checkbox" checked={shareAnyone} onChange={(e) => setShareAnyone(e.target.checked)} className="accent-[var(--color-accent)]" />
                Anyone with the link
              </label>
              <button onClick={createShares} className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold text-white self-start">
                Create share
              </button>
              {shareMsg && <div className="text-xs text-text-muted">{shareMsg}</div>}
              {lastShares.length > 0 && (
                <div className="flex flex-col gap-2">
                  {lastShares.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-xs">
                      <span className="text-text-muted shrink-0">{s.email ?? "Anyone with link"}</span>
                      <code className="flex-1 min-w-0 truncate text-accent">{s.url}</code>
                      <button onClick={() => copyUrl(s.url)} className="shrink-0 text-accent hover:text-accent-hover">
                        {copied === s.url ? "Copied" : "Copy"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {existingShares.length > 0 && (
                <div className="border-t border-border/40 pt-3 flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Existing</span>
                  {existingShares.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-xs">
                      <span className="text-text-muted shrink-0">{s.email ?? "Anyone with link"}</span>
                      <code className="flex-1 min-w-0 truncate text-accent">{s.url}</code>
                      <button onClick={() => revokeShare(s.id)} className="shrink-0 text-text-muted hover:text-danger" title="Revoke">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-6 px-4">
          {error && (
            <div className="animate-fade-up mb-4 px-4 py-2.5 rounded-lg bg-danger/15 border border-danger/25 text-danger text-sm">{error}</div>
          )}

          <div className="animate-fade-up mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center text-accent text-base">#</span>
              {meeting.title}
            </h1>
            {meeting.description && <p className="text-sm text-text-muted mt-1">{meeting.description}</p>}
          </div>

          {!template ? (
            canEdit && !minutesExists ? (
              <div className="animate-fade-up card-hover bg-surface/50 border border-border/40 rounded-xl p-4">
                <p className="text-sm font-medium text-text-normal mb-2.5">Pick a template to start the minutes</p>
                {orgTemplates.length > 0 ? (
                  <div className="flex gap-2 flex-wrap">
                    {orgTemplates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => chooseTemplate(t.id)}
                        className="px-3 py-1.5 text-sm rounded-lg bg-bg-input border border-border hover:border-accent hover:text-accent transition-colors"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">No templates in this organization yet — create one in Settings → Templates.</p>
                )}
              </div>
            ) : (
              <div className="text-sm text-text-muted">This meeting has no template.</div>
            )
          ) : template.fields.length === 0 ? (
            <div className="text-sm text-text-muted">This template has no fields defined.</div>
          ) : (
            // Tailwind preflight strips fieldset chrome; disabled blocks input
            // for members without edit_meeting so they can't type into a void.
            <fieldset disabled={!canEdit} className="flex flex-col gap-4">
              {template.fields.map((field, i) => (
                <div key={field.name} className="animate-fade-up card-hover bg-surface/50 border border-border/40 rounded-xl p-4 flex flex-col gap-2" style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    {field.label}
                  </label>
                  <FieldInput
                    field={field}
                    value={content[field.name]}
                    onChange={(v) => setField(field.name, v)}
                    onAddTeamMembers={
                      canEdit &&
                      field.type === "table" &&
                      field.config.columns.some((c) => c.key === "name") &&
                      teamMembers.length > 0
                        ? () => addTeamMembersToField(field.name, field.config.columns)
                        : undefined
                    }
                  />
                </div>
              ))}
            </fieldset>
          )}
        </div>
      </main>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  onAddTeamMembers,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  onAddTeamMembers?: () => void;
}) {
  const inputClass = "bg-bg-input border border-border rounded px-2 py-1.5 text-sm focus:border-accent focus:outline-none";

  switch (field.type) {
    case "text":
      return <input className={inputClass} type="text" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "textarea":
      return <textarea className={`${inputClass} min-h-24 resize-y`} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <input className={inputClass} type="number" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <DualDateInput value={String(value ?? "")} onChange={(v) => onChange(v)} />;
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--color-accent)]" />
          {field.label}
        </label>
      );
    case "select": {
      const options = field.config.options;
      return (
        <select className={inputClass} value={String(value ?? options[0] ?? "")} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    case "table": {
      const columns = field.config.columns;
      const rows = Array.isArray(value) ? (value as Record<string, string>[]) : [];
      return (
        <div className="flex flex-col gap-2">
          {rows.map((row, ri) => (
            <div key={ri} className="flex gap-2 items-center">
              {columns.map((col) => (
                <input
                  key={col.key} className={`${inputClass} flex-1`} placeholder={col.label}
                  value={row[col.key] ?? ""}
                  onChange={(e) => {
                    const next = rows.map((r) => ({ ...r }));
                    next[ri] = { ...row, [col.key]: e.target.value };
                    onChange(next);
                  }}
                />
              ))}
              <button onClick={() => onChange(rows.filter((_, i) => i !== ri))} className="text-text-muted hover:text-danger text-sm px-1">✕</button>
            </div>
          ))}
          <div className="flex gap-3">
            {onAddTeamMembers && (
              <button
                onClick={onAddTeamMembers}
                className="self-start text-sm text-accent hover:text-accent-hover transition-colors"
                title="Add every member of this meeting's team as a row"
              >
                + Add team members
              </button>
            )}
            <button
              onClick={() => {
                const newRow: Record<string, string> = {};
                for (const col of columns) newRow[col.key] = "";
                onChange([...rows, newRow]);
              }}
              className="self-start text-sm text-text-muted hover:text-text-normal"
            >
              + Add row
            </button>
          </div>
        </div>
      );
    }
  }
}
