import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error("NEXT_PUBLIC_API_URL is not set");
  const r = await fetch(`${base}/api/health`, { cache: "no-store" });
  const data = await r.json();
  return NextResponse.json(data);
}
