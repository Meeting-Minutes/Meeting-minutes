import { db } from "../db";
import { organizations } from "../db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const [inserted] = await db
    .insert(organizations)
    .values({ name: "Test Org" })
    .returning();
  console.assert(inserted.name === "Test Org", "insert failed");

  const [found] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, inserted.id));
  console.assert(found?.id === inserted.id, "select failed");

  await db.delete(organizations).where(eq(organizations.id, inserted.id));
  const [gone] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, inserted.id));
  console.assert(gone === undefined, "delete failed");

  console.log("DB round-trip works: insert, select, delete all confirmed");
  process.exit(0);
}

main().catch((err) => {
  console.error("DB check failed:", err);
  process.exit(1);
});
