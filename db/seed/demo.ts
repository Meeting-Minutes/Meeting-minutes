import { randomUUID } from "node:crypto";
import { db } from "../index";
import { organizations, teams, memberships, users } from "../schema";
import { eq } from "drizzle-orm";

export async function seedDemo() {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, "admin@example.com"))
    .limit(1);
  if (!user) return;

  const existing = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, user.id))
    .limit(1);
  if (existing.length > 0) return;

  const orgId = randomUUID();
  await db.insert(organizations).values({
    id: orgId,
    name: "Acme Corp",
    slug: "acme-corp",
  });

  await db.insert(memberships).values({
    userId: user.id,
    organizationId: orgId,
  });

  const teamNames = ["Engineering", "Design", "Marketing", "Operations"];
  for (const name of teamNames) {
    await db.insert(teams).values({
      id: randomUUID(),
      orgId,
      name,
    });
  }

  console.log(`Seeded demo org "Acme Corp" with ${teamNames.length} teams`);
}
