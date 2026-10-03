"use client";

/**
 * Marketplace homepage — data shaping.
 *
 * The visual layer is components/home/marketplace-home.tsx. This module only
 * builds its props:
 *
 *  · DEMO_MODE (design preview): everything resolves synchronously from the
 *    isolated demo dataset in lib/demo-marketplace-data.ts — real local
 *    artwork files, honest preview numbers, clearly labelled as such.
 *  · Live mode: the same shape is built from the real API via the existing
 *    hooks (useCollections, useListingsWithAssets). Sections stay hidden
 *    until the network actually returns data — nothing is fabricated.
 *
 * Recent activity deliberately does NOT appear on the homepage; it lives on
 * /activity (market-wide) and on each collection page.
 */

import { useMemo } from "react";
import {
  DEMO_MODE,
  DEMO_ASSETS,
  DEMO_COLLECTIONS,
  DEMO_LISTINGS,
  DEMO_MARKET_STATS,
} from "@/lib/demo-marketplace-data";
import { useCollections, useListingsWithAssets } from "@/lib/api/hooks";
import { buildListingViews, type ListingView } from "@/lib/marketplace/views";
import { formatSol, resolveImageUrl } from "@/lib/format";
import {
  MarketplaceHome,
  type HomeCollageItem,
  type HomeCollectionCard,
  type HomeNftCard,
  type MarketplaceHomeData,
} from "@/components/home/marketplace-home";
import type { HeroCollection } from "@/components/home/design-hero";
import type { MarketplaceCollection } from "@/lib/api/types";

/**
 * The hero is a fixed four-slot carousel. Pick four deterministic collections
 * straight from the backend records — flagship first, then creation order —
 * resolving each PFP through the backend artwork layer.
 */
function heroCollections(
  collections: MarketplaceCollection[]
): HeroCollection[] {
  const ranked = [...collections]
    .filter((c) => Boolean(c.image))
    .sort((a, b) => Number(b.flagship) - Number(a.flagship))
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      pfp: resolveImageUrl(c.image),
      verified: c.verification_status === "verified",
    }));
  if (ranked.length === 0) return [];
  // The ring always renders exactly four slots; cycle real records if needed.
  return Array.from({ length: 4 }, (_, i) => ranked[i % ranked.length]);
}

const MAX_TRENDING = 8;

function newestFirst(views: ListingView[]): ListingView[] {
  return [...views].sort(
    (a, b) => (b.listing.created_at ?? 0) - (a.listing.created_at ?? 0)
  );
}

function trendingCards(views: ListingView[]): HomeNftCard[] {
  return newestFirst(views).slice(0, MAX_TRENDING).map((view) => ({
    name: view.name,
    collection: view.collectionName,
    image: view.image,
    href: `/nft/${view.listing.asset_address}`,
    price: formatSol(view.listing.price_lamports),
    status: view.listing.status,
    address: view.listing.asset_address,
  }));
}

/**
 * REAL collection PFPs only — /demo-marketplace/<slug>/pfp.avif. The homepage
 * showcase is identity-only: PFP + name + verification. No market stats.
 */
function featuredCards(
  collections: MarketplaceCollection[]
): HomeCollectionCard[] {
  return [...collections]
    .sort((a, b) => Number(b.flagship) - Number(a.flagship))
    .slice(0, 6)
    .map((c) => ({
      name: c.name,
      image: resolveImageUrl(c.image),
      href: `/collections/${c.slug}`,
      verified: c.verification_status === "verified",
    }));
}

/** Editorial creator collage — four REAL artworks, one per collection. */
function collageItems(
  collections: MarketplaceCollection[],
  assets: { asset_address: string; collection_address: string | null; name?: string | null; image?: string | null }[]
): HomeCollageItem[] {
  const items: HomeCollageItem[] = [];
  for (const collection of collections) {
    const asset = assets.find(
      (a) =>
        a.collection_address === collection.collection_address &&
        Boolean(a.image)
    );
    const image = resolveImageUrl(asset?.image);
    if (image) {
      items.push({
        image,
        alt: asset?.name ?? `${collection.name} artwork`,
        href: `/collections/${collection.slug}`,
      });
    }
  }
  return items.slice(0, 4);
}

function buildDemoData(): MarketplaceHomeData {
  const assets = Object.fromEntries(DEMO_ASSETS.map((a) => [a.asset_address, a]));
  const views = buildListingViews(DEMO_LISTINGS, assets, DEMO_COLLECTIONS);

  return {
    stats: [
      { value: String(DEMO_MARKET_STATS.collections), label: "Collections" },
      { value: String(DEMO_MARKET_STATS.nfts), label: "NFTs" },
      {
        value: formatSol(DEMO_MARKET_STATS.totalVolumeLamports),
        label: "Total volume",
      },
      {
        value: DEMO_MARKET_STATS.traders.toLocaleString("en-US"),
        label: "Traders",
      },
    ],
    hero: heroCollections(DEMO_COLLECTIONS),
    featured: featuredCards(DEMO_COLLECTIONS),
    trending: trendingCards(views),
    collage: collageItems(DEMO_COLLECTIONS, DEMO_ASSETS),
  };
}

function useLiveHomeData(): MarketplaceHomeData {
  const listingsState = useListingsWithAssets({ status: null });
  const collectionsState = useCollections();

  return useMemo(() => {
    const collections = collectionsState.data ?? [];
    const data = listingsState.data;
    const views = data
      ? buildListingViews(data.listings, data.assets, data.collections)
      : [];

    return {
      stats: collections.length
        ? [
            { value: String(collections.length), label: "Collections" },
            {
              value: String(
                views.filter((v) => v.listing.status === "active").length
              ),
              label: "Live listings",
            },
            {
              value: String(
                views.filter((v) => v.listing.status === "sold").length
              ),
              label: "Sales settled",
            },
            {
              value: String(
                collections.filter(
                  (c) => c.verification_status === "verified"
                ).length
              ),
              label: "Verified",
            },
          ]
        : [],
      hero: heroCollections(collections),
      featured: featuredCards(collections),
      trending: trendingCards(views),
      collage: data ? collageItems(collections, Object.values(data.assets)) : [],
    };
  }, [listingsState.data, collectionsState.data]);
}

export default function HomePage() {
  const demoData = useMemo(buildDemoData, []);
  const liveData = useLiveHomeData();

  return <MarketplaceHome data={DEMO_MODE ? demoData : liveData} />;
}
