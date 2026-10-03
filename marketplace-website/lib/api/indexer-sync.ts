/**
 * Indexer synchronisation after a confirmed marketplace transaction.
 *
 * The chain is the source of truth; once a list/buy/cancel transaction is
 * confirmed the backend indexer must be nudged so the JsonFileStore read model
 * reflects the new on-chain state. Doing this here (rather than requiring a
 * manual `curl`) closes the Phase 1 manual-sync gap.
 *
 * `syncIndexer` is idempotent server-side (dedup by transaction signature), so
 * calling it for one confirmed transaction never duplicates activity.
 */

import { MARKETPLACE } from "@/lib/config";

/** Broadcast after a successful poll so mounted data hooks can refetch. */
export const MARKETPLACE_REFRESH_EVENT = "zecians:marketplace-refresh";

export interface RefreshDetail {
  source: "indexer-poll";
}

export async function syncIndexer(): Promise<boolean> {
  try {
    const response = await fetch(`${MARKETPLACE.backendUrl}/api/indexer/poll`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(MARKETPLACE_REFRESH_EVENT));
    }
    return response.ok;
  } catch {
    // A sync failure must never turn a confirmed on-chain tx into a UI error:
    // the transaction is still real, the read model simply lags until the next
    // poll. The manual endpoint remains available.
    return false;
  }
}
