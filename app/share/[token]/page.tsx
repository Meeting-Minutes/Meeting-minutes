import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shares, minutes, meetings, templates } from "@/db/schema";
import { renderTemplate, defaultTemplateSource } from "@/lib/render-pdf";

function stripDoc(html: string) {
  return html
    .replace(/^[\s\S]*<body[^>]*>/i, "")
    .replace(/<\/body>\s*<\/html>\s*$/i, "");
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
  const fields = (template?.fields ?? []) as Parameters<typeof defaultTemplateSource>[2];

  let bodyHtml: string | null = null;
  if (template?.texSource) {
    try {
      bodyHtml = stripDoc(renderTemplate(template.texSource, content));
    } catch {
      // broken template — fall through to generic layout
    }
  }
  bodyHtml ??= stripDoc(defaultTemplateSource(title, content, fields));

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
          <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </div>
      </main>
    </div>
  );
}