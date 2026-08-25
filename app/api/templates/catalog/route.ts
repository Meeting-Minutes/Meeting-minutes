import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { STARTER_TEMPLATES } from "@/lib/starter-templates";

// Built-in starter templates an admin can add into an org. The catalog is
// global (not org-scoped) — copying one in is what makes it org-owned.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(
    STARTER_TEMPLATES.map((t) => ({
      key: t.key,
      name: t.name,
      description: t.description,
      fieldCount: t.fields.length,
    })),
  );
}
