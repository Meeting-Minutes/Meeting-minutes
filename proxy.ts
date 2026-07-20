import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

const protectedRoutes = ["/"];
const publicRoutes = ["/login"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtected = protectedRoutes.includes(path);
  const isPublic = publicRoutes.includes(path);

  const sessionCookie = req.cookies.get("session")?.value;
  const payload = await decrypt(sessionCookie);

  if (isProtected && !payload?.userId) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isPublic && payload?.userId && path === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
