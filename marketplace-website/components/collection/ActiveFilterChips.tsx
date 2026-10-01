"use client";

import type { FilterChip } from "./useCollectionFilters";
import { c } from "./collection-detail.styles";

export function ActiveFilterChips({
  chips,
  onClearAll,
}: {
  chips: FilterChip[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;

  return (
    <div className={c("activeChips")}>
      {chips.map((chip) => (
        <span className={c("chip")} key={chip.key}>
          {chip.label}
          <button
            type="button"
            aria-label={`Remove ${chip.label} filter`}
            onClick={chip.clear}
          >
            ×
          </button>
        </span>
      ))}
      <button type="button" className={c("chipClear")} onClick={onClearAll}>
        Clear all
      </button>
    </div>
  );
}
