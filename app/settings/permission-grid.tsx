"use client";

export type Perm = { id: string; key: string; description: string | null };

export function PermissionGrid({
  perms,
  selected,
  onToggle,
  readOnly = false,
}: {
  perms: Perm[];
  selected: string[];
  onToggle: (permId: string, on: boolean) => void;
  readOnly?: boolean;
}) {
  const allOn = perms.length > 0 && perms.every((p) => selected.includes(p.id));

  function toggleAll() {
    const next = !allOn;
    for (const p of perms) onToggle(p.id, next);
  }

  return (
    <div>
      {!readOnly && perms.length > 0 && (
        <button
          type="button"
          onClick={toggleAll}
          className="mb-3 flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-text-normal transition-colors select-none"
        >
          <span
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              allOn
                ? "bg-accent border-accent text-white"
                : "border-border bg-bg-input"
            }`}
          >
            {allOn && (
              <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2 6 5 9 10 3" />
              </svg>
            )}
          </span>
          {allOn ? "Clear all" : "Select all"}
        </button>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
      {perms.map((p, i) => {
        const on = selected.includes(p.id);
        return (
          <label
            key={p.id}
            className={`card-hover flex items-start gap-3 px-3.5 py-3 rounded-xl border text-sm transition-colors animate-fade-up ${
              readOnly ? "cursor-default" : "cursor-pointer"
            } ${
              on
                ? "border-accent/30 bg-gradient-to-br from-accent/10 to-accent/5"
                : "border-border/40 bg-surface/50 hover:border-border"
            }`}
            style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }}
          >
            <input
              type="checkbox"
              checked={on}
              disabled={readOnly}
              onChange={(e) => onToggle(p.id, e.target.checked)}
              className="mt-0.5 accent-[var(--color-accent)]"
            />
            <span className="min-w-0">
              <span className={`block font-medium truncate ${on ? "text-accent" : "text-text-normal"}`}>
                {p.key}
              </span>
              {p.description && (
                <span className="block text-xs text-text-muted mt-0.5">{p.description}</span>
              )}
            </span>
          </label>
        );
      })}
      </div>
    </div>
  );
}