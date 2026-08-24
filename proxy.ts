import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

const publicRoutes = ["/login", "/signup", "/share", "/join"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublic = publicRoutes.some((r) => path === r || path.startsWith(`${r}/`));

  const sessionCookie = req.cookies.get("session")?.value;
  const payload = await decrypt(sessionCookie);

  if (!isPublic && !payload?.userId) {
    const next = encodeURIComponent(path + req.nextUrl.search);
    return NextResponse.redirect(new URL(`/login?next=${next}`, req.nextUrl));
  }

  if (isPublic && payload?.userId && path === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
