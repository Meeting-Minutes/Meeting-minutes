import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shares, minutes, meetings, templates } from "@/db/schema";
import { renderTemplate } from "@/lib/render-pdf";

function formatValue(v: unknown): string {
  if (Array.isArray(v)) {
    const cols = Object.keys(v[0] ?? {});
    return v
      .map((row) => cols.map((c) => (row as Record<string, unknown>)[c]).join(" | "))
      .join("\n");
  }
  return String(v ?? "");
}

function Fallback({ title, content }: { title: string; content: Record<string, unknown> }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>
      {Object.entries(content).map(([k, v]) => (
        <div key={k} className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{k}</div>
          <div className="text-sm whitespace-pre-wrap text-gray-800">{formatValue(v)}</div>
        </div>
      ))}
    </div>
  );
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [share] = await db
    .select()
    .from(shares)
    .where(eq(shares.token, token))
    .limit(1);
  if (!share) notFound();

  const [minutesRow] = await db
    .select()
    .from(minutes)
    .where(eq(minutes.id, share.minutesId))
    .limit(1);
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, share.minutesId))
    .limit(1);
  const [template] = minutesRow?.templateId
    ? await db
        .select()
        .from(templates)
        .where(eq(templates.id, minutesRow.templateId))
        .limit(1)
    : [null];

  const content = (minutesRow?.content ?? {}) as Record<string, unknown>;
  const title = meeting?.title ?? "Shared minutes";

  let bodyHtml: string | null = null;
  if (template?.texSource) {
    try {
      const source = template.texSource;
      bodyHtml = renderTemplate(source, content)
        .replace(/^[\s\S]*<body[^>]*>/i, "")
        .replace(/<\/body>\s*<\/html>\s*$/i, "");
    } catch {
      // template file missing — fall back to field dump
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <header className="frost h-12 shrink-0 flex items-center justify-between px-5 border-b border-border/50">
        <span className="text-sm font-semibold text-text-normal">{title}</span>
        <span className="text-xs text-text-muted">
          {share.email ? `Shared with ${share.email}` : "Shared link"}
        </span>
      </header>
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-border/40 p-8">
          {bodyHtml ? (
            <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          ) : (
            <Fallback title={title} content={content} />
          )}
        </div>
      </main>
    </div>
  );
}