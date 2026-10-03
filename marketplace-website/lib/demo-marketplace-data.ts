/**
 * DEMO MARKETPLACE DATASET — strictly isolated visual-preview data.
 * ----------------------------------------------------------------------------
 * This module exists ONLY so the frontend can be designed and evaluated while
 * the real backend has little or no marketplace activity.
 *
 *  · Nothing here is production data. Nothing here is written to any backend,
 *    database or Solana program. All "addresses" are inert, randomly generated
 *    strings and all transactions are invented for layout purposes only.
 *  · Every surface that renders this dataset must stay clearly labelled as
 *    demo / design-preview (see DEMO_MARKET_LABEL and the network bar).
 *  · Flip NEXT_PUBLIC_DEMO_MARKETPLACE=0 (or remove this module and its single
 *    call-site in lib/api/client.ts) to return to the real API.
 *
 * Artwork: REAL local files copied from ~/Desktop/collection-test into
 * /public/demo-marketplace — every collection gets its own PFP plus a set of
 * NFT artworks (name-normalised to /demo-marketplace/<slug>/).
 */

import type {
  ActivityEvent,
  MarketplaceAsset,
  MarketplaceCollection,
  MarketplaceListing,
} from "@/lib/api/types";

/** Master switch: demo data is on unless explicitly disabled. */
export const DEMO_MODE: boolean =
  process.env.NEXT_PUBLIC_DEMO_MARKETPLACE !== "0";

/** Persistent, obvious label shown wherever demo data is rendered. */
export const DEMO_MARKET_LABEL = "DEVNET · DESIGN PREVIEW";

/* ============================================================================
   Demo wallet identities (inert, generated strings — never real keys)
   ========================================================================== */

const W1 = "532eFwZvCh38QYrGwF9mpTm4oLnbgwDefrVmBDxs8aMP";
const W2 = "HGN1UyPzcHp2s6CcRkXprtCTk7cASABCousD6yQq3cu4";
const W3 = "WuyFJvLUjxv3k79Pp78ce4eFtEiaWS5qx9w3PAUiYTWR";
const W4 = "rHLdbZczg3ULcvB9S1d1ud4LGYBCGXjfo26WNHybLZeY";
const W5 = "bCR2L2eo7YrKdiCN2jG2PgsrgZc4Y4gTQPQoaMHyRsQ2";
const W6 = "dVpdxLVv8ssT1cvWzWg5AVucTfqSrq194DA65HRHKNAT";
const W7 = "C4oDfW815wc1rovQSdxa18oSfrzd34zhSUxmiakdB7fq";
const W8 = "2zYfv2HnQaCswp6Zg2W1sgCy2M2GKjqiD7TMATdu4ULg";
const W9 = "hEwhgm8ECrP2s3f6YSXo7JUqo7yA5Zrgee2aaWWw4PeS";
const W10 = "Rkkn1rCXULWNycD6nHxwEnKXxEAryaHKPs51Ew5r3ptW";

export const DEMO_WALLETS = [W1, W2, W3, W4, W5, W6, W7, W8, W9, W10];

/* ============================================================================
   Collections — every real project in the test folder, slug used as the key
   ========================================================================== */

const SOL = 1_000_000_000;

export interface DemoCollectionStats {
  /** Null when the collection has no active listing — never conflated with 0. */
  floorLamports: number | null;
  volumeLamports: number;
  change24hPercent: number;
  supply: number;
  listedCount: number;
  sales24h: number;
  /* Per-metric 24h change. Real values only — null carries through to the UI
     as "—" so a metric without a reported change never shows an invented one. */
  floorChange24hPercent?: number | null;
  volumeChange24hPercent?: number | null;
  salesChange24hPercent?: number | null;
  listedChange24hPercent?: number | null;
}

export const DEMO_COLLECTIONS: MarketplaceCollection[] = [
  {
    slug: "claynosaurz",
    name: "Claynosaurz",
    description:
      "Hand-crafted clay dinosaurs living in a miniature prehistoric world — collectible characters with cinematic animations.",
    image: "/demo-marketplace/claynosaurz/pfp.avif",
    standard: "Metaplex Core",
    verification_status: "verified",
    marketplace_status: "live",
    collection_address: "DemoClayColl-address-1111111111111111111111111",
    chain_deployed: true,
    royalty_bps: 500,
    supply: 9999,
    flagship: true,
    collection_id: "demo-claynosaurz",
  },
  {
    slug: "mad-lads",
    name: "Mad Lads",
    description:
      "A lively, expressive character collection built around personality, humour and a strongly engaged community.",
    image: "/demo-marketplace/mad-lads/pfp.avif",
    standard: "Metaplex Core",
    verification_status: "verified",
    marketplace_status: "live",
    collection_address: "DemoLadsColl-address-11111111111111111111111111",
    chain_deployed: true,
    royalty_bps: 500,
    supply: 9999,
    flagship: false,
    collection_id: "demo-mad-lads",
  },
  {
    slug: "degods",
    name: "DeGods",
    description:
      "A pioneering Solana PFP collection — gods of the metaverse with a long, well-documented history of community experimentation.",
    image: "/demo-marketplace/degods/pfp.avif",
    standard: "Metaplex Core",
    verification_status: "verified",
    marketplace_status: "live",
    collection_address: "DemoGodsColl-address-11111111111111111111111111",
    chain_deployed: true,
    royalty_bps: 500,
    supply: 9999,
    flagship: false,
    collection_id: "demo-degods",
  },
  {
    slug: "dga",
    name: "DGA",
    description:
      "Bold generative artwork with a distinctive painterly style — an art-first collection for collectors of composition and colour.",
    image: "/demo-marketplace/dga/pfp.avif",
    standard: "Metaplex Core",
    verification_status: "verified",
    marketplace_status: "live",
    collection_address: "DemoDgaColl-address-111111111111111111111111111",
    chain_deployed: true,
    royalty_bps: 500,
    supply: 5000,
    flagship: false,
    collection_id: "demo-dga",
  },
  {
    slug: "critters-quest",
    name: "Critters Quest",
    description:
      "A playful roster of adventuring critters, each a hand-illustrated character with its own quest archetype and palette.",
    image: "/demo-marketplace/critters-quest/pfp.avif",
    standard: "Metaplex Core",
    verification_status: "verified",
    marketplace_status: "live",
    collection_address: "DemoCrittersColl-address-111111111111111111111111",
    chain_deployed: true,
    royalty_bps: 500,
    supply: 4444,
    flagship: false,
    collection_id: "demo-critters-quest",
  },
  {
    slug: "famous-fox-federation",
    name: "Famous Fox Federation",
    description:
      "A long-standing Solana collective of sharply dressed foxes, built around a strong community and utility ecosystem.",
    image: "/demo-marketplace/famous-fox-federation/pfp.webp",
    standard: "Metaplex Core",
    verification_status: "verified",
    marketplace_status: "live",
    collection_address: "DemoFoxColl-address-11111111111111111111111111111",
    chain_deployed: true,
    royalty_bps: 500,
    supply: 7777,
    flagship: false,
    collection_id: "demo-famous-fox-federation",
  },
  {
    slug: "otc-desks",
    name: "OTC Desks",
    description:
      "A curated trading-desk collection where each piece represents a distinct over-the-counter desk identity.",
    image: "/demo-marketplace/otc-desks/pfp.avif",
    standard: "Metaplex Core",
    verification_status: "verified",
    marketplace_status: "live",
    collection_address: "DemoOtcColl-address-111111111111111111111111111111",
    chain_deployed: true,
    royalty_bps: 500,
    supply: 2222,
    flagship: false,
    collection_id: "demo-otc-desks",
  },
  {
    slug: "smb-gen2",
    name: "SMB Gen2",
    description:
      "The second generation of the Solana Monkey Business lineage — pixel monkeys with a deep, historical trading record.",
    image: "/demo-marketplace/smb-gen2/pfp.avif",
    standard: "Metaplex Core",
    verification_status: "verified",
    marketplace_status: "live",
    collection_address: "DemoSmbColl-address-111111111111111111111111111111",
    chain_deployed: true,
    royalty_bps: 500,
    supply: 5000,
    flagship: false,
    collection_id: "demo-smb-gen2",
  },
  {
    slug: "stonk-cats",
    name: "Stonk Cats",
    description:
      "A finance-flavoured feline collection — expressive cats rendered for a market-obsessed collecting crowd.",
    image: "/demo-marketplace/stonk-cats/pfp.avif",
    standard: "Metaplex Core",
    verification_status: "verified",
    marketplace_status: "live",
    collection_address: "DemoStonkColl-address-11111111111111111111111111111",
    chain_deployed: true,
    royalty_bps: 500,
    supply: 10000,
    flagship: false,
    collection_id: "demo-stonk-cats",
  },
];

const DEMO_COLLECTION_STATS: Record<string, DemoCollectionStats> = {
  claynosaurz: {
    floorLamports: 8.9 * SOL,
    volumeLamports: 142.5 * SOL,
    change24hPercent: 6.2,
    supply: 9999,
    listedCount: 4,
    sales24h: 11,
    floorChange24hPercent: null,
    volumeChange24hPercent: 6.2,
    salesChange24hPercent: null,
    listedChange24hPercent: null,
  },
  "mad-lads": {
    floorLamports: 12.4 * SOL,
    volumeLamports: 96.3 * SOL,
    change24hPercent: 3.1,
    supply: 9999,
    listedCount: 3,
    sales24h: 7,
    floorChange24hPercent: null,
    volumeChange24hPercent: 3.1,
    salesChange24hPercent: null,
    listedChange24hPercent: null,
  },
  degods: {
    floorLamports: 5.2 * SOL,
    volumeLamports: 88.7 * SOL,
    change24hPercent: -1.8,
    supply: 9999,
    listedCount: 3,
    sales24h: 9,
    floorChange24hPercent: null,
    volumeChange24hPercent: -1.8,
    salesChange24hPercent: null,
    listedChange24hPercent: null,
  },
  dga: {
    floorLamports: 3.6 * SOL,
    volumeLamports: 41.2 * SOL,
    change24hPercent: 9.4,
    supply: 5000,
    listedCount: 4,
    sales24h: 5,
    floorChange24hPercent: null,
    volumeChange24hPercent: 9.4,
    salesChange24hPercent: null,
    listedChange24hPercent: null,
  },
  "critters-quest": {
    floorLamports: 2.4 * SOL,
    volumeLamports: 54.8 * SOL,
    change24hPercent: 4.5,
    supply: 4444,
    listedCount: 6,
    sales24h: 12,
    floorChange24hPercent: null,
    volumeChange24hPercent: 4.5,
    salesChange24hPercent: null,
    listedChange24hPercent: null,
  },
  "famous-fox-federation": {
    floorLamports: 1.8 * SOL,
    volumeLamports: 33.5 * SOL,
    change24hPercent: -2.3,
    supply: 7777,
    listedCount: 5,
    sales24h: 8,
    floorChange24hPercent: null,
    volumeChange24hPercent: -2.3,
    salesChange24hPercent: null,
    listedChange24hPercent: null,
  },
  "otc-desks": {
    floorLamports: 6.7 * SOL,
    volumeLamports: 61.2 * SOL,
    change24hPercent: 1.9,
    supply: 2222,
    listedCount: 2,
    sales24h: 4,
    floorChange24hPercent: null,
    volumeChange24hPercent: 1.9,
    salesChange24hPercent: null,
    listedChange24hPercent: null,
  },
  "smb-gen2": {
    floorLamports: 9.3 * SOL,
    volumeLamports: 120.4 * SOL,
    change24hPercent: 5.7,
    supply: 5000,
    listedCount: 7,
    sales24h: 14,
    floorChange24hPercent: null,
    volumeChange24hPercent: 5.7,
    salesChange24hPercent: null,
    listedChange24hPercent: null,
  },
  "stonk-cats": {
    floorLamports: 0.9 * SOL,
    volumeLamports: 74.6 * SOL,
    change24hPercent: 11.2,
    supply: 10000,
    listedCount: 9,
    sales24h: 18,
    floorChange24hPercent: null,
    volumeChange24hPercent: 11.2,
    salesChange24hPercent: null,
    listedChange24hPercent: null,
  },
};

export function demoCollectionStats(
  slug: string | null | undefined
): DemoCollectionStats | null {
  if (!slug) return null;
  return DEMO_COLLECTION_STATS[slug] ?? null;
}

/**
 * Featured presentation media per collection: one strong artwork as the large
 * visual, the real PFP as the identity badge. Local demo files only — no
 * remote or invented artwork.
 */
const DEMO_COLLECTION_MEDIA: Record<string, { artwork: string; secondary: string }> = {
  claynosaurz: {
    artwork: "/demo-marketplace/claynosaurz/clay-4251.webp",
    secondary: "/demo-marketplace/claynosaurz/clay-3341.webp",
  },
  "mad-lads": {
    artwork: "/demo-marketplace/mad-lads/madlad-832.avif",
    secondary: "/demo-marketplace/mad-lads/madlad-2629.avif",
  },
  degods: {
    artwork: "/demo-marketplace/degods/degod-4488.avif",
    secondary: "/demo-marketplace/degods/degod-9609.avif",
  },
  dga: {
    artwork: "/demo-marketplace/dga/dga-02.avif",
    secondary: "/demo-marketplace/dga/dga-05.avif",
  },
  "critters-quest": {
    artwork: "/demo-marketplace/critters-quest/art-01.avif",
    secondary: "/demo-marketplace/critters-quest/art-02.avif",
  },
  "famous-fox-federation": {
    artwork: "/demo-marketplace/famous-fox-federation/art-01.avif",
    secondary: "/demo-marketplace/famous-fox-federation/art-02.avif",
  },
  "otc-desks": {
    artwork: "/demo-marketplace/otc-desks/art-01.avif",
    secondary: "/demo-marketplace/otc-desks/art-02.avif",
  },
  "smb-gen2": {
    artwork: "/demo-marketplace/smb-gen2/art-01.avif",
    secondary: "/demo-marketplace/smb-gen2/art-02.avif",
  },
  "stonk-cats": {
    artwork: "/demo-marketplace/stonk-cats/art-01.avif",
    secondary: "/demo-marketplace/stonk-cats/art-02.avif",
  },
};

export function demoCollectionMedia(
  slug: string | null | undefined
): { artwork: string; secondary: string; pfp: string | null } | null {
  if (!slug) return null;
  const media = DEMO_COLLECTION_MEDIA[slug];
  if (!media) return null;
  const collection = DEMO_COLLECTIONS.find((c) => c.slug === slug);
  return { artwork: media.artwork, secondary: media.secondary, pfp: collection?.image ?? null };
}

/** Short glyph used as an edge watermark on collection artwork. */
export function demoCollectionGlyph(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

/* ============================================================================
   Assets — 20 real artworks (5 per collection) with demo attributes
   ========================================================================== */

export interface DemoAttribute {
  trait: string;
  value: string;
}

interface DemoAssetSeed {
  address: string;
  collection: string;
  name: string;
  image: string;
  owner: string;
  attributes: DemoAttribute[];
}

const ASSET_SEEDS: DemoAssetSeed[] = [
  // Claynosaurz
  { address: "7FhDhLm47oD34oYvdV9deFnmFDijk8pwSt2sRTyzvbAE", collection: "claynosaurz", name: "Claynosaurz #2902", image: "/demo-marketplace/claynosaurz/clay-2902.gif", owner: W2, attributes: [{ trait: "Species", value: "T-Rex" }, { trait: "Scene", value: "Jungle" }, { trait: "Expression", value: "Grin" }] },
  { address: "wTVg7ZtJdVdNEJ8zpafyobWegAvNgAZRLgssRNqhTRzi", collection: "claynosaurz", name: "Claynosaurz #3341", image: "/demo-marketplace/claynosaurz/clay-3341.webp", owner: W3, attributes: [{ trait: "Species", value: "Brontosaurus" }, { trait: "Scene", value: "Swamp" }, { trait: "Mood", value: "Sleepy" }] },
  { address: "SHQzd9BvoMeJmHm1KAMZuEk9LvDDo1LqiVjx1pBc5km6", collection: "claynosaurz", name: "Claynosaurz #4251", image: "/demo-marketplace/claynosaurz/clay-4251.webp", owner: W4, attributes: [{ trait: "Species", value: "Triceratops" }, { trait: "Scene", value: "Volcano" }, { trait: "Expression", value: "Fierce" }] },
  { address: "rg8Q64CFkifgoEG8YRLhBoS9s1ujq7ABNE7DQHriUSrk", collection: "claynosaurz", name: "Claynosaurz #8698", image: "/demo-marketplace/claynosaurz/clay-8698.webp", owner: W5, attributes: [{ trait: "Species", value: "Raptor" }, { trait: "Scene", value: "Desert" }, { trait: "Mood", value: "Curious" }] },
  { address: "N7YjvwSa6amfygMTjyMoQaZTQT3s2hEKE6aGXbYmQYCF", collection: "claynosaurz", name: "Claynosaurz #9435", image: "/demo-marketplace/claynosaurz/clay-9435.webp", owner: W6, attributes: [{ trait: "Species", value: "Stegosaurus" }, { trait: "Scene", value: "Forest" }, { trait: "Mood", value: "Chill" }] },
  // Mad Lads
  { address: "xBhErWqhbWVmFvbnSfUnCVkXnAj2BoauJtutVn2mKF2Y", collection: "mad-lads", name: "Mad Lads #832", image: "/demo-marketplace/mad-lads/madlad-832.avif", owner: W3, attributes: [{ trait: "Background", value: "Amber" }, { trait: "Eyes", value: "Wink" }, { trait: "Fit", value: "Hoodie" }] },
  { address: "6Kg1C6uB6BGvEwTSendR74SPbMCuDhEktD887VM1TgLA", collection: "mad-lads", name: "Mad Lads #2086", image: "/demo-marketplace/mad-lads/madlad-2086.avif", owner: W7, attributes: [{ trait: "Background", value: "Violet" }, { trait: "Eyes", value: "Laser" }, { trait: "Fit", value: "Suit" }] },
  { address: "7C6igEjxwp6MMGy3g4ZPmNJrx39CKtNSty7PWL8fWpWY", collection: "mad-lads", name: "Mad Lads #2629", image: "/demo-marketplace/mad-lads/madlad-2629.avif", owner: W8, attributes: [{ trait: "Background", value: "Charcoal" }, { trait: "Eyes", value: "Side" }, { trait: "Hat", value: "Beanie" }] },
  { address: "rwhJyBK4Gqqto57m4N6DWAqEvRjDiTfcbhikzKBhEdPm", collection: "mad-lads", name: "Mad Lads #8540", image: "/demo-marketplace/mad-lads/madlad-8540.avif", owner: W1, attributes: [{ trait: "Background", value: "Sunset" }, { trait: "Eyes", value: "Wide" }, { trait: "Fit", value: "Varsity" }] },
  { address: "WnKBU3kLHFbNEvkYu7nRHC7iZz2TNpPZJRfbAhTFmTLP", collection: "mad-lads", name: "Mad Lads #9876", image: "/demo-marketplace/mad-lads/madlad-9876.avif", owner: W9, attributes: [{ trait: "Background", value: "Cream" }, { trait: "Eyes", value: "Squint" }, { trait: "Mouth", value: "Smirk" }] },
  // DeGods
  { address: "ruGMX7gxbp1NdyzarN8rr8pzfmSJVKGPdETtKWCVoSP7", collection: "degods", name: "DeGods #1402", image: "/demo-marketplace/degods/degod-1402.avif", owner: W4, attributes: [{ trait: "Aura", value: "Ash" }, { trait: "Crown", value: "Bronze" }, { trait: "Eyes", value: "Hooded" }] },
  { address: "psr8FbwXzcAkynaqrZ8k6q95bdngG1FU918AJ2v5KnL1", collection: "degods", name: "DeGods #4488", image: "/demo-marketplace/degods/degod-4488.avif", owner: W10, attributes: [{ trait: "Aura", value: "Ember" }, { trait: "Mask", value: "Gold" }, { trait: "Eyes", value: "Blind" }] },
  { address: "n17vojvjcoN7q1aeqGy5igrraiX4mPnS8KTkRAUtAaoB", collection: "degods", name: "DeGods #5118", image: "/demo-marketplace/degods/degod-5118.avif", owner: W2, attributes: [{ trait: "Aura", value: "Dust" }, { trait: "Crown", value: "Silver" }, { trait: "Mouth", value: "Grin" }] },
  { address: "dFLEauecwE2REep5LmUGXztRt681u52XspXw76ghUbT5", collection: "degods", name: "DeGods #8770", image: "/demo-marketplace/degods/degod-8770.avif", owner: W5, attributes: [{ trait: "Aura", value: "Smoke" }, { trait: "Mask", value: "Bone" }, { trait: "Eyes", value: "Glow" }] },
  { address: "xiq6tsahHruwhR6pNWKVCQ3hfai2b6egCjtSJL7GuU5w", collection: "degods", name: "DeGods #9609", image: "/demo-marketplace/degods/degod-9609.avif", owner: W7, attributes: [{ trait: "Aura", value: "Void" }, { trait: "Crown", value: "Thorn" }, { trait: "Mouth", value: "Stoic" }] },
  // DGA
  { address: "6766uiRtuvqYYdx4SAjbs7JiS5aQY5n6PXBW4LSW9szt", collection: "dga", name: "DGA #101", image: "/demo-marketplace/dga/dga-01.avif", owner: W6, attributes: [{ trait: "Palette", value: "Warm" }, { trait: "Composition", value: "Orbit" }, { trait: "Texture", value: "Grain" }] },
  { address: "iYRa147LpDMPnfHKTWw7K9y2jsiSgQmujrgnZv1e2TCH", collection: "dga", name: "DGA #217", image: "/demo-marketplace/dga/dga-02.avif", owner: W8, attributes: [{ trait: "Palette", value: "Amber" }, { trait: "Composition", value: "Fold" }, { trait: "Texture", value: "Paint" }] },
  { address: "msFj15oK2eAWRHefEwTQzXUeh8fS1GjzWHnRCS1msYLH", collection: "dga", name: "DGA #342", image: "/demo-marketplace/dga/dga-03.avif", owner: W9, attributes: [{ trait: "Palette", value: "Dusk" }, { trait: "Composition", value: "Wave" }, { trait: "Texture", value: "Charcoal" }] },
  { address: "nvEb9fRy5Gch5osvj6o7ZkTCJpE823L3aTDmKhcSYruk", collection: "dga", name: "DGA #458", image: "/demo-marketplace/dga/dga-04.avif", owner: W1, attributes: [{ trait: "Palette", value: "Ember" }, { trait: "Composition", value: "Spiral" }, { trait: "Texture", value: "Chalk" }] },
  { address: "wSWn4aFzD4SN6cJK8QfKmfVZs19NFwFnjSyhYERnhbFt", collection: "dga", name: "DGA #563", image: "/demo-marketplace/dga/dga-05.avif", owner: W10, attributes: [{ trait: "Palette", value: "Violet" }, { trait: "Composition", value: "Drape" }, { trait: "Texture", value: "Ink" }] },
];

export const DEMO_ASSETS: MarketplaceAsset[] = ASSET_SEEDS.map((seed, i) => ({
  asset_address: seed.address,
  collection_address:
    DEMO_COLLECTIONS.find((c) => c.slug === seed.collection)
      ?.collection_address ?? null,
  owner_address: seed.owner,
  standard: "Metaplex Core",
  metadata_uri: null,
  creator_address: DEMO_WALLETS[i % DEMO_WALLETS.length],
  royalty_bps: 500,
  verified_collection: true,
  name: seed.name,
  description: `${seed.name} — part of the ${seed.collection} demo preview on Zecians Marketplace.`,
  image: seed.image,
  attributes: seed.attributes,
}));

/** Demo attributes ride along as an optional, additive field. */
export type DemoAsset = MarketplaceAsset & { attributes?: DemoAttribute[] };

export function demoAttributesFor(
  assetAddress: string
): DemoAttribute[] | null {
  const seed = ASSET_SEEDS.find((s) => s.address === assetAddress);
  return seed ? seed.attributes : null;
}

/* ============================================================================
   Listings — 20 demo listings (14 active, 6 sold) with demo prices
   ========================================================================== */

interface DemoListingSeed {
  asset: string;
  seller: string;
  priceSol: number;
  status: "active" | "sold";
  minutesAgo: number;
  buyer?: string;
}

const LISTING_SEEDS: DemoListingSeed[] = [
  { asset: "7FhDhLm47oD34oYvdV9deFnmFDijk8pwSt2sRTyzvbAE", seller: W2, priceSol: 9.8, status: "active", minutesAgo: 4 },
  { asset: "xBhErWqhbWVmFvbnSfUnCVkXnAj2BoauJtutVn2mKF2Y", seller: W3, priceSol: 13.5, status: "active", minutesAgo: 11 },
  { asset: "6766uiRtuvqYYdx4SAjbs7JiS5aQY5n6PXBW4LSW9szt", seller: W6, priceSol: 3.9, status: "active", minutesAgo: 23 },
  { asset: "ruGMX7gxbp1NdyzarN8rr8pzfmSJVKGPdETtKWCVoSP7", seller: W4, priceSol: 5.6, status: "active", minutesAgo: 38 },
  { asset: "wTVg7ZtJdVdNEJ8zpafyobWegAvNgAZRLgssRNqhTRzi", seller: W3, priceSol: 8.2, status: "active", minutesAgo: 74 },
  { asset: "6Kg1C6uB6BGvEwTSendR74SPbMCuDhEktD887VM1TgLA", seller: W7, priceSol: 12.9, status: "active", minutesAgo: 121 },
  { asset: "iYRa147LpDMPnfHKTWw7K9y2jsiSgQmujrgnZv1e2TCH", seller: W8, priceSol: 4.4, status: "active", minutesAgo: 168 },
  { asset: "psr8FbwXzcAkynaqrZ8k6q95bdngG1FU918AJ2v5KnL1", seller: W10, priceSol: 6.1, status: "active", minutesAgo: 240 },
  { asset: "SHQzd9BvoMeJmHm1KAMZuEk9LvDDo1LqiVjx1pBc5km6", seller: W4, priceSol: 10.4, status: "active", minutesAgo: 320 },
  { asset: "7C6igEjxwp6MMGy3g4ZPmNJrx39CKtNSty7PWL8fWpWY", seller: W8, priceSol: 11.7, status: "active", minutesAgo: 470 },
  { asset: "n17vojvjcoN7q1aeqGy5igrraiX4mPnS8KTkRAUtAaoB", seller: W2, priceSol: 4.8, status: "active", minutesAgo: 610 },
  { asset: "msFj15oK2eAWRHefEwTQzXUeh8fS1GjzWHnRCS1msYLH", seller: W9, priceSol: 3.2, status: "active", minutesAgo: 760 },
  { asset: "rg8Q64CFkifgoEG8YRLhBoS9s1ujq7ABNE7DQHriUSrk", seller: W5, priceSol: 9.1, status: "active", minutesAgo: 940 },
  { asset: "dFLEauecwE2REep5LmUGXztRt681u52XspXw76ghUbT5", seller: W5, priceSol: 5.9, status: "active", minutesAgo: 1180 },
  { asset: "N7YjvwSa6amfygMTjyMoQaZTQT3s2hEKE6aGXbYmQYCF", seller: W6, priceSol: 8.6, status: "sold", minutesAgo: 1310, buyer: W9 },
  { asset: "rwhJyBK4Gqqto57m4N6DWAqEvRjDiTfcbhikzKBhEdPm", seller: W1, priceSol: 14.2, status: "sold", minutesAgo: 1620, buyer: W3 },
  { asset: "xiq6tsahHruwhR6pNWKVCQ3hfai2b6egCjtSJL7GuU5w", seller: W7, priceSol: 5.1, status: "sold", minutesAgo: 2010, buyer: W8 },
  { asset: "nvEb9fRy5Gch5osvj6o7ZkTCJpE823L3aTDmKhcSYruk", seller: W1, priceSol: 4.7, status: "sold", minutesAgo: 2650, buyer: W10 },
  { asset: "WnKBU3kLHFbNEvkYu7nRHC7iZz2TNpPZJRfbAhTFmTLP", seller: W9, priceSol: 12.1, status: "sold", minutesAgo: 3180, buyer: W4 },
  { asset: "6766uiRtuvqYYdx4SAjbs7JiS5aQY5n6PXBW4LSW9szt", seller: W8, priceSol: 3.4, status: "sold", minutesAgo: 3880, buyer: W2 },
];

const NOW = Math.floor(Date.now() / 1000);

export const DEMO_LISTINGS: MarketplaceListing[] = LISTING_SEEDS.map(
  (seed, i) => ({
    listing_id: `demo-listing-${String(i + 1).padStart(3, "0")}`,
    asset_address: seed.asset,
    collection_address:
      DEMO_COLLECTIONS.find(
        (c) => c.slug === ASSET_SEEDS.find((s) => s.address === seed.asset)?.collection
      )?.collection_address ?? null,
    seller_address: seed.seller,
    price_lamports: Math.round(seed.priceSol * SOL),
    currency: "SOL",
    marketplace: "zecians-demo",
    status: seed.status,
    created_at: NOW - seed.minutesAgo * 60,
    sale_id: seed.status === "sold" ? `demo-sale-${i + 1}` : null,
  })
);

/* ============================================================================
   Activity — demo events (sales, listings, transfers)
   ========================================================================== */

interface DemoEventSeed {
  sig: string;
  type: "sale" | "list" | "transfer";
  asset: string;
  minutesAgo: number;
  from: string;
  to: string | null;
  lamportsSol: number | null;
}

const EVENT_SEEDS: DemoEventSeed[] = [
  { sig: "q9zQdEWMUtjgAgZzmHboRJ7WgzfFQhEkyEALjgKFLHmX", type: "sale", asset: "N7YjvwSa6amfygMTjyMoQaZTQT3s2hEKE6aGXbYmQYCF", minutesAgo: 6, from: W6, to: W9, lamportsSol: 8.6 },
  { sig: "cFdz6Z3HHkuzibniKxaMST7Rnz5gJRUGX4iqSTjxHhQf", type: "list", asset: "7FhDhLm47oD34oYvdV9deFnmFDijk8pwSt2sRTyzvbAE", minutesAgo: 9, from: W2, to: null, lamportsSol: 9.8 },
  { sig: "uWQuZRGpJvQi8JU9eqSK8aNkWemPej6CJnozGxNtRu8n", type: "sale", asset: "rwhJyBK4Gqqto57m4N6DWAqEvRjDiTfcbhikzKBhEdPm", minutesAgo: 17, from: W1, to: W3, lamportsSol: 14.2 },
  { sig: "9Yv2FnY71rAoQqYk6FV7bGpD8jTb3aURW7HPDVDcfbCC", type: "transfer", asset: "wSWn4aFzD4SN6cJK8QfKmfVZs19NFwFnjSyhYERnhbFt", minutesAgo: 31, from: W5, to: W7, lamportsSol: null },
  { sig: "PkAbuWtgpFiPAWdPrXi1ivBT9GcXktFZzSSodfxPZzaH", type: "list", asset: "xBhErWqhbWVmFvbnSfUnCVkXnAj2BoauJtutVn2mKF2Y", minutesAgo: 44, from: W3, to: null, lamportsSol: 13.5 },
  { sig: "Qh9N1PD2TeSi65RAuYqkZQfMeZ7K4hTfjXvJDo2mHfRr", type: "sale", asset: "xiq6tsahHruwhR6pNWKVCQ3hfai2b6egCjtSJL7GuU5w", minutesAgo: 58, from: W7, to: W8, lamportsSol: 5.1 },
  { sig: "xSGJEEa2APMBn5sapkEFJu6kECHg9zrrNaVZLVBZSZ9u", type: "list", asset: "6766uiRtuvqYYdx4SAjbs7JiS5aQY5n6PXBW4LSW9szt", minutesAgo: 66, from: W6, to: null, lamportsSol: 3.9 },
  { sig: "7wU4WBdA8ywKta85FDPrY181FXMYrssmkjf8bhfoqxWB", type: "transfer", asset: "ruGMX7gxbp1NdyzarN8rr8pzfmSJVKGPdETtKWCVoSP7", minutesAgo: 83, from: W10, to: W4, lamportsSol: null },
  { sig: "nmM9mweUyjcRu95Ws82ArcGxCEK4MK4h3WW3erfxSf6i", type: "sale", asset: "nvEb9fRy5Gch5osvj6o7ZkTCJpE823L3aTDmKhcSYruk", minutesAgo: 102, from: W1, to: W10, lamportsSol: 4.7 },
  { sig: "PeANvjqoEdhRh1VQ5BchikpDKgJDJZdUm4r2mjwtinxX", type: "list", asset: "iYRa147LpDMPnfHKTWw7K9y2jsiSgQmujrgnZv1e2TCH", minutesAgo: 129, from: W8, to: null, lamportsSol: 4.4 },
  { sig: "4LM4NbwuwJyCSLpBnv1c5KCC8jbgdBKFGfNwSW7sUWR5", type: "list", asset: "psr8FbwXzcAkynaqrZ8k6q95bdngG1FU918AJ2v5KnL1", minutesAgo: 173, from: W10, to: null, lamportsSol: 6.1 },
  { sig: "ZfVPQt17ynpTj35X5e9LrzXrYo7djRPYCiFgVhynj8bW", type: "transfer", asset: "n17vojvjcoN7q1aeqGy5igrraiX4mPnS8KTkRAUtAaoB", minutesAgo: 221, from: W2, to: W6, lamportsSol: null },
  { sig: "EziWtV9DzANQfFCd3roHYedqLeFg6YbGwJR4DY4gYmuC", type: "sale", asset: "WnKBU3kLHFbNEvkYu7nRHC7iZz2TNpPZJRfbAhTFmTLP", minutesAgo: 268, from: W9, to: W4, lamportsSol: 12.1 },
  { sig: "zTfA8ipfeBFCRNXeFwC1wiinjQsr6YfuzwmxejDxbpbW", type: "list", asset: "msFj15oK2eAWRHefEwTQzXUeh8fS1GjzWHnRCS1msYLH", minutesAgo: 305, from: W9, to: null, lamportsSol: 3.2 },
  { sig: "t1p4MK5E1LQXnV9Q5rrXMX3LFH1ZxFtQKSXsjMtGJo9j", type: "sale", asset: "6766uiRtuvqYYdx4SAjbs7JiS5aQY5n6PXBW4LSW9szt", minutesAgo: 342, from: W8, to: W2, lamportsSol: 3.4 },
  { sig: "9ev2esSXMUHsDfzDT5vJJmAD5bPBTctjeD2zov8d928f", type: "transfer", asset: "dFLEauecwE2REep5LmUGXztRt681u52XspXw76ghUbT5", minutesAgo: 388, from: W3, to: W5, lamportsSol: null },
];

export const DEMO_ACTIVITY: ActivityEvent[] = EVENT_SEEDS.map((seed) => {
  const asset = ASSET_SEEDS.find((s) => s.address === seed.asset);
  const collection = DEMO_COLLECTIONS.find((c) => c.slug === asset?.collection);
  const blockTime = NOW - seed.minutesAgo * 60;
  const isSale = seed.type === "sale";
  const isList = seed.type === "list";
  return {
    signature: seed.sig,
    slot: 28_000_000 + seed.minutesAgo,
    block_time: blockTime,
    type: seed.type,
    asset_address: seed.asset,
    collection_address: collection?.collection_address ?? null,
    from_address: seed.from,
    to_address: seed.to,
    seller_address: isSale || isList ? seed.from : seed.from,
    buyer_address: isSale ? (seed.to ?? null) : null,
    lamports: seed.lamportsSol !== null ? Math.round(seed.lamportsSol * SOL) : null,
    now: blockTime,
  };
});

/* ============================================================================
   Market stats — explicitly preview values, never real blockchain totals
   ========================================================================== */

export const DEMO_MARKET_STATS = {
  collections: DEMO_COLLECTIONS.length,
  nfts: DEMO_ASSETS.length,
  totalVolumeLamports: 368.7 * SOL,
  traders: 1284,
  sales24h: 32,
  listingsActive: DEMO_LISTINGS.filter((l) => l.status === "active").length,
};

export const DEMO_OFFERS = [
  {
    id: "demo-offer-1",
    asset: "6Kg1C6uB6BGvEwTSendR74SPbMCuDhEktD887VM1TgLA",
    from: W5,
    amountLamports: 11.8 * SOL,
    minutesAgo: 26,
  },
  {
    id: "demo-offer-2",
    asset: "ruGMX7gxbp1NdyzarN8rr8pzfmSJVKGPdETtKWCVoSP7",
    from: W9,
    amountLamports: 5.25 * SOL,
    minutesAgo: 95,
  },
];

/* ============================================================================
   Demo config / treasury mirrors of the real API shapes
   ========================================================================== */

export const DEMO_CONFIG = {
  chain: "solana",
  network: "solana-devnet",
  nft_standard: "metaplex-core",
  mint_enabled: false,
  marketplace_enabled: true,
  allowlist_enabled: false,
  fees: {
    marketplace_fee_bps: 200,
    royalty_bps_default: 500,
    currency: "SOL",
  },
};

export const DEMO_TREASURY = {
  treasury_address: null,
  summary: { total_lamports: 0, event_count: 0, by_kind: {} as Record<string, number> },
  events: [],
};

export function demoConfigValue() {
  return DEMO_CONFIG;
}
