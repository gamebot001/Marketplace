"use client";

import { useConfig } from "@/lib/api/hooks";
import { PROGRAM_CONFIGURED } from "@/lib/config";
import { formatSol } from "@/lib/format";
import { submitCancel } from "@/lib/solana/transactions";
import { VerifiedBadge } from "@/components/ui/badges";
import type { ListingView } from "@/lib/marketplace/views";
import { TransactionFlow } from "./flow-shell";
import { FlowSummary } from "./flow-summary";

export function CancelFlow({
  view,
  onClose,
}: {
  view: ListingView;
  onClose: () => void;
}) {
  const { data: config, loading } = useConfig();
  const marketplaceEnabled = config?.marketplace_enabled ?? false;
  const programReady = PROGRAM_CONFIGURED && marketplaceEnabled;

  const unavailableMessage = loading
    ? "Loading the marketplace configuration. Please wait a moment."
    : !marketplaceEnabled
      ? "The marketplace is not enabled on this deployment yet, so this listing cannot be cancelled. No transaction will be sent."
      : "The Zecians marketplace program is not deployed on Solana Devnet yet, so this listing cannot be cancelled. No transaction will be sent.";

  return (
    <TransactionFlow
      title="Cancel listing"
      confirmLabel="Cancel listing"
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
        { k: "Current price", v: formatSol(view.listing.price_lamports) },
        { k: "Listing ID", v: <span className="mono">{view.listing.listing_id}</span> },
        { k: "Network", v: "Solana Devnet" },
      ]}
      onConfirm={(sender, connection) =>
        submitCancel(
          {
            listingId: view.listing.listing_id,
            assetAddress: view.listing.asset_address,
          },
          sender,
          connection
        )
      }
    />
  );
}
