"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Grid3x3, LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import type { SortKey, ViewMode } from "./useCollectionFilters";
import { SORT_OPTIONS } from "./useCollectionFilters";
import { c } from "./collection-detail.styles";

const VIEWS: { key: ViewMode; label: string; Icon: typeof LayoutGrid }[] = [
  { key: "grid", label: "Grid view", Icon: LayoutGrid },
  { key: "compact", label: "Compact view", Icon: Grid3x3 },
  { key: "list", label: "List view", Icon: List },
];

export function CollectionToolbar({
  visible,
  sort,
  view,
  rangeFrom,
  rangeTo,
  total,
  activeCount,
  onSort,
  onView,
  onOpenFilters,
}: {
  visible: boolean;
  sort: SortKey;
  view: ViewMode;
  rangeFrom: number;
  rangeTo: number;
  total: number;
  activeCount: number;
  onSort: (sort: SortKey) => void;
  onView: (view: ViewMode) => void;
  onOpenFilters: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [open]);

  const activeLabel =
    SORT_OPTIONS.find((option) => option.key === sort)?.label ?? "Recently listed";

  return (
    <div
      className={c("toolbarRow")}
      style={{ visibility: visible ? "visible" : "hidden" }}
    >
      <div className={c("tb-left")}>
        <h2 className={c("tb-title")}>Items</h2>
        <span className={c("tb-count")}>
          Showing <b>{rangeFrom.toLocaleString("en-US")}</b>–
          <b>{rangeTo.toLocaleString("en-US")}</b> of{" "}
          <b>{total.toLocaleString("en-US")}</b>
        </span>
      </div>
      <div className={c("tb-right")}>
        <div className={c("sortWrap")} ref={wrapRef} data-open={open}>
          <button
            type="button"
            className={c("sortBtn")}
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={(event) => {
              event.stopPropagation();
              setOpen((value) => !value);
            }}
          >
            <span className={c("sort-key")}>Sort</span>
            <span className={c("sort-label")}>{activeLabel}</span>
            <ChevronDown className={c("chev")} aria-hidden />
          </button>
          <div className={c("sortMenu")} role="listbox">
            {SORT_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.key}
                className={c(option.key === sort && "on")}
                role="option"
                aria-selected={option.key === sort}
                onClick={(event) => {
                  event.stopPropagation();
                  onSort(option.key);
                  setOpen(false);
                }}
              >
                {option.label}
                <Check aria-hidden />
              </button>
            ))}
          </div>
        </div>

        <div className={c("viewToggle")} role="group" aria-label="View">
          {VIEWS.map(({ key, label, Icon }) => (
            <button
              type="button"
              key={key}
              className={c(key === view && "on")}
              aria-label={label}
              aria-pressed={key === view}
              onClick={() => onView(key)}
            >
              <Icon aria-hidden />
            </button>
          ))}
        </div>

        <button
          type="button"
          className={c("filterBtn", activeCount > 0 && "on")}
          onClick={onOpenFilters}
        >
          <SlidersHorizontal aria-hidden />
          Filters
          <span className={c("filterBadge")}>{activeCount}</span>
        </button>
      </div>
    </div>
  );
}
