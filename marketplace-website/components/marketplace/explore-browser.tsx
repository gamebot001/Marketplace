"use client";

/**
 * Explore — the global NFT discovery hub.
 *
 * This is the complete marketplace surface: every listing across every
 * registered collection, with search, collection/status/price/trait filters
 * and sorting. It is deliberately distinct from the curated homepage and from
 * a collection page (which browses one project only).
 *
 * Filters: Search · Collection · Status · Price range · Trait · Verified
 * Sort: Recently Listed · Price Low → High · Price High → Low · Recently Sold
 *
 * Every control reflects real data only; traits appear only when the API
 * actually returned attributes, and empty/error states are designed.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Compass,
  LayoutGrid,
  Search,
  SlidersHorizontal,
  Square,
} from "lucide-react";
import { useListingsWithAssets } from "@/lib/api/hooks";
import {
  DEFAULT_FILTERS,
  buildListingViews,
  buildTraitGroups,
  filterListingViews,
  type ExploreFilters,
  type ExploreSort,
} from "@/lib/marketplace/views";
import { NftCard } from "@/components/marketplace/nft-card";
import { Reveal } from "@/components/ui/motion";
import { CardSkeletons } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";

export function ExploreBrowser() {
  const params = useSearchParams();
  const initialQuery = params.get("q") ?? "";
  const initialCollection = params.get("collection") ?? "";

  const [filters, setFilters] = useState<ExploreFilters>({
    ...DEFAULT_FILTERS,
    search: initialQuery,
    collectionSlug: initialCollection,
  });
  const [view, setView] = useState<"grid" | "large">("grid");

  // All statuses are loaded so the Status filter and Recently Sold sort are
  // honest — the backend decides what exists, the client merely narrows.
  const { data, error, loading } = useListingsWithAssets({ status: null });

  useEffect(() => {
    setFilters((f) => ({
      ...f,
      search: initialQuery,
      collectionSlug: initialCollection,
      traitFilter: "",
    }));
  }, [initialQuery, initialCollection]);

  const collections = useMemo(() => data?.collections ?? [], [data]);
  const assets = useMemo(() => data?.assets ?? {}, [data]);
  const views = useMemo(
    () => buildListingViews(data?.listings ?? [], assets, collections),
    [data, assets, collections]
  );
  const filtered = useMemo(
    () => filterListingViews(views, filters, assets),
    [views, filters, assets]
  );

  // Trait facets follow the collection filter, so the available traits always
  // describe the set the collector is actually browsing.
  const facetViews = useMemo(
    () =>
      filters.collectionSlug
        ? views.filter((v) => v.collectionSlug === filters.collectionSlug)
        : views,
    [views, filters.collectionSlug]
  );
  const traitGroups = useMemo(
    () => buildTraitGroups(facetViews, assets),
    [facetViews, assets]
  );

  const update = <K extends keyof ExploreFilters>(key: K, value: ExploreFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const selectCollection = (slug: string) =>
    setFilters((f) => ({ ...f, collectionSlug: slug, traitFilter: "" }));

  const hasActiveFilters =
    filters.search ||
    filters.collectionSlug ||
    filters.priceMin ||
    filters.priceMax ||
    filters.verifiedOnly ||
    filters.traitFilter ||
    filters.status !== DEFAULT_FILTERS.status;

  const listedCount = useMemo(
    () => views.filter((v) => v.listing.status === "active").length,
    [views]
  );
  const activeCollections = useMemo(
    () => new Set(views.map((v) => v.collectionSlug).filter(Boolean)).size,
    [views]
  );

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <Reveal>
        <div className="explore-scope">
          <span className="explore-scope-mark" aria-hidden>
            <Compass size={15} />
          </span>
          <p>
            <strong>Global discovery.</strong> Every listing across every
            registered collection — search, narrow by collection, status, price
            or trait, then sort. The homepage is curated; a collection page is
            collection-specific.
          </p>
          {!loading && !error && (
            <span className="explore-scope-stats mono">
              {listedCount} listed
              <span aria-hidden> · </span>
              {activeCollections}{" "}
              {activeCollections === 1 ? "collection" : "collections"}
            </span>
          )}
        </div>
      </Reveal>

      <Reveal>
        <div className="filter-bar" role="search" style={{ marginTop: 18 }}>
          <div className="search-field">
            <Search size={16} aria-hidden />
            <input
              className="input"
              type="search"
              placeholder="Search NFTs, collections, wallets"
              aria-label="Search listings"
              value={filters.search}
              onChange={(e) => update("search", e.target.value)}
            />
          </div>

          <select
            className="select"
            aria-label="Filter by collection"
            value={filters.collectionSlug}
            onChange={(e) => selectCollection(e.target.value)}
          >
            <option value="">All collections</option>
            {collections.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="select"
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) => update("status", e.target.value as ExploreFilters["status"])}
          >
            <option value="active">Listed</option>
            <option value="any">All statuses</option>
            <option value="sold">Sold</option>
          </select>

          <label className="price-input">
            <input
              inputMode="decimal"
              placeholder="Min"
              aria-label="Minimum price in SOL"
              value={filters.priceMin}
              onChange={(e) => update("priceMin", e.target.value)}
            />
            <span>SOL</span>
          </label>
          <label className="price-input">
            <input
              inputMode="decimal"
              placeholder="Max"
              aria-label="Maximum price in SOL"
              value={filters.priceMax}
              onChange={(e) => update("priceMax", e.target.value)}
            />
            <span>SOL</span>
          </label>

          {traitGroups.length > 0 && (
            <select
              className="select"
              aria-label="Filter by trait"
              value={filters.traitFilter}
              onChange={(e) => update("traitFilter", e.target.value)}
            >
              <option value="">All traits</option>
              {traitGroups.map((group) =>
                group.values.map((value) => (
                  <option
                    key={`${group.trait}-${value}`}
                    value={`${group.trait}\u0000${value}`}
                  >
                    {group.trait}: {value}
                  </option>
                ))
              )}
            </select>
          )}

          <button
            className={`btn btn-sm ${filters.verifiedOnly ? "btn-accent" : "btn-outline"}`}
            aria-pressed={filters.verifiedOnly}
            onClick={() => update("verifiedOnly", !filters.verifiedOnly)}
          >
            Verified
          </button>

          <select
            className="select"
            aria-label="Sort listings"
            value={filters.sort}
            onChange={(e) => update("sort", e.target.value as ExploreSort)}
            style={{ marginLeft: "auto" }}
          >
            <option value="recent">Recently listed</option>
            <option value="price-asc">Price: low → high</option>
            <option value="price-desc">Price: high → low</option>
            <option value="sold-recent">Recently sold</option>
          </select>

          <div className="filter-toggle" role="group" aria-label="Layout">
            <button
              aria-pressed={view === "grid"}
              aria-label="Grid"
              onClick={() => setView("grid")}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              aria-pressed={view === "large"}
              aria-label="Large grid"
              onClick={() => setView("large")}
            >
              <Square size={15} />
            </button>
          </div>
        </div>
      </Reveal>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "24px 0 20px",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span className="eyebrow">
          {loading
            ? "Loading the market"
            : `${filtered.length} result${filtered.length === 1 ? "" : "s"}`}
        </span>
        {hasActiveFilters && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setFilters({ ...DEFAULT_FILTERS })}
          >
            Clear filters
          </button>
        )}
      </div>

      {error ? (
        <ErrorState title="Could not load listings" message={error} />
      ) : loading ? (
        <CardSkeletons count={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<SlidersHorizontal size={18} />}
          title="Nothing matches"
          message={
            views.length === 0
              ? "Nothing is listed yet. Active listings will appear here as sellers list verified assets."
              : "No listings match the current filters. Try widening the search."
          }
          action={
            <Link href="/collections" className="btn btn-outline btn-sm">
              Browse collections
            </Link>
          }
        />
      ) : (
        <div className={`grid ${view === "grid" ? "grid-4" : "grid-3"}`}>
          {filtered.map((v, i) => (
            <Reveal key={v.listing.listing_id} delay={(i % 4) * 60}>
              <NftCard view={v} priority={i < 4} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
