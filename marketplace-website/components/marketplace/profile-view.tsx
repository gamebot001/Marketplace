"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Wallet as WalletIcon, ExternalLink, HandCoins } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useActivity, useListingsWithAssets } from "@/lib/api/hooks";
import { buildListingViews, activityLabel, activityWallet } from "@/lib/marketplace/views";
import { formatSol, lamportsToSol, relativeTime, resolveImageUrl, shorten } from "@/lib/format";
import { explorerAddressUrl } from "@/lib/solana/cluster";
import { DEMO_MODE, DEMO_OFFERS } from "@/lib/demo-marketplace-data";
import { Artwork } from "@/components/ui/artwork";
import { Address } from "@/components/ui/address";
import { NftCard } from "@/components/marketplace/nft-card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { CardSkeletons } from "@/components/ui/skeleton";
import { useWalletDialog } from "@/components/wallet/wallet-provider";

export function ProfileView() {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { open: openWallet } = useWalletDialog();
  const address = publicKey?.toBase58() ?? null;

  const listingsState = useListingsWithAssets({ status: null });
  const activityState = useActivity(200);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState(false);

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

  const { ownedAssets, listedViews } = useMemo(() => {
    if (!data || !address) return { ownedAssets: [], listedViews: [] };
    const owned = Object.values(data.assets).filter(
      (a) => a.owner_address === address
    );
    const views = buildListingViews(data.listings, data.assets, data.collections);
    const listed = views.filter(
      (v) => v.listing.seller_address === address && v.listing.status === "active"
    );
    return { ownedAssets: owned, listedViews: listed };
  }, [data, address]);

  const myActivity = useMemo(() => {
    if (!address) return [];
    return (activityState.data ?? []).filter(
      (e) => activityWallet(e) === address
    );
  }, [activityState.data, address]);

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

  return (
    <div style={{ display: "grid", gap: 48 }}>
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

      <section>
        <div className="section-head">
          <h2>Listed by you</h2>
        </div>
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

      <section>
        <div className="section-head">
          <h2>Owned assets</h2>
        </div>
        {listingsState.loading ? (
          <CardSkeletons count={4} />
        ) : ownedAssets.length === 0 ? (
          <EmptyState
            title="No indexed assets"
            message="Assets you own that the marketplace has indexed will appear here. Full wallet indexing is not available yet — only assets discovered through listings and activity are shown."
          />
        ) : (
          <div className="grid grid-4">
            {ownedAssets.map((asset) => {
              const name = asset.name?.trim() || shorten(asset.asset_address, 5, 5);
              return (
                <Link
                  key={asset.asset_address}
                  href={`/nft/${asset.asset_address}`}
                  className="nft-card"
                >
                  <div className="nft-media" style={{ position: "relative" }}>
                    <Artwork
                      src={resolveImageUrl(asset.image ?? asset.metadata_uri)}
                      alt={name}
                      sizes="(max-width: 560px) 100vw, 25vw"
                    />
                  </div>
                  <div className="nft-body">
                    <div className="nft-title">{name}</div>
                    <div className="nft-sub">
                      <span className="mono">{shorten(asset.asset_address, 5, 5)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>Offers</h2>
        </div>
        {DEMO_MODE ? (
          <div className="grid grid-2">
            {DEMO_OFFERS.map((offer) => {
              const asset = data?.assets[offer.asset];
              const name = asset?.name?.trim() || shorten(offer.asset, 5, 5);
              return (
                <div key={offer.id} className="panel panel-pad offer-card">
                  <Link href={`/nft/${offer.asset}`} className="cell-asset">
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
                  </Link>
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

      <section>
        <div className="section-head">
          <h2>Your activity</h2>
        </div>
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
              <div
                key={event.signature}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                  <span style={{ color: "var(--text-strong)", fontSize: 13.5 }}>
                    {activityLabel(event.type)}
                  </span>
                  {event.asset_address && (
                    <Link
                      href={`/nft/${event.asset_address}`}
                      className="mono"
                      style={{ color: "var(--muted)" }}
                    >
                      {shorten(event.asset_address, 6, 6)}
                    </Link>
                  )}
                </div>
                <div style={{ textAlign: "right", display: "grid", gap: 3 }}>
                  <span className="mono">
                    {event.lamports !== null && event.lamports !== undefined
                      ? formatSol(event.lamports)
                      : "—"}
                  </span>
                  <span className="mono" style={{ color: "var(--muted)" }}>
                    {relativeTime(event.block_time ?? event.now) ?? "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
