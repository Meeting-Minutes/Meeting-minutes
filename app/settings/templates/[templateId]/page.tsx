"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Text (multi-line)" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Checkbox" },
  { value: "select", label: "Dropdown" },
  { value: "table", label: "Table (rows)" },
];

type Field = {
  name: string; label: string; type: string;
  config?: { options?: string[]; columns?: { key: string; label: string }[] };
};

type TemplateData = {
  id?: string;
  name: string;
  description: string;
  fields: Field[];
  texPath?: string | null;
  templateSource?: string | null;
};

export default function TemplateEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const router = useRouter();
  const routeParams = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [orgId, setOrgId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<Field[]>([]);
  const [texFile, setTexFile] = useState<File | null>(null);
  const [existingTexPath, setExistingTexPath] = useState<string | null>(null);
  const [templateSource, setTemplateSource] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    searchParams.then((sp) => {
      const oid = sp.org ?? "";
      const tid = Array.isArray(routeParams.templateId)
        ? routeParams.templateId[0]
        : (routeParams.templateId ?? "");
      setOrgId(oid);
      setTemplateId(tid);
      if (!oid) return;
      if (!tid || tid === "new") {
        setIsNew(true);
        return;
      }
      setIsNew(false);
      fetch(`/api/organizations/${oid}/templates/${tid}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((t: TemplateData | null) => {
          if (!t) return;
          setName(t.name);
          setDescription(t.description ?? "");
          setFields(t.fields ?? []);
          setExistingTexPath(t.texPath ?? null);
          setTemplateSource(t.templateSource ?? null);
        })
        .catch(() => setError("Failed to load template"));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addField() {
    setFields((prev) => [
      ...prev,
      { name: `field_${prev.length + 1}`, label: "", type: "text" },
    ]);
  }

  function updateField(index: number, patch: Partial<Field>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function moveField(index: number, dir: -1 | 1) {
    setFields((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    if (!orgId || !name.trim()) return setError("Template name is required");
    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("description", description.trim());
      formData.set("fields", JSON.stringify(fields));
      if (texFile) formData.set("tex", texFile);

      const url = isNew
        ? `/api/organizations/${orgId}/templates`
        : `/api/organizations/${orgId}/templates/${templateId}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save template");
      }
      router.push(`/settings?org=${orgId}&tab=templates`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!orgId) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary text-sm text-text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      <header className="frost h-14 shrink-0 flex items-center gap-3 px-5 border-b border-border/50 z-10">
        <a
          href={`/settings?org=${orgId}&tab=templates`}
          className="group text-sm text-text-muted hover:text-text-normal transition-colors"
        >
          <span className="inline-block transition-transform duration-200 group-hover:-translate-x-0.5">←</span> Templates
        </a>
        <span className="text-text-muted/50">/</span>
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="w-5 h-5 rounded-md bg-gradient-to-br from-[#6b76ff] to-[#3d49e8] flex items-center justify-center text-white text-[10px] shadow-[0_4px_14px_-4px_rgba(88,101,242,0.7)]">
            📄
          </span>
          {isNew ? "New Template" : "Edit Template"}
        </span>
        <div className="flex-1" />
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {saving ? "Saving…" : "Save Template"}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-8 px-4 flex flex-col gap-6">
          {error && (
            <div className="animate-fade-up px-4 py-2.5 rounded-lg bg-danger/15 border border-danger/25 text-danger text-sm">{error}</div>
          )}

          <div className="animate-fade-up card-hover bg-surface border border-border/40 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-bg-input border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                placeholder="Standard Committee Meeting"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-bg-input border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none min-h-16 resize-y"
              />
            </div>
          </div>

          {/* --- fields --- */}
          <div className="animate-fade-up flex flex-col gap-3" style={{ animationDelay: "60ms" }}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                Fields
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent font-medium normal-case tracking-normal">
                  {fields.length}
                </span>
              </span>
              <button onClick={addField} className="btn-primary px-3 py-1.5 rounded-lg text-xs font-semibold text-white">
                + Add field
              </button>
            </div>

            {fields.map((field, i) => (
              <div
                key={i}
                className="card-hover rounded-xl border border-border/40 bg-surface/50 p-4 flex flex-col gap-3 animate-fade-up"
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-md bg-gradient-to-br from-surface to-bg-tertiary border border-border/50 flex items-center justify-center text-[10px] font-bold text-text-muted">
                    {i + 1}
                  </span>
                  <input
                    value={field.name}
                    onChange={(e) => updateField(i, { name: e.target.value.replace(/\s+/g, "_") })}
                    className="flex-1 bg-bg-input border border-border rounded-lg px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none font-mono"
                    placeholder="field_name"
                  />
                  <input
                    value={field.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                    className="flex-1 bg-bg-input border border-border rounded-lg px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
                    placeholder="Display label"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => {
                      const type = e.target.value;
                      const patch: Partial<Field> = { type };
                      if (type === "select") patch.config = { options: [] };
                      if (type === "table") patch.config = { columns: [{ key: "col_1", label: "Column 1" }] };
                      updateField(i, patch);
                    }}
                    className="bg-bg-input border border-border rounded-lg px-2 py-1.5 text-sm focus:border-accent focus:outline-none cursor-pointer"
                  >
                    {FIELD_TYPES.map((ft) => (
                      <option key={ft.value} value={ft.value}>{ft.label}</option>
                    ))}
                  </select>
                  <div className="flex flex-col shrink-0">
                    <button onClick={() => moveField(i, -1)} disabled={i === 0} className="text-text-muted hover:text-text-normal disabled:opacity-30 text-[9px] px-0.5 leading-none">▲</button>
                    <button onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} className="text-text-muted hover:text-text-normal disabled:opacity-30 text-[9px] px-0.5 leading-none mt-0.5">▼</button>
                  </div>
                  <button onClick={() => removeField(i)} className="text-text-muted hover:text-danger text-sm px-1 shrink-0" title="Remove field">✕</button>
                </div>

                {/* select options editor */}
                {field.type === "select" && (
                  <div className="flex gap-2 items-center animate-fade-up">
                    <span className="text-xs text-text-muted shrink-0">Options:</span>
                    <input
                      value={(field.config?.options ?? []).join(", ")}
                      onChange={(e) =>
                        updateField(i, {
                          config: { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) },
                        })
                      }
                      className="flex-1 bg-bg-input border border-border rounded-lg px-2.5 py-1 text-xs focus:border-accent focus:outline-none"
                      placeholder="Option A, Option B"
                    />
                  </div>
                )}

                {/* table columns editor */}
                {field.type === "table" && (
                  <div className="flex flex-col gap-1.5 ml-7 animate-fade-up">
                    <span className="text-xs text-text-muted">Columns:</span>
                    {(field.config?.columns ?? []).map((col, ci) => (
                      <div key={ci} className="flex items-center gap-2">
                        <input
                          value={col.key}
                          onChange={(e) => {
                            const cols = [...(field.config?.columns ?? [])];
                            cols[ci] = { ...col, key: e.target.value.replace(/\s+/g, "_") };
                            updateField(i, { config: { columns: cols } });
                          }}
                          className="w-32 bg-bg-input border border-border rounded-lg px-2 py-1 text-xs focus:border-accent focus:outline-none font-mono"
                          placeholder="key"
                        />
                        <input
                          value={col.label}
                          onChange={(e) => {
                            const cols = [...(field.config?.columns ?? [])];
                            cols[ci] = { ...col, label: e.target.value };
                            updateField(i, { config: { columns: cols } });
                          }}
                          className="flex-1 bg-bg-input border border-border rounded-lg px-2 py-1 text-xs focus:border-accent focus:outline-none"
                          placeholder="Label"
                        />
                        <button
                          onClick={() => {
                            const cols = (field.config?.columns ?? []).filter((_, j) => j !== ci);
                            updateField(i, { config: { columns: cols } });
                          }}
                          className="text-text-muted hover:text-danger text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const cols = [...(field.config?.columns ?? [])];
                        cols.push({ key: `col_${cols.length + 1}`, label: "" });
                        updateField(i, { config: { columns: cols } });
                      }}
                      className="self-start text-xs text-accent hover:text-accent-hover transition-colors"
                    >
                      + Add column
                    </button>
                  </div>
                )}
              </div>
            ))}
            {fields.length === 0 && (
              <div className="text-sm text-text-muted px-1">No fields yet — add one to start.</div>
            )}
          </div>

          {/* --- tex file upload --- */}
          <div className="animate-fade-up card-hover bg-surface border border-border/40 rounded-2xl p-5 flex flex-col gap-3" style={{ animationDelay: "100ms" }}>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Template File (.hbs or .html)</label>
            {existingTexPath && (
              <div className="text-xs text-text-muted">
                Current file: <code className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary border border-border/50">{existingTexPath.split("/").pop()}</code>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".hbs,.html"
              onChange={(e) => setTexFile(e.target.files?.[0] ?? null)}
              className="text-sm text-text-muted file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-accent/30 file:text-sm file:bg-accent/10 file:text-accent hover:file:bg-accent/20 hover:file:border-accent/50 transition-all file:transition-all cursor-pointer"
            />
            {texFile && (
              <span className="text-xs text-accent">New file: {texFile.name}</span>
            )}
            <p className="text-xs text-text-muted leading-relaxed">
              <code>{`{{field}}`}</code> values,{" "}
              <code>{`{{#each list}}...{{/each}}`}</code> loops,{" "}
              <code>{`{{#if field}}...{{/if}}`}</code> conditions.{" "}
              Also <code>{`{{#if (eq field "value")}}`}</code>,{" "}
              <code>{`{{#if (not field)}}`}</code>,{" "}
              <code>{`{{#if (has list)}}`}</code>.
            </p>
          </div>

          {/* --- template source preview --- */}
          {templateSource && (
            <div className="animate-fade-up flex flex-col gap-2" style={{ animationDelay: "140ms" }}>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Template Source</label>
              <pre className="bg-bg-tertiary border border-border/50 rounded-xl p-4 text-xs font-mono text-text-muted overflow-auto max-h-64 whitespace-pre-wrap">{templateSource}</pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
