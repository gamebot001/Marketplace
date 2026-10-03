/**
 * PHASE 2A — mint the 7 discovered collections + 35 Core assets on Devnet.
 *
 * Reads the artwork manifest produced by phase2a-artwork.ts, creates one real
 * Metaplex Core collection + 5 real Core assets per collection, distributes
 * ownership across Wallet A (seller) / B (buyer) / C (collector), and registers
 * every record in the backend read model.
 *
 * Idempotent/resumable per collection: a collection already recorded with a
 * live on-chain address and all 5 assets present is skipped.
 *
 * Run:
 *   npx tsx phase2a-mint.ts
 */

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  create,
  createCollection,
  fetchCollection,
  mplCore,
} from "@metaplex-foundation/mpl-core";
import {
  createSignerFromKeypair,
  generateSigner,
  signerIdentity,
  publicKey as umiPublicKey,
  type Umi,
} from "@metaplex-foundation/umi";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  buildManifest,
  MANIFEST_PATH,
  type ArtworkManifest,
} from "./phase2a-artwork.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  "https://api.devnet.solana.com";
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8788";

const SOL_DIR = `${homedir()}/.config/solana`;
const KEYS = {
  deployer: resolve(process.env.ZECIANS_DEPLOYER_KEYPAIR || `${SOL_DIR}/zecians-deployer.json`),
  walletA: resolve(process.env.ZECIANS_WALLET_A_KEYPAIR || `${SOL_DIR}/zecians-wallet-a.json`),
  walletB: resolve(process.env.ZECIANS_WALLET_B_KEYPAIR || `${SOL_DIR}/zecians-wallet-b.json`),
  walletC: resolve(process.env.ZECIANS_WALLET_C_KEYPAIR || `${SOL_DIR}/zecians-wallet-c.json`),
};
const RESULTS_PATH = resolve(__dirname, ".keys", "phase2a-mint-results.json");
const FUND_C_LAMPORTS = 1_500_000_000; // 1.5 SOL of A's balance, Devnet only

function loadKeypair(path: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

function umiKeypair(umi: Umi, kp: Keypair) {
  return umi.eddsa.createKeypairFromSecretKey(kp.secretKey);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const delay = Math.min(8000, 1500 * (i + 1)) + Math.floor(Math.random() * 500);
      console.warn(`  retry ${i + 1}/${attempts} for ${label}: ${message.slice(0, 100)}`);
      await sleep(delay);
    }
  }
  throw lastError;
}

function isAlreadyInUse(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already in use|already initialized/i.test(message);
}

async function confirmSignature(
  connection: Connection,
  signature: string,
  label: string
): Promise<void> {
  const started = Date.now();
  for (;;) {
    try {
      const status = await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: false,
      });
      const value = status.value[0];
      if (value?.err) {
        throw new Error(`transaction ${signature} failed: ${JSON.stringify(value.err)}`);
      }
      if (
        value?.confirmationStatus === "confirmed" ||
        value?.confirmationStatus === "finalized"
      ) {
        await sleep(700);
        return;
      }
    } catch (error) {
      if (/transaction .* failed/.test(String(error))) throw error;
      // transient RPC error (e.g. 429) — keep polling this same signature
    }
    if (Date.now() - started > 120_000) {
      throw new Error(`timed out confirming ${label} (${signature})`);
    }
    await sleep(1400);
  }
}

/**
 * Send a Umi transaction builder over plain HTTP and confirm by polling
 * `getSignatureStatuses` — avoids the websocket subscriptions that the public
 * Devnet RPC throttles aggressively (429s). The transaction is only ever sent
 * once per call; confirmation retries never re-send (which would double-mint).
 */
async function sendAndConfirmHttp(
  umi: Umi,
  builder: { buildAndSign: (ctx: Umi) => Promise<unknown> },
  connection: Connection,
  label: string
): Promise<string> {
  let signature: string | null = null;
  try {
    signature = await withRetry(
      `${label} send`,
      async () => {
        const transaction = await builder.buildAndSign(umi as never);
        const bytes = umi.transactions.serialize(transaction as never);
        return connection.sendRawTransaction(bytes, {
          skipPreflight: false,
          maxRetries: 3,
        });
      },
      8
    );
  } catch (error) {
    if (isAlreadyInUse(error)) {
      console.warn(`  ${label}: account already exists on-chain — continuing.`);
      return "";
    }
    throw error;
  }
  await confirmSignature(connection, signature, label);
  return signature;
}

async function coreOwner(connection: Connection, asset: string): Promise<string | null> {
  const info = await connection.getAccountInfo(new PublicKey(asset), "confirmed");
  if (!info) return null;
  return new PublicKey(info.data.subarray(1, 33)).toBase58();
}

/** Create Wallet C if absent and fund it from Wallet A (Devnet play money). */
async function ensureWalletC(connection: Connection, walletA: Keypair): Promise<Keypair> {
  if (!existsSync(KEYS.walletC)) {
    const kp = Keypair.generate();
    writeFileSync(KEYS.walletC, JSON.stringify(Array.from(kp.secretKey)));
    console.log("Generated Wallet C:", kp.publicKey.toBase58());
  }
  const walletC = loadKeypair(KEYS.walletC);
  const balance = await connection.getBalance(walletC.publicKey, "confirmed");
  if (balance < FUND_C_LAMPORTS) {
    console.log("Funding Wallet C from Wallet A…");
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: walletA.publicKey,
        toPubkey: walletC.publicKey,
        lamports: FUND_C_LAMPORTS - balance,
      })
    );
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = walletA.publicKey;
    tx.partialSign(walletA);
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    await connection.confirmTransaction(signature, "confirmed");
    console.log("  funded Wallet C:", signature);
  }
  return walletC;
}

interface MintedAsset {
  asset_address: string;
  owner_address: string;
  name: string;
  index: number;
  image: string;
  metadata_uri: string;
  collection_address: string;
  collection_slug: string;
  artwork_path: string;
  mime_type: string;
}

interface MintedCollection {
  name: string;
  slug: string;
  address: string;
  image: string;
  description: string;
  symbol: string;
  artwork_path: string;
  assets: MintedAsset[];
}

function loadResults(): { collections: MintedCollection[] } {
  if (!existsSync(RESULTS_PATH)) return { collections: [] };
  try {
    return JSON.parse(readFileSync(RESULTS_PATH, "utf8"));
  } catch {
    return { collections: [] };
  }
}

function saveResults(results: { collections: MintedCollection[] }) {
  mkdirSync(dirname(RESULTS_PATH), { recursive: true });
  writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
}

/**
 * Deterministic owner distribution across the flat 35-asset list:
 *   first 15 → Wallet A (seller), next 10 → Wallet B (buyer), rest → Wallet C.
 */
function ownerFor(flatIndex: number, owners: string[]): string {
  if (flatIndex < 15) return owners[0];
  if (flatIndex < 25) return owners[1];
  return owners[2];
}

async function registerCollection(
  collection: MintedCollection
): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/indexer/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      collection: {
        name: collection.name,
        slug: collection.slug,
        collection_address: collection.address,
        description: collection.description,
        image: collection.image,
        royalty_bps: 0,
        verified: false,
        artwork_path: collection.artwork_path,
      },
      assets: collection.assets.map((a) => ({
        asset_address: a.asset_address,
        collection_address: a.collection_address,
        owner_address: a.owner_address,
        metadata_uri: a.metadata_uri,
        royalty_bps: 0,
        name: a.name,
        image: a.image,
        description: `${a.name} — Phase 2A Devnet test asset.`,
        attributes: [],
        artwork_path: a.artwork_path,
        mime_type: a.mime_type,
        collection_slug: a.collection_slug,
      })),
    }),
  });
  if (!response.ok) {
    throw new Error(`backend register failed: HTTP ${response.status}`);
  }
}

async function main() {
  const onlySlug = process.argv.find((a) => a.startsWith("--collection="))?.split("=")[1];
  const manifest: ArtworkManifest = existsSync(MANIFEST_PATH)
    ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
    : buildManifest();

  const connection = new Connection(RPC_URL, "confirmed");
  const deployer = loadKeypair(KEYS.deployer);
  const walletA = loadKeypair(KEYS.walletA);
  const walletB = loadKeypair(KEYS.walletB);
  const walletC = await ensureWalletC(connection, walletA);
  const owners = [
    walletA.publicKey.toBase58(),
    walletB.publicKey.toBase58(),
    walletC.publicKey.toBase58(),
  ];

  console.log("RPC:", RPC_URL);
  console.log("Backend:", BACKEND_URL);
  console.log("Deployer/payer:", deployer.publicKey.toBase58());
  console.log("Wallet A:", owners[0]);
  console.log("Wallet B:", owners[1]);
  console.log("Wallet C:", owners[2]);

  const umi = createUmi(RPC_URL).use(mplCore());
  umi.use(signerIdentity(createSignerFromKeypair(umi, umiKeypair(umi, deployer))));

  const results = loadResults();
  const doneSlugs = new Set(results.collections.map((c) => c.slug));

  let flatIndex = 0;
  for (const collection of manifest.collections) {
    const collectionFlatStart = flatIndex;
    flatIndex += collection.assets.length;

    if (onlySlug && collection.slug !== onlySlug) continue;
    const artworkByIndex = new Map(collection.assets.map((a) => [a.index, a]));

    if (doneSlugs.has(collection.slug)) {
      const existing = results.collections.find((c) => c.slug === collection.slug)!;
      const live = await coreOwner(connection, existing.address);
      const assetOwners = await Promise.all(
        existing.assets.map((a) => coreOwner(connection, a.asset_address))
      );
      if (live && assetOwners.every((o) => o !== null)) {
        console.log(`\nSkipping ${collection.name} (already minted).`);
        continue;
      }
    }

    console.log(`\n=== ${collection.name} (${collection.slug}) ===`);
    const collectionSigner = generateSigner(umi);
    const collectionUri = `${BACKEND_URL}/api/metadata/collection/${collection.slug}`;
    console.log("Creating collection…", collectionSigner.publicKey.toString());
    await sendAndConfirmHttp(
      umi,
      createCollection(umi, {
        collection: collectionSigner,
        name: collection.name,
        uri: collectionUri,
      }),
      connection,
      `createCollection ${collection.slug}`
    );
    const collectionAddress = collectionSigner.publicKey.toString();
    await fetchCollection(umi, collectionSigner.publicKey); // confirm readable

    const minted: MintedCollection = {
      name: collection.name,
      slug: collection.slug,
      address: collectionAddress,
      image: `/api/artwork/${collectionAddress}`,
      description: collection.metadata.description,
      symbol: collection.metadata.symbol,
      artwork_path: collection.pfp.artwork_path,
      assets: [],
    };

    for (const [position, asset] of collection.assets.entries()) {
      const assetSigner = generateSigner(umi);
      const owner = ownerFor(collectionFlatStart + position, owners);
      const metadataUri = `${BACKEND_URL}/api/metadata/${assetSigner.publicKey.toString()}`;
      console.log(`  mint ${asset.name} → ${owner.slice(0, 6)}… (${asset.mime_type})`);
      await sendAndConfirmHttp(
        umi,
        create(umi, {
          asset: assetSigner,
          collection: collectionSigner.publicKey as never,
          name: asset.name,
          uri: metadataUri,
          owner: umiPublicKey(owner),
        }),
        connection,
        `create ${asset.name}`
      );
      const discovered = artworkByIndex.get(asset.index)!;
      minted.assets.push({
        asset_address: assetSigner.publicKey.toString(),
        owner_address: owner,
        name: asset.name,
        index: asset.index,
        image: `/api/artwork/${assetSigner.publicKey.toString()}`,
        metadata_uri: metadataUri,
        collection_address: collectionAddress,
        collection_slug: collection.slug,
        artwork_path: discovered.artwork_path,
        mime_type: discovered.mime_type,
      });
    }

    console.log("Registering with backend…");
    await registerCollection(minted);

    const idx = results.collections.findIndex((c) => c.slug === collection.slug);
    if (idx >= 0) results.collections[idx] = minted;
    else results.collections.push(minted);
    saveResults(results);
    doneSlugs.add(collection.slug);
  }

  const totalAssets = results.collections.reduce((n, c) => n + c.assets.length, 0);
  console.log(`\nMinted collections: ${results.collections.length}`);
  console.log(`Minted assets: ${totalAssets}`);
  console.log("Wrote", RESULTS_PATH);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
