"use client";

/**
 * Client-side data hooks over the API client. Small, dependency-free, and
 * deliberately conservative: a failed request becomes an honest error state,
 * never fabricated data.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchActivity,
  fetchAsset,
  fetchCollection,
  fetchCollections,
  fetchConfig,
  fetchListings,
  fetchTreasury,
} from "./client";
import type {
  ActivityEvent,
  CollectionDetail,
  FetchResult,
  MarketplaceAsset,
  MarketplaceCollection,
  MarketplaceConfig,
  MarketplaceListing,
  TreasuryResponse,
} from "./types";

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useAsync<T>(
  loader: () => Promise<FetchResult<T>>,
  deps: unknown[]
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setData(result.data);
          setError(null);
        } else {
          setData(null);
          setError(result.error);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}

export function useConfig(): AsyncState<MarketplaceConfig> {
  return useAsync(fetchConfig, []);
}

export function useCollections(): AsyncState<MarketplaceCollection[]> {
  return useAsync(fetchCollections, []);
}

export function useCollection(slug: string | null): AsyncState<CollectionDetail> {
  return useAsync(
    () =>
      slug
        ? fetchCollection(slug)
        : Promise.resolve({ ok: false as const, error: "Missing collection." }),
    [slug]
  );
}

export function useAsset(assetAddress: string | null): AsyncState<MarketplaceAsset> {
  return useAsync(
    () =>
      assetAddress
        ? fetchAsset(assetAddress)
        : Promise.resolve({ ok: false as const, error: "Missing asset." }),
    [assetAddress]
  );
}

export function useListings(params?: {
  status?: string | null;
  collectionAddress?: string | null;
}): AsyncState<MarketplaceListing[]> {
  const status = params?.status ?? null;
  const collectionAddress = params?.collectionAddress ?? null;
  return useAsync(
    () => fetchListings({ status, collectionAddress }),
    [status, collectionAddress]
  );
}

export function useActivity(limit = 100): AsyncState<ActivityEvent[]> {
  return useAsync(() => fetchActivity(limit), [limit]);
}

export function useTreasury(): AsyncState<TreasuryResponse> {
  return useAsync(fetchTreasury, []);
}

/**
 * Loads many listings together with their assets and collections in one pass,
 * with a single loading/error surface. Used by explore, home and profile.
 */
export interface ListingData {
  listings: MarketplaceListing[];
  assets: Record<string, MarketplaceAsset>;
  collections: MarketplaceCollection[];
}

export function useListingsWithAssets(params?: {
  status?: string | null;
  collectionAddress?: string | null;
}): AsyncState<ListingData> {
  const status = params?.status ?? null;
  const collectionAddress = params?.collectionAddress ?? null;

  return useAsync<ListingData>(async () => {
    const [listingsResult, collectionsResult] = await Promise.all([
      fetchListings({ status, collectionAddress }),
      fetchCollections(),
    ]);
    if (!listingsResult.ok) return listingsResult;

    const listings = listingsResult.data;
    const collections = collectionsResult.ok ? collectionsResult.data : [];

    const uniqueAssets = Array.from(new Set(listings.map((l) => l.asset_address)));
    const assetResults = await Promise.all(uniqueAssets.map((a) => fetchAsset(a)));
    const assets: Record<string, MarketplaceAsset> = {};
    assetResults.forEach((result, index) => {
      if (result.ok) assets[uniqueAssets[index]] = result.data;
    });

    return { ok: true, data: { listings, assets, collections } };
  }, [status, collectionAddress]);
}
