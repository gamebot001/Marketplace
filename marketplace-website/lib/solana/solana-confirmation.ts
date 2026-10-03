/**
 * Wallet → cluster submission and confirmation.
 *
 * This is the single place where a signed transaction is sent and confirmed.
 * Success is returned only after the cluster confirms the transaction without
 * error. A rejected wallet prompt and an on-chain failure are distinct errors
 * so the UI never reports a false success.
 */

import type { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { syncIndexer } from "@/lib/api/indexer-sync";

export class TransactionRejectedError extends Error {
  constructor(message = "The transaction was rejected in your wallet.") {
    super(message);
    this.name = "TransactionRejectedError";
  }
}

export class TransactionFailedError extends Error {
  readonly signature: string | null;
  constructor(message: string, signature: string | null = null) {
    super(message);
    this.name = "TransactionFailedError";
    this.signature = signature;
  }
}

/** The minimum a caller must expose to submit a transaction. */
export interface WalletSender {
  publicKey: PublicKey;
  sendTransaction: (
    transaction: Transaction,
    connection: Connection,
    options?: { skipPreflight?: boolean; maxRetries?: number }
  ) => Promise<string>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Confirm a signature by polling `getSignatureStatuses` over HTTP. Public
 * Devnet RPC throttles websocket subscriptions aggressively (429s), so polling
 * is the reliable confirmation path here.
 */
async function confirmSignatureOverHttp(
  connection: Connection,
  signature: string,
  lastValidBlockHeight: number
): Promise<void> {
  const started = Date.now();
  for (;;) {
    try {
      const response = await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: false,
      });
      const value = response.value[0];
      if (value?.err) {
        throw new TransactionFailedError(
          "The transaction was confirmed as failed by the cluster.",
          signature
        );
      }
      if (
        value?.confirmationStatus === "confirmed" ||
        value?.confirmationStatus === "finalized"
      ) {
        return;
      }
      const blockHeight = await connection.getBlockHeight("confirmed").catch(() => 0);
      if (blockHeight > lastValidBlockHeight) {
        throw new TransactionFailedError(
          "The transaction expired before it was confirmed.",
          signature
        );
      }
    } catch (error) {
      if (error instanceof TransactionFailedError) throw error;
      // Transient RPC error (e.g. 429): keep polling the same signature.
    }
    if (Date.now() - started > 120_000) {
      throw new TransactionFailedError(
        "Confirmation could not be verified in time.",
        signature
      );
    }
    await delay(1200);
  }
}

/**
 * Sign via the wallet, submit, and wait for a real confirmation, then sync the
 * backend indexer so the read model reflects the confirmed transaction. Returns
 * the signature only after the cluster confirms success.
 */
export async function signSendAndConfirm(
  sender: WalletSender,
  connection: Connection,
  transaction: Transaction
): Promise<string> {
  transaction.feePayer = transaction.feePayer ?? sender.publicKey;

  let signature: string;
  let lastValidBlockHeight: number;
  try {
    const { blockhash, lastValidBlockHeight: validHeight } =
      await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = validHeight;
    lastValidBlockHeight = validHeight;
    signature = await sender.sendTransaction(transaction, connection, {
      skipPreflight: false,
      maxRetries: 3,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/user rejected|rejected the request|declined/i.test(message)) {
      throw new TransactionRejectedError();
    }
    throw new TransactionFailedError(message);
  }

  await confirmSignatureOverHttp(connection, signature, lastValidBlockHeight);

  // Confirmed: bring the backend read model up to date. Idempotent and
  // best-effort — a sync failure never turns a real tx into a false error.
  await syncIndexer();

  return signature;
}
