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
      <header className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-border/50 bg-bg-secondary">
        <a href={`/settings?org=${orgId}&tab=templates`} className="text-sm text-text-muted hover:text-text-normal transition-colors">
          ← Templates
        </a>
        <span className="text-sm font-semibold">{isNew ? "New Template" : "Edit Template"}</span>
        <div className="flex-1" />
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-1.5 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Template"}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto py-6 px-4 flex flex-col gap-6">
          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-danger/15 text-danger text-sm">{error}</div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-bg-input border border-border rounded px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
              placeholder="Standard Committee Meeting"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-bg-input border border-border rounded px-2 py-1.5 text-sm focus:border-accent focus:outline-none min-h-16 resize-y"
            />
          </div>

          {/* --- fields --- */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Fields</span>
              <button onClick={addField} className="text-sm text-accent hover:text-accent-hover">
                + Add field
              </button>
            </div>

            {fields.map((field, i) => (
              <div key={i} className="rounded-lg border border-border/50 bg-bg-secondary p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    value={field.name}
                    onChange={(e) => updateField(i, { name: e.target.value.replace(/\s+/g, "_") })}
                    className="flex-1 bg-bg-input border border-border rounded px-2 py-1.5 text-sm focus:border-accent focus:outline-none font-mono"
                    placeholder="field_name"
                  />
                  <input
                    value={field.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                    className="flex-1 bg-bg-input border border-border rounded px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
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
                    className="bg-bg-input border border-border rounded px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                  >
                    {FIELD_TYPES.map((ft) => (
                      <option key={ft.value} value={ft.value}>{ft.label}</option>
                    ))}
                  </select>
                  <button onClick={() => moveField(i, -1)} disabled={i === 0} className="text-text-muted hover:text-text-normal disabled:opacity-30 text-xs px-1">▲</button>
                  <button onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} className="text-text-muted hover:text-text-normal disabled:opacity-30 text-xs px-1">▼</button>
                  <button onClick={() => removeField(i)} className="text-text-muted hover:text-danger text-sm px-1">✕</button>
                </div>

                {/* select options editor */}
                {field.type === "select" && (
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-text-muted shrink-0">Options:</span>
                    <input
                      value={(field.config?.options ?? []).join(", ")}
                      onChange={(e) =>
                        updateField(i, {
                          config: { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) },
                        })
                      }
                      className="flex-1 bg-bg-input border border-border rounded px-2 py-1 text-xs focus:border-accent focus:outline-none"
                      placeholder="Option A, Option B"
                    />
                  </div>
                )}

                {/* table columns editor */}
                {field.type === "table" && (
                  <div className="flex flex-col gap-1 ml-2">
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
                          className="w-32 bg-bg-input border border-border rounded px-2 py-1 text-xs focus:border-accent focus:outline-none font-mono"
                          placeholder="key"
                        />
                        <input
                          value={col.label}
                          onChange={(e) => {
                            const cols = [...(field.config?.columns ?? [])];
                            cols[ci] = { ...col, label: e.target.value };
                            updateField(i, { config: { columns: cols } });
                          }}
                          className="flex-1 bg-bg-input border border-border rounded px-2 py-1 text-xs focus:border-accent focus:outline-none"
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
                      className="self-start text-xs text-text-muted hover:text-text-normal"
                    >
                      + Add column
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* --- tex file upload --- */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Template File (.hbs or .html)</label>
            {existingTexPath && (
              <div className="text-xs text-text-muted">
                Current file: <code className="text-[10px]">{existingTexPath.split("/").pop()}</code>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".hbs,.html"
              onChange={(e) => setTexFile(e.target.files?.[0] ?? null)}
              className="text-sm text-text-muted file:mr-3 file:px-3 file:py-1 file:rounded-md file:border-0 file:text-sm file:bg-surface file:text-text-normal hover:file:bg-surface-hover"
            />
            {texFile && (
              <span className="text-xs text-text-muted">New file: {texFile.name}</span>
            )}
            <p className="text-xs text-text-muted">
              <code>{`{{field}}`}</code> values,{" "}
              <code>{`{{#each list}}...{{/each}}`}</code> loops,{" "}
              <code>{`{{#if field}}...{{/if}}`}</code> conditions.{" "}
              Also <code>{`{{#if (eq field "value")}}`}</code>,{" "}
              <code>{`{{#if (not field)}}`}</code>,{" "}
              <code>{`{{#if (has list)}}`}</code>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
