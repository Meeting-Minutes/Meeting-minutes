import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

const PROTECTED = ["/settings", "/meetings"];
const PUBLIC = ["/login", "/signup"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC.some((p) => path.startsWith(p))) return NextResponse.next();

  const isProtected = path === "/" || PROTECTED.some((p) => path.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const sessionCookie = req.cookies.get("session")?.value;
  const payload = await decrypt(sessionCookie);

  if (!payload?.userId) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
