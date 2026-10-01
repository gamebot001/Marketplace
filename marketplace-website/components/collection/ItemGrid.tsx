"use client";

import type { CollectionItem } from "@/lib/collection-detail-data";
import type { ViewMode } from "./useCollectionFilters";
import { c } from "./collection-detail.styles";
import { ItemCard } from "./ItemCard";
import { Pagination } from "./Pagination";

/**
 * The item surface: grid / compact / list are one markup tree whose layout is
 * switched by a mode class, with pagination directly beneath.
 */
export function ItemGrid({
  items,
  view,
  isFiltered,
  page,
  totalPages,
  onSelect,
  onPage,
}: {
  items: CollectionItem[];
  view: ViewMode;
  isFiltered: boolean;
  page: number;
  totalPages: number;
  onSelect: (item: CollectionItem) => void;
  onPage: (page: number) => void;
}) {
  return (
    <>
      <div className={c("grid", `mode-${view}`)}>
        {items.length === 0 ? (
          <div className={c("empty")}>
            {isFiltered ? (
              <>
                No items match <b>these filters</b>. Try clearing one.
              </>
            ) : (
              <>
                No items are listed in <b>this collection</b> yet.
              </>
            )}
          </div>
        ) : (
          items.map((item) => (
            <ItemCard key={item.id} item={item} onSelect={onSelect} />
          ))
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} onPage={onPage} />
    </>
  );
}
