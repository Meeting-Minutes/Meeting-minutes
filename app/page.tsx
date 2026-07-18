"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; email: string; name: string };

const teams = [
  { id: "1", name: "General", icon: "#" },
  { id: "2", name: "Engineering", icon: "#" },
  { id: "3", name: "Design", icon: "#" },
];

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTeam, setActiveTeam] = useState("1");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data) => setUser(data.user))
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Server bar */}
      <nav className="w-[72px] bg-bg-tertiary flex flex-col items-center gap-2 py-3 shrink-0">
        <button className="w-12 h-12 rounded-2xl bg-accent hover:rounded-xl hover:bg-accent-hover transition-all flex items-center justify-center text-white font-bold text-lg">
          M
        </button>
        <div className="w-8 h-px bg-border" />
        {teams.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTeam(t.id)}
            className={`w-12 h-12 rounded-2xl hover:rounded-xl transition-all flex items-center justify-center font-medium text-lg ${
              activeTeam === t.id
                ? "bg-accent text-white rounded-xl"
                : "bg-bg-secondary text-text-muted hover:bg-accent hover:text-white"
            }`}
          >
            {t.name[0]}
          </button>
        ))}
      </nav>

      {/* Channel sidebar */}
      <aside className="w-60 bg-bg-secondary flex flex-col shrink-0">
        <div className="h-12 flex items-center px-4 border-b border-border shadow-sm">
          <h2 className="text-base font-semibold text-text-normal truncate">
            Minutes
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <ChannelSection title="Teams">
            {teams.map((t) => (
              <ChannelItem
                key={t.id}
                icon={t.icon}
                label={t.name}
                active={activeTeam === t.id}
                onClick={() => setActiveTeam(t.id)}
              />
            ))}
          </ChannelSection>
        </div>

        {/* User area */}
        {user && (
          <div className="h-14 shrink-0 bg-bg-tertiary/50 px-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-normal truncate">
                {user.name}
              </p>
              <p className="text-xs text-text-muted truncate">{user.email}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="text-text-muted hover:text-text-normal transition-colors text-lg leading-none px-1"
            >
              &#x23fb;
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b border-border flex items-center px-4 shrink-0 bg-bg-primary">
          <span className="text-text-muted mr-2 font-semibold">#</span>
          <span className="font-semibold text-text-normal">
            {teams.find((t) => t.id === activeTeam)?.name || "General"}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <h1 className="text-2xl font-bold text-text-normal">
              Welcome{user ? `, ${user.name}` : ""}
            </h1>
            <p className="text-text-muted">
              Select a team from the sidebar to view its meetings.
            </p>

            <div className="grid gap-3 mt-8">
              <div className="bg-bg-secondary rounded-lg p-4 border border-border">
                <h3 className="text-text-normal font-medium">Recent meetings</h3>
                <p className="text-text-muted text-sm mt-1">
                  No meetings yet. Schedule your first meeting to get started.
                </p>
              </div>
              <div className="bg-bg-secondary rounded-lg p-4 border border-border">
                <h3 className="text-text-normal font-medium">Quick actions</h3>
                <div className="flex gap-2 mt-3">
                  <button className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded transition-colors">
                    New meeting
                  </button>
                  <button className="px-4 py-2 bg-bg-hover hover:bg-border text-text-normal text-sm rounded transition-colors">
                    Browse templates
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ChannelSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-2 py-1 mt-3 mb-0.5">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function ChannelItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm transition-colors ${
        active
          ? "bg-bg-hover text-text-normal"
          : "text-text-muted hover:bg-bg-hover hover:text-text-normal"
      }`}
    >
      <span className="text-text-muted w-4 text-center shrink-0 text-lg leading-none">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
