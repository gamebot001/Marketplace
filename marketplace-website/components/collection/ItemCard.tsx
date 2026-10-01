"use client";

import type { CollectionItem } from "@/lib/collection-detail-data";
import { c } from "./collection-detail.styles";
import { Verify } from "./icons";

const BADGE_LABEL: Record<CollectionItem["status"], string> = {
  listed: "Listed",
  auction: "Auction",
  unlisted: "Unlisted",
};

/**
 * One artwork tile. The same component renders the grid, compact and list
 * variants — the layout differences live entirely in the shared CSS module, so
 * switching view never remounts content.
 */
export function ItemCard({
  item,
  onSelect,
}: {
  item: CollectionItem;
  onSelect: (item: CollectionItem) => void;
}) {
  return (
    <article
      className={c("card")}
      role="button"
      tabIndex={0}
      data-id={item.id}
      aria-label={`View ${item.name}`}
      onClick={() => onSelect(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(item);
        }
      }}
    >
      <div className={c("img")}>
        <span className={c("badge")}>{BADGE_LABEL[item.status]}</span>
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            draggable={false}
            onError={(event) => {
              event.currentTarget.style.opacity = "0";
            }}
          />
        ) : (
          <div className="media-fallback">No artwork</div>
        )}
      </div>
      <div className={c("info")}>
        <div className={c("nm-row")}>
          <span className={c("nm")}>
            {item.name}
            <Verify className={c("v")} />
          </span>
        </div>
        <div className={c("row")}>
          <span className={c("k")}>Price</span>
          <span className={c("v")}>
            {item.price.toFixed(1)}
            <small>SOL</small>
          </span>
        </div>
      </div>
    </article>
  );
}
