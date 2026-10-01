"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Wallet as WalletIcon, ExternalLink, HandCoins, Heart } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useActivity, useListingsWithAssets } from "@/lib/api/hooks";
import { buildListingViews, activityLabel, activityWallet } from "@/lib/marketplace/views";
import { formatSol, lamportsToSol, relativeTime, resolveImageUrl, shorten } from "@/lib/format";
import { explorerAddressUrl } from "@/lib/solana/cluster";
import { DEMO_MODE, DEMO_OFFERS } from "@/lib/demo-marketplace-data";
import type { MarketplaceAsset } from "@/lib/api/types";
import { Artwork } from "@/components/ui/artwork";
import { Address } from "@/components/ui/address";
import { NftCard } from "@/components/marketplace/nft-card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { CardSkeletons } from "@/components/ui/skeleton";
import { useWalletDialog } from "@/components/wallet/wallet-provider";
import { useWatchlist } from "@/components/marketplace/watchlist";
import { useNftQuickView } from "@/components/marketplace/nft-quick-view";

type Tab = "owned" | "listed" | "offers" | "activity" | "watchlist" | "collections";

function AssetTile({
  asset,
  name,
}: {
  asset: MarketplaceAsset | null;
  name: string;
}) {
  const { open } = useNftQuickView();
  const { has, toggle } = useWatchlist();
  const address = asset?.asset_address ?? null;
  const faved = address ? has(address) : false;

  return (
    <div className="nft-card" style={{ position: "relative" }}>
      <button
        type="button"
        className="nft-media"
        style={{ display: "block", width: "100%", border: 0, padding: 0, cursor: "pointer" }}
        onClick={() => address && open({ address, asset: asset ?? undefined })}
        aria-label={name}
      >
        <Artwork
          src={resolveImageUrl(asset?.image ?? asset?.metadata_uri ?? null)}
          alt={name}
          sizes="(max-width: 560px) 100vw, 25vw"
        />
      </button>
      {address && (
        <button
          type="button"
          className="nft-fav"
          aria-pressed={faved}
          aria-label={faved ? "Remove from watchlist" : "Add to watchlist"}
          onClick={() => toggle(address)}
        >
          <Heart size={13} fill={faved ? "currentColor" : "none"} aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={() => address && open({ address, asset: asset ?? undefined })}
        style={{ border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer" }}
      >
        <div className="nft-body">
          <div className="nft-title">{name}</div>
          <div className="nft-sub">
            <span className="mono">
              {address ? shorten(address, 5, 5) : "—"}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

export function ProfileView() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { open: openWallet } = useWalletDialog();
  const { open: openNft } = useNftQuickView();
  const { items: watchlist } = useWatchlist();
  const address = publicKey?.toBase58() ?? null;

  const listingsState = useListingsWithAssets({ status: null });
  const activityState = useActivity(200);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const [tab, setTab] = useState<Tab>("owned");

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    let active = true;
    connection
      .getBalance(publicKey, "confirmed")
      .then((lamports) => active && setBalance(lamports))
      .catch(() => active && setBalanceError(true));
    return () => {
      active = false;
    };
  }, [connection, publicKey]);

  const data = listingsState.data;

  const { ownedAssets, listedViews, watchlistAssets } = useMemo(() => {
    if (!data || !address) {
      return {
        ownedAssets: [] as MarketplaceAsset[],
        listedViews: [] as ReturnType<typeof buildListingViews>,
        watchlistAssets: [] as MarketplaceAsset[],
      };
    }
    const owned = Object.values(data.assets).filter(
      (a) => a.owner_address === address
    );
    const allViews = buildListingViews(data.listings, data.assets, data.collections);
    const listed = allViews.filter(
      (v) => v.listing.seller_address === address && v.listing.status === "active"
    );
    const watched = watchlist
      .map((assetAddress) => data.assets[assetAddress])
      .filter((a): a is MarketplaceAsset => Boolean(a));
    return {
      ownedAssets: owned,
      listedViews: listed,
      watchlistAssets: watched,
    };
  }, [data, address, watchlist]);

  const myActivity = useMemo(() => {
    if (!address) return [];
    return (activityState.data ?? []).filter(
      (e) => activityWallet(e) === address
    );
  }, [activityState.data, address]);

  const myCollections = useMemo(() => {
    if (!data || !address) return [];
    const owned = Object.values(data.assets).filter(
      (a) => a.owner_address === address
    );
    const addresses = new Set(
      owned.map((a) => a.collection_address).filter(Boolean)
    );
    return data.collections.filter((c) =>
      c.collection_address ? addresses.has(c.collection_address) : false
    );
  }, [data, address]);

  const ownedNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const asset of ownedAssets) {
      map.set(
        asset.asset_address,
        asset.name?.trim() || shorten(asset.asset_address, 5, 5)
      );
    }
    return map;
  }, [ownedAssets]);

  const listedForAsset = useMemo(() => {
    const map = new Map<string, string>();
    for (const view of listedViews) {
      map.set(view.listing.asset_address, view.name);
    }
    return map;
  }, [listedViews]);

  if (!connected || !address) {
    return (
      <EmptyState
        icon={<WalletIcon size={18} />}
        title="Connect your wallet"
        message="Connect a Solana wallet to view the assets, listings and activity associated with your address."
        action={
          <button className="btn btn-primary" onClick={openWallet}>
            <WalletIcon size={15} /> Connect Wallet
          </button>
        }
      />
    );
  }

  const tabs: { id: Tab; label: string; count: number | null }[] = [
    { id: "owned", label: "Owned", count: ownedAssets.length },
    { id: "listed", label: "Listed", count: listedViews.length },
    { id: "offers", label: "Offers", count: DEMO_MODE ? DEMO_OFFERS.length : 0 },
    { id: "activity", label: "Activity", count: myActivity.length },
    { id: "watchlist", label: "Watchlist", count: watchlistAssets.length },
    { id: "collections", label: "Collections", count: myCollections.length },
  ];

  return (
    <div style={{ display: "grid", gap: 36 }}>
      <div
        className="panel panel-pad"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(130deg, var(--surface-2), var(--surface) 65%)",
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div className="eyebrow">Connected wallet</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <span className="wallet-avatar" style={{ width: 26, height: 26 }} aria-hidden />
            <span className="mono" style={{ color: "var(--text-strong)", fontSize: 16 }}>
              {shorten(address, 8, 8)}
            </span>
            <Address value={address} head={0} tail={0} />
            <a
              className="copy-btn"
              href={explorerAddressUrl(address)}
              target="_blank"
              rel="noreferrer"
            >
              Explorer <ExternalLink size={12} />
            </a>
          </div>
        </div>
        <div className="price" style={{ textAlign: "right" }}>
          <span className="label">Devnet balance</span>
          <span className="value" style={{ fontSize: 20 }}>
            {balanceError
              ? "Unavailable"
              : balance === null
                ? "…"
                : `${lamportsToSol(balance)} SOL`}
          </span>
        </div>
      </div>

      <div className="tab-row" role="tablist" aria-label="Collector sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className="tab-btn"
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count !== null && <span className="tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "owned" && (
        <section>
          {listingsState.loading ? (
            <CardSkeletons count={4} />
          ) : ownedAssets.length === 0 ? (
            <EmptyState
              title="No indexed assets"
              message="Assets you own that the marketplace has indexed will appear here. Full wallet indexing is not available yet — only assets discovered through listings and activity are shown."
            />
          ) : (
            <div className="grid grid-4">
              {ownedAssets.map((asset) => (
                <AssetTile
                  key={asset.asset_address}
                  asset={asset}
                  name={ownedNames.get(asset.asset_address) ?? asset.asset_address}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "listed" && (
        <section>
          {listingsState.loading ? (
            <CardSkeletons count={4} />
          ) : listedViews.length === 0 ? (
            <EmptyState
              title="No active listings"
              message="You have no active listings on this network. List an asset you own to see it here."
            />
          ) : (
            <div className="grid grid-4">
              {listedViews.map((v, i) => (
                <NftCard key={v.listing.listing_id} view={v} priority={i < 4} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "offers" && (
        <section>
          {DEMO_MODE ? (
            <div className="grid grid-2">
              {DEMO_OFFERS.map((offer) => {
                const asset = data?.assets[offer.asset];
                const name = asset?.name?.trim() || shorten(offer.asset, 5, 5);
                return (
                  <div key={offer.id} className="panel panel-pad offer-card">
                    <button
                      type="button"
                      className="cell-asset"
                      style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", textAlign: "left" }}
                      onClick={() => openNft({ address: offer.asset, asset })}
                    >
                      <div className="cell-thumb" style={{ width: 56, height: 56 }}>
                        <Artwork
                          src={resolveImageUrl(asset?.image ?? asset?.metadata_uri)}
                          alt={name}
                          sizes="56px"
                        />
                      </div>
                      <span style={{ minWidth: 0 }}>
                        <span className="nft-title" style={{ fontSize: 14.5 }}>{name}</span>
                        <span className="ar-sub" style={{ display: "block" }}>
                          Offer from {shorten(offer.from, 4, 4)} ·{" "}
                          {relativeTime(Date.now() / 1000 - offer.minutesAgo * 60) ?? "recent"}
                        </span>
                      </span>
                    </button>
                    <div className="offer-card-side">
                      <span className="price">
                        <span className="label">Offer</span>
                        <span className="value">{formatSol(offer.amountLamports)}</span>
                      </span>
                      <span className="badge badge-gold" title="Offers are disabled while demo data is active">
                        <HandCoins size={10} /> Demo offer
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No offers yet"
              message="Offers made on your listed assets will appear here once offer support is live."
            />
          )}
        </section>
      )}

      {tab === "activity" && (
        <section>
          {activityState.loading ? (
            <CardSkeletons count={2} />
          ) : activityState.error ? (
            <ErrorState message={activityState.error} />
          ) : myActivity.length === 0 ? (
            <EmptyState
              title="No activity"
              message="Activity involving your wallet will appear here once it is observed on-chain."
            />
          ) : (
            <div className="panel">
              {myActivity.slice(0, 25).map((event) => (
                <button
                  key={event.signature}
                  type="button"
                  onClick={() =>
                    event.asset_address &&
                    openNft({ address: event.asset_address })
                  }
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--line)",
                    border: 0,
                    borderBottomWidth: 1,
                    borderBottomStyle: "solid",
                    borderBottomColor: "var(--line)",
                    background: "transparent",
                    textAlign: "left",
                    cursor: event.asset_address ? "pointer" : "default",
                  }}
                >
                  <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
                    <span style={{ color: "var(--text-strong)", fontSize: 13.5 }}>
                      {activityLabel(event.type)}
                    </span>
                    {event.asset_address && (
                      <span className="mono" style={{ color: "var(--muted)" }}>
                        {shorten(event.asset_address, 6, 6)}
                      </span>
                    )}
                  </span>
                  <span style={{ textAlign: "right", display: "grid", gap: 3 }}>
                    <span className="mono">
                      {event.lamports !== null && event.lamports !== undefined
                        ? formatSol(event.lamports)
                        : "—"}
                    </span>
                    <span className="mono" style={{ color: "var(--muted)" }}>
                      {relativeTime(event.block_time ?? event.now) ?? "—"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "watchlist" && (
        <section>
          {watchlistAssets.length === 0 ? (
            <EmptyState
              icon={<Heart size={18} />}
              title="Your watchlist is empty"
              message="Add pieces from any listing card or detail view to track them here."
              action={
                <Link href="/explore" className="btn btn-outline btn-sm">
                  Explore listings
                </Link>
              }
            />
          ) : (
            <div className="grid grid-4">
              {watchlistAssets.map((asset) => (
                <AssetTile
                  key={asset.asset_address}
                  asset={asset}
                  name={
                    ownedNames.get(asset.asset_address) ??
                    listedForAsset.get(asset.asset_address) ??
                    asset.name?.trim() ??
                    shorten(asset.asset_address, 5, 5)
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "collections" && (
        <section>
          {myCollections.length === 0 ? (
            <EmptyState
              title="No collections yet"
              message="Collections you own pieces from will appear here."
            />
          ) : (
            <div className="grid grid-4">
              {myCollections.map((collection) => (
                <Link
                  key={collection.slug}
                  href={`/collections/${collection.slug}`}
                  className="rail-card"
                  style={{ height: "100%" }}
                >
                  <div className="rail-media">
                    <Artwork
                      src={resolveImageUrl(collection.image)}
                      alt={collection.name}
                      sizes="(max-width: 560px) 100vw, 25vw"
                    />
                  </div>
                  <div className="rail-body">
                    <h3>
                      <span className="rn">{collection.name}</span>
                    </h3>
                    <span className="rail-sub">{collection.standard}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
