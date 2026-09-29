"use client";

/**
 * Collection-scoped activity — a compact, secondary editorial list.
 *
 * Reuses the global activity feed and filters it to this collection only
 * (by collection address, or by the collection's own asset set) so the view
 * stays honest without touching the data contract. Rows keep a hairline
 * rhythm; the thumbnail, event marker, price and route carry the meaning.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity as ActivityIcon } from "lucide-react";
import { useActivity } from "@/lib/api/hooks";
import { activityLabel, type ListingView } from "@/lib/marketplace/views";
import { formatSol, relativeTime, shorten } from "@/lib/format";
import { Artwork } from "@/components/ui/artwork";
import { ErrorState } from "@/components/ui/empty-state";
import { LineSkeleton } from "@/components/ui/skeleton";
import styles from "./collection-view.module.css";

/**
 * Wallet address rendered as quiet, click-to-copy text. No visible copy
 * affordance — a small "Copied" tooltip confirms the action, then fades.
 */
function CopyAddress({ value }: { value: string | null }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  if (!value) return <span>—</span>;

  return (
    <button
      type="button"
      className={styles.copyAddr}
      data-copied={copied}
      aria-label={`Copy address ${value}`}
      onClick={async () => {
        await navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
      }}
    >
      {shorten(value, 4, 4)}
    </button>
  );
}

export function CollectionActivity({
  collectionAddress,
  views,
  limit = 6,
  onSelect,
}: {
  collectionAddress: string | null;
  views: ListingView[];
  limit?: number;
  onSelect?: (view: ListingView) => void;
}) {
  const { data: events, error, loading } = useActivity(200);

  const viewByAsset = new Map(
    views.map((v) => [v.listing.asset_address, v])
  );
  const assetSet = new Set(views.map((v) => v.listing.asset_address));

  if (loading) {
    return (
      <div style={{ display: "grid", gap: 1 }} aria-busy="true">
        <LineSkeleton />
        <LineSkeleton width="88%" />
        <LineSkeleton width="94%" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Activity unavailable" message={error} />;
  }

  const rows = (events ?? [])
    .filter(
      (event) =>
        (collectionAddress && event.collection_address === collectionAddress) ||
        (event.asset_address ? assetSet.has(event.asset_address) : false)
    )
    .slice(0, limit);

  if (rows.length === 0) {
    return (
      <div className={styles.activityEmpty}>
        <ActivityIcon size={16} aria-hidden />
        <span>No recent activity for this collection yet.</span>
      </div>
    );
  }

  return (
    <div className={styles.activity}>
      <div className={styles.activityHead} aria-hidden="true">
        <span>Item</span>
        <span className={styles.priceCol}>Price</span>
        <span className={styles.buyerCol}>Buyer</span>
        <span className={styles.sellerCol}>Seller</span>
        <span className={styles.timeCol}>Time</span>
      </div>

      {rows.map((event, i) => {
        const view = event.asset_address
          ? viewByAsset.get(event.asset_address)
          : undefined;
        const name =
          view?.name ||
          (event.asset_address ? shorten(event.asset_address, 5, 5) : "Chain event");
        const kind = /sale|sold/i.test(event.type)
          ? "sale"
          : /list/i.test(event.type)
            ? "list"
            : "transfer";
        const buyer = event.buyer_address ?? event.to_address ?? null;
        const seller = event.seller_address ?? event.from_address ?? null;

        return (
          <div
            key={event.signature}
            className={styles.activityRow}
            data-kind={kind}
            style={{ "--row": i } as React.CSSProperties}
          >
            <span className={styles.assetCell}>
              <span className={styles.thumb} aria-hidden="true">
                {view?.image ? (
                  <Artwork src={view.image} alt="" sizes="40px" />
                ) : null}
              </span>
              <span style={{ minWidth: 0, display: "grid" }}>
                {view && onSelect ? (
                  <button
                    type="button"
                    className={styles.assetName}
                    onClick={() => onSelect(view)}
                  >
                    {name}
                  </button>
                ) : event.asset_address ? (
                  <Link href={`/nft/${event.asset_address}`} className={styles.assetName}>
                    {name}
                  </Link>
                ) : (
                  <span className={styles.assetName}>{name}</span>
                )}
                <span className={styles.assetSub}>{activityLabel(event.type)}</span>
              </span>
            </span>

            <span className={styles.price}>
              {event.lamports !== null && event.lamports !== undefined
                ? formatSol(event.lamports)
                : "—"}
            </span>

            <span className={styles.buyer}>
              <CopyAddress value={buyer} />
            </span>

            <span className={styles.seller}>
              <CopyAddress value={seller} />
            </span>

            <span className={styles.time}>
              {relativeTime(event.block_time ?? event.now) ?? "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
