"use client";

/**
 * Wide editorial market feed — thumbnail, event marker, NFT, collection,
 * route, price, time. Row separators are hairlines; sale/listing/transfer
 * markers are color-coded. Rows enter with a subtle stagger. When the ledger
 * is quiet, it says so. Nothing is ever simulated outside demo mode.
 */

import Link from "next/link";
import { Activity as ActivityIcon } from "lucide-react";
import { useActivity, useListingsWithAssets } from "@/lib/api/hooks";
import { activityLabel, buildListingViews } from "@/lib/marketplace/views";
import { formatSol, relativeTime, shorten } from "@/lib/format";
import { Artwork } from "@/components/ui/artwork";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { LineSkeleton } from "@/components/ui/skeleton";

export function ActivityStrip({ limit = 5 }: { limit?: number }) {
  const { data: events, error, loading } = useActivity(limit);
  const meta = useListingsWithAssets({ status: null });

  const views = meta.data
    ? buildListingViews(meta.data.listings, meta.data.assets, meta.data.collections)
    : [];
  const viewByAsset = new Map(views.map((v) => [v.listing.asset_address, v]));
  const assets = meta.data?.assets ?? {};

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

  if (!events || events.length === 0) {
    return (
      <EmptyState
        icon={<ActivityIcon size={18} />}
        title="No activity yet"
        message="Marketplace activity will appear here."
      />
    );
  }

  return (
    <div className="activity-strip">
      {events.map((event, i) => {
        const asset = event.asset_address ? assets[event.asset_address] : undefined;
        const view = event.asset_address ? viewByAsset.get(event.asset_address) : undefined;
        const name =
          asset?.name?.trim() ||
          view?.name ||
          (event.asset_address ? shorten(event.asset_address, 5, 5) : "Chain event");
        const kind = /sale|sold/i.test(event.type) ? "sale" : /list/i.test(event.type) ? "list" : "transfer";
        const from = event.from_address ?? event.seller_address ?? null;
        const to = event.to_address ?? event.buyer_address ?? null;
        return (
          <div
            key={event.signature}
            className="activity-row"
            data-kind={kind}
            style={{ "--row": i } as React.CSSProperties}
          >
            <span className="ar-thumb" aria-hidden="true">
              {view?.image ? (
                <Artwork src={view.image} alt="" sizes="44px" />
              ) : null}
            </span>
            <span style={{ minWidth: 0, display: "grid" }}>
              {event.asset_address ? (
                <Link href={`/nft/${event.asset_address}`} className="ar-name">
                  {name}
                </Link>
              ) : (
                <span className="ar-name">{name}</span>
              )}
              <span className="ar-sub">{view?.collectionName ?? "—"}</span>
            </span>
            <span className="action-pill" data-kind={kind === "transfer" ? undefined : kind}>
              {activityLabel(event)}
            </span>
            <span className="ar-route mono">
              {from ? shorten(from, 4, 4) : "—"}
              {to ? <span className="ar-arrow"> → {shorten(to, 4, 4)}</span> : null}
            </span>
            <span className="ar-price">
              {event.lamports !== null && event.lamports !== undefined
                ? formatSol(event.lamports)
                : "—"}
            </span>
            <span className="ar-time">
              {relativeTime(event.block_time ?? event.now) ?? "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
