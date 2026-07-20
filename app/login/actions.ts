"use server";

import { verifyCredentials } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { redirect } from "next/navigation";

export async function login(_prev: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    return { error: "Invalid email or password" };
  }

  await createSession(user.id);
  redirect("/");
}
