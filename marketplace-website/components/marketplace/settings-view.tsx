"use client";

import { useConfig, useTreasury } from "@/lib/api/hooks";
import { MARKETPLACE, NETWORK_LABEL, PROGRAM_CONFIGURED } from "@/lib/config";
import { bpsToPercent, formatSol, shorten } from "@/lib/format";
import { explorerAddressUrl } from "@/lib/solana/cluster";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { LineSkeleton } from "@/components/ui/skeleton";

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function SettingsView() {
  const config = useConfig();
  const treasury = useTreasury();

  return (
    <div style={{ display: "grid", gap: 40 }}>
      <section id="network" className="panel panel-pad" style={{ display: "grid", gap: 4 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Network
        </div>
        <dl style={{ margin: 0 }}>
          <Row label="Cluster" value={NETWORK_LABEL} />
          <Row label="Chain" value={config.data?.chain ?? "solana"} />
          <Row label="RPC endpoint" value={<span className="mono">{MARKETPLACE.rpcUrl}</span>} />
          <Row label="NFT standard" value={config.data?.nft_standard ?? "metaplex-core"} />
          <Row
            label="Marketplace program"
            value={
              PROGRAM_CONFIGURED ? (
                <span className="mono">{shorten(MARKETPLACE.programId, 6, 6)}</span>
              ) : (
                <span className="badge badge-danger">Not deployed</span>
              )
            }
          />
          <Row
            label="Mainnet"
            value={<span className="badge badge-danger">Hard-disabled</span>}
          />
        </dl>
      </section>

      <section className="panel panel-pad" style={{ display: "grid", gap: 4 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Configuration &amp; fees
        </div>
        {config.loading ? (
          <div style={{ display: "grid", gap: 12 }}>
            <LineSkeleton />
            <LineSkeleton width="70%" />
          </div>
        ) : config.error ? (
          <div className="notice error">{config.error}</div>
        ) : config.data ? (
          <dl style={{ margin: 0 }}>
            <Row
              label="Marketplace enabled"
              value={config.data.marketplace_enabled ? "Yes" : "No"}
            />
            <Row
              label="Marketplace fee"
              value={
                bpsToPercent(config.data.fees.marketplace_fee_bps) ??
                "Disabled (0 bps)"
              }
            />
            <Row
              label="Default secondary royalty"
              value={
                bpsToPercent(config.data.fees.royalty_bps_default) ??
                "None configured"
              }
            />
            <Row label="Settlement currency" value={config.data.fees.currency} />
            <Row label="Mint enabled" value={config.data.mint_enabled ? "Yes" : "No"} />
            <Row
              label="Allowlist enabled"
              value={config.data.allowlist_enabled ? "Yes" : "No"}
            />
          </dl>
        ) : null}
        <div className="notice" style={{ marginTop: 14 }}>
          Fee percentages are configurable and shown exactly as configured.
          Nothing here is a promise of token allocation or airdrops.
        </div>
      </section>

      <section id="treasury" className="panel panel-pad" style={{ display: "grid", gap: 4 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Treasury
        </div>
        {treasury.loading ? (
          <LineSkeleton width="60%" />
        ) : treasury.error ? (
          <ErrorState message={treasury.error} />
        ) : treasury.data ? (
          <>
            <dl style={{ margin: 0 }}>
              <Row
                label="Treasury address"
                value={
                  treasury.data.treasury_address ? (
                    <a
                      className="mono"
                      href={explorerAddressUrl(treasury.data.treasury_address)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--accent)" }}
                    >
                      {shorten(treasury.data.treasury_address, 6, 6)}
                    </a>
                  ) : (
                    "Not configured"
                  )
                }
              />
              <Row
                label="Recorded fees"
                value={formatSol(treasury.data.summary.total_lamports)}
              />
              <Row
                label="Treasury events"
                value={String(treasury.data.summary.event_count)}
              />
            </dl>
            <div className="notice" style={{ marginTop: 14 }}>
              Zecians marketplace fees are routed to the Zecians Treasury.
              Marketplace fees and configured secondary-sale royalties are routed
              according to the marketplace and collection fee rules. The ledger
              shows only real recorded events.
            </div>
          </>
        ) : (
          <EmptyState title="No treasury data" />
        )}
      </section>

      <section className="panel panel-pad">
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Safety
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", display: "grid", gap: 8 }}>
          <li>Development network only — test SOL, never real funds.</li>
          <li>Zecians never asks for a seed phrase or private key.</li>
          <li>No transaction is ever reported successful without on-chain confirmation.</li>
          <li>Transaction explorer links always target the configured development cluster.</li>
        </ul>
      </section>
    </div>
  );
}
