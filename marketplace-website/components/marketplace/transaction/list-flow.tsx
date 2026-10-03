"use client";

import { useState } from "react";
import { useConfig } from "@/lib/api/hooks";
import { PROGRAM_CONFIGURED } from "@/lib/config";
import { bpsToPercent, formatSol, solToLamports } from "@/lib/format";
import { splitFees } from "@/lib/marketplace/fees";
import { submitList } from "@/lib/solana/marketplace-listing";
import { resolveImageUrl } from "@/lib/format";
import type { MarketplaceAsset } from "@/lib/api/types";
import { TransactionFlow } from "./flow-shell";
import { FlowSummary } from "./flow-summary";

export function ListFlow({
  asset,
  collectionName,
  onClose,
}: {
  asset: MarketplaceAsset;
  collectionName?: string;
  onClose: () => void;
}) {
  const { data: config, loading } = useConfig();
  const [priceInput, setPriceInput] = useState("");

  const priceLamports = solToLamports(priceInput);
  const validPrice = priceLamports !== null && priceLamports > 0n;

  const feeBps = config?.fees.marketplace_fee_bps ?? 0;
  const royaltyBps = asset.royalty_bps ?? config?.fees.royalty_bps_default ?? 0;
  const breakdown = splitFees(priceLamports ?? 0, feeBps, royaltyBps);
  const proceeds = breakdown.price - breakdown.fee - breakdown.royalty;

  const marketplaceEnabled = config?.marketplace_enabled ?? false;
  const programReady = PROGRAM_CONFIGURED && marketplaceEnabled;

  const unavailableMessage = loading
    ? "Loading the marketplace configuration. Please wait a moment."
    : !marketplaceEnabled
      ? "The marketplace is not enabled on this deployment yet, so this listing cannot be submitted. No transaction will be sent."
      : "The Zecians marketplace program is not deployed on Solana Devnet yet, so this listing cannot be submitted. No transaction will be sent.";

  const name = asset.name?.trim() || `${asset.asset_address.slice(0, 8)}…`;

  return (
    <TransactionFlow
      title="List for sale"
      confirmLabel={validPrice ? `List for ${formatSol(breakdown.price)}` : "Enter a price"}
      programReady={programReady}
      confirmDisabled={!validPrice}
      unavailableMessage={unavailableMessage}
      onClose={onClose}
      summary={
        <FlowSummary
          image={resolveImageUrl(asset.image ?? asset.metadata_uri)}
          name={name}
          collection={collectionName ?? null}
          verified={asset.verified_collection}
        />
      }
      reviewContent={
        <div className="field">
          <label htmlFor="list-price">Listing price (SOL)</label>
          <input
            id="list-price"
            className="input"
            inputMode="decimal"
            placeholder="0.00"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            autoComplete="off"
          />
          {priceInput !== "" && !validPrice && (
            <span className="mono" style={{ color: "var(--danger)" }}>
              Enter a valid amount with up to 9 decimal places.
            </span>
          )}
        </div>
      }
      rows={[
        {
          k: "Listing price",
          v: validPrice ? formatSol(breakdown.price) : "—",
        },
        {
          k:
            feeBps > 0
              ? `Marketplace fee (${bpsToPercent(feeBps)})`
              : "Marketplace fee",
          v: validPrice
            ? feeBps > 0
              ? `− ${formatSol(breakdown.fee)}`
              : "Disabled"
            : "—",
        },
        {
          k:
            royaltyBps > 0
              ? `Creator royalty (${bpsToPercent(royaltyBps)})`
              : "Creator royalty",
          v: validPrice
            ? royaltyBps > 0
              ? `− ${formatSol(breakdown.royalty)}`
              : "None configured"
            : "—",
        },
        {
          k: "You receive",
          v: validPrice ? formatSol(proceeds) : "—",
          total: true,
        },
        { k: "Asset", v: <span className="mono">{asset.asset_address}</span> },
        { k: "Network", v: "Solana Devnet" },
      ]}
      onConfirm={(sender, connection) =>
        submitList(
          {
            assetAddress: asset.asset_address,
            collectionAddress: asset.collection_address,
            priceLamports: breakdown.price,
          },
          sender,
          connection
        )
      }
    />
  );
}
