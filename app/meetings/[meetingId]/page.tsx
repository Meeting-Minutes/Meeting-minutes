"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { renderTemplate } from "@/lib/render-pdf";

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
  } | null>(null);
  const [template, setTemplate] = useState<{ id: string; name: string; fields: Field[] } | null>(null);
  const [templateSource, setTemplateSource] = useState<string | null>(null);
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/meetings/${meetingId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setMeeting(d.meeting ?? null); })
      .catch(() => setError("Failed to load meeting"));
  }, [meetingId]);

  useEffect(() => {
    fetch(`/api/meetings/${meetingId}/minutes`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setTemplate(d.template);
        setTemplateSource(d.templateSource);
        setContent(d.content ?? {});
        setStatus(d.minutes?.status ?? "draft");
      })
      .catch(() => setError("Failed to load minutes"));
  }, [meetingId]);

  function setField(name: string, value: unknown) {
    setContent((prev) => ({ ...prev, [name]: value }));
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
    if (!templateSource) return;
    const html = renderTemplate(templateSource, content);
    setPreviewHtml(html.replace(/^[\s\S]*<body[^>]*>/i, "").replace(/<\/body>\s*<\/html>\s*$/i, ""));
  }

  async function exportPdf() {
    if (!templateSource) return;
    const html = renderTemplate(templateSource, content);
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

  if (!meeting) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary text-text-muted text-sm">
        {error || "Loading meeting…"}
      </div>
    );
  }

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
          {templateSource && (
            <>
              <button onClick={showPreview} className="px-4 py-1.5 rounded-lg border border-border text-sm text-text-normal hover:bg-surface/50 hover:border-accent/40 transition-all active:scale-95">
                Preview
              </button>
              <button onClick={exportPdf} className="btn-primary px-4 py-1.5 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M8 2v8M4.5 7L8 10.5 11.5 7M2.5 13h11" />
                </svg>
                Export PDF
              </button>
            </>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save"}
          </button>
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
            <div className="text-sm text-text-muted">This meeting has no template.</div>
          ) : template.fields.length === 0 ? (
            <div className="text-sm text-text-muted">This template has no fields defined.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {template.fields.map((field, i) => (
                <div key={field.name} className="animate-fade-up card-hover bg-surface/50 border border-border/40 rounded-xl p-4 flex flex-col gap-2" style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
                  <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    {field.label}
                  </label>
                  <FieldInput field={field} value={content[field.name]} onChange={(v) => setField(field.name, v)} />
                </div>
              ))}
            </div>
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
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
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
      return <input className={inputClass} type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
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
      );
    }
  }
}
