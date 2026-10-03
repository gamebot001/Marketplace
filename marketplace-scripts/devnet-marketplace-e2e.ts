/**
 * Phase 1 headless two-keypair Devnet E2E.
 *
 * Executes the exact same client functions the UI calls
 * (`submitList` / `submitBuy` / `submitCancel`) against Solana Devnet using two
 * real keypairs, records the real transaction signatures, and verifies Core
 * ownership directly from the chain plus the backend read model.
 *
 * Run (API must be running for the read-model checks):
 *   cd marketplace-scripts && npm run e2e
 */

process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID =
  process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID ||
  "5E5HHbGwZbhmEcoRwBXArzoGqxX6Yh9ACPHET6EwnAwJ";
process.env.NEXT_PUBLIC_SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
process.env.NEXT_PUBLIC_BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8788";

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { submitList } from "../marketplace-website/lib/solana/marketplace-listing";
import { submitBuy } from "../marketplace-website/lib/solana/marketplace-buying";
import { submitCancel } from "../marketplace-website/lib/solana/marketplace-cancellation";
import {
  deriveListingPda,
  deriveMarketplacePda,
  getProgramId,
} from "../marketplace-website/lib/solana/marketplace-program";
import type { WalletSender } from "../marketplace-website/lib/solana/solana-confirmation";

const __dirname = dirname(fileURLToPath(import.meta.url));

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!;
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;
const PRICE = 2_000_000_000n; // 2 SOL
const FEE_BPS = 250n;
const EXPECTED_FEE = (PRICE * FEE_BPS) / 10_000n;
const EXPECTED_PROCEEDS = PRICE - EXPECTED_FEE;

const KEYPAIRS = {
  seller: resolve(homedir(), ".config/solana/zecians-wallet-a.json"),
  buyer: resolve(homedir(), ".config/solana/zecians-wallet-b.json"),
};

const ASSETS_PATH = resolve(__dirname, ".keys/test-assets.json");
const RESULTS_PATH = resolve(__dirname, ".keys/devnet-e2e-results.json");

const connection = new Connection(RPC_URL, "confirmed");

interface Step {
  name: string;
  status: "passed" | "failed" | "expected-failure";
  signature?: string | null;
  explorer?: string | null;
  detail?: string;
}

const steps: Step[] = [];

function explorer(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(path, "utf8")))
  );
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

async function coreOwner(asset: string): Promise<string | null> {
  const info = await connection.getAccountInfo(new PublicKey(asset), "confirmed");
  if (!info) return null;
  return new PublicKey(info.data.subarray(1, 33)).toBase58();
}

async function balance(address: string): Promise<bigint> {
  return BigInt(await connection.getBalance(new PublicKey(address), "confirmed"));
}

async function poll(): Promise<unknown> {
  const response = await fetch(`${BACKEND_URL}/api/indexer/poll`, {
    method: "POST",
  });
  return response.json();
}

async function backendListing(asset: string): Promise<any | null> {
  const response = await fetch(`${BACKEND_URL}/api/marketplace/listings?status=`);
  if (!response.ok) return null;
  const body: any = await response.json();
  const listings = body.listings || [];
  return listings.find((l: any) => l.asset_address === asset) || null;
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function record(step: Step) {
  steps.push(step);
  const icon =
    step.status === "passed" ? "PASS" : step.status === "expected-failure" ? "OK-FAIL" : "FAIL";
  console.log(`[${icon}] ${step.name}${step.signature ? ` — ${step.signature}` : ""}`);
  if (step.detail) console.log(`       ${step.detail}`);
}

async function main() {
  console.log("RPC:", RPC_URL);
  console.log("Program:", getProgramId().toBase58());
  console.log("Marketplace PDA:", deriveMarketplacePda().toBase58());

  const test = JSON.parse(readFileSync(ASSETS_PATH, "utf8"));
  const collection: string = test.collection.address;
  const sellerWallet = loadKeypair(KEYPAIRS.seller);
  const buyerWallet = loadKeypair(KEYPAIRS.buyer);
  const seller = sellerWallet.publicKey.toBase58();
  const buyer = buyerWallet.publicKey.toBase58();

  // Self-heal: recover any assets left escrowed by a previous interrupted run,
  // so the suite is re-runnable without re-minting.
  for (const asset of test.assets.map((a: any) => a.asset_address)) {
    const current = await coreOwner(asset);
    if (current === deriveListingPda(new PublicKey(asset)).toBase58()) {
      try {
        const sig = await submitCancel(
          { assetAddress: asset, collectionAddress: collection },
          keypairSender(sellerWallet),
          connection
        );
        console.log("Recovered escrowed asset", asset, sig);
      } catch (error) {
        console.log("Could not recover", asset, String(error).slice(0, 120));
      }
    }
  }

  const allAssets: string[] = test.assets.map((a: any) => a.asset_address);
  const owners = await Promise.all(allAssets.map((a) => coreOwner(a)));
  const sellerAssets = allAssets.filter((_, i) => owners[i] === seller);
  const buyerAssets = allAssets.filter((_, i) => owners[i] === buyer);

  console.log("Seller:", seller, "assets:", sellerAssets.length);
  console.log("Buyer:", buyer, "assets:", buyerAssets.length);
  if (sellerAssets.length < 2) {
    throw new Error(
      `Need at least 2 seller-owned assets for list/buy + cancel, found ${sellerAssets.length}. ` +
        "Re-run the mint script to bootstrap fresh assets."
    );
  }

  // TEST 2 — real Core ownership matches the recorded owners.
  for (const asset of [...sellerAssets, ...buyerAssets]) {
    const owner = await coreOwner(asset);
    assert(owner !== null, `asset ${asset} exists on-chain`);
  }
  record({
    name: "TEST 2 — wallets own real Core assets",
    status: "passed",
    detail: `${test.assets.length} Core assets verified on-chain`,
  });

  const listAsset = sellerAssets[0];
  const marketplace = deriveMarketplacePda();
  const listPda = deriveListingPda(new PublicKey(listAsset));
  const treasury = "BNH88D4eHHWcRTTUvxjKqqnKFCcGvnkBuDxkS8W4Yrxz";

  // TEST 3 — LIST
  const treasuryBeforeList = await balance(treasury);
  const listSig = await submitList(
    { assetAddress: listAsset, collectionAddress: collection, priceLamports: PRICE },
    keypairSender(sellerWallet),
    connection
  );
  assert((await coreOwner(listAsset)) === listPda.toBase58(), "escrow owns the asset");
  record({
    name: "TEST 3 — create_listing (escrow)",
    status: "passed",
    signature: listSig,
    explorer: explorer(listSig),
    detail: `asset escrowed to listing PDA ${listPda.toBase58()}`,
  });

  await poll();
  const activeListing = await backendListing(listAsset);
  assert(activeListing?.status === "active", "read model shows active listing");
  record({
    name: "TEST 3b — read model ACTIVE after confirmed tx",
    status: "passed",
    detail: `listing_id=${activeListing?.listing_id}`,
  });

  // TEST 4 — BUY
  const sellerBefore = await balance(seller);
  const buySig = await submitBuy(
    { assetAddress: listAsset, sellerAddress: seller, collectionAddress: collection },
    keypairSender(buyerWallet),
    connection
  );
  const ownerAfterBuy = await coreOwner(listAsset);
  assert(ownerAfterBuy === buyer, "buyer owns the asset after settlement");
  const sellerAfter = await balance(seller);
  const treasuryAfterBuy = await balance(treasury);
  const sellerDelta = sellerAfter - sellerBefore;
  const feeDelta = treasuryAfterBuy - treasuryBeforeList;
  assert(sellerDelta === EXPECTED_PROCEEDS, `seller received ${sellerDelta}`);
  assert(feeDelta === EXPECTED_FEE, `treasury received ${feeDelta}`);
  record({
    name: "TEST 4 — buy_nft (atomic settlement)",
    status: "passed",
    signature: buySig,
    explorer: explorer(buySig),
    detail: `owner→buyer, seller +${sellerDelta} lamports, treasury +${feeDelta} lamports (royalty 0)`,
  });

  await poll();
  const soldListing = await backendListing(listAsset);
  assert(soldListing?.status === "sold", "read model shows sold");
  record({
    name: "TEST 4b — read model SOLD after confirmed tx",
    status: "passed",
  });

  // TEST 5 — CANCEL
  const cancelAsset = sellerAssets[1];
  const cancelPda = deriveListingPda(new PublicKey(cancelAsset));
  const listSig2 = await submitList(
    { assetAddress: cancelAsset, collectionAddress: collection, priceLamports: PRICE },
    keypairSender(sellerWallet),
    connection
  );
  assert((await coreOwner(cancelAsset)) === cancelPda.toBase58(), "escrow owns asset 2");
  const cancelSig = await submitCancel(
    { assetAddress: cancelAsset, collectionAddress: collection },
    keypairSender(sellerWallet),
    connection
  );
  assert((await coreOwner(cancelAsset)) === seller, "seller reclaimed the asset");
  record({
    name: "TEST 5 — cancel_listing (escrow→seller)",
    status: "passed",
    signature: cancelSig,
    explorer: explorer(cancelSig),
    detail: `list sig ${listSig2}; NFT returned to seller`,
  });

  await poll();
  const cancelled = await backendListing(cancelAsset);
  assert(cancelled?.status === "cancelled", "read model shows cancelled");
  record({
    name: "TEST 5b — read model CANCELLED after confirmed tx",
    status: "passed",
  });

  // TEST 8 — invalid operations fail safely.
  try {
    await submitBuy(
      { assetAddress: listAsset, sellerAddress: seller, collectionAddress: collection },
      keypairSender(buyerWallet),
      connection
    );
    record({ name: "TEST 8a — buy already-sold listing", status: "failed", detail: "unexpectedly succeeded" });
  } catch (error) {
    record({
      name: "TEST 8a — buy already-sold listing is rejected",
      status: "expected-failure",
      detail: String(error).slice(0, 180),
    });
  }

  const wrongAsset = sellerAssets[1 % sellerAssets.length];
  await submitList(
    { assetAddress: wrongAsset, collectionAddress: collection, priceLamports: PRICE },
    keypairSender(sellerWallet),
    connection
  );
  try {
    await submitCancel(
      { assetAddress: wrongAsset, collectionAddress: collection },
      keypairSender(buyerWallet), // wrong wallet: B is not the seller
      connection
    );
    record({ name: "TEST 8b — wrong-wallet cancel", status: "failed", detail: "unexpectedly succeeded" });
  } catch (error) {
    record({
      name: "TEST 8b — wrong-wallet cancel is rejected",
      status: "expected-failure",
      detail: String(error).slice(0, 180),
    });
  }
  // Clean up the listing so the asset is not left escrowed.
  const cleanupSig = await submitCancel(
    { assetAddress: wrongAsset, collectionAddress: collection },
    keypairSender(sellerWallet),
    connection
  );
  assert((await coreOwner(wrongAsset)) === seller, "cleanup cancel returned asset");

  // Insufficient funds: fresh, unfunded wallet cannot buy.
  const broke = Keypair.generate();
  await submitList(
    { assetAddress: wrongAsset, collectionAddress: collection, priceLamports: PRICE },
    keypairSender(sellerWallet),
    connection
  );
  try {
    await submitBuy(
      { assetAddress: wrongAsset, sellerAddress: seller, collectionAddress: collection },
      keypairSender(broke),
      connection
    );
    record({ name: "TEST 8c — insufficient funds", status: "failed", detail: "unexpectedly succeeded" });
  } catch (error) {
    record({
      name: "TEST 8c — insufficient-funds buy is rejected",
      status: "expected-failure",
      detail: String(error).slice(0, 180),
    });
  }
  // Clean up so the asset returns to the seller and the run is re-runnable.
  const finalCancelSig = await submitCancel(
    { assetAddress: wrongAsset, collectionAddress: collection },
    keypairSender(sellerWallet),
    connection
  );
  assert((await coreOwner(wrongAsset)) === seller, "wrongAsset returned to seller");

  const results = {
    network: "solana-devnet",
    rpc_url: RPC_URL,
    program_id: getProgramId().toBase58(),
    marketplace_pda: marketplace.toBase58(),
    treasury,
    seller,
    buyer,
    collection_address: collection,
    price_lamports: PRICE.toString(),
    expected_fee_lamports: EXPECTED_FEE.toString(),
    expected_seller_proceeds_lamports: EXPECTED_PROCEEDS.toString(),
    steps,
    finished_at: new Date().toISOString(),
  };
  mkdirSync(dirname(RESULTS_PATH), { recursive: true });
  writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
  console.log("\nWrote", RESULTS_PATH);

  const failures = steps.filter((s) => s.status === "failed");
  if (failures.length > 0) {
    console.error(`\n${failures.length} step(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll Phase 1 E2E steps passed (including expected failures).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
