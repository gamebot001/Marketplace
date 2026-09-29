/**
 * Solana cluster helpers.
 *
 * Everything here is read-only or URL construction. Devnet is the default and
 * the only cluster this build targets. Explorer links always carry the matching
 * cluster query so a devnet signature can never be mistaken for mainnet.
 */

import { MARKETPLACE } from "@/lib/config";

export function explorerCluster(
  cluster: string | null | undefined = MARKETPLACE.cluster
): string {
  if (cluster === "devnet") return "?cluster=devnet";
  if (cluster === "testnet") return "?cluster=testnet";
  return "";
}

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}${explorerCluster()}`;
}

export function explorerAddressUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}${explorerCluster()}`;
}
