"use client";

/**
 * Flagship collection spotlight.
 *
 * One intentional panel: large real collection artwork with the real PFP as the
 * identity mark, then name, verification, description and a compact metric
 * strip (floor / volume / 24h / items) plus the live listed count.
 *
 * Hover is CSS only — a crop shift, a brightness response and an amber edge.
 * No pointer listeners, no per-frame reads, no backdrop blur.
 */

import Link from "next/link";
import {
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Layers,
} from "lucide-react";
import { Artwork } from "@/components/ui/artwork";
import { resolveImageUrl, formatSol } from "@/lib/format";
import { demoCollectionMedia } from "@/lib/demo-marketplace-data";
import type { MarketplaceCollection } from "@/lib/api/types";
import type { DemoCollectionStats } from "@/lib/demo-marketplace-data";

export function FeaturedCollectionCard({
  collection,
  activeListings,
  stats,
  index,
}: {
  collection: MarketplaceCollection;
  activeListings: number | null;
  stats?: DemoCollectionStats | null;
  index?: number;
}) {
  const verified = collection.verification_status === "verified";
  const media = demoCollectionMedia(collection.slug);
  const artwork = media?.artwork ?? resolveImageUrl(collection.image);
  // The PFP is a separate identity mark only when distinct artwork exists.
  const pfp = media?.pfp ?? null;
  const change = stats?.change24hPercent ?? null;

  return (
    <Link
      href={`/collections/${collection.slug}`}
      className="fc-card"
      aria-label={`View collection ${collection.name}`}
    >
      <div className="fc-media">
        <Artwork
          src={artwork}
          alt={collection.name}
          sizes="(max-width: 760px) 100vw, 480px"
          priority={index === 0}
        />
        {pfp && (
          <span className="fc-pfp" aria-hidden="true">
            <Artwork src={pfp} alt="" sizes="72px" />
          </span>
        )}
      </div>

      <div className="fc-body">
        <span className="fc-eyebrow">
          {collection.flagship ? "Flagship collection" : "Featured collection"}
        </span>

        <h3>
          {collection.name}
          {verified && (
            <BadgeCheck size={17} style={{ color: "var(--accent)" }} aria-label="Verified" />
          )}
        </h3>

        {collection.description && <p className="fc-desc">{collection.description}</p>}

        {stats ? (
          <dl className="fc-stats">
            <div>
              <dt>Floor</dt>
              <dd>{formatSol(stats.floorLamports)}</dd>
            </div>
            <div>
              <dt>Volume</dt>
              <dd>{formatSol(stats.volumeLamports)}</dd>
            </div>
            <div>
              <dt>24h</dt>
              <dd data-change={change !== null && change >= 0 ? "up" : "down"}>
                {change !== null &&
                  (change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />)}
                {change !== null ? `${Math.abs(change).toFixed(1)}%` : "—"}
              </dd>
            </div>
            <div>
              <dt>Items</dt>
              <dd>{stats.supply.toLocaleString("en-US")}</dd>
            </div>
          </dl>
        ) : (
          <div className="fc-meta">
            {verified && <span className="badge badge-gold">Verified</span>}
            <span className="badge">{collection.standard}</span>
          </div>
        )}

        <div className="fc-foot">
          <span style={{ minWidth: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
            {verified && <span className="badge badge-gold">Verified</span>}
            {activeListings !== null && activeListings > 0 && (
              <span className="badge">
                <Layers size={10} />
                {activeListings} listed
              </span>
            )}
          </span>
          <span className="fc-cta">
            View collection <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}
