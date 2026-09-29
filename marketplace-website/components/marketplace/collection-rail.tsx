"use client";

/**
 * Trending collections rail — a horizontal scroll row with navigation
 * arrows and snap positioning. Collections ordered by live listings.
 * Floor and volume render from collection stats when available (demo mode);
 * otherwise the rail stays honest and omits them.
 */

import { useRef } from "react";
import Link from "next/link";
import { BadgeCheck, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { Artwork } from "@/components/ui/artwork";
import { resolveImageUrl, formatSol } from "@/lib/format";
import type { MarketplaceCollection } from "@/lib/api/types";
import type { DemoCollectionStats } from "@/lib/demo-marketplace-data";

export interface RailEntry {
  collection: MarketplaceCollection;
  activeListings: number;
  stats?: DemoCollectionStats | null;
}

export function CollectionRail({ entries }: { entries: RailEntry[] }) {
  const railRef = useRef<HTMLDivElement>(null);

  const nudge = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.72) * dir;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  if (entries.length === 0) {
    return (
      <div className="empty" role="status">
        <div className="empty-mark" aria-hidden>
          <Layers size={18} />
        </div>
        <h3>No collections yet</h3>
        <p>
          When collections are registered on the marketplace they will appear
          here, ranked by live listings.
        </p>
      </div>
    );
  }

  return (
    <div className="rail-wrap">
      {entries.length > 3 && (
        <div className="rail-nav" role="group" aria-label="Scroll collections">
          <button
            type="button"
            className="icon-btn"
            aria-label="Scroll back"
            onClick={() => nudge(-1)}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Scroll forward"
            onClick={() => nudge(1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <div
        ref={railRef}
        className="rail"
        role="list"
        aria-label="Trending collections"
      >
        {entries.map(({ collection, activeListings, stats }, i) => {
          const verified = collection.verification_status === "verified";
          return (
            <Link
              key={collection.slug}
              href={`/collections/${collection.slug}`}
              className="rail-card"
              role="listitem"
              aria-label={`View collection ${collection.name}`}
            >
              <div className="rail-media">
                <Artwork
                  src={resolveImageUrl(collection.image)}
                  alt={collection.name}
                  sizes="300px"
                  priority={i < 3}
                />
                {stats && (
                  <span className="rail-floor">
                    Floor {formatSol(stats.floorLamports)}
                  </span>
                )}
              </div>
              <div className="rail-body">
                <h3>
                  <span className="rn">{collection.name}</span>
                  {verified && (
                    <BadgeCheck
                      size={14}
                      style={{ color: "var(--accent)", flex: "none" }}
                      aria-label="Verified"
                    />
                  )}
                </h3>
                <span className="rail-sub">
                  {stats
                    ? `Vol ${formatSol(stats.volumeLamports)} · ${stats.sales24h} sales today`
                    : `${verified ? "Verified" : "Unverified"} · ${collection.standard}`}
                </span>
                <div className="rail-foot">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Layers size={12} style={{ color: "var(--accent)" }} />
                    <span className="mono">{activeListings}</span> live
                  </span>
                  <span className="rail-live" aria-hidden="true">
                    <span className="status-dot" />
                    Active
                  </span>
                  <ChevronRight size={13} aria-hidden />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
