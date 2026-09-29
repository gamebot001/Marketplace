/**
 * Zecians Main Website — public build configuration.
 *
 * Single source of truth for the marketplace destination. Every
 * "Enter Marketplace" action across the site resolves through this module.
 * Never hardcode the marketplace URL elsewhere.
 *
 * All values are PUBLIC (NEXT_PUBLIC_*). No secrets belong here.
 */

function readMarketplaceUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_MARKETPLACE_URL || "http://localhost:3001").trim();
  return raw.replace(/\/+$/, "") || "http://localhost:3001";
}

/** Base URL of the marketplace application (no trailing slash). */
export const MARKETPLACE_URL = readMarketplaceUrl();

/** Cluster label used only for the restrained footer note. */
export const NETWORK_LABEL =
  (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet").toLowerCase() === "testnet"
    ? "Solana Testnet"
    : "Solana Devnet";

/** True while the brand experience targets a development chain. */
export const IS_DEV_CHAIN = NETWORK_LABEL === "Solana Devnet";
