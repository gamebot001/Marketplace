/**
 * PHASE 2A — create real Devnet marketplace activity.
 *
 * Runs the exact same client functions the UI uses (`submitList` / `submitBuy`
 * / `submitCancel`) with real Wallet A/B/C keypairs, producing:
 *   · 4 completed sales (A lists → B buys)
 *   · 5 cancellations (A and C list then cancel)
 *   · 10 active listings (A and C)
 * Every step is a real confirmed Devnet transaction; the indexer is polled so
 * the backend read model reflects exactly what the chain recorded.
 *
 * Run (backend must be running):
 *   npx tsx phase2a-marketplace.ts
 */

process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID =
  process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID ||
  "5E5HHbGwZbhmEcoRwBXArzoGqxX6Yh9ACPHET6EwnAwJ";
process.env.NEXT_PUBLIC_SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
process.env.NEXT_PUBLIC_BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8788";

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { Connection, Keypair } from "@solana/web3.js";
import { submitList } from "../marketplace-website/lib/solana/marketplace-listing";
import { submitBuy } from "../marketplace-website/lib/solana/marketplace-buying";
import { submitCancel } from "../marketplace-website/lib/solana/marketplace-cancellation";
import type { WalletSender } from "../marketplace-website/lib/solana/solana-confirmation";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!;
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;

const MINT_RESULTS = resolve(__dirname, ".keys", "phase2a-mint-results.json");
const RESULTS_PATH = resolve(__dirname, ".keys", "phase2a-marketplace-results.json");

const SOL = 1_000_000_000n;
const sol = (amount: number) => BigInt(Math.round(amount * Number(SOL)));

const connection = new Connection(RPC_URL, "confirmed");

interface MintedAsset {
  asset_address: string;
  owner_address: string;
  name: string;
  index: number;
  collection_address: string;
  collection_slug: string;
}
interface MintedCollection {
  slug: string;
  address: string;
  assets: MintedAsset[];
}

interface Step {
  kind: "list" | "buy" | "cancel";
  asset: string;
  name: string;
  collection: string;
  price_lamports?: string;
  signature: string;
  explorer: string;
  status: "passed" | "failed";
  detail?: string;
}

const steps: Step[] = [];

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

function keypairSender(keypair: Keypair): WalletSender {
  return {
    publicKey: keypair.publicKey,
    sendTransaction: async (transaction, conn) => {
      transaction.partialSign(keypair);
      return conn.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
    },
  };
}

const explorer = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

async function poll(): Promise<void> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/indexer/poll`, { method: "POST" });
    if (!response.ok) console.warn("  indexer poll HTTP", response.status);
  } catch (error) {
    console.warn("  indexer poll skipped:", error instanceof Error ? error.message : error);
  }
}

function bySlug(collections: MintedCollection[], slug: string): MintedCollection {
  const found = collections.find((c) => c.slug === slug);
  if (!found) throw new Error(`missing collection ${slug}`);
  return found;
}

function asset(collections: MintedCollection[], slug: string, index: number): MintedAsset {
  const collection = bySlug(collections, slug);
  const found = collection.assets.find((a) => a.index === index);
  if (!found) throw new Error(`missing asset ${slug} #${index}`);
  return found;
}

async function main() {
  if (!existsSync(MINT_RESULTS)) {
    throw new Error(`Mint results not found at ${MINT_RESULTS}. Run phase2a-mint.ts first.`);
  }
  const mint = JSON.parse(readFileSync(MINT_RESULTS, "utf8")) as { collections: MintedCollection[] };
  const collections = mint.collections;

  const walletA = loadKeypair(`${homedir()}/.config/solana/zecians-wallet-a.json`);
  const walletB = loadKeypair(`${homedir()}/.config/solana/zecians-wallet-b.json`);
  const walletC = loadKeypair(`${homedir()}/.config/solana/zecians-wallet-c.json`);
  const senderA = keypairSender(walletA);
  const senderB = keypairSender(walletB);
  const senderC = keypairSender(walletC);

  console.log("Seller A:", walletA.publicKey.toBase58());
  console.log("Buyer  B:", walletB.publicKey.toBase58());
  console.log("Collector C:", walletC.publicKey.toBase58());

  async function list(
    assetEntry: MintedAsset,
    seller: WalletSender,
    price: bigint
  ): Promise<string> {
    const signature = await submitList(
      {
        assetAddress: assetEntry.asset_address,
        collectionAddress: assetEntry.collection_address,
        priceLamports: price,
      },
      seller,
      connection
    );
    await poll();
    steps.push({
      kind: "list",
      asset: assetEntry.asset_address,
      name: assetEntry.name,
      collection: assetEntry.collection_slug,
      price_lamports: price.toString(),
      signature,
      explorer: explorer(signature),
      status: "passed",
    });
    console.log(`  [LIST] ${assetEntry.name} @ ${Number(price) / 1e9} SOL — ${signature}`);
    return signature;
  }

  async function buy(assetEntry: MintedAsset, sellerPubkey: string): Promise<string> {
    const signature = await submitBuy(
      {
        assetAddress: assetEntry.asset_address,
        sellerAddress: sellerPubkey,
        collectionAddress: assetEntry.collection_address,
      },
      senderB,
      connection
    );
    await poll();
    steps.push({
      kind: "buy",
      asset: assetEntry.asset_address,
      name: assetEntry.name,
      collection: assetEntry.collection_slug,
      signature,
      explorer: explorer(signature),
      status: "passed",
    });
    console.log(`  [BUY ] ${assetEntry.name} — ${signature}`);
    return signature;
  }

  async function cancel(assetEntry: MintedAsset, seller: WalletSender): Promise<string> {
    const signature = await submitCancel(
      {
        assetAddress: assetEntry.asset_address,
        collectionAddress: assetEntry.collection_address,
      },
      seller,
      connection
    );
    await poll();
    steps.push({
      kind: "cancel",
      asset: assetEntry.asset_address,
      name: assetEntry.name,
      collection: assetEntry.collection_slug,
      signature,
      explorer: explorer(signature),
      status: "passed",
    });
    console.log(`  [CANC] ${assetEntry.name} — ${signature}`);
    return signature;
  }

  const sellerA = walletA.publicKey.toBase58();
  const sellerC = walletC.publicKey.toBase58();

  console.log("\n== Completed sales (A lists → B buys) ==");
  const sales: Array<[string, number, number]> = [
    ["cats", 1, 0.25],
    ["dogs", 2, 0.5],
    ["horses", 3, 0.75],
    ["cats", 4, 1.0],
  ];
  for (const [slug, index, price] of sales) {
    const entry = asset(collections, slug, index);
    await list(entry, senderA, sol(price));
    await buy(entry, sellerA);
  }

  console.log("\n== Cancellations (A and C) ==");
  const cancels: Array<[string, number, "A" | "C"]> = [
    ["cats", 3, "A"],
    ["dogs", 4, "A"],
    ["horses", 5, "A"],
    ["squirrels", 4, "C"],
    ["turtles", 3, "C"],
  ];
  for (const [slug, index, who] of cancels) {
    const entry = asset(collections, slug, index);
    await list(entry, who === "A" ? senderA : senderC, sol(0.4));
    await cancel(entry, who === "A" ? senderA : senderC);
  }

  console.log("\n== Active listings ==");
  const active: Array<[string, number, number, "A" | "C"]> = [
    ["dogs", 1, 1.5, "A"],
    ["dogs", 3, 2.0, "A"],
    ["horses", 1, 0.25, "A"],
    ["horses", 4, 0.5, "A"],
    ["cats", 2, 0.75, "A"],
    ["squirrels", 1, 1.0, "C"],
    ["squirrels", 2, 1.5, "C"],
    ["squirrels", 3, 2.0, "C"],
    ["turtles", 1, 0.25, "C"],
    ["turtles", 2, 0.5, "C"],
  ];
  for (const [slug, index, price, who] of active) {
    const entry = asset(collections, slug, index);
    await list(entry, who === "A" ? senderA : senderC, sol(price));
  }

  const results = {
    network: "solana-devnet",
    rpc_url: RPC_URL,
    program_id: process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID,
    wallets: { A: sellerA, B: sellerB(walletB), C: sellerC },
    counts: {
      sales: steps.filter((s) => s.kind === "buy").length,
      cancellations: steps.filter((s) => s.kind === "cancel").length,
      active_listings: active.length,
    },
    steps,
    finished_at: new Date().toISOString(),
  };
  mkdirSync(dirname(RESULTS_PATH), { recursive: true });
  writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
  console.log("\nWrote", RESULTS_PATH);
  console.log(
    `Sales ${results.counts.sales}, cancellations ${results.counts.cancellations}, active listings ${results.counts.active_listings}`
  );
}

function sellerB(walletB: Keypair): string {
  return walletB.publicKey.toBase58();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
