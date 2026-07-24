import { NextResponse } from "next/server";
import { db } from "@/db";
import { meetings, meetingTeams, teams, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;

  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      description: meetings.description,
      scheduledAt: meetings.scheduledAt,
      location: meetings.location,
      createdAt: meetings.createdAt,
      creator: { id: users.id, name: users.name },
    })
    .from(meetings)
    .innerJoin(meetingTeams, eq(meetingTeams.meetingId, meetings.id))
    .leftJoin(users, eq(meetings.createdBy, users.id))
    .where(eq(meetingTeams.teamId, teamId))
    .orderBy(desc(meetings.scheduledAt));

  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await params;
  const { title, description, scheduledAt, location } = await req.json();

  if (!title || !scheduledAt) {
    return NextResponse.json({ error: "title and scheduledAt are required" }, { status: 400 });
  }

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const meetingId = crypto.randomUUID();

  await db.insert(meetings).values({
    id: meetingId,
    orgId: team.orgId,
    title,
    description: description || null,
    scheduledAt: new Date(scheduledAt),
    location: location || null,
    createdBy: currentUser.id,
  });

  await db.insert(meetingTeams).values({ meetingId, teamId });

  const [created] = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      description: meetings.description,
      scheduledAt: meetings.scheduledAt,
      location: meetings.location,
      createdAt: meetings.createdAt,
      creator: { id: users.id, name: users.name },
    })
    .from(meetings)
    .leftJoin(users, eq(meetings.createdBy, users.id))
    .where(eq(meetings.id, meetingId))
    .limit(1);

  return NextResponse.json(created, { status: 201 });
}
