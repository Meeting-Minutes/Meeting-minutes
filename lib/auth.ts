import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { decrypt } from "./session";
import { cookies } from "next/headers";

export async function verifyCredentials(email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user?.passwordHash) return null;
  const valid = await compare(password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name };
}

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const payload = await decrypt(sessionCookie);
  if (!payload?.userId) return null;

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, payload.userId))
    .limit(1);

  return user ?? null;
});

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
