"use client";

/**
 * In-context NFT detail panel — the heavy half of the quick view.
 *
 * Loaded on demand by NftQuickViewProvider so initial page bundles stay lean.
 * Renders real listing/asset data with the existing buy / list / cancel actions
 * and a route to the full page.
 *
 * Flicker safety: rendered through the shared root overlay host, animates
 * opacity/transform only (collection-view.module.css), body scroll-lock pairs
 * with the reserved scrollbar gutter, and no animated environment sits above it.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Heart,
  ShoppingBag,
  Tag,
  Wallet as WalletIcon,
  X,
  XCircle,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { MarketplaceAsset } from "@/lib/api/types";
import type { ListingView } from "@/lib/marketplace/views";
import { buildListingView } from "@/lib/marketplace/views";
import { useAsset, useListingsWithAssets } from "@/lib/api/hooks";
import { bpsToPercent, formatSol, relativeTime } from "@/lib/format";
import { explorerAddressUrl } from "@/lib/solana/cluster";
import { DEMO_MODE } from "@/lib/demo-marketplace-data";
import { NETWORK_LABEL } from "@/lib/config";
import { Artwork } from "@/components/ui/artwork";
import { VerifiedBadge, StatusBadge } from "@/components/ui/badges";
import { Address } from "@/components/ui/address";
import { OverlayPortal, useDialogFocus } from "@/components/ui/overlay-portal";
import { useTransaction } from "@/components/marketplace/transaction/transaction-provider";
import { useWalletDialog } from "@/components/wallet/wallet-provider";
import { useWatchlist } from "@/components/marketplace/watchlist";
import type { QuickViewInput } from "@/components/marketplace/nft-quick-view";
import styles from "./collection-view.module.css";

export function NftQuickViewPanel({
  input,
  onClose,
}: {
  input: QuickViewInput;
  onClose: () => void;
}) {
  return input.view != null ? (
    <ResolvedPanel input={input} onClose={onClose} />
  ) : (
    <FetchedPanel input={input} onClose={onClose} />
  );
}

/** Preset view path — no listing fetch, asset only fetched when not supplied. */
function ResolvedPanel({
  input,
  onClose,
}: {
  input: QuickViewInput;
  onClose: () => void;
}) {
  const { data: fetchedAsset } = useAsset(input.asset ? null : input.address);
  const asset = input.asset ?? fetchedAsset ?? null;
  return (
    <QuickViewLayout
      address={input.address}
      activeView={input.view?.listing.status === "active" ? input.view : null}
      lastView={input.view ?? null}
      asset={asset}
      loading={false}
      onClose={onClose}
    />
  );
}

/** Address-only path — one listing fetch, then the exact same panel. */
function FetchedPanel({
  input,
  onClose,
}: {
  input: QuickViewInput;
  onClose: () => void;
}) {
  const assetState = useAsset(input.address);
  const listingsState = useListingsWithAssets({ status: null });

  const { activeView, lastView } = useMemo(() => {
    const data = listingsState.data;
    const asset = assetState.data;
    if (!data || !asset) {
      return { activeView: null as ListingView | null, lastView: null as ListingView | null };
    }
    const assets = { ...data.assets, [asset.asset_address]: asset };
    const matching = data.listings
      .filter((l) => l.asset_address === asset.asset_address)
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
    const active = matching.find((l) => l.status === "active") ?? null;
    const last = matching[0] ?? null;
    return {
      activeView: active ? buildListingView(active, assets, data.collections) : null,
      lastView: last ? buildListingView(last, assets, data.collections) : null,
    };
  }, [listingsState.data, assetState.data]);

  return (
    <QuickViewLayout
      address={input.address}
      activeView={activeView}
      lastView={lastView}
      asset={assetState.data ?? null}
      loading={assetState.loading}
      onClose={onClose}
    />
  );
}

function QuickViewLayout({
  address,
  activeView,
  lastView,
  asset,
  loading,
  onClose,
}: {
  address: string;
  activeView: ListingView | null;
  lastView: ListingView | null;
  asset: MarketplaceAsset | null;
  loading: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { publicKey, connected } = useWallet();
  const { request } = useTransaction();
  const { open: openWallet } = useWalletDialog();
  const { has, toggle } = useWatchlist();
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  useDialogFocus(true, dialogRef, closeRef);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const displayView = activeView ?? lastView;
  const name =
    asset?.name?.trim() ||
    displayView?.name ||
    `${address.slice(0, 6)}…${address.slice(-4)}`;
  const image = displayView?.image ?? asset?.image ?? asset?.metadata_uri ?? null;
  const collectionName = displayView?.collectionName ?? null;
  const collectionHref = displayView?.collectionSlug
    ? `/collections/${displayView.collectionSlug}`
    : null;
  const verified = Boolean(asset?.verified_collection ?? displayView?.collectionVerified);
  const royalty = bpsToPercent(asset?.royalty_bps ?? displayView?.royaltyBps ?? null);
  const attributes = asset?.attributes ?? null;
  const description = displayView?.description ?? asset?.description ?? null;

  const connectedAddress = publicKey?.toBase58() ?? null;
  const isOwner = Boolean(
    connectedAddress && asset?.owner_address && connectedAddress === asset.owner_address
  );
  const isSeller = Boolean(
    connectedAddress && activeView?.listing.seller_address === connectedAddress
  );
  const watchlisted = has(address);

  // The current beneficial owner: the seller for an active listing, otherwise
  // the asset owner. Shown once, and as "You" when it is the connected wallet.
  const beneficialOwner = activeView
    ? activeView.listing.seller_address
    : asset?.owner_address ?? null;
  const identityLabel = activeView ? (isSeller ? "Listed by" : "Seller") : "Owner";
  const identityIsSelf = Boolean(
    connectedAddress && beneficialOwner && connectedAddress === beneficialOwner
  );
  const creatorAddress =
    asset?.creator_address ?? displayView?.creatorAddress ?? null;
  // Creator is a separate relationship: suppress it when it is the same address
  // as the current beneficial owner (it would be pure duplication).
  const showCreator = Boolean(creatorAddress && creatorAddress !== beneficialOwner);

  const demoBlocked = (action: string) =>
    setDemoNotice(
      `${action} is disabled while demo data is active — this is a design preview with sample market data, not a real listing.`
    );

  const renderActions = () => {
    if (!activeView) {
      if (!connected) {
        return (
          <button className="btn btn-primary btn-block btn-lg" onClick={openWallet}>
            <WalletIcon size={16} aria-hidden /> Connect Wallet
          </button>
        );
      }
      if (isOwner && asset) {
        if (DEMO_MODE) {
          return (
            <button
              className="btn btn-primary btn-block btn-lg"
              onClick={() => demoBlocked("Listing")}
            >
              <Tag size={16} aria-hidden /> List for sale
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
            <Tag size={16} aria-hidden /> List for sale
          </button>
        );
      }
      return (
        <button className="btn btn-outline btn-block btn-lg" disabled>
          Not for sale
        </button>
      );
    }

    if (!connected) {
      return (
        <button className="btn btn-primary btn-block btn-lg" onClick={openWallet}>
          <WalletIcon size={16} aria-hidden /> Connect Wallet
        </button>
      );
    }
    if (isSeller) {
      if (DEMO_MODE) {
        return (
          <button
            className="btn btn-danger btn-block btn-lg"
            onClick={() => demoBlocked("Cancel listing")}
          >
            <XCircle size={16} aria-hidden /> Cancel listing
          </button>
        );
      }
      return (
        <button
          className="btn btn-danger btn-block btn-lg"
          onClick={() => {
            onClose();
            request({ kind: "cancel", view: activeView });
          }}
        >
          <XCircle size={16} aria-hidden /> Cancel listing
        </button>
      );
    }
    if (isOwner && asset) {
      if (DEMO_MODE) {
        return (
          <button
            className="btn btn-primary btn-block btn-lg"
            onClick={() => demoBlocked("Re-listing")}
          >
            <Tag size={16} aria-hidden /> Re-list for sale
          </button>
        );
      }
      return (
        <button
          className="btn btn-primary btn-block btn-lg"
          onClick={() => {
            onClose();
            request({ kind: "list", asset, collectionName: activeView.collectionName });
          }}
        >
          <Tag size={16} aria-hidden /> Re-list for sale
        </button>
      );
    }
    return (
      <button
        className="btn btn-primary btn-block btn-lg"
        onClick={() => {
          if (DEMO_MODE) {
            demoBlocked("Buy Now");
          } else {
            onClose();
            request({ kind: "buy", view: activeView });
          }
        }}
      >
        <ShoppingBag size={16} aria-hidden /> Buy Now
      </button>
    );
  };

  return (
    <OverlayPortal>
      <div
        className="overlay"
        role="presentation"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className={styles.modal}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="nft-quickview-title"
          tabIndex={-1}
        >
          <button
            ref={closeRef}
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2.2} aria-hidden />
          </button>

          <div className={styles.modalMedia}>
            {loading ? (
              <div className={styles.modalMediaSkeleton} aria-hidden />
            ) : (
              <Artwork
                src={image}
                alt={name}
                sizes="(max-width: 900px) 100vw, 520px"
                priority
              />
            )}
          </div>

          <div className={styles.modalAside}>
            {DEMO_MODE && (
              <div className="notice warn" role="note">
                <strong>Demo preview.</strong>&nbsp;Sample market data —
                transaction actions are disabled.
              </div>
            )}

            {demoNotice && (
              <div className="notice" role="status">
                {demoNotice}
              </div>
            )}

            {collectionName && (
              <div className="eyebrow">
                {collectionHref ? (
                  <Link href={collectionHref} style={{ color: "var(--accent)" }}>
                    {collectionName}
                  </Link>
                ) : (
                  collectionName
                )}
              </div>
            )}

            <div className={styles.modalHead}>
              <h2 id="nft-quickview-title" className={styles.modalTitle}>
                {name}
                {verified && <VerifiedBadge label="" />}
              </h2>
            </div>

            <div className="panel panel-pad" style={{ display: "grid", gap: 16 }}>
              <div className={styles.modalPriceRow}>
                <div className="price">
                  <span className="label">
                    {activeView ? "Current price" : lastView ? "Last price" : "Status"}
                  </span>
                  <span className="value" style={{ fontSize: 22 }}>
                    {displayView
                      ? formatSol(displayView.listing.price_lamports)
                      : "Not for sale"}
                  </span>
                </div>
                {activeView ? (
                  <StatusBadge status={activeView.listing.status} />
                ) : (
                  <span className="badge">
                    {lastView ? lastView.listing.status : "Unlisted"}
                  </span>
                )}
              </div>

              <div className="detail-row" style={{ padding: 0, borderBottom: 0 }}>
                <dt>{identityLabel}</dt>
                <dd>
                  {identityIsSelf ? (
                    <span style={{ color: "var(--text-strong)" }}>You</span>
                  ) : (
                    <Address value={beneficialOwner} head={5} tail={5} link />
                  )}
                </dd>
              </div>

              {renderActions()}

              <button
                type="button"
                className="btn btn-ghost btn-block"
                aria-pressed={watchlisted}
                onClick={() => toggle(address)}
              >
                <Heart
                  size={14}
                  fill={watchlisted ? "currentColor" : "none"}
                  aria-hidden
                />
                {watchlisted ? "On your watchlist" : "Add to watchlist"}
              </button>
            </div>

            <div className="attr-grid">
              <div className="attr">
                <div className="k">Standard</div>
                <div className="v">{asset?.standard ?? displayView?.standard ?? "—"}</div>
              </div>
              {showCreator ? (
                <div className="attr">
                  <div className="k">Creator</div>
                  <div className="v">
                    <Address value={creatorAddress} head={5} tail={5} />
                  </div>
                </div>
              ) : null}
              <div className="attr">
                <div className="k">Royalty</div>
                <div className="v">{royalty ?? "None configured"}</div>
              </div>
            </div>

            {attributes && attributes.length > 0 && (
              <div style={{ display: "grid", gap: 10 }}>
                <div className="eyebrow">Attributes</div>
                <div className="attr-grid">
                  {attributes.map((a) => (
                    <div className="attr" key={`${a.trait}-${a.value}`}>
                      <div className="k">{a.trait}</div>
                      <div className="v">{a.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="detail-row" style={{ padding: 0 }}>
              <dt>Asset</dt>
              <dd style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Address value={address} head={6} tail={6} />
                <a
                  className="btn btn-ghost btn-sm"
                  href={explorerAddressUrl(address)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Explorer <ExternalLink size={12} aria-hidden />
                </a>
              </dd>
            </div>

            {description && (
              <div className="prose">
                <p>{description}</p>
              </div>
            )}

            <div
              className="mono"
              style={{ color: "var(--muted)", fontSize: 12, display: "grid", gap: 4 }}
            >
              <span>{NETWORK_LABEL}</span>
              {lastView?.listing.status === "sold" && lastView.listing.created_at && (
                <span>
                  Last sale {relativeTime(lastView.listing.created_at) ?? "—"}
                </span>
              )}
            </div>

            <Link
              href={`/nft/${address}`}
              className="btn btn-outline btn-block"
              onClick={onClose}
            >
              View full details <ExternalLink size={13} aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
