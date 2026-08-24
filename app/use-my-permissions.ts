"use client";

import { useCallback, useEffect, useState } from "react";

type PermState = {
  orgId: string | null;
  orgKeys: Set<string>;
  teamKeys: Record<string, Set<string>>;
};

/** Effective permission keys for one org (mirrors the API's hasPermission:
 *  key present OR superuser). UI-only gate — the API still enforces for real.
 *  `ready` stays false while loading AND when `orgId` changes mid-flight,
 *  so stale keys from a previous org can never pass a check. */
export function useMyPermissions(orgId: string | null | undefined) {
  const [state, setState] = useState<PermState>({
    orgId: null,
    orgKeys: new Set(),
    teamKeys: {},
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    let alive = true;
    fetch(`/api/me/permissions?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setState({
          orgId,
          orgKeys: new Set(d.orgKeys ?? []),
          teamKeys: Object.fromEntries(
            Object.entries((d.teamKeys ?? {}) as Record<string, string[]>).map(
              ([k, v]) => [k, new Set(v)],
            ),
          ),
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [orgId, version]);

  // Call after any action that can change who holds which role (creating
  // teams, adding/removing members, editing roles) — otherwise newly created
  // teams and self-permission changes leave stale hidden controls.
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const can = useCallback(
    (key: string, teamId?: string | null) => {
      if (state.orgId !== orgId) return false;
      const keys = teamId ? state.teamKeys[teamId] : state.orgKeys;
      return !!keys && (keys.has(key) || keys.has("superuser"));
    },
    [state, orgId],
  );

  const ready = state.orgId === orgId && !!orgId;

  return { ready, can, refresh };
}
