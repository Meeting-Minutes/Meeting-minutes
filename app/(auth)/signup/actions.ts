"use server";

import { createUser } from "@/lib/auth";
import { createSession } from "@/lib/session";
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

  let user;
  try {
    user = await createUser(name, email, password);
  } catch {
    return { error: "An account with this email already exists" };
  }

  await createSession(user.id);
  redirect(next);
}
