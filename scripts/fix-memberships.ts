import { db } from "../db";

await db.execute(
  "ALTER TABLE memberships ALTER COLUMN team_id DROP NOT NULL",
);
console.log("Fixed memberships.team_id nullability");
process.exit(0);
