"use client";

/**
 * Collector watchlist — one shared favourite store for the whole product.
 *
 * Any surface (cards, quick view, profile) reads and toggles the same set, so
 * favouriting never means a different thing on different pages. Persistence is
 * local and private (localStorage), read once after mount so server and client
 * markup agree — no hydration mismatch, no layout shift, no flicker.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Heart } from "lucide-react";

const STORAGE_KEY = "mk-watchlist";

interface WatchlistValue {
  items: string[];
  has: (assetAddress: string) => boolean;
  toggle: (assetAddress: string) => void;
}

const WatchlistContext = createContext<WatchlistValue | null>(null);

export function useWatchlist(): WatchlistValue {
  const value = useContext(WatchlistContext);
  if (!value) {
    throw new Error("useWatchlist must be used within WatchlistProvider.");
  }
  return value;
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(parsed.filter((v): v is string => typeof v === "string"));
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, ready]);

  const has = useCallback(
    (assetAddress: string) => items.includes(assetAddress),
    [items]
  );
  const toggle = useCallback((assetAddress: string) => {
    setItems((prev) =>
      prev.includes(assetAddress)
        ? prev.filter((value) => value !== assetAddress)
        : [assetAddress, ...prev]
    );
  }, []);

  const value = useMemo(
    () => ({ items, has, toggle }),
    [items, has, toggle]
  );

  return (
    <WatchlistContext.Provider value={value}>
      {children}
    </WatchlistContext.Provider>
  );
}

/** Shared watchlist control — same mark, same behaviour, every surface. */
export function WatchToggle({
  assetAddress,
  label,
  className,
  size = 13,
}: {
  assetAddress: string;
  label: string;
  className?: string;
  size?: number;
}) {
  const { has, toggle } = useWatchlist();
  const active = has(assetAddress);

  return (
    <button
      type="button"
      className={className}
      aria-pressed={active}
      aria-label={active ? `Remove ${label} from watchlist` : `Add ${label} to watchlist`}
      title={active ? "Remove from watchlist" : "Add to watchlist"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(assetAddress);
      }}
    >
      <Heart size={size} fill={active ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
