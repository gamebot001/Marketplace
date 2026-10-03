/**
 * Zecians marketplace program access (Phase 1).
 *
 * Locked stack: existing wallet-adapter → @solana/web3.js v1 →
 * @anchor-lang/core 0.32.2 → zecians_marketplace → Solana Devnet.
 *
 * This module owns the program id, connection, provider and PDA derivations so
 * no React component has to know how the marketplace is addressed on-chain.
 * It reads `NEXT_PUBLIC_*` values directly (and not via `@/lib/config`) so the
 * exact same module can be imported by the headless Devnet E2E runner.
 */

import { AnchorProvider, Program } from "@anchor-lang/core";
import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import idlJson from "./zecians_marketplace.idl.json";

// The IDL shape is Anchor-version specific; keep it loosely typed here and let
// the generated client carry the precise method/account types at call sites.
const idl = idlJson as any;

export const MARKETPLACE_SEED = "marketplace";
export const LISTING_SEED = "listing";

/** Metaplex Core program id (the asset standard, not our marketplace). */
export const MPL_CORE_PROGRAM_ID = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const RAW_PROGRAM_ID = (
  process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID || ""
).trim();
const RAW_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

/** True only when a syntactically valid program id is configured. */
export const PROGRAM_CONFIGURED = BASE58_ADDRESS.test(RAW_PROGRAM_ID);

export class MarketplaceProgramError extends Error {
  readonly reason: "not-configured" | "invalid";
  constructor(reason: "not-configured" | "invalid", message: string) {
    super(message);
    this.name = "MarketplaceProgramError";
    this.reason = reason;
  }
}

/** The configured marketplace program id, or a precise error. */
export function getProgramId(): PublicKey {
  if (!PROGRAM_CONFIGURED) {
    throw new MarketplaceProgramError(
      "not-configured",
      "The Zecians marketplace program is not configured for this build, so this action cannot be submitted. No transaction has been sent."
    );
  }
  try {
    return new PublicKey(RAW_PROGRAM_ID);
  } catch {
    throw new MarketplaceProgramError(
      "invalid",
      "The configured marketplace program id is invalid. No transaction has been sent."
    );
  }
}

/** Devnet connection for the configured RPC. */
export function getConnection(): Connection {
  return new Connection(RAW_RPC_URL, "confirmed");
}

/**
 * Read-only wallet shim. The connected wallet adapter performs the actual
 * signing through `WalletSender`; this shim only supplies the fee payer the
 * Anchor provider needs while assembling instructions.
 */
function readonlyWallet(publicKey: PublicKey) {
  const unsupported = async () => {
    throw new Error(
      "Signing is handled by the connected wallet adapter, not this provider."
    );
  };
  return {
    publicKey,
    signTransaction: unsupported,
    signAllTransactions: unsupported,
  };
}

/** Build an Anchor `Program` bound to the given connection and fee payer. */
// The generated client is intentionally loosely typed: method/account names are
// validated by the IDL at runtime, and precise generics here produce deep type
// instantiation errors without adding safety.
export function getProgram(connection: Connection, feePayer: PublicKey): any {
  const provider = new AnchorProvider(
    connection,
    readonlyWallet(feePayer) as never,
    { commitment: "confirmed", preflightCommitment: "confirmed" }
  );
  return new Program(idl, provider);
}

/** The singleton marketplace configuration PDA. */
export function deriveMarketplacePda(programId = getProgramId()): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(MARKETPLACE_SEED)],
    programId
  )[0];
}

/** The per-asset escrow listing PDA: [b"listing", marketplace, asset]. */
export function deriveListingPda(
  asset: PublicKey,
  programId = getProgramId()
): PublicKey {
  const marketplace = deriveMarketplacePda(programId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(LISTING_SEED), marketplace.toBuffer(), asset.toBuffer()],
    programId
  )[0];
}

/** A fresh, unsigned transaction with the wallet as fee payer. */
export function buildTransaction(
  feePayer: PublicKey,
  instruction: Transaction["instructions"][number]
): Transaction {
  const transaction = new Transaction();
  transaction.feePayer = feePayer;
  transaction.add(instruction);
  return transaction;
}
