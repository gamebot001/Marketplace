"use client";

/**
 * Premium collectible card — collection-page gallery treatment.
 *
 * Artwork dominates (square crop, full-bleed), metadata stays lean:
 * a listed chip, the piece name, then price + status. On hover the card lifts,
 * the artwork scales and a view arrow appears.
 *
 * Clicking opens the shared in-context NFT quick view instead of navigating
 * away, so exploring a piece never leaves the collection. The collection page
 * is the only caller, so this is scoped to it rather than altering the shared
 * .nft-card used across explore/home.
 */

import { ArrowUpRight, Heart } from "lucide-react";
import { Artwork } from "@/components/ui/artwork";
import { formatSol } from "@/lib/format";
import type { ListingView } from "@/lib/marketplace/views";
import { useNftQuickView } from "@/components/marketplace/nft-quick-view";
import { useWatchlist } from "@/components/marketplace/watchlist";
import styles from "./collection-view.module.css";

export function CollectibleCard({
  view,
  priority = false,
}: {
  view: ListingView;
  priority?: boolean;
}) {
  const { listing } = view;
  const { open } = useNftQuickView();
  const { has, toggle } = useWatchlist();
  const faved = has(listing.asset_address);

  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => open({ address: listing.asset_address, view })}
      aria-label={`${view.name} — ${formatSol(listing.price_lamports)}`}
    >
      <div className={styles.cardMedia}>
        {listing.status === "active" && (
          <span className={`badge badge-gold ${styles.cardChip}`}>
            <span className="status-dot" aria-hidden />
            Listed
          </span>
        )}
        <span className={styles.cardArrow} aria-hidden="true">
          <ArrowUpRight size={14} />
        </span>
        <span
          className={styles.cardWatch}
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
        <Artwork
          src={view.image}
          alt={view.name}
          priority={priority}
          sizes="(max-width: 560px) 50vw, (max-width: 860px) 50vw, (max-width: 1080px) 33vw, 25vw"
        />
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardName} title={view.name}>
          {view.name}
        </div>

        <div className={styles.cardFoot}>
          <div>
            <span className={styles.cardLabel}>
              {listing.status === "active" ? "Price" : "Last price"}
            </span>
            <span className={styles.cardValue}>
              {formatSol(listing.price_lamports)}
            </span>
          </div>
          <span className={styles.cardStatus} data-status={listing.status}>
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
    </button>
  );
}
