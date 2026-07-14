import express from "express";
import postgres from "postgres";

const app = express();
app.use(express.json());

const sql = postgres(process.env.DATABASE_URL!);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "Backend is running" });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    await sql`SELECT 1`;
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(503).json({
      ok: false,
      name: err instanceof Error ? err.name : undefined,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      error: err,
    });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () => {
  console.log(`Backend Listening on http://localhost:${port}`);
});
