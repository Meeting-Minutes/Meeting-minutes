// Self-check for shares + bulk member add — `bun run db:check:shares`.
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  organizations,
  users,
  memberships,
  meetings,
  minutes,
  shares,
} from "../db/schema";

function q(s = 8) {
  return crypto.randomUUID().slice(0, s);
}

async function main() {
  const orgId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const meetingId = crypto.randomUUID();

  await db.insert(organizations).values({
    id: orgId,
    name: "ShareCheck Org",
    slug: `sharecheck-${q(8)}`,
  });
  await db.insert(users).values({
    id: userId,
    email: `founder_${q()}@test`,
    name: "Founder",
  });
  await db.insert(meetings).values({
    id: meetingId,
    orgId,
    title: "ShareCheck Meeting",
    scheduledAt: new Date(),
  });
  await db.insert(minutes).values({
    id: meetingId,
    status: "published",
    content: { title: "Hello" },
  });

  // --- Share create + resolve-by-token (the public page's query) ---
  const emailShare = (
    await db
      .insert(shares)
      .values({
        id: crypto.randomUUID(),
        minutesId: meetingId,
        token: randomBytes(16).toString("base64url"),
        email: "ext@example.com",
        createdBy: userId,
      })
      .returning()
  )[0];
  const anonShare = (
    await db
      .insert(shares)
      .values({
        id: crypto.randomUUID(),
        minutesId: meetingId,
        token: randomBytes(16).toString("base64url"),
        email: null,
        createdBy: userId,
      })
      .returning()
  )[0];

  const [found] = await db
    .select()
    .from(shares)
    .where(eq(shares.token, emailShare.token))
    .limit(1);
  console.assert(
    found?.minutesId === meetingId,
    "FAIL: token lookup should resolve the shared minutes",
  );

  const [row] = await db
    .select()
    .from(minutes)
    .where(eq(minutes.id, found.minutesId))
    .limit(1);
  console.assert(
    (row?.content as { title: string }).title === "Hello",
    "FAIL: resolved minutes should expose content for rendering",
  );
  console.assert(
    anonShare.email === null,
    "FAIL: anonymous share must have null recipient email",
  );
  console.log("OK: share tokens resolve to their minutes (email + anonymous)");

  // --- Cascade: deleting minutes removes its shares ---
  await db.delete(minutes).where(eq(minutes.id, meetingId));
  const [gone] = await db
    .select()
    .from(shares)
    .where(eq(shares.minutesId, meetingId));
  console.assert(
    gone === undefined,
    "FAIL: deleting minutes must cascade-delete its shares",
  );
  console.log("OK: shares cascade-delete with their minutes");

  // --- Bulk member-add semantics: create missing, reuse existing, skip members, dedupe ---
  await db.insert(minutes).values({
    id: meetingId,
    content: {},
  });
  const emailA = `bulk_a_${q()}@test`;
  const emailB = `bulk_b_${q()}@test`;
  await db.insert(users).values({ id: crypto.randomUUID(), email: emailA, name: "A" });
  await db.insert(memberships).values({
    userId: (await db.select().from(users).where(eq(users.email, emailA)).limit(1))[0].id,
    organizationId: orgId,
    roleId: null,
  });

  // Same dedupe as the route: unique by lowercased email.
  const unique = [
    ...new Map(
      [emailA, emailB, emailA].map((e) => [e.toLowerCase(), e]),
    ).values(),
  ];
  console.assert(unique.length === 2, "FAIL: duplicate emails should be deduped");

  const alreadyMembers: string[] = [];
  let createdB = false;
  for (const email of unique) {
    let [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!u) {
      await db.insert(users).values({ id: crypto.randomUUID(), email, name: email });
      u = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
      if (email === emailB) createdB = true;
    }
    const [m] = await db
      .insert(memberships)
      .values({ userId: u.id, organizationId: orgId, roleId: null })
      .onConflictDoNothing()
      .returning();
    if (!m) alreadyMembers.push(email);
  }
  console.assert(
    alreadyMembers.length === 1 && alreadyMembers[0] === emailA,
    "FAIL: already-member should be skipped, not duplicated",
  );
  console.assert(createdB, "FAIL: missing user should be created");
  console.log("OK: bulk add creates/reuses users and skips existing members");

  // --- Cleanup ---
  await db.delete(memberships).where(eq(memberships.organizationId, orgId));
  await db.delete(minutes).where(eq(minutes.id, meetingId));
  await db.delete(meetings).where(eq(meetings.id, meetingId));
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(users).where(eq(users.email, emailB));
  await db.delete(users).where(eq(users.email, emailA));
  await db.delete(organizations).where(eq(organizations.id, orgId));

  console.log("\nAll share/bulk checks passed");
  process.exit(0);
}

main().catch((err) => {
  console.error("Share/bulk check failed:", err);
  process.exit(1);
});