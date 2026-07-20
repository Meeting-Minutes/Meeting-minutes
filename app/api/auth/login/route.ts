import { NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/auth";
import { createSession } from "@/lib/session";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  await createSession(user.id);
  return NextResponse.json({ user });
}
