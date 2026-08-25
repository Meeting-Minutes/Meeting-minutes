"use server";

import { createUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function signup(_prev: unknown, formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  // Only relative paths — never redirect off-site via ?next=.
  const nextRaw = formData.get("next");
  const next = typeof nextRaw === "string" && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";


  if (!name || !email || !password) {
    return { error: "Name, email and password are required" };
  }

  try {
    await createUser(name, email, password);
  } catch {
    return { error: "An account with this email already exists" };
  }

  // Don't auto-establish a session: send the new user to sign in. Carrying
  // `next` means an invite signup lands back on the join page after login.
  redirect(next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login");
}
