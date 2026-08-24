import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL!;
const client = postgres(url, {
  prepare: false, // PgBouncer transaction-pooler compatibility (Vercel + Supabase)
  ssl: /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url) ? false : "require",
});
export const db = drizzle(client, { schema });
