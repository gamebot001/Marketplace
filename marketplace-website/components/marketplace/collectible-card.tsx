"use client";

/**
 * Premium collectible card — collection-page gallery treatment.
 *
 * Artwork dominates (square crop, full-bleed), metadata stays lean:
 * a listed chip, the piece name, then price + status. On hover the card lifts,
 * the artwork scales, a cursor illumination tracks the pointer (CSS vars only —
 * no per-frame layout reads), and a view arrow appears.
 *
 * Clicking opens the in-page overlay (onSelect) instead of navigating away, so
 * exploring a piece never leaves the collection. The collection page is the
 * only caller, so this is scoped to it rather than altering the shared
 * .nft-card used across explore/home.
 */

import { useCallback, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Artwork } from "@/components/ui/artwork";
import { formatSol } from "@/lib/format";
import type { ListingView } from "@/lib/marketplace/views";
import styles from "./collection-view.module.css";

export function CollectibleCard({
  view,
  priority = false,
  onSelect,
}: {
  view: ListingView;
  priority?: boolean;
  onSelect: (view: ListingView) => void;
}) {
  const { listing } = view;
  const mediaRef = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = mediaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty(
      "--px",
      `${(((e.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`
    );
    el.style.setProperty(
      "--py",
      `${(((e.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`
    );
    el.style.setProperty("--glow", "1");
  }, []);

  const onLeave = useCallback(() => {
    mediaRef.current?.style.setProperty("--glow", "0");
  }, []);

  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => onSelect(view)}
      aria-label={`${view.name} — ${formatSol(listing.price_lamports)}`}
    >
      <div
        className={styles.cardMedia}
        ref={mediaRef}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {listing.status === "active" && (
          <span className={`badge badge-gold ${styles.cardChip}`}>
            <span className="status-dot" aria-hidden />
            Listed
          </span>
        )}
        <span className={styles.cardArrow} aria-hidden="true">
          <ArrowUpRight size={14} />
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
