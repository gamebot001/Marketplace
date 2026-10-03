"use client";

import { useConfig } from "@/lib/api/hooks";
import { PROGRAM_CONFIGURED } from "@/lib/config";
import { bpsToPercent, formatSol } from "@/lib/format";
import { splitFees } from "@/lib/marketplace/fees";
import { submitBuy } from "@/lib/solana/marketplace-buying";
import { Artwork } from "@/components/ui/artwork";
import { VerifiedBadge } from "@/components/ui/badges";
import type { ListingView } from "@/lib/marketplace/views";
import { TransactionFlow } from "./flow-shell";
import { FlowSummary } from "./flow-summary";

export function BuyFlow({
  view,
  onClose,
}: {
  view: ListingView;
  onClose: () => void;
}) {
  const { data: config, loading } = useConfig();
  const feeBps = config?.fees.marketplace_fee_bps ?? 0;
  const royaltyBps = view.royaltyBps ?? config?.fees.royalty_bps_default ?? 0;
  const breakdown = splitFees(view.listing.price_lamports, feeBps, royaltyBps);
  const marketplaceEnabled = config?.marketplace_enabled ?? false;
  const programReady = PROGRAM_CONFIGURED && marketplaceEnabled;

  const unavailableMessage = loading
    ? "Loading the marketplace configuration. Please wait a moment."
    : !marketplaceEnabled
      ? "The marketplace is not enabled on this deployment yet, so this purchase cannot be submitted. No transaction will be sent."
      : "The Zecians marketplace program is not deployed on Solana Devnet yet, so this purchase cannot be submitted. No transaction will be sent.";

  const feeLabel = feeBps > 0 ? `Marketplace fee (${bpsToPercent(feeBps)})` : "Marketplace fee";
  const royaltyLabel =
    royaltyBps > 0 ? `Creator royalty (${bpsToPercent(royaltyBps)})` : "Creator royalty";

  return (
    <TransactionFlow
      title="Complete purchase"
      confirmLabel={`Buy for ${formatSol(breakdown.total)}`}
      programReady={programReady}
      unavailableMessage={unavailableMessage}
      onClose={onClose}
      summary={
        <FlowSummary
          image={view.image}
          name={view.name}
          collection={view.collectionName}
          verified={view.collectionVerified}
        />
      }
      rows={[
        { k: "Asset", v: view.name },
        {
          k: "Collection",
          v: (
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              {view.collectionName}
              {view.collectionVerified && <VerifiedBadge label="" />}
            </span>
          ),
        },
        { k: "Price", v: formatSol(breakdown.price) },
        { k: feeLabel, v: feeBps > 0 ? formatSol(breakdown.fee) : "Disabled" },
        {
          k: royaltyLabel,
          v: royaltyBps > 0 ? formatSol(breakdown.royalty) : "None configured",
        },
        { k: "Total", v: formatSol(breakdown.total), total: true },
        { k: "Seller", v: <span className="mono">{view.listing.seller_address}</span> },
        { k: "Network", v: "Solana Devnet" },
      ]}
      onConfirm={(sender, connection) =>
        submitBuy(
          {
            assetAddress: view.listing.asset_address,
            sellerAddress: view.listing.seller_address,
            collectionAddress: view.listing.collection_address,
          },
          sender,
          connection
        )
      }
    />
  );
}
