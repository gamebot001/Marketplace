"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Tag,
  XCircle,
  Wallet as WalletIcon,
  ExternalLink,
  HandCoins,
  Heart,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAsset, useListingsWithAssets } from "@/lib/api/hooks";
import { buildListingView } from "@/lib/marketplace/views";
import type { ListingView } from "@/lib/marketplace/views";
import { bpsToPercent, formatSol, relativeTime, resolveImageUrl } from "@/lib/format";
import { explorerAddressUrl } from "@/lib/solana/cluster";
import { DEMO_MODE, DEMO_OFFERS } from "@/lib/demo-marketplace-data";
import { NETWORK_LABEL } from "@/lib/config";
import { useWatchlist } from "@/components/marketplace/watchlist";
import { Artwork } from "@/components/ui/artwork";
import { VerifiedBadge, StatusBadge } from "@/components/ui/badges";
import { Address } from "@/components/ui/address";
import { CardSkeletons } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/motion";
import { useTransaction } from "@/components/marketplace/transaction/transaction-provider";
import { useWalletDialog } from "@/components/wallet/wallet-provider";

export function NftDetail({ assetAddress }: { assetAddress: string }) {
  const { data: asset, error, loading } = useAsset(assetAddress);
  const listingsState = useListingsWithAssets({ status: null });
  const { publicKey, connected } = useWallet();
  const { request } = useTransaction();
  const { open: openWallet } = useWalletDialog();
  const frameRef = useRef<HTMLDivElement>(null);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  const onFrameMove = useCallback((e: React.PointerEvent) => {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--px", `${(((e.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
    el.style.setProperty("--py", `${(((e.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
  }, []);

  const connectedAddress = publicKey?.toBase58() ?? null;
  const { has, toggle } = useWatchlist();

  const { activeView, lastView, history } = useMemo(() => {
    const empty = {
      activeView: null as ListingView | null,
      lastView: null as ListingView | null,
      history: [] as ListingView[],
    };
    const data = listingsState.data;
    if (!data || !asset) return empty;
    const assets = { ...data.assets, [asset.asset_address]: asset };
    const matching = data.listings
      .filter((l) => l.asset_address === asset.asset_address)
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
    const active = matching.find((l) => l.status === "active") ?? null;
    const last = matching[0] ?? null;
    return {
      activeView: active ? buildListingView(active, assets, data.collections) : null,
      lastView: last ? buildListingView(last, assets, data.collections) : null,
      history: matching.map((l) => buildListingView(l, assets, data.collections)),
    };
  }, [listingsState.data, asset]);

  const displayView = activeView ?? lastView;
  const isOwner = Boolean(
    connectedAddress &&
      asset?.owner_address &&
      connectedAddress === asset.owner_address
  );
  const isSeller = Boolean(
    connectedAddress && activeView?.listing.seller_address === connectedAddress
  );

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 34 }}>
        <div className="detail-grid">
          <div className="skeleton" style={{ aspectRatio: "1 / 1" }} />
          <div style={{ display: "grid", gap: 14 }}>
            <div className="skeleton" style={{ height: 30 }} />
            <div className="skeleton" style={{ height: 130 }} />
            <div className="skeleton" style={{ height: 50 }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="container" style={{ paddingTop: 34 }}>
        <ErrorState
          title="Asset not found"
          message={error ?? "This asset is not indexed on this network."}
          action={
            <Link href="/explore" className="btn btn-outline btn-sm">
              Back to Explore
            </Link>
          }
        />
      </div>
    );
  }

  const name = asset.name?.trim() || `${asset.asset_address.slice(0, 8)}…`;
  const image = resolveImageUrl(asset.image ?? asset.metadata_uri);
  const collectionHref = displayView?.collectionSlug
    ? `/collections/${displayView.collectionSlug}`
    : null;

  const demoBlocked = (action: string) =>
    setDemoNotice(
      `${action} is disabled while demo data is active — this is a design preview with sample market data, not a real listing.`
    );

  const renderActions = () => {
    const demoNote = DEMO_MODE && (
      <button
        type="button"
        className="btn btn-outline btn-block"
        onClick={() => demoBlocked("Make Offer")}
      >
        <HandCoins size={15} /> Make Offer
      </button>
    );

    if (!activeView) {
      // No active listing: only the current owner may list.
      if (!connected) {
        return (
          <>
            <button className="btn btn-primary btn-block btn-lg" onClick={openWallet}>
              <WalletIcon size={16} /> Connect to list
            </button>
            {demoNote}
          </>
        );
      }
      if (isOwner) {
        if (DEMO_MODE) {
          return (
            <button
              className="btn btn-primary btn-block btn-lg"
              onClick={() => demoBlocked("Listing")}
            >
              <Tag size={16} /> List for sale
            </button>
          );
        }
        return (
          <button
            className="btn btn-primary btn-block btn-lg"
            onClick={() =>
              request({
                kind: "list",
                asset,
                collectionName: displayView?.collectionName,
              })
            }
          >
            <Tag size={16} /> List for sale
          </button>
        );
      }
      return (
        <>
          <button className="btn btn-outline btn-block btn-lg" disabled>
            Not for sale
          </button>
          {demoNote}
        </>
      );
    }

    const view = activeView;
    if (!connected) {
      return (
        <>
          <button className="btn btn-primary btn-block btn-lg" onClick={openWallet}>
            <WalletIcon size={16} /> Connect to buy
          </button>
          {demoNote}
        </>
      );
    }
    if (isSeller) {
      if (DEMO_MODE) {
        return (
          <button
            className="btn btn-danger btn-block btn-lg"
            onClick={() => demoBlocked("Cancel listing")}
          >
            <XCircle size={16} /> Cancel listing
          </button>
        );
      }
      return (
        <button
          className="btn btn-danger btn-block btn-lg"
          onClick={() => request({ kind: "cancel", view })}
        >
          <XCircle size={16} /> Cancel listing
        </button>
      );
    }
    if (isOwner) {
      if (DEMO_MODE) {
        return (
          <button
            className="btn btn-primary btn-block btn-lg"
            onClick={() => demoBlocked("Re-listing")}
          >
            <Tag size={16} /> Re-list for sale
          </button>
        );
      }
      return (
        <button
          className="btn btn-primary btn-block btn-lg"
          onClick={() =>
            request({
              kind: "list",
              asset,
              collectionName: view.collectionName,
            })
          }
        >
          <Tag size={16} /> Re-list for sale
        </button>
      );
    }
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <button
          className="btn btn-primary btn-block btn-lg"
          onClick={() =>
            DEMO_MODE ? demoBlocked("Buy Now") : request({ kind: "buy", view })
          }
        >
          <ShoppingBag size={16} /> Buy Now
        </button>
        {demoNote}
      </div>
    );
  };

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 20 }}>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/explore">Explore</Link>
        <span className="sep">/</span>
        {collectionHref && displayView ? (
          <>
            <Link href={collectionHref}>{displayView.collectionName}</Link>
            <span className="sep">/</span>
          </>
        ) : null}
        <span>{name}</span>
      </nav>

      <div className="detail-grid">
        <Reveal>
          <div
            className="artwork-frame"
            style={{ aspectRatio: "1 / 1" }}
            ref={frameRef}
            onPointerMove={onFrameMove}
          >
            <Artwork src={image} alt={name} sizes="(max-width: 1080px) 100vw, 55vw" priority />
          </div>
        </Reveal>

        <Reveal delay={120} className="detail-aside" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {DEMO_MODE && (
            <div className="notice warn" role="note">
              <strong>Demo preview.</strong>&nbsp;This asset is sample market
              data. Transaction actions are disabled — nothing here is a real
              blockchain transaction.
            </div>
          )}

          {demoNotice && (
            <div className="notice" role="status">
              {demoNotice}
            </div>
          )}

          <div>
            {displayView && (
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                <Link href={collectionHref ?? "/collections"} style={{ color: "var(--accent)" }}>
                  {displayView.collectionName}
                </Link>
              </div>
            )}
            <h1
              className="display display-md"
              style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
            >
              {name}
              {asset.verified_collection && <VerifiedBadge />}
            </h1>
          </div>

          <div
            className="panel panel-pad"
            style={{ display: "grid", gap: 16 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div className="price">
                <span className="label">
                  {activeView ? "Current price" : "Status"}
                </span>
                <span className="value" style={{ fontSize: 22 }}>
                  {activeView ? formatSol(activeView.listing.price_lamports) : "Not for sale"}
                </span>
              </div>
              {activeView ? (
                <StatusBadge status={activeView.listing.status} />
              ) : (
                <span className="badge">Unlisted</span>
              )}
            </div>

            {activeView && (
              <div className="detail-row" style={{ padding: 0, borderBottom: 0 }}>
                <dt>Seller</dt>
                <dd>
                  <Address value={activeView.listing.seller_address} head={5} tail={5} link />
                </dd>
              </div>
            )}

            {renderActions()}

            {isOwner && (
              <div className="mono" style={{ color: "var(--muted)", textAlign: "center" }}>
                This asset is owned by your connected wallet.
              </div>
            )}

            <button
              type="button"
              className="btn btn-ghost btn-block"
              aria-pressed={has(asset.asset_address)}
              onClick={() => toggle(asset.asset_address)}
            >
              <Heart
                size={14}
                fill={has(asset.asset_address) ? "currentColor" : "none"}
                aria-hidden
              />
              {has(asset.asset_address) ? "On your watchlist" : "Add to watchlist"}
            </button>
          </div>

          <div className="attr-grid">
            <div className="attr">
              <div className="k">Owner</div>
              <div className="v">
                <Address value={asset.owner_address} head={5} tail={5} link />
              </div>
            </div>
            <div className="attr">
              <div className="k">Standard</div>
              <div className="v">{asset.standard}</div>
            </div>
            <div className="attr">
              <div className="k">Creator</div>
              <div className="v">
                <Address value={asset.creator_address} head={5} tail={5} />
              </div>
            </div>
            <div className="attr">
              <div className="k">Royalty</div>
              <div className="v">
                {bpsToPercent(asset.royalty_bps) ?? "None configured"}
              </div>
            </div>
            <div className="attr">
              <div className="k">Network</div>
              <div className="v">{NETWORK_LABEL}</div>
            </div>
            {collectionHref && displayView && (
              <div className="attr">
                <div className="k">Collection</div>
                <div className="v">
                  <Link href={collectionHref} style={{ color: "var(--accent)" }}>
                    {displayView.collectionName}
                  </Link>
                </div>
              </div>
            )}
          </div>

          {asset.attributes && asset.attributes.length > 0 && (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="eyebrow">Attributes</div>
              <div className="attr-grid">
                {asset.attributes.map((a) => (
                  <div className="attr" key={`${a.trait}-${a.value}`}>
                    <div className="k">{a.trait}</div>
                    <div className="v">{a.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel panel-pad" style={{ display: "grid", gap: 10 }}>
            <div className="eyebrow">Asset address</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <Address value={asset.asset_address} head={8} tail={8} />
              <a
                className="btn btn-ghost btn-sm"
                href={explorerAddressUrl(asset.asset_address)}
                target="_blank"
                rel="noreferrer"
              >
                Explorer <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {asset.description && (
            <div className="prose">
              <p>{asset.description}</p>
            </div>
          )}

          {history.length > 0 && (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="eyebrow">Listing history</div>
              <div className="panel">
                {history.slice(0, 8).map((entry) => (
                  <div
                    key={entry.listing.listing_id}
                    className="detail-row"
                    style={{ padding: "12px 16px" }}
                  >
                    <dt style={{ textTransform: "capitalize" }}>{entry.listing.status}</dt>
                    <dd style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <span className="mono">{formatSol(entry.listing.price_lamports)}</span>
                      <span className="mono" style={{ color: "var(--muted)" }}>
                        {relativeTime(entry.listing.created_at) ?? "—"}
                      </span>
                    </dd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {DEMO_MODE && DEMO_OFFERS.some((o) => o.asset === asset.asset_address) && (
            <div style={{ display: "grid", gap: 10 }}>
              <div className="eyebrow">Offers</div>
              <div className="panel">
                {DEMO_OFFERS.filter((o) => o.asset === asset.asset_address).map((offer) => (
                  <div
                    key={offer.id}
                    className="detail-row"
                    style={{ padding: "12px 16px" }}
                  >
                    <dt>
                      <Address value={offer.from} head={4} tail={4} />
                    </dt>
                    <dd className="mono">{formatSol(offer.amountLamports)}</dd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {history.length > 0 && (
            <span className="demo-note">
              Listing history is drawn from listings observed on this network.
            </span>
          )}
        </Reveal>
      </div>

      {!listingsState.loading && !activeView && !lastView && (
        <div style={{ marginTop: 40 }}>
          <EmptyState
            title="No listing history"
            message="This asset has no marketplace activity observed on this network yet."
          />
        </div>
      )}

      {listingsState.loading && (
        <div style={{ marginTop: 40 }}>
          <CardSkeletons count={4} />
        </div>
      )}
    </div>
  );
}
