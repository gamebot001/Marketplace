/**
 * Initialize the on-chain Zecians marketplace configuration on Devnet.
 *
 * Idempotent: if the marketplace PDA already exists it prints the current
 * configuration and exits without sending a transaction. Uses the deployer
 * keypair as the authority/payer and the dedicated Devnet treasury as the fee
 * recipient. Run after `anchor deploy`.
 */

process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID =
  process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID ||
  "5E5HHbGwZbhmEcoRwBXArzoGqxX6Yh9ACPHET6EwnAwJ";
process.env.NEXT_PUBLIC_SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  type Transaction,
} from "@solana/web3.js";
import {
  buildTransaction,
  deriveMarketplacePda,
  getProgram,
} from "../marketplace-website/lib/solana/marketplace-program";
import { signSendAndConfirm } from "../marketplace-website/lib/solana/solana-confirmation";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!;
const FEE_BPS = Number(process.env.ZECIANS_MARKETPLACE_FEE_BPS || 250);
const TREASURY =
  process.env.SOLANA_TREASURY_ADDRESS ||
  "BNH88D4eHHWcRTTUvxjKqqnKFCcGvnkBuDxkS8W4Yrxz";
const DEPLOYER_KEYPAIR = resolve(homedir(), ".config/solana/zecians-deployer.json");

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const deployer = loadKeypair(DEPLOYER_KEYPAIR);
  const marketplace = deriveMarketplacePda();
  const program = getProgram(connection, deployer.publicKey);

  const existing = await connection.getAccountInfo(marketplace, "confirmed");
  if (existing) {
    const account = await program.account.marketplace.fetch(marketplace);
    console.log("Marketplace already initialized:", {
      pda: marketplace.toBase58(),
      treasury: account.treasury.toBase58(),
      feeBps: account.marketplaceFeeBps,
      listingEnabled: account.listingEnabled,
      buyEnabled: account.buyEnabled,
      paused: account.paused,
    });
    return;
  }

  console.log("Initializing marketplace", marketplace.toBase58(), "treasury", TREASURY);
  const instruction = await program.methods
    .initializeMarketplace(FEE_BPS)
    .accounts({
      authority: deployer.publicKey,
      marketplace,
      treasury: new PublicKey(TREASURY),
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const sender = {
    publicKey: deployer.publicKey,
    sendTransaction: async (transaction: Transaction, conn: Connection) => {
      transaction.partialSign(deployer);
      return conn.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
    },
  };

  const signature = await signSendAndConfirm(
    sender,
    connection,
    buildTransaction(deployer.publicKey, instruction)
  );
  console.log("Marketplace initialized:", signature);
  console.log("Explorer:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
