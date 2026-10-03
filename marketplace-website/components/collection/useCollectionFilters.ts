"use client";

/**
 * useCollectionFilters — the single source of truth for the collection page's
 * browse state: sort, filters, view mode and page. All data stays derived, so
 * swapping the item source later changes nothing here.
 *
 * Rules (from the locked design):
 *   · sort / view / filter changes → page resets to 1
 *   · a resize that changes per-page keeps the first visible item in view
 *   · page changes scroll to the top of the items section
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CollectionItem } from "@/lib/collection-detail-data";

export type SortKey = "recent" | "price-asc" | "price-desc" | "rarity";
export type ViewMode = "grid" | "compact" | "list";
export type StatusFilter = "listed" | "auction" | "all";

export interface CollectionFilters {
  status: StatusFilter;
  priceMin: string;
  priceMax: string;
  species: string[];
  scene: string[];
  expression: string[];
}

/**
 * The collection page opens unfiltered: every NFT (listed + unlisted) is shown.
 * "Listed first" is a SORT concern (see the default "recent" sort), never a
 * filter — a user must never arrive with a Listed chip they did not select.
 */
export const DEFAULT_FILTERS: CollectionFilters = {
  status: "all",
  priceMin: "",
  priceMax: "",
  species: [],
  scene: [],
  expression: [],
};

export const CLEARED_FILTERS: CollectionFilters = {
  status: "all",
  priceMin: "",
  priceMax: "",
  species: [],
  scene: [],
  expression: [],
};

export interface FilterChip {
  key: string;
  label: string;
  clear: () => void;
}

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recently listed" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
  { key: "rarity", label: "Rarity" },
];

function columnsFor(view: ViewMode, width: number): number {
  if (view === "list") return 1;
  if (view === "compact") {
    if (width <= 700) return 3;
    if (width <= 1000) return 4;
    if (width <= 1300) return 5;
    return 6;
  }
  if (width <= 700) return 2;
  if (width <= 1000) return 3;
  if (width <= 1300) return 3;
  return 4;
}

export function perPageFor(view: ViewMode, width: number): number {
  if (view === "list") return 10;
  const cols = columnsFor(view, width);
  return view === "compact" ? cols * 5 : cols * 4;
}

export interface CollectionFilterState {
  sort: SortKey;
  filters: CollectionFilters;
  view: ViewMode;
  page: number;
  perPage: number;
  totalPages: number;
  totalItems: number;
  rangeFrom: number;
  rangeTo: number;
  pageItems: CollectionItem[];
  sortedItems: CollectionItem[];
  activeCount: number;
  chips: FilterChip[];
  setSort: (sort: SortKey) => void;
  setView: (view: ViewMode) => void;
  setFilters: (filters: CollectionFilters) => void;
  setPage: (page: number) => void;
  resetFilters: () => void;
}

export function useCollectionFilters(
  items: CollectionItem[]
): CollectionFilterState {
  const [sort, setSortState] = useState<SortKey>("recent");
  const [filters, setFiltersState] = useState<CollectionFilters>(DEFAULT_FILTERS);
  const [view, setViewState] = useState<ViewMode>("grid");
  const [page, setPageState] = useState(1);
  const [width, setWidth] = useState(1920);

  useEffect(() => {
    const measure = () => setWidth(window.innerWidth);
    measure();
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 160);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, []);

  const perPage = perPageFor(view, width);

  const filtered = useMemo(() => {
    const min = filters.priceMin.trim() === "" ? null : Number(filters.priceMin);
    const max = filters.priceMax.trim() === "" ? null : Number(filters.priceMax);
    const hasSpecies = filters.species.length > 0;
    const hasScene = filters.scene.length > 0;
    const hasExpression = filters.expression.length > 0;

    return items.filter((item) => {
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (min !== null && Number.isFinite(min)) {
        if (item.price === null || item.price < min) return false;
      }
      if (max !== null && Number.isFinite(max)) {
        if (item.price === null || item.price > max) return false;
      }
      if (hasSpecies && !filters.species.includes(item.species)) return false;
      if (hasScene && !filters.scene.includes(item.scene)) return false;
      if (hasExpression && !filters.expression.includes(item.expression)) return false;
      return true;
    });
  }, [items, filters]);

  const sorted = useMemo(() => {
    const next = filtered.slice();
    const byPrice = (a: CollectionItem, b: CollectionItem, dir: 1 | -1) => {
      if (a.price === null && b.price === null) return 0;
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      return dir * (a.price - b.price);
    };

    switch (sort) {
      case "price-asc":
        next.sort((a, b) => byPrice(a, b, 1));
        break;
      case "price-desc":
        next.sort((a, b) => byPrice(a, b, -1));
        break;
      case "rarity":
        next.sort((a, b) => a.rank - b.rank);
        break;
      case "recent":
      default:
        // Default browse order: listed assets first, then unlisted, each group
        // most-recent-first. This keeps every NFT visible while the market
        // stays at the top — distinct from the status filter.
        next.sort((a, b) => {
          const aListed = a.status === "unlisted" ? 1 : 0;
          const bListed = b.status === "unlisted" ? 1 : 0;
          if (aListed !== bListed) return aListed - bListed;
          return b.listedAt - a.listedAt;
        });
        break;
    }
    return next;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));

  /* keep the first visible item in view when per-page changes on resize */
  const prevPerPage = useRef(perPage);
  useEffect(() => {
    if (prevPerPage.current === perPage) return;
    const previous = prevPerPage.current;
    prevPerPage.current = perPage;
    setPageState((current) => {
      const firstIndex = (current - 1) * previous;
      return Math.max(1, Math.floor(firstIndex / perPage) + 1);
    });
  }, [perPage]);

  /* never strand the view past the last page */
  useEffect(() => {
    setPageState((current) => Math.min(Math.max(1, current), totalPages));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return sorted.slice(start, start + perPage);
  }, [sorted, page, perPage]);

  const start = (page - 1) * perPage;

  const setSort = useCallback((value: SortKey) => {
    setSortState(value);
    setPageState(1);
  }, []);

  const setView = useCallback((value: ViewMode) => {
    setViewState(value);
    setPageState(1);
  }, []);

  const setFilters = useCallback((value: CollectionFilters) => {
    setFiltersState(value);
    setPageState(1);
  }, []);

  const setPage = useCallback((value: number) => {
    setPageState(value);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(CLEARED_FILTERS);
    setPageState(1);
  }, []);

  const activeCount =
    (filters.status !== "all" ? 1 : 0) +
    (filters.priceMin.trim() ? 1 : 0) +
    (filters.priceMax.trim() ? 1 : 0) +
    filters.species.length +
    filters.scene.length +
    filters.expression.length;

  const chips = useMemo<FilterChip[]>(() => {
    const out: FilterChip[] = [];
    const update = (patch: Partial<CollectionFilters>) =>
      setFilters({ ...filters, ...patch });

    if (filters.status !== "all") {
      out.push({
        key: "status",
        label: filters.status === "listed" ? "Listed" : "On auction",
        clear: () => update({ status: "all" }),
      });
    }
    if (filters.priceMin.trim()) {
      out.push({
        key: "priceMin",
        label: `Min ${filters.priceMin} SOL`,
        clear: () => update({ priceMin: "" }),
      });
    }
    if (filters.priceMax.trim()) {
      out.push({
        key: "priceMax",
        label: `Max ${filters.priceMax} SOL`,
        clear: () => update({ priceMax: "" }),
      });
    }
    for (const value of filters.species) {
      out.push({
        key: `species:${value}`,
        label: value,
        clear: () =>
          update({ species: filters.species.filter((v) => v !== value) }),
      });
    }
    for (const value of filters.scene) {
      out.push({
        key: `scene:${value}`,
        label: value,
        clear: () => update({ scene: filters.scene.filter((v) => v !== value) }),
      });
    }
    for (const value of filters.expression) {
      out.push({
        key: `expression:${value}`,
        label: value,
        clear: () =>
          update({ expression: filters.expression.filter((v) => v !== value) }),
      });
    }
    return out;
  }, [filters, setFilters]);

  return {
    sort,
    filters,
    view,
    page,
    perPage,
    totalPages,
    totalItems: sorted.length,
    rangeFrom: sorted.length === 0 ? 0 : start + 1,
    rangeTo: Math.min(start + perPage, sorted.length),
    pageItems,
    sortedItems: sorted,
    activeCount,
    chips,
    setSort,
    setView,
    setFilters,
    setPage,
    resetFilters,
  };
}
