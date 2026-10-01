"use client";

/**
 * Page-local watchlist for the collection detail surface.
 *
 * Persists to `zecians-watchlist` (an array of asset ids) and is read once
 * after mount so server and client markup agree — no hydration mismatch. Kept
 * separate from the shared collector store on purpose: the collection page owns
 * its own state and must survive a reload without touching other routes.
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "zecians-watchlist";

export interface CollectionWatchlist {
  has: (assetId: string) => boolean;
  toggle: (assetId: string) => void;
}

export function useCollectionWatchlist(): CollectionWatchlist {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setIds(parsed.filter((value): value is string => typeof value === "string"));
        }
      }
    } catch {
      /* storage unavailable — watchlist simply starts empty */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }, [ids, ready]);

  const has = useCallback((assetId: string) => ids.includes(assetId), [ids]);
  const toggle = useCallback((assetId: string) => {
    setIds((current) =>
      current.includes(assetId)
        ? current.filter((value) => value !== assetId)
        : [assetId, ...current]
    );
  }, []);

  return { has, toggle };
}
