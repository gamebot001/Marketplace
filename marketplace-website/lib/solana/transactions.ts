/**
 * Solana transaction plumbing for the marketplace.
 *
 * This module is REAL: it signs and sends transactions through the connected
 * wallet adapter and confirms them against the configured cluster. It contains
 * no simulated success paths.
 *
 * The on-chain marketplace program is not deployed yet, so the operation
 * builders below cannot produce valid instructions. Until it is deployed they
 * raise `MarketplaceProgramError`, and the UI surfaces that honestly. There is
 * no code path that reports a purchase, listing, or cancellation as successful
 * without a confirmed signature.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import { MARKETPLACE, PROGRAM_CONFIGURED } from "@/lib/config";

export class MarketplaceProgramError extends Error {
  readonly reason: "not-configured" | "not-published";
  constructor(reason: "not-configured" | "not-published", message: string) {
    super(message);
    this.name = "MarketplaceProgramError";
    this.reason = reason;
  }
}

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

export interface WalletSender {
  sendTransaction: (
    transaction: Transaction,
    connection: Connection,
    options?: { skipPreflight?: boolean; maxRetries?: number }
  ) => Promise<string>;
}

export function getConnection(): Connection {
  return new Connection(MARKETPLACE.rpcUrl, "confirmed");
}

/**
 * Guarantees a usable marketplace program before any money-touching flow runs.
 * Never substitutes a fake transaction.
 */
export function assertMarketplaceProgram(): PublicKey {
  if (!PROGRAM_CONFIGURED) {
    throw new MarketplaceProgramError(
      "not-configured",
      "The Zecians marketplace program is not deployed on this network yet, so this action cannot be submitted. No transaction has been sent."
    );
  }
  throw new MarketplaceProgramError(
    "not-published",
    "The marketplace program interface is not published for this build yet, so this action cannot be assembled into a transaction. No transaction has been sent."
  );
}

/**
 * Build the marketplace program instruction for an action. Not implemented
 * until the program is deployed; raising here keeps callers honest.
 */
export function buildMarketplaceInstruction(_action: string): TransactionInstruction {
  assertMarketplaceProgram();
  throw new Error("unreachable");
}

export interface BuyRequest {
  assetAddress: string;
  sellerAddress: string;
  priceLamports: number;
  currency: string;
}

export interface ListRequest {
  assetAddress: string;
  priceLamports: number;
  currency: string;
}

export interface CancelRequest {
  listingId: string;
  assetAddress: string;
}

/**
 * Submit a purchase. Requires the deployed marketplace program; before that it
 * raises and no transaction is created or sent. Never returns a fabricated
 * signature.
 */
export async function submitBuy(
  _request: BuyRequest,
  sender: WalletSender,
  connection: Connection
): Promise<string> {
  assertMarketplaceProgram();
  const transaction = new Transaction();
  transaction.add(buildMarketplaceInstruction("buy"));
  return signSendAndConfirm(sender, connection, transaction);
}

/** Submit a listing for sale. Same program gating as `submitBuy`. */
export async function submitList(
  _request: ListRequest,
  sender: WalletSender,
  connection: Connection
): Promise<string> {
  assertMarketplaceProgram();
  const transaction = new Transaction();
  transaction.add(buildMarketplaceInstruction("list"));
  return signSendAndConfirm(sender, connection, transaction);
}

/** Cancel an active listing. Same program gating as `submitBuy`. */
export async function submitCancel(
  _request: CancelRequest,
  sender: WalletSender,
  connection: Connection
): Promise<string> {
  assertMarketplaceProgram();
  const transaction = new Transaction();
  transaction.add(buildMarketplaceInstruction("cancel"));
  return signSendAndConfirm(sender, connection, transaction);
}

/**
 * Sign via the wallet, submit, and wait for a real confirmation. Returns the
 * signature only after the cluster confirms the transaction succeeded. A
 * rejected wallet prompt and an on-chain failure are distinct errors.
 */
export async function signSendAndConfirm(
  sender: WalletSender,
  connection: Connection,
  transaction: Transaction
): Promise<string> {
  let signature: string;
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(
      "confirmed"
    );
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
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

  try {
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash: transaction.recentBlockhash!, lastValidBlockHeight: transaction.lastValidBlockHeight! },
      "confirmed"
    );
    if (confirmation.value.err) {
      throw new TransactionFailedError(
        "The transaction was confirmed as failed by the cluster.",
        signature
      );
    }
  } catch (error) {
    if (error instanceof TransactionFailedError) throw error;
    throw new TransactionFailedError(
      error instanceof Error ? error.message : "Confirmation could not be verified.",
      signature
    );
  }
  return signature;
}
