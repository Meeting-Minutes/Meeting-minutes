import { randomUUID } from "node:crypto";
import { hashSync } from "bcryptjs";
import { db } from "../index";
import { users } from "../schema";

const DEMO_PW = hashSync("demodemo123", 10);

const DEMO_USERS = [
  { email: "admin@pcampus.edu.np", name: "Aarav (Admin)" },
  { email: "secretary@pcampus.edu.np", name: "Bina (Secretary)" },
  { email: "viewer@pcampus.edu.np", name: "Chirag (Viewer)" },
];

export async function seedUsers() {
  for (const u of DEMO_USERS) {
    await db
      .insert(users)
      .values({
        id: randomUUID(),
        email: u.email,
        name: u.name,
        passwordHash: DEMO_PW,
      })
      .onConflictDoNothing();
  }

  const count = await db.select().from(users);
  console.log(`Seeded ${count.length} user(s)`);
}
