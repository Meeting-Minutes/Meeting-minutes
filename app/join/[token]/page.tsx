import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invitations, organizations, roles, teams } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isExpired } from "@/lib/invitations";
import ThemeToggle from "@/app/theme-toggle";
import AcceptButton from "./accept-button";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [invite] = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
      orgName: organizations.name,
      teamName: teams.name,
      roleName: roles.name,
    })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .leftJoin(teams, eq(teams.id, invitations.teamId))
    .leftJoin(roles, eq(roles.id, invitations.roleId))
    .where(eq(invitations.token, token))
    .limit(1);

  const user = await getCurrentUser();
  const expired = !invite || isExpired(invite) || (!!invite.acceptedAt && !!invite.email);
  const wrongUser =
    !!invite && !!user && !!invite.email && invite.email !== user.email.toLowerCase();

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-bg-tertiary px-4">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>
      <div className="animate-pop-in bg-bg-primary w-full max-w-sm p-8 rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] border border-border/40 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/30 to-success/15 flex items-center justify-center mx-auto mb-4 shadow-[0_8px_24px_-8px_rgba(88,101,242,0.6)]">
          <span className="text-accent text-lg font-bold">M</span>
        </div>

        {!invite || expired ? (
          <>
            <h1 className="text-xl font-semibold">Invite unavailable</h1>
            <p className="text-text-muted text-sm mt-2">
              This invite link is invalid, expired, or has already been used.
              Ask an organization admin for a new one.
            </p>
          </>
        ) : wrongUser ? (
          <>
            <h1 className="text-xl font-semibold">Wrong account</h1>
            <p className="text-text-muted text-sm mt-2">
              This invite was sent to <strong>{invite.email}</strong>, but you
              are signed in as <strong>{user!.email}</strong>. Sign in with the
              invited account and open the link again.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">
              Join {invite.orgName}
            </h1>
            <p className="text-text-muted text-sm mt-2">
              You&rsquo;ve been invited{invite.teamName ? ` to the ${invite.teamName} team` : ""}
              {invite.roleName ? ` with the ${invite.roleName} role` : ""}.
            </p>
            {user ? (
              <AcceptButton token={token} />
            ) : (
              <div className="mt-5 flex flex-col gap-2">
                <Link
                  href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}
                  className="btn-primary block py-2.5 px-4 rounded-lg text-white font-semibold"
                >
                  Sign in to accept
                </Link>
                <Link
                  href={`/signup?next=${encodeURIComponent(`/join/${token}`)}`}
                  className="block py-2.5 px-4 rounded-lg border border-border text-sm text-text-normal hover:bg-surface/50 transition-colors"
                >
                  Create an account
                </Link>
                {invite.email && (
                  <p className="text-xs text-text-muted mt-1">
                    Use the address this invite was sent to: {invite.email}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
