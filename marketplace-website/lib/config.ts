/**
 * Marketplace build configuration.
 *
 * Every value here is PUBLIC (NEXT_PUBLIC_*). No secret, private key, or seed
 * phrase can ever reach this module. Devnet is the only supported cluster in
 * this phase; mainnet is deliberately not selectable.
 */

export type MarketplaceCluster = "devnet" | "testnet";

function readCluster(): MarketplaceCluster {
  const raw = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet").toLowerCase();
  if (raw === "testnet") return "testnet";
  return "devnet";
}

export const MARKETPLACE = {
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8788",
  cluster: readCluster(),
  rpcUrl:
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
  programId: (process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID || "").trim(),
} as const;

/** True while the build targets a development chain. Shown as a top-level badge. */
export const IS_DEVNET = MARKETPLACE.cluster === "devnet";

/** Human network label, e.g. "Solana Devnet". */
export const NETWORK_LABEL =
  MARKETPLACE.cluster === "devnet" ? "Solana Devnet" : "Solana Testnet";

/** The backend's network identifier for this cluster. */
export const NETWORK_ID = `solana-${MARKETPLACE.cluster}`;

/** True only when a real, configured marketplace program id exists. */
export const PROGRAM_CONFIGURED = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(
  MARKETPLACE.programId
);
