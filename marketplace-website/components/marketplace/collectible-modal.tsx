"use client";

/**
 * In-page NFT overlay for the collection route.
 *
 * Exploring a piece should feel like opening it *inside* the collection, not
 * leaving for a separate detail page. This renders the real listing + asset
 * data (artwork, price/status, owner/seller, attributes, description and the
 * existing buy / list / cancel actions) in a portaled dialog above the page,
 * so the collection stays visible behind it.
 *
 * Flicker safety: the overlay lives in the shared root portal host (the
 * OverlayHostSentinel freezes the animated environment), the panel animates
 * only opacity/transform, and the body scroll-lock pairs with the always
 * reserved scrollbar gutter in globals.css so opening it cannot shift layout.
 */

import { useEffect, useRef, useState } from "react";
import {
  ShoppingBag,
  Tag,
  XCircle,
  X,
  Wallet as WalletIcon,
  ExternalLink,
} from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { MarketplaceAsset } from "@/lib/api/types";
import type { ListingView } from "@/lib/marketplace/views";
import { bpsToPercent, formatSol } from "@/lib/format";
import { explorerAddressUrl } from "@/lib/solana/cluster";
import { DEMO_MODE } from "@/lib/demo-marketplace-data";
import { Artwork } from "@/components/ui/artwork";
import { VerifiedBadge, StatusBadge } from "@/components/ui/badges";
import { Address } from "@/components/ui/address";
import { OverlayPortal, useDialogFocus } from "@/components/ui/overlay-portal";
import { useTransaction } from "@/components/marketplace/transaction/transaction-provider";
import { useWalletDialog } from "@/components/wallet/wallet-provider";
import styles from "./collection-view.module.css";

export function CollectibleModal({
  view,
  asset,
  onClose,
}: {
  view: ListingView;
  asset: MarketplaceAsset | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { publicKey, connected } = useWallet();
  const { request } = useTransaction();
  const { open: openWallet } = useWalletDialog();
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

  const { listing } = view;
  const connectedAddress = publicKey?.toBase58() ?? null;
  const isSeller = Boolean(
    connectedAddress && listing.seller_address === connectedAddress
  );
  const isOwner = Boolean(
    connectedAddress &&
      asset?.owner_address &&
      connectedAddress === asset.owner_address
  );

  const demoBlocked = (action: string) =>
    setDemoNotice(
      `${action} is disabled while demo data is active — this is a design preview with sample market data, not a real listing.`
    );

  const renderActions = () => {
    if (listing.status !== "active") return null;
    if (DEMO_MODE) {
      return (
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => demoBlocked("Buy Now")}
        >
          <ShoppingBag size={15} aria-hidden /> Buy Now
        </button>
      );
    }
    if (!connected) {
      return (
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={openWallet}
        >
          <WalletIcon size={15} aria-hidden /> Connect to buy
        </button>
      );
    }
    if (isSeller) {
      return (
        <button
          type="button"
          className="btn btn-danger btn-block"
          onClick={() => {
            onClose();
            request({ kind: "cancel", view });
          }}
        >
          <XCircle size={15} aria-hidden /> Cancel listing
        </button>
      );
    }
    if (isOwner && asset) {
      return (
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => {
            onClose();
            request({ kind: "list", asset, collectionName: view.collectionName });
          }}
        >
          <Tag size={15} aria-hidden /> Re-list for sale
        </button>
      );
    }
    return (
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => {
          onClose();
          request({ kind: "buy", view });
        }}
      >
        <ShoppingBag size={15} aria-hidden /> Buy Now
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
          aria-labelledby="nft-modal-title"
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
            <Artwork
              src={view.image}
              alt={view.name}
              sizes="(max-width: 900px) 100vw, 520px"
              priority
            />
          </div>

          <div className={styles.modalAside}>
            {DEMO_MODE && (
              <div className="notice warn" role="note">
                <strong>Demo preview.</strong>&nbsp;This asset is sample market
                data. Transaction actions are disabled.
              </div>
            )}

            {demoNotice && (
              <div className="notice" role="status">
                {demoNotice}
              </div>
            )}

            <div className={styles.modalHead}>
              <h2 id="nft-modal-title" className={styles.modalTitle}>
                {view.name}
                {view.collectionVerified && <VerifiedBadge label="" />}
              </h2>
            </div>

            <div className="panel panel-pad" style={{ display: "grid", gap: 16 }}>
              <div className={styles.modalPriceRow}>
                <div className="price">
                  <span className="label">Price</span>
                  <span className="value" style={{ fontSize: 22 }}>
                    {formatSol(listing.price_lamports)}
                  </span>
                </div>
                <StatusBadge status={listing.status} />
              </div>

              <div className="detail-row" style={{ padding: 0, borderBottom: 0 }}>
                <dt>Seller</dt>
                <dd>
                  <Address
                    value={listing.seller_address}
                    head={5}
                    tail={5}
                    link
                  />
                </dd>
              </div>

              {renderActions()}

              {isOwner && (
                <div
                  className="mono"
                  style={{ color: "var(--muted)", textAlign: "center" }}
                >
                  This asset is owned by your connected wallet.
                </div>
              )}
            </div>

            <div className="attr-grid">
              <div className="attr">
                <div className="k">Creator</div>
                <div className="v">
                  <Address
                    value={view.creatorAddress ?? asset?.creator_address ?? null}
                    head={5}
                    tail={5}
                  />
                </div>
              </div>
              <div className="attr">
                <div className="k">Royalty</div>
                <div className="v">
                  {bpsToPercent(view.royaltyBps ?? asset?.royalty_bps ?? null) ??
                    "None configured"}
                </div>
              </div>
              <div className="attr">
                <div className="k">Standard</div>
                <div className="v">{view.standard ?? asset?.standard ?? "—"}</div>
              </div>
            </div>

            {asset?.attributes && asset.attributes.length > 0 && (
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

            <div className="detail-row" style={{ padding: 0 }}>
              <dt>Asset</dt>
              <dd style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Address value={listing.asset_address} head={6} tail={6} />
                <a
                  className="btn btn-ghost btn-sm"
                  href={explorerAddressUrl(listing.asset_address)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Explorer <ExternalLink size={12} aria-hidden />
                </a>
              </dd>
            </div>

            {view.description && (
              <div className="prose">
                <p>{view.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
