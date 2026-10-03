/**
 * Phase 1 test-asset bootstrap (DEVELOPMENT TOOL — NOT a Creator Studio).
 *
 * Creates ONE Metaplex Core collection and FIVE real Core assets on Solana
 * Devnet using the existing project artwork in
 * `marketplace-website/public/demo-marketplace/`.
 *
 * No enforced royalty plugin is added, which is what lets the Phase 1
 * settlement be exactly `seller_proceeds = price - marketplace_fee`.
 *
 * Distribution:
 *   Wallet A (seller) → assets 1..3
 *   Wallet B (buyer)  → assets 4..5
 *
 * Run:
 *   node --env-file=../marketplace-website/.env.local \
 *     --import tsx marketplace-scripts/mint-test-assets.ts
 * (or: cd marketplace-scripts && npm run mint)
 */

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  create,
  createCollection,
  mplCore,
} from "@metaplex-foundation/mpl-core";
import {
  createSignerFromKeypair,
  generateSigner,
  signerIdentity,
  publicKey as umiPublicKey,
} from "@metaplex-foundation/umi";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { Connection, Keypair } from "@solana/web3.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  "https://api.devnet.solana.com";
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8788";

const KEYPAIRS = {
  deployer: process.env.ZECIANS_DEPLOYER_KEYPAIR
    ? resolve(process.env.ZECIANS_DEPLOYER_KEYPAIR)
    : resolve(homedir(), ".config/solana/zecians-deployer.json"),
  seller: process.env.ZECIANS_WALLET_A_KEYPAIR
    ? resolve(process.env.ZECIANS_WALLET_A_KEYPAIR)
    : resolve(homedir(), ".config/solana/zecians-wallet-a.json"),
  buyer: process.env.ZECIANS_WALLET_B_KEYPAIR
    ? resolve(process.env.ZECIANS_WALLET_B_KEYPAIR)
    : resolve(homedir(), ".config/solana/zecians-wallet-b.json"),
};

const OUTPUT_PATH = resolve(__dirname, ".keys/test-assets.json");

const ART_DIR = "/demo-marketplace/critters-quest";
const ART_FILES = [
  "art-01.avif",
  "art-02.avif",
  "art-03.avif",
  "art-04.avif",
  "art-05.avif",
];

const COLLECTION = {
  name: "Zecians Devnet Test",
  slug: "zecians-devnet-test",
  image: `${ART_DIR}/pfp.avif`,
  description:
    "Phase 1 Devnet test collection for the Zecians marketplace. No enforced creator royalties.",
  uriPlaceholder: "https://devnet.zecians.test/metadata/zecians-devnet-test/collection.json",
};

function loadKeypair(path: string): Keypair {
  const secret = JSON.parse(readFileSync(path, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");
  const deployer = loadKeypair(KEYPAIRS.deployer);
  const seller = loadKeypair(KEYPAIRS.seller);
  const buyer = loadKeypair(KEYPAIRS.buyer);

  console.log("RPC:", RPC_URL);
  console.log("Deployer (payer):", deployer.publicKey.toBase58());
  console.log("Wallet A / seller:", seller.publicKey.toBase58());
  console.log("Wallet B / buyer:", buyer.publicKey.toBase58());

  const umi = createUmi(RPC_URL).use(mplCore());
  const deployerKeypair = umi.eddsa.createKeypairFromSecretKey(deployer.secretKey);
  umi.use(signerIdentity(createSignerFromKeypair(umi, deployerKeypair)));

  // 1) Create the single test collection (no royalties plugin).
  const collectionSigner = generateSigner(umi);
  console.log("\nCreating collection…", collectionSigner.publicKey.toString());
  await createCollection(umi, {
    collection: collectionSigner,
    name: COLLECTION.name,
    uri: COLLECTION.uriPlaceholder,
  }).sendAndConfirm(umi);
  console.log("Collection created:", collectionSigner.publicKey.toString());

  // 2) Mint 5 Core assets: A gets 3, B gets 2.
  const owners = [
    seller.publicKey.toBase58(),
    seller.publicKey.toBase58(),
    seller.publicKey.toBase58(),
    buyer.publicKey.toBase58(),
    buyer.publicKey.toBase58(),
  ];

  const assets = [];
  for (let i = 0; i < ART_FILES.length; i += 1) {
    const assetSigner = generateSigner(umi);
    const name = `${COLLECTION.name} #${i + 1}`;
    const uri = `https://devnet.zecians.test/metadata/${COLLECTION.slug}/${i + 1}.json`;
    console.log(`\nMinting ${name} → ${owners[i]}`);
    await create(umi, {
      asset: assetSigner,
      collection: collectionSigner.publicKey as never,
      name,
      uri,
      owner: umiPublicKey(owners[i]),
    }).sendAndConfirm(umi);
    console.log("  asset:", assetSigner.publicKey.toString());
    assets.push({
      asset_address: assetSigner.publicKey.toString(),
      owner_address: owners[i],
      name,
      image: `${ART_DIR}/${ART_FILES[i]}`,
      metadata_uri: uri,
      collection_address: collectionSigner.publicKey.toString(),
    });
  }

  const record = {
    network: "solana-devnet",
    rpc_url: RPC_URL,
    created_at: new Date().toISOString(),
    collection: {
      name: COLLECTION.name,
      slug: COLLECTION.slug,
      address: collectionSigner.publicKey.toString(),
      image: COLLECTION.image,
      description: COLLECTION.description,
    },
    wallets: {
      seller: seller.publicKey.toBase58(),
      buyer: buyer.publicKey.toBase58(),
    },
    assets,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(record, null, 2));
  console.log("\nWrote", OUTPUT_PATH);

  // 3) Best-effort: register the collection + assets in the backend read model.
  try {
    const response = await fetch(`${BACKEND_URL}/api/indexer/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        collection: {
          name: COLLECTION.name,
          slug: COLLECTION.slug,
          collection_address: collectionSigner.publicKey.toString(),
          description: COLLECTION.description,
          image: COLLECTION.image,
          royalty_bps: 0,
          verified: true,
        },
        assets: assets.map((a) => ({
          asset_address: a.asset_address,
          collection_address: a.collection_address,
          owner_address: a.owner_address,
          metadata_uri: a.metadata_uri,
          royalty_bps: 0,
          name: a.name,
          image: a.image,
          description: `${a.name} — Phase 1 Devnet test asset.`,
        })),
      }),
    });
    console.log("Backend register:", response.status);
  } catch (error) {
    console.warn(
      "Backend register skipped (is the API running?):",
      error instanceof Error ? error.message : error
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
