"use client";

/**
 * Artwork-first listing card.
 *
 * Structure: IMAGE (75–85% of the card) → listing badge → NAME → COLLECTION →
 * PRICE + status. Resting state is the artwork alone; on hover the piece lifts
 * 3px, the crop shifts, a cursor-following illumination warms the image, a
 * favorite mark and action arrow appear, and the price takes the accent.
 */

import { useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, Heart } from "lucide-react";
import { Artwork } from "@/components/ui/artwork";
import { VerifiedBadge } from "@/components/ui/badges";
import { formatSol } from "@/lib/format";
import type { ListingView } from "@/lib/marketplace/views";
import { useNftQuickView } from "@/components/marketplace/nft-quick-view";
import { useWatchlist } from "@/components/marketplace/watchlist";

export function NftCard({
  view,
  priority = false,
}: {
  view: ListingView;
  priority?: boolean;
}) {
  const { listing } = view;
  const mediaRef = useRef<HTMLDivElement>(null);
  const { open } = useNftQuickView();
  const { has, toggle } = useWatchlist();
  const faved = has(listing.asset_address);

  // Cursor illumination: cheap per-card handler writing CSS vars.
  const onMediaMove = useCallback((e: React.PointerEvent) => {
    const el = mediaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--px", `${(((e.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
    el.style.setProperty("--py", `${(((e.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
    el.style.setProperty("--glow", "1");
  }, []);

  const onMediaLeave = useCallback(() => {
    mediaRef.current?.style.setProperty("--glow", "0");
  }, []);

  return (
    <Link
      href={`/nft/${listing.asset_address}`}
      className="nft-card"
      aria-label={`${view.name} — ${formatSol(listing.price_lamports)}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        open({ address: listing.asset_address, view });
      }}
    >
      <div
        className="nft-media"
        ref={mediaRef}
        onPointerMove={onMediaMove}
        onPointerLeave={onMediaLeave}
      >
        {listing.status === "active" ? (
          <span className="badge badge-gold listing-chip">
            <span className="status-dot" aria-hidden />
            Listed
          </span>
        ) : (
          listing.status !== "active" && (
            <span className="badge listing-chip">{listing.status}</span>
          )
        )}
        <span
          className="nft-fav"
          role="button"
          tabIndex={-1}
          aria-pressed={faved}
          aria-label={faved ? "Remove from watchlist" : "Add to watchlist"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle(listing.asset_address);
          }}
        >
          <Heart size={13} fill={faved ? "currentColor" : "none"} aria-hidden />
        </span>
        <span className="nft-arrow" aria-hidden="true">
          <ArrowUpRight size={14} />
        </span>
        <Artwork
          src={view.image}
          alt={view.name}
          priority={priority}
          sizes="(max-width: 560px) 100vw, (max-width: 1080px) 33vw, 25vw"
        />
      </div>

      <div className="nft-body">
        <div className="nft-title">{view.name}</div>

        <div className="nft-collection">
          <span>{view.collectionName}</span>
          {view.collectionVerified && <VerifiedBadge label="" />}
        </div>

        <div className="nft-foot">
          <div className="price">
            <span className="label">
              {listing.status === "active" ? "Price" : "Last price"}
            </span>
            <span className="value">{formatSol(listing.price_lamports)}</span>
          </div>
          <span
            className="nft-status"
            data-status={listing.status}
            aria-hidden="true"
          >
            <span
              className="status-dot"
              style={{
                background:
                  listing.status === "active" ? "var(--accent)" : "var(--positive)",
              }}
            />
            {listing.status === "active" ? "On sale" : "Sold"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function NftCardSkeleton() {
  return <div className="skeleton skeleton-card" aria-hidden />;
}
