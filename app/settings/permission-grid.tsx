"use client";

export type Perm = { id: string; key: string; description: string | null };

export function PermissionGrid({
  perms,
  selected,
  onToggle,
}: {
  perms: Perm[];
  selected: string[];
  onToggle: (permId: string, on: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
      {perms.map((p, i) => {
        const on = selected.includes(p.id);
        return (
          <label
            key={p.id}
            className={`card-hover flex items-start gap-3 px-3.5 py-3 rounded-xl border text-sm cursor-pointer transition-colors animate-fade-up ${
              on
                ? "border-accent/30 bg-gradient-to-br from-accent/10 to-accent/5"
                : "border-border/40 bg-surface/50 hover:border-border"
            }`}
            style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }}
          >
            <input
              type="checkbox"
              checked={on}
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
  );
}