/**
 * Marketplace API client.
 *
 * One thin, collection-agnostic read layer over the Zecians platform API.
 * Every call returns a FetchResult so callers render honest empty/error states
 * instead of throwing or fabricating data.
 *
 * DEMO MODE: while lib/demo-marketplace-data.ts's DEMO_MODE is active, reads
 * resolve from the isolated local demo dataset instead of the network. The
 * switch lives ONLY here — demo values never leak into real API responses and
 * nothing demo is ever written to any backend or chain.
 */

import { MARKETPLACE } from "@/lib/config";
import {
  DEMO_MODE,
  DEMO_ACTIVITY,
  DEMO_ASSETS,
  DEMO_CONFIG,
  DEMO_LISTINGS,
  DEMO_TREASURY,
  DEMO_COLLECTIONS,
  demoAttributesFor,
} from "@/lib/demo-marketplace-data";
import type {
  ActivityEvent,
  CollectionDetail,
  FetchResult,
  HealthResponse,
  ListingDetail,
  MarketplaceAsset,
  MarketplaceCollection,
  MarketplaceConfig,
  MarketplaceListing,
  TreasuryResponse,
} from "./types";

async function getJson<T>(path: string): Promise<FetchResult<T>> {
  try {
    const res = await fetch(`${MARKETPLACE.backendUrl}${path}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 404
            ? "Not found."
            : `The marketplace API responded with HTTP ${res.status}.`,
        status: res.status,
      };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: "Could not reach the marketplace API." };
  }
}

function resolved<T>(data: T): Promise<FetchResult<T>> {
  return Promise.resolve({ ok: true, data });
}

export async function fetchHealth(): Promise<FetchResult<HealthResponse>> {
  if (DEMO_MODE) {
    return resolved<HealthResponse>({
      status: "demo",
      chain: "solana",
      network: "solana-devnet",
      env: "design-preview",
      nft_standard: "metaplex-core",
      rpc_configured: true,
      treasury_configured: false,
    });
  }
  return getJson("/api/health");
}

export async function fetchConfig(): Promise<FetchResult<MarketplaceConfig>> {
  if (DEMO_MODE) return resolved<MarketplaceConfig>(DEMO_CONFIG);
  return getJson("/api/config");
}

export async function fetchCollections(): Promise<
  FetchResult<MarketplaceCollection[]>
> {
  if (DEMO_MODE) return resolved<MarketplaceCollection[]>(DEMO_COLLECTIONS);
  const result = await getJson<{ collections?: MarketplaceCollection[] }>(
    "/api/collections"
  );
  if (!result.ok) return result;
  return { ok: true, data: result.data.collections ?? [] };
}

export async function fetchCollection(
  slug: string
): Promise<FetchResult<CollectionDetail>> {
  if (DEMO_MODE) {
    const collection = DEMO_COLLECTIONS.find((c) => c.slug === slug);
    if (!collection) {
      return Promise.resolve({
        ok: false,
        error: "Collection not found.",
        status: 404,
      });
    }
    return resolved<CollectionDetail>({
      collection,
      asset_count: DEMO_ASSETS.filter(
        (a) => a.collection_address === collection.collection_address
      ).length,
    });
  }
  return getJson(`/api/collections/${encodeURIComponent(slug)}`);
}

export async function fetchAsset(
  assetAddress: string
): Promise<FetchResult<MarketplaceAsset>> {
  if (DEMO_MODE) {
    const asset = DEMO_ASSETS.find((a) => a.asset_address === assetAddress);
    if (!asset) {
      return Promise.resolve({
        ok: false,
        error: "Asset not found.",
        status: 404,
      });
    }
    return resolved<MarketplaceAsset>({
      ...asset,
      attributes: demoAttributesFor(assetAddress),
    });
  }
  const result = await getJson<{ asset?: MarketplaceAsset }>(
    `/api/nft/${encodeURIComponent(assetAddress)}`
  );
  if (!result.ok) return result;
  if (!result.data.asset) return { ok: false, error: "Asset not found." };
  return { ok: true, data: result.data.asset };
}

/**
 * Listings. `status` omitted → every status; explicit status filters server-side.
 */
export async function fetchListings(params?: {
  status?: string | null;
  collectionAddress?: string | null;
}): Promise<FetchResult<MarketplaceListing[]>> {
  if (DEMO_MODE) {
    let listings = DEMO_LISTINGS;
    if (params?.collectionAddress) {
      listings = listings.filter(
        (l) => l.collection_address === params.collectionAddress
      );
    }
    if (params?.status) {
      listings = listings.filter((l) => l.status === params.status);
    }
    return resolved<MarketplaceListing[]>(listings);
  }
  const search = new URLSearchParams();
  search.set("status", params?.status ?? "");
  if (params?.collectionAddress) {
    search.set("collection_address", params.collectionAddress);
  }
  const result = await getJson<{ listings?: MarketplaceListing[] }>(
    `/api/marketplace/listings?${search.toString()}`
  );
  if (!result.ok) return result;
  return { ok: true, data: result.data.listings ?? [] };
}

export async function fetchListing(
  listingId: string
): Promise<FetchResult<ListingDetail>> {
  if (DEMO_MODE) {
    const listing = DEMO_LISTINGS.find((l) => l.listing_id === listingId);
    if (!listing) {
      return Promise.resolve({
        ok: false,
        error: "Listing not found.",
        status: 404,
      });
    }
    return resolved<ListingDetail>({ listing, sale: null });
  }
  return getJson(`/api/marketplace/listings/${encodeURIComponent(listingId)}`);
}

export async function fetchActivity(limit = 100): Promise<FetchResult<ActivityEvent[]>> {
  if (DEMO_MODE) return resolved<ActivityEvent[]>(DEMO_ACTIVITY.slice(0, limit));
  const result = await getJson<{ events?: ActivityEvent[] }>(
    `/api/activity?limit=${limit}`
  );
  if (!result.ok) return result;
  return { ok: true, data: result.data.events ?? [] };
}

export async function fetchTreasury(): Promise<FetchResult<TreasuryResponse>> {
  if (DEMO_MODE) return resolved<TreasuryResponse>(DEMO_TREASURY);
  return getJson("/api/treasury");
}
