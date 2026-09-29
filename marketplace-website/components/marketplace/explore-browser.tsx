"use client";

/**
 * Explore everything — marketplace discovery with a strong hierarchy.
 *
 * Filters: Collection · Price · Verified · Status
 * Sort: Recently Listed · Price Low → High · Price High → Low · Recently Sold
 *
 * Controls are compact and quiet; the grid is the protagonist. All data is
 * real; empty and error states are designed, not improvised.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, LayoutGrid, Square } from "lucide-react";
import { useListingsWithAssets } from "@/lib/api/hooks";
import {
  DEFAULT_FILTERS,
  buildListingViews,
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
    setFilters((f) => ({ ...f, search: initialQuery, collectionSlug: initialCollection }));
  }, [initialQuery, initialCollection]);

  const collections = data?.collections ?? [];
  const views = useMemo(
    () =>
      buildListingViews(
        data?.listings ?? [],
        data?.assets ?? {},
        data?.collections ?? []
      ),
    [data]
  );
  const filtered = useMemo(
    () => filterListingViews(views, filters),
    [views, filters]
  );

  const update = <K extends keyof ExploreFilters>(key: K, value: ExploreFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const hasActiveFilters =
    filters.search ||
    filters.collectionSlug ||
    filters.priceMin ||
    filters.priceMax ||
    filters.verifiedOnly ||
    filters.status !== DEFAULT_FILTERS.status;

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 40 }}>
      <Reveal>
        <div className="filter-bar" role="search">
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
            onChange={(e) => update("collectionSlug", e.target.value)}
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
