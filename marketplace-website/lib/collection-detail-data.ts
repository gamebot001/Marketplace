/**
 * COLLECTION DETAIL — page data.
 * ----------------------------------------------------------------------------
 * One clean, swap-ready shape for the collection detail page. Today it is
 * assembled from the isolated demo dataset (lib/demo-marketplace-data.ts) so
 * the whole surface — grid, sort, filters, pagination, activity, about and the
 * detail modal — can be built and exercised without a backend. Every field is
 * deliberately the shape the real API will return later, so replacing
 * `getCollectionDetailData` with a network call is a one-file change.
 *
 * Nothing here writes anywhere. Artwork resolves to the local demo files under
 * /public/demo-marketplace.
 */

import {
  DEMO_ASSETS,
  DEMO_COLLECTIONS,
  DEMO_WALLETS,
  demoCollectionStats,
} from "@/lib/demo-marketplace-data";
import type {
  ActivityEvent,
  MarketplaceAsset,
  MarketplaceCollection,
  MarketplaceListing,
} from "@/lib/api/types";
import { lamportsToSol, relativeTime, resolveImageUrl } from "@/lib/format";

export type ItemStatus = "listed" | "auction" | "unlisted";

export interface CollectionItem {
  id: number;
  name: string;
  image: string;
  /** Current listing price. Null when the asset is not actively listed — an
      unlisted asset has no current price and must never render as 0 SOL. */
  price: number | null;
  /** Most recent settled sale price, when one exists. Null otherwise. */
  lastSale: number | null;
  rank: number;
  status: ItemStatus;
  seller: string;
  owner: string;
  creator: string;
  royalty: string;
  chain: string;
  species: string;
  scene: string;
  expression: string;
  colour: string;
  asset: string;
  listedAt: number;
  /** Real on-chain listing linkage (live data only). */
  listingId?: string | null;
  listingLamports?: number;
  collectionAddress?: string | null;
  standard?: string;
  royaltyBps?: number;
}

export type ActivityType = "sale" | "list" | "offer" | "transfer" | "cancel";

export interface CollectionActivity {
  type: ActivityType;
  title: string;
  to: string;
  price: string;
  time: string;
  txHash: string;
}

export interface TraitOption {
  value: string;
  pct: number;
  count: number;
}

export interface TraitGroup {
  key: "species" | "scene" | "expression";
  label: string;
  options: TraitOption[];
}

export interface CollectionDetailData {
  slug: string;
  name: string;
  verified: boolean;
  pfp: string;
  description: string;
  creator: string;
  floor: string;
  volume: string;
  totalItems: string;
  listedCount: string;
  royalty: string;
  chain: string;
  launched: string;
  solUsd: number;
  items: CollectionItem[];
  activity: CollectionActivity[];
  traitGroups: TraitGroup[];
  colourOptions: TraitOption[];
  traitDistribution: TraitOption[];
  about: {
    heading: string;
    paragraphs: string[];
    links: { label: string; href: string }[];
  };
}

const SOL_USD = 188;

const SPECIES = ["T-Rex", "Triceratops", "Stegosaurus", "Velociraptor", "Brachiosaurus"];
const SCENES = ["Jungle", "Desert", "Arctic", "Volcano", "Swamp"];
const EXPRESSIONS = ["Grin", "Smirk", "Sleepy", "Fierce", "Curious"];
const COLOURS = ["Moss", "Crimson", "Azure", "Amber", "Bone"];

/** Item counts per collection — sized so sort / filter / pagination are real. */
const ITEM_COUNT: Record<string, number> = {
  claynosaurz: 2341,
  "mad-lads": 1460,
  degods: 1120,
  dga: 980,
  "critters-quest": 1340,
  "famous-fox-federation": 1180,
  "otc-desks": 720,
  "smb-gen2": 1280,
  "stonk-cats": 1520,
};

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Per-NFT artwork sets.
 *
 * The real demo assets already carry one file each, so for those collections we
 * reuse their images. Collections without seeded assets fall back to the
 * generic art-0N set that ships in their folder. Either way the collection PFP
 * (identity badge) is never used as item art — every item points at an actual
 * per-NFT file, and the item list cycles through the set so adjacent cards
 * differ.
 */
const FALLBACK_ART: Record<string, string[]> = {
  "critters-quest": [
    "/demo-marketplace/critters-quest/art-01.avif",
    "/demo-marketplace/critters-quest/art-02.avif",
    "/demo-marketplace/critters-quest/art-03.avif",
    "/demo-marketplace/critters-quest/art-04.avif",
    "/demo-marketplace/critters-quest/art-05.avif",
  ],
  "famous-fox-federation": [
    "/demo-marketplace/famous-fox-federation/art-01.avif",
    "/demo-marketplace/famous-fox-federation/art-02.avif",
    "/demo-marketplace/famous-fox-federation/art-03.avif",
    "/demo-marketplace/famous-fox-federation/art-04.avif",
    "/demo-marketplace/famous-fox-federation/art-05.avif",
  ],
  "otc-desks": [
    "/demo-marketplace/otc-desks/art-01.avif",
    "/demo-marketplace/otc-desks/art-02.avif",
    "/demo-marketplace/otc-desks/art-03.avif",
    "/demo-marketplace/otc-desks/art-04.avif",
    "/demo-marketplace/otc-desks/art-05.avif",
  ],
  "smb-gen2": [
    "/demo-marketplace/smb-gen2/art-01.avif",
    "/demo-marketplace/smb-gen2/art-02.avif",
    "/demo-marketplace/smb-gen2/art-03.avif",
    "/demo-marketplace/smb-gen2/art-04.avif",
  ],
  "stonk-cats": [
    "/demo-marketplace/stonk-cats/art-01.avif",
    "/demo-marketplace/stonk-cats/art-02.avif",
    "/demo-marketplace/stonk-cats/art-03.avif",
    "/demo-marketplace/stonk-cats/art-04.avif",
    "/demo-marketplace/stonk-cats/art-05.avif",
  ],
};

function collectionArtwork(
  slug: string,
  collectionAddress: string | null
): string[] {
  const seeded = DEMO_ASSETS.filter(
    (asset) => asset.collection_address === collectionAddress
  )
    .map((asset) => asset.image)
    .filter((image): image is string => Boolean(image));
  if (seeded.length > 0) return seeded;
  return FALLBACK_ART[slug] ?? [];
}

/** Deterministic pseudo Solana address (inert, never used on chain). */
function pseudoAddress(seed: number, length = 44): string {
  let x = (seed + 1) * 2654435761;
  let out = "";
  for (let i = 0; i < length; i += 1) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out += B58[x % B58.length];
  }
  return out;
}

const NOW_SECONDS = Math.floor(Date.now() / 1000);

function buildItems(
  collection: MarketplaceCollection,
  count: number,
  artwork: string[]
): CollectionItem[] {
  const creator = DEMO_WALLETS[0];
  const items: CollectionItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = 1000 + i * 3 + (i % 7);
    const status: ItemStatus =
      i % 9 === 0 ? "auction" : i % 15 === 0 ? "unlisted" : "listed";
    const seller = DEMO_WALLETS[(i % (DEMO_WALLETS.length - 1)) + 1];
    items.push({
      id,
      name: `${collection.name} #${id}`,
      image: artwork.length > 0 ? artwork[i % artwork.length] : "",
      price: Math.round((7 + ((i * 13) % 90) / 10) * 10) / 10,
      lastSale: Math.round((6 + ((i * 7) % 70) / 10) * 10) / 10,
      rank: 20 + ((i * 17) % 980),
      status,
      seller,
      owner: seller,
      creator,
      royalty: "5.0%",
      chain: "Solana",
      species: SPECIES[i % SPECIES.length],
      scene: SCENES[(i * 3) % SCENES.length],
      expression: EXPRESSIONS[(i * 5) % EXPRESSIONS.length],
      colour: COLOURS[(i * 7) % COLOURS.length],
      asset: pseudoAddress(i + 7),
      listedAt: NOW_SECONDS - i * 600,
    });
  }
  return items;
}

function distribution(
  items: CollectionItem[],
  get: (item: CollectionItem) => string,
  vocabulary: string[]
): TraitOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = get(item);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const total = items.length || 1;
  return vocabulary.map((value) => {
    const c = counts.get(value) ?? 0;
    return { value, count: c, pct: Math.round((c / total) * 100) };
  });
}

const ACTIVITY_TITLES: Record<ActivityType, string> = {
  sale: "Sold",
  list: "Listed",
  cancel: "Cancelled",
  offer: "Offer placed",
  transfer: "Transferred",
};

const ACTIVITY_ORDER: ActivityType[] = ["sale", "list", "offer", "transfer"];

function short(address: string, head = 5, tail = 5): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

function timeAgo(seconds: number): string {
  const delta = Math.max(0, NOW_SECONDS - seconds);
  if (delta < 3600) return `${Math.max(1, Math.floor(delta / 60))} min ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)} hr ago`;
  return `${Math.floor(delta / 86400)} day ago`;
}

function buildActivity(items: CollectionItem[]): CollectionActivity[] {
  const out: CollectionActivity[] = [];
  for (let k = 0; k < 10; k += 1) {
    const item = items[(k * 37) % items.length];
    const type = ACTIVITY_ORDER[k % ACTIVITY_ORDER.length];
    const counterparty = DEMO_WALLETS[(k * 3 + 2) % DEMO_WALLETS.length];
    const basePrice = item.price ?? 0;
    const price =
      type === "transfer"
        ? "—"
        : (type === "offer" ? basePrice * 0.85 : basePrice).toFixed(1);
    out.push({
      type,
      title: ACTIVITY_TITLES[type],
      to: short(counterparty),
      price,
      time: timeAgo(item.listedAt - k * 900),
      txHash: pseudoAddress(k + 41, 64),
    });
  }
  return out;
}

/**
 * Assemble the full page data for one collection. Returns null for an unknown
 * slug so the route can render an honest not-found. Results are memoised per
 * slug so metadata + page render share one build.
 */
const DETAIL_CACHE = new Map<string, CollectionDetailData | null>();

export function getCollectionDetailData(slug: string): CollectionDetailData | null {
  if (DETAIL_CACHE.has(slug)) return DETAIL_CACHE.get(slug) ?? null;
  const result = buildCollectionDetailData(slug);
  DETAIL_CACHE.set(slug, result);
  return result;
}

function buildCollectionDetailData(slug: string): CollectionDetailData | null {
  const collection = DEMO_COLLECTIONS.find((c) => c.slug === slug);
  if (!collection) return null;

  const stats = demoCollectionStats(slug);
  const count = ITEM_COUNT[slug] ?? Math.min(collection.supply ?? 1000, 1400);
  const artwork = collectionArtwork(slug, collection.collection_address);
  const items = buildItems(collection, count, artwork);

  const species = distribution(items, (i) => i.species, SPECIES);
  const scene = distribution(items, (i) => i.scene, SCENES);
  const expression = distribution(items, (i) => i.expression, EXPRESSIONS);
  const colourOptions = distribution(items, (i) => i.colour, COLOURS);

  const supply = collection.supply ?? stats?.supply ?? count;

  /* Stats are derived from the listed items themselves — never static strings.
     Floor is the cheapest active listing, Listed is the count of active
     listings, and Volume is the summed last-sale of those listings, so nothing
     on the sidebar can contradict a price shown in the grid. */
  const listedItems = items.filter((item) => item.status === "listed");
  const listedPrices = listedItems
    .map((item) => item.price)
    .filter((value): value is number => value !== null);
  const floorValue =
    listedPrices.length > 0 ? Math.min(...listedPrices) : null;
  const volumeValue = listedItems.reduce(
    (sum, item) => sum + (item.lastSale ?? 0),
    0
  );

  const floor = floorValue === null ? "—" : floorValue.toFixed(1);
  const volume = volumeValue.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return {
    slug,
    name: collection.name,
    verified: collection.verification_status === "verified",
    pfp: collection.image ?? "",
    description: collection.description ?? "",
    creator: DEMO_WALLETS[0],
    floor,
    volume,
    totalItems: supply.toLocaleString("en-US"),
    listedCount: String(listedItems.length),
    royalty: "5.0%",
    chain: "Solana",
    launched: "March 2024",
    solUsd: SOL_USD,
    items,
    activity: buildActivity(items),
    traitGroups: [
      { key: "species", label: "Species", options: species },
      { key: "scene", label: "Scene", options: scene },
      { key: "expression", label: "Expression", options: expression },
    ],
    colourOptions,
    traitDistribution: species,
    about: {
      heading: `About ${collection.name}`,
      paragraphs: [
        collection.description ??
          `${collection.name} is a verified collection on the Zecians Marketplace.`,
        `Each piece in ${collection.name} is a unique composition of species, scene and expression traits, with rarity distributed across a fully deterministic reveal.`,
      ],
      links: [
        { label: "Website", href: "#" },
        { label: "Twitter / X", href: "#" },
        { label: "Discord", href: "#" },
        { label: "Explorer", href: "#" },
      ],
    },
  };
}

/* ============================================================================
   LIVE collection detail — built from the real backend read model.

   The same CollectionDetailData shape is produced from real assets, listings
   and indexed activity; attributes are honoured when present and an empty
   attributes array simply yields no trait facets (the filters degrade
   gracefully rather than crashing). No demo data is used on this path.
   ========================================================================== */

function apiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8788").replace(
    /\/$/,
    ""
  );
}

function liveTime(seconds: number | null | undefined): string {
  return relativeTime(seconds ?? 0) ?? "—";
}

function activityType(type: string): ActivityType {
  if (type === "sale") return "sale";
  if (type === "cancel" || type === "cancelled") return "cancel";
  if (type === "offer") return "offer";
  if (type === "transfer") return "transfer";
  return "list";
}

const ACTIVITY_TITLE: Record<ActivityType, string> = {
  sale: "Sold",
  list: "Listed",
  cancel: "Cancelled",
  offer: "Offer placed",
  transfer: "Transferred",
};

export async function getLiveCollectionDetailData(
  slug: string
): Promise<CollectionDetailData | null> {
  const base = apiBaseUrl();
  let response: Response;
  try {
    response = await fetch(
      `${base}/api/collections/${encodeURIComponent(slug)}`,
      { cache: "no-store", headers: { accept: "application/json" } }
    );
  } catch {
    throw new Error(
      "Could not reach the marketplace API. No collection data was loaded."
    );
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `The marketplace API responded with HTTP ${response.status}.`
    );
  }

  const payload = (await response.json()) as {
    collection: MarketplaceCollection;
    asset_count?: number;
    assets?: MarketplaceAsset[];
    listings?: MarketplaceListing[];
  };
  const collection = payload.collection;
  const assets = payload.assets ?? [];
  const listings = payload.listings ?? [];

  let events: ActivityEvent[] = [];
  try {
    const activityResponse = await fetch(`${base}/api/activity?limit=200`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (activityResponse.ok) {
      const body = (await activityResponse.json()) as { events?: ActivityEvent[] };
      events = body.events ?? [];
    }
  } catch {
    // Activity is supplementary; the grid still renders from assets/listings.
  }

  const collectionAddress = collection.collection_address;
  const collectionEvents = events.filter(
    (event) => event.collection_address === collectionAddress
  );

  const items: CollectionItem[] = assets.map((asset, index) => {
    const active = listings.find(
      (l) => l.asset_address === asset.asset_address && l.status === "active"
    );
    const sold = listings.find(
      (l) => l.asset_address === asset.asset_address && l.status === "sold"
    );
    const creator =
      collection.creator_address || asset.creator_address || asset.owner_address || "";
    return {
      id: index + 1,
      name: asset.name?.trim() || `${collection.name} #${index + 1}`,
      image: resolveImageUrl(asset.image ?? asset.metadata_uri) ?? "",
      price: active ? Number(lamportsToSol(active.price_lamports)) : null,
      lastSale: sold ? Number(lamportsToSol(sold.price_lamports)) : null,
      rank: 0,
      status: active ? "listed" : "unlisted",
      seller: active?.seller_address ?? asset.owner_address ?? "",
      owner: asset.owner_address ?? "",
      creator,
      royalty: asset.royalty_bps ? `${asset.royalty_bps / 100}%` : "0%",
      chain: "Solana",
      // Phase 2A assets ship no visual traits; empty strings keep every
      // consumer honest (no trait filter is available to select).
      species: "",
      scene: "",
      expression: "",
      colour: "",
      asset: asset.asset_address,
      listedAt: active?.created_at ?? asset.created_at ?? 0,
      listingId: active?.listing_id ?? null,
      listingLamports: active?.price_lamports ?? 0,
      collectionAddress: asset.collection_address ?? collectionAddress ?? null,
      standard: asset.standard ?? collection.standard,
      royaltyBps: asset.royalty_bps ?? 0,
    };
  });

  const activeListings = listings.filter((l) => l.status === "active");
  const stats = collection.stats;
  const floorValue =
    stats?.floor_lamports ??
    (activeListings.length
      ? Math.min(...activeListings.map((l) => l.price_lamports))
      : null);
  const volumeValue = stats?.volume_lamports ?? 0;
  const supplyValue = stats?.supply ?? assets.length;
  const listedValue = stats?.listed_count ?? activeListings.length;

  const activity: CollectionActivity[] = collectionEvents.slice(0, 24).map((event) => {
    const type = activityType(event.type);
    const counterparty =
      event.buyer_address ??
      event.to_address ??
      event.from_address ??
      event.seller_address ??
      "";
    return {
      type,
      // The backend owns the final event label; only fall back to the local
      // table if an older API response omits it.
      title: event.label ?? ACTIVITY_TITLE[type],
      to: counterparty ? short(counterparty) : "—",
      price: event.lamports != null ? lamportsToSol(event.lamports) : "—",
      time: liveTime(event.block_time ?? event.now),
      txHash: event.signature,
    };
  });

  const description =
    collection.description?.trim() ||
    `${collection.name} is a collection on the Zecians Marketplace.`;

  const website =
    collection.website?.trim() || collection.socials?.website?.trim() || null;

  return {
    slug,
    name: collection.name,
    verified: collection.verification_status === "verified",
    pfp: resolveImageUrl(collection.image) ?? "",
    description,
    creator:
      collection.creator_address ||
      assets.find((a) => a.creator_address)?.creator_address ||
      assets.find((a) => a.owner_address)?.owner_address ||
      "",
    floor: floorValue === null ? "—" : lamportsToSol(floorValue),
    volume: lamportsToSol(volumeValue),
    totalItems: supplyValue.toLocaleString("en-US"),
    listedCount: String(listedValue),
    royalty: collection.royalty_bps ? `${collection.royalty_bps / 100}%` : "0%",
    chain: "Solana",
    launched: "",
    solUsd: SOL_USD,
    items,
    activity,
    traitGroups: [],
    colourOptions: [],
    traitDistribution: [],
    about: {
      heading: `About ${collection.name}`,
      paragraphs: [
        description,
        "This is a custom Solana Devnet test collection created for the Zecians Marketplace. It is not affiliated with any existing mainnet collection.",
      ],
      links: website ? [{ label: "Website", href: website }] : [],
    },
  };
}
