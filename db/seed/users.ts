import { randomUUID } from "node:crypto";
import { hashSync } from "bcryptjs";
import { db } from "../index";
import { users } from "../schema";

export async function seedUsers() {
  const passwordHash = hashSync("password123", 10);

  await db
    .insert(users)
    .values({
      id: randomUUID(),
      email: "admin@example.com",
      name: "Admin User",
      passwordHash,
    })
    .onConflictDoNothing();
}
