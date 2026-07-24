"use server";

import { createUser } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { redirect } from "next/navigation";

export async function signup(_prev: unknown, formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;


  if (!name || !email || !password) {
    return { error: "Name, email and password are required" };
  }

  const user = await createUser(name, email, password);
  if (!user) {
    return { error: "Invalid email or password" };
  }

  await createSession(user.id);
  redirect("/");
}
