/**
 * Marketplace view models and pure selectors.
 *
 * A ListingView joins a real listing with the real asset and collection it
 * references. Missing fields stay null — never guessed, never fabricated.
 */

import { MARKETPLACE } from "@/lib/config";
import { resolveImageUrl, shorten } from "@/lib/format";
import type {
  ActivityEvent,
  MarketplaceAsset,
  MarketplaceCollection,
  MarketplaceListing,
} from "@/lib/api/types";

export interface ListingView {
  listing: MarketplaceListing;
  name: string;
  image: string | null;
  collectionName: string;
  collectionSlug: string | null;
  collectionVerified: boolean;
  standard: string | null;
  ownerAddress: string | null;
  creatorAddress: string | null;
  royaltyBps: number | null;
  description: string | null;
}

export function collectionByAddress(
  address: string | null | undefined,
  collections: MarketplaceCollection[]
): MarketplaceCollection | undefined {
  if (!address) return undefined;
  return collections.find((c) => c.collection_address === address);
}

export function buildListingView(
  listing: MarketplaceListing,
  assets: Record<string, MarketplaceAsset>,
  collections: MarketplaceCollection[]
): ListingView {
  const asset = assets[listing.asset_address] ?? null;
  const collection = collectionByAddress(listing.collection_address, collections);
  const verified =
    asset?.verified_collection ??
    collection?.verification_status === "verified";

  return {
    listing,
    name:
      asset?.name?.trim() ||
      shorten(listing.asset_address, 6, 6),
    image: resolveImageUrl(asset?.image ?? asset?.metadata_uri ?? null),
    collectionName: collection?.name ?? "Unregistered collection",
    collectionSlug: collection?.slug ?? null,
    collectionVerified: Boolean(verified),
    standard: asset?.standard ?? collection?.standard ?? null,
    ownerAddress: asset?.owner_address ?? null,
    creatorAddress: asset?.creator_address ?? null,
    royaltyBps: asset?.royalty_bps ?? collection?.royalty_bps ?? null,
    description: asset?.description ?? null,
  };
}

export function buildListingViews(
  listings: MarketplaceListing[],
  assets: Record<string, MarketplaceAsset>,
  collections: MarketplaceCollection[]
): ListingView[] {
  return listings.map((listing) => buildListingView(listing, assets, collections));
}

export interface ExploreFilters {
  search: string;
  collectionSlug: string; // "" = all
  priceMin: string; // SOL, "" = none
  priceMax: string; // SOL, "" = none
  verifiedOnly: boolean;
  status: "any" | "active" | "sold";
  traitFilter: string; // "trait\u0000value", "" = all
  sort: ExploreSort;
}

export type ExploreSort =
  | "recent"
  | "price-asc"
  | "price-desc"
  | "name-asc"
  | "sold-recent";

export const DEFAULT_FILTERS: ExploreFilters = {
  search: "",
  collectionSlug: "",
  priceMin: "",
  priceMax: "",
  verifiedOnly: false,
  status: "active",
  traitFilter: "",
  sort: "recent",
};

export interface TraitGroup {
  trait: string;
  values: string[];
}

/**
 * Real trait facets for a set of listings. Only attributes the API actually
 * returned are surfaced — a collection with no trait metadata yields no groups
 * rather than an invented taxonomy.
 */
export function buildTraitGroups(
  views: ListingView[],
  assets: Record<string, MarketplaceAsset>
): TraitGroup[] {
  const map = new Map<string, Set<string>>();
  for (const view of views) {
    const attrs = assets[view.listing.asset_address]?.attributes;
    if (!attrs) continue;
    for (const attr of attrs) {
      if (!attr?.trait || !attr?.value) continue;
      if (!map.has(attr.trait)) map.set(attr.trait, new Set());
      map.get(attr.trait)!.add(attr.value);
    }
  }
  return [...map.entries()]
    .map(([trait, values]) => ({ trait, values: [...values].sort() }))
    .sort((a, b) => a.trait.localeCompare(b.trait));
}

/** Split a "trait\u0000value" facet key back into its parts. */
export function parseTraitFilter(value: string): {
  trait: string;
  value: string;
} {
  const index = value.indexOf("\u0000");
  if (index < 0) return { trait: value, value: "" };
  return { trait: value.slice(0, index), value: value.slice(index + 1) };
}

function solToLamportsBigInt(input: string): bigint | null {
  const text = input.trim();
  if (!/^\d*(\.\d{0,9})?$/.test(text) || text === "" || text === ".") return null;
  const [whole, fraction = ""] = text.split(".");
  const padded = (fraction + "000000000").slice(0, 9);
  try {
    return BigInt(whole || "0") * 1_000_000_000n + BigInt(padded || "0");
  } catch {
    return null;
  }
}

export function filterListingViews(
  views: ListingView[],
  filters: ExploreFilters,
  assets?: Record<string, MarketplaceAsset>
): ListingView[] {
  const search = filters.search.trim().toLowerCase();
  const min = solToLamportsBigInt(filters.priceMin);
  const max = solToLamportsBigInt(filters.priceMax);
  const trait = filters.traitFilter
    ? parseTraitFilter(filters.traitFilter)
    : null;

  let result = views.filter((view) => {
    if (filters.collectionSlug && view.collectionSlug !== filters.collectionSlug) {
      return false;
    }
    if (filters.verifiedOnly && !view.collectionVerified) return false;
    if (filters.status !== "any" && view.listing.status !== filters.status) {
      return false;
    }
    if (trait && assets) {
      const attrs = assets[view.listing.asset_address]?.attributes ?? [];
      if (
        !attrs.some((a) => a.trait === trait.trait && a.value === trait.value)
      ) {
        return false;
      }
    }

    const price = BigInt(view.listing.price_lamports ?? 0);
    if (min !== null && price < min) return false;
    if (max !== null && price > max) return false;

    if (search) {
      const haystack = [
        view.name,
        view.collectionName,
        view.listing.asset_address,
        view.listing.seller_address,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  result = [...result];
  switch (filters.sort) {
    case "price-asc":
      result.sort(
        (a, b) => (a.listing.price_lamports ?? 0) - (b.listing.price_lamports ?? 0)
      );
      break;
    case "price-desc":
      result.sort(
        (a, b) => (b.listing.price_lamports ?? 0) - (a.listing.price_lamports ?? 0)
      );
      break;
    case "name-asc":
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "sold-recent":
      // "Recently sold": sold listings first, newest sale/listing activity first.
      result.sort((a, b) => {
        const aSold = a.listing.status === "sold" ? 1 : 0;
        const bSold = b.listing.status === "sold" ? 1 : 0;
        if (aSold !== bSold) return bSold - aSold;
        return (b.listing.created_at ?? 0) - (a.listing.created_at ?? 0);
      });
      break;
    case "recent":
    default:
      result.sort(
        (a, b) => (b.listing.created_at ?? 0) - (a.listing.created_at ?? 0)
      );
      break;
  }
  return result;
}

/** Human label for an activity event type, without inventing meaning. */
export function activityLabel(type: string | null | undefined): string {
  if (!type) return "Activity";
  switch (type) {
    case "mint":
      return "Mint";
    case "list":
    case "listing":
      return "List";
    case "sale":
      return "Sale";
    case "cancel":
    case "cancelled":
      return "Cancel";
    case "transfer":
      return "Transfer";
    case "observed_signature":
      return "Chain event";
    default:
      return type.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/** The counterparty wallet for an activity event, when present. */
export function activityWallet(event: ActivityEvent): string | null {
  return (
    event.buyer_address ??
    event.to_address ??
    event.seller_address ??
    event.from_address ??
    null
  );
}
