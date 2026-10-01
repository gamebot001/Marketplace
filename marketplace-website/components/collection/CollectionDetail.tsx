"use client";

/**
 * Collection detail — the client shell for /collections/[slug]. Owns the page
 * chrome (tab, theme, drawer, modal, toast) and hands the derived browse state
 * to the presentational pieces. All data arrives as props so the swap to a live
 * API is transparent to every component below it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CollectionDetailData, CollectionItem } from "@/lib/collection-detail-data";
import { c } from "./collection-detail.styles";
import { CollectionHeader, type CollectionTab } from "./CollectionHeader";
import { CollectionToolbar } from "./CollectionToolbar";
import { ActiveFilterChips } from "./ActiveFilterChips";
import { ItemGrid } from "./ItemGrid";
import { ActivityFeed } from "./ActivityFeed";
import { AboutPanel } from "./AboutPanel";
import { FilterDrawer } from "./FilterDrawer";
import { NftModal } from "./NftModal";
import { useCollectionFilters } from "./useCollectionFilters";

type Theme = "dark" | "light";

export function CollectionDetail({ data }: { data: CollectionDetailData }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [activeTab, setActiveTab] = useState<CollectionTab>("nfts");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<CollectionItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef(0);

  const filters = useCollectionFilters(data.items);

  /* theme — read once after mount (never during SSR) and persist on change */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("zecians-theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "light" ? "dark" : "light";
      try {
        window.localStorage.setItem("zecians-theme", next);
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const copyCreator = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.creator);
    } catch {
      try {
        const field = document.createElement("textarea");
        field.value = data.creator;
        field.style.position = "fixed";
        field.style.left = "-9999px";
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        document.body.removeChild(field);
      } catch {
        /* clipboard unavailable */
      }
    }
    showToast("Copied to clipboard");
  }, [data.creator, showToast]);

  /* body scroll lock while an overlay is open */
  useEffect(() => {
    if (!selected && !drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [selected, drawerOpen]);

  /* Escape closes whichever overlay is open */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelected(null);
      setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={c("page")} data-theme={theme}>
      <main className={c("shell")}>
        <div className={c("layout")}>
          <CollectionHeader
            data={data}
            activeTab={activeTab}
            nftCount={data.items.length}
            theme={theme}
            onTabChange={setActiveTab}
            onToggleTheme={toggleTheme}
            onCopyCreator={copyCreator}
          />

          <div className={c("mhead")}>
            <CollectionToolbar
              visible={activeTab === "nfts"}
              sort={filters.sort}
              view={filters.view}
              rangeFrom={filters.rangeFrom}
              rangeTo={filters.rangeTo}
              total={filters.totalItems}
              activeCount={filters.activeCount}
              onSort={filters.setSort}
              onView={filters.setView}
              onOpenFilters={() => setDrawerOpen(true)}
            />
          </div>

          <div className={c("colDivider")} aria-hidden />

          <section className={c("mbody")}>
            {activeTab === "nfts" ? (
              <>
                <ActiveFilterChips
                  chips={filters.chips}
                  onClearAll={filters.resetFilters}
                />
                <ItemGrid
                  items={filters.pageItems}
                  view={filters.view}
                  isFiltered={filters.activeCount > 0}
                  page={filters.page}
                  totalPages={filters.totalPages}
                  onSelect={setSelected}
                  onPage={filters.setPage}
                />
              </>
            ) : null}

            {activeTab === "activity" ? (
              <ActivityFeed activity={data.activity} collectionName={data.name} />
            ) : null}

            {activeTab === "about" ? (
              <AboutPanel data={data} onCopyCreator={copyCreator} />
            ) : null}
          </section>
        </div>
      </main>

      <FilterDrawer
        open={drawerOpen}
        filters={filters.filters}
        traitGroups={data.traitGroups}
        onApply={(next) => {
          filters.setFilters(next);
          setDrawerOpen(false);
        }}
        onReset={filters.resetFilters}
        onClose={() => setDrawerOpen(false)}
      />

      <NftModal
        item={selected}
        data={data}
        onClose={() => setSelected(null)}
        onToast={showToast}
      />

      <div className={c("toast", toast && "show")}>{toast ?? "Copied to clipboard"}</div>
    </div>
  );
}
