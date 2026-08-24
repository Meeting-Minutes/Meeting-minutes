// Self-check for shares + member add/invite — `bun run db:check:shares`.
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
  invitations,
} from "../db/schema";
import { resolveInviteTargets, isExpired } from "./invitations";

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

  // --- Member-add semantics: reuse existing members, invite unknown emails ---
  await db.insert(minutes).values({
    id: meetingId,
    content: {},
  });
  const emailA = `bulk_a_${q()}@test`;
  const emailB = `bulk_b_${q()}@test`;
  const userA = crypto.randomUUID();
  await db.insert(users).values({ id: userA, email: emailA, name: "A" });

  // Same normalization as resolveInviteTargets.
  const unique = [...new Set([emailA, emailB, emailA].map((e) => e.toLowerCase()))];
  console.assert(unique.length === 2, "FAIL: duplicate emails should be deduped");

  // First pass: known account joins directly, unknown email gets an invite.
  const { added, invited } = await resolveInviteTargets(orgId, unique, null, null, userId);
  console.assert(
    added.length === 1 &&
      added[0] === emailA &&
      invited.length === 1 &&
      invited[0].email === emailB,
    "FAIL: existing user should be added directly; unknown email should get an invite",
  );

  // Second pass: A is a member now (skipped), B just gets another link.
  const again = await resolveInviteTargets(orgId, unique, null, null, userId);
  console.assert(
    again.added.length === 0 &&
      again.invited.length === 1 &&
      again.invited[0].email === emailB,
    "FAIL: repeat pass should skip the existing member, not duplicate them",
  );

  const [invRow] = await db.select().from(invitations).where(eq(invitations.email, emailB));
  console.assert(!!invRow, "FAIL: invitation row should exist for the unknown email");
  console.assert(
    invRow && !invRow.acceptedAt && !isExpired(invRow),
    "FAIL: a fresh invitation should be pending",
  );
  const [noUser] = await db.select().from(users).where(eq(users.email, emailB));
  console.assert(!noUser, "FAIL: inviting must not create a user account");
  console.log("OK: member add reuses existing users and invites new ones via token");

  // --- Cleanup ---
  await db.delete(invitations).where(eq(invitations.organizationId, orgId));
  await db.delete(memberships).where(eq(memberships.organizationId, orgId));
  await db.delete(minutes).where(eq(minutes.id, meetingId));
  await db.delete(meetings).where(eq(meetings.id, meetingId));
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(users).where(eq(users.email, emailA));
  await db.delete(organizations).where(eq(organizations.id, orgId));

  console.log("\nAll share/bulk checks passed");
  process.exit(0);
}

main().catch((err) => {
  console.error("Share/bulk check failed:", err);
  process.exit(1);
});