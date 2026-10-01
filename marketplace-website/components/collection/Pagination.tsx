"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { c } from "./collection-detail.styles";

/**
 * Pagination with the locked design's custom ellipsis logic: always the first
 * and last page, the current page ±1, and an ellipsis wherever a gap appears.
 */
function buildPages(current: number, total: number): (number | "...")[] {
  const pages: (number | "...")[] = [];
  if (total <= 7) {
    for (let p = 1; p <= total; p += 1) pages.push(p);
    return pages;
  }
  pages.push(1);
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push("...");
  for (let p = left; p <= right; p += 1) pages.push(p);
  if (right < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const tokens = buildPages(page, totalPages);

  return (
    <nav className={c("pager")} aria-label="Pagination">
      <button
        type="button"
        className={c("nav")}
        data-nav="prev"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        <ArrowLeft aria-hidden />
        <span>Prev</span>
      </button>
      {tokens.map((token, index) =>
        token === "..." ? (
          <span className={c("ellipsis")} key={`gap-${index}`}>
            …
          </span>
        ) : (
          <button
            type="button"
            key={token}
            className={c(token === page && "on")}
            aria-current={token === page ? "page" : undefined}
            onClick={() => onPage(token)}
          >
            {token}
          </button>
        )
      )}
      <button
        type="button"
        className={c("nav")}
        data-nav="next"
        disabled={page === totalPages}
        onClick={() => onPage(page + 1)}
      >
        <span>Next</span>
        <ArrowRight aria-hidden />
      </button>
    </nav>
  );
}
