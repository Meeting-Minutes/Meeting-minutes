"use client";

import { useState } from "react";

// Signed in as the wrong account for a targeted invite? Log out in place and
// reload the same join link so the page re-renders anonymously, letting the
// user create/sign in with the invited address.
export default function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.reload();
    }
  }

  return (
    <button
      onClick={logout}
      disabled={busy}
      className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-text-muted hover:text-text-normal hover:bg-surface/60 transition-colors disabled:opacity-60"
    >
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
