"use client";

/**
 * Activity ledger with event tabs (All / Sales / Listings / Transfers),
 * artwork thumbnails and From → To wallets. While demo mode is active the
 * table is labelled as demo market data and signatures are not linked to an
 * explorer (they are not real transactions).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity as ActivityIcon, ExternalLink } from "lucide-react";
import { useActivity, useListingsWithAssets } from "@/lib/api/hooks";
import { activityLabel, buildListingViews } from "@/lib/marketplace/views";
import { formatSol, relativeTime, shorten } from "@/lib/format";
import { explorerTxUrl } from "@/lib/solana/cluster";
import { DEMO_MODE } from "@/lib/demo-marketplace-data";
import { Artwork } from "@/components/ui/artwork";
import { Address } from "@/components/ui/address";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { CardSkeletons } from "@/components/ui/skeleton";
import { Reveal } from "@/components/ui/motion";

type Tab = "all" | "sale" | "list" | "transfer";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sale", label: "Sales" },
  { id: "list", label: "Listings" },
  { id: "transfer", label: "Transfers" },
];

function actionKind(type: string | null | undefined): string | undefined {
  if (!type) return undefined;
  if (/sale|sold/i.test(type)) return "sale";
  if (/list/i.test(type)) return "list";
  return undefined;
}

export function ActivityTable() {
  const { data: events, error, loading } = useActivity(200);
  const meta = useListingsWithAssets({ status: null });
  const [tab, setTab] = useState<Tab>("all");

  const views = meta.data
    ? buildListingViews(meta.data.listings, meta.data.assets, meta.data.collections)
    : [];
  const viewByAsset = new Map(views.map((v) => [v.listing.asset_address, v]));
  const assets = meta.data?.assets ?? {};

  const filtered = useMemo(() => {
    if (!events) return [];
    if (tab === "all") return events;
    return events.filter((e) => e.type === tab);
  }, [events, tab]);

  if (loading) return <CardSkeletons count={4} />;
  if (error) return <ErrorState title="Could not load activity" message={error} />;
  if (!events || events.length === 0) {
    return (
      <EmptyState
        icon={<ActivityIcon size={18} />}
        title="The ledger is quiet"
        message="Marketplace activity will appear here. Mints, listings, sales and transfers observed on-chain are indexed in real time — nothing is fabricated."
        action={
          <Link href="/explore" className="btn btn-outline btn-sm">
            Explore listings
          </Link>
        }
      />
    );
  }

  return (
    <div
      style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1fr)" }}
    >
      <div className="tab-row" role="tablist" aria-label="Activity filters">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className="tab-btn"
            onClick={() => setTab(id)}
          >
            {label}
            <span className="tab-count">
              {id === "all"
                ? events.length
                : events.filter((e) => e.type === id).length}
            </span>
          </button>
        ))}
        {DEMO_MODE && <span className="badge badge-gold demo-flag">Demo market activity</span>}
      </div>

      <Reveal>
        <div className="activity-scroll">
          <table className="activity-table">
            <thead>
              <tr>
                <th scope="col">NFT</th>
                <th scope="col">Collection</th>
                <th scope="col">Event</th>
                <th scope="col">Price</th>
                <th scope="col">From</th>
                <th scope="col">To</th>
                <th scope="col">Time</th>
                {!DEMO_MODE && <th scope="col">Transaction</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((event) => {
                const asset = event.asset_address ? assets[event.asset_address] : undefined;
                const view = event.asset_address ? viewByAsset.get(event.asset_address) : undefined;
                const name =
                  asset?.name?.trim() ||
                  view?.name ||
                  (event.asset_address ? shorten(event.asset_address, 5, 5) : "Unknown asset");
                const time = event.block_time ?? event.now ?? null;
                return (
                  <tr key={event.signature}>
                    <td>
                      <div className="cell-asset">
                        <div className="cell-thumb">
                          <Artwork src={view?.image ?? null} alt={name} sizes="38px" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="nft-title" style={{ fontSize: 13.5, fontFamily: "var(--font-sans)", fontWeight: 500 }}>
                            {event.asset_address ? (
                              <Link href={`/nft/${event.asset_address}`}>{name}</Link>
                            ) : (
                              name
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>
                        {view?.collectionName ?? "—"}
                      </span>
                    </td>
                    <td>
                      <span className="action-pill" data-kind={actionKind(event.type)}>
                        {activityLabel(event.type)}
                      </span>
                    </td>
                    <td className="mono">
                      {event.lamports !== null && event.lamports !== undefined
                        ? formatSol(event.lamports)
                        : "—"}
                    </td>
                    <td>
                      {event.from_address || event.seller_address ? (
                        <Address value={event.from_address ?? event.seller_address} head={4} tail={4} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {event.to_address || event.buyer_address ? (
                        <Address value={event.to_address ?? event.buyer_address} head={4} tail={4} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <div style={{ color: "var(--text)" }}>{relativeTime(time) ?? "—"}</div>
                    </td>
                    {!DEMO_MODE && (
                      <td>
                        <a
                          className="copy-btn"
                          href={explorerTxUrl(event.signature)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shorten(event.signature, 5, 5)} <ExternalLink size={12} />
                        </a>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: "26px 18px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
              No {tab} events in the current view.
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
