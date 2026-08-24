"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcceptButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/join/${token}`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed to accept invite");
      router.push("/");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-2">
      <button
        onClick={accept}
        disabled={busy}
        className="btn-primary py-2.5 px-4 rounded-lg text-white font-semibold disabled:opacity-60"
      >
        {busy ? "Joining…" : "Accept invite"}
      </button>
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}
