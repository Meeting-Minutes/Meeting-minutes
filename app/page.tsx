"use client";

import { useEffect, useState } from "react";

type Org = { id: string; name: string; createdAt: string };

export default function Home() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");

  const load = () =>
    fetch("/api/organizations")
      .then((r) => r.json())
      .then(setOrgs);

  useEffect(() => {
    load();
  }, []);

  const addOrg = async () => {
    if (!name.trim()) return;
    await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    load();
  };

  return (
    <main style={{ padding: 32, fontFamily: "sans-serif" }}>
      <h1>Organizations</h1>
      <div style={{ marginBottom: 16 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Org name"
          style={{ marginRight: 8 }}
        />
        <button onClick={addOrg}>Add</button>
      </div>
      <ul>
        {orgs.map((o) => (
          <li key={o.id}>{o.name}</li>
        ))}
      </ul>
    </main>
  );
}
