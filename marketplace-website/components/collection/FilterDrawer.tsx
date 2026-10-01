"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { TraitGroup } from "@/lib/collection-detail-data";
import type { CollectionFilters, StatusFilter } from "./useCollectionFilters";
import { c } from "./collection-detail.styles";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "listed", label: "Buy now" },
  { value: "auction", label: "On auction" },
  { value: "all", label: "All items" },
];

export function FilterDrawer({
  open,
  filters,
  traitGroups,
  onApply,
  onReset,
  onClose,
}: {
  open: boolean;
  filters: CollectionFilters;
  traitGroups: TraitGroup[];
  onApply: (filters: CollectionFilters) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CollectionFilters>(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const toggleTrait = (key: TraitGroup["key"], value: string) => {
    setDraft((current) => {
      const list = current[key];
      const next = list.includes(value)
        ? list.filter((entry) => entry !== value)
        : [...list, value];
      return { ...current, [key]: next };
    });
  };

  return (
    <>
      <div
        className={c("drawerBackdrop", open && "open")}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={c("drawer", open && "open")}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label="Filters"
      >
        <div className={c("drawerHead")}>
          <h3>Filters</h3>
          <button
            type="button"
            className={c("drawerClose")}
            aria-label="Close filters"
            onClick={onClose}
          >
            <X aria-hidden />
          </button>
        </div>
        <div className={c("drawerBody")}>
          <div className={c("fdSection")}>
            <div className={c("fdH")}>Status</div>
            {STATUS_OPTIONS.map((option) => (
              <label className={c("fdRadio")} key={option.value}>
                <input
                  type="radio"
                  name="collection-status"
                  value={option.value}
                  checked={draft.status === option.value}
                  onChange={() => setDraft((current) => ({ ...current, status: option.value }))}
                />
                {option.label}
              </label>
            ))}
          </div>

          <div className={c("fdSection")}>
            <div className={c("fdH")}>Price range (SOL)</div>
            <div className={c("fdPriceRow")}>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Min"
                value={draft.priceMin}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, priceMin: event.target.value }))
                }
              />
              <span>—</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Max"
                value={draft.priceMax}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, priceMax: event.target.value }))
                }
              />
            </div>
          </div>

          {traitGroups.map((group) => (
            <div className={c("fdSection")} key={group.key}>
              <div className={c("fdH")}>
                {group.label} <span>{group.options.length} traits</span>
              </div>
              {group.options.map((option) => (
                <label className={c("fdCheck")} key={option.value}>
                  <input
                    type="checkbox"
                    checked={draft[group.key].includes(option.value)}
                    onChange={() => toggleTrait(group.key, option.value)}
                  />
                  {option.value}
                  <span className={c("pct")}>{option.pct}%</span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className={c("drawerFoot")}>
          <button type="button" className={c("fdReset")} onClick={onReset}>
            Reset
          </button>
          <button
            type="button"
            className={c("fdApply")}
            onClick={() => onApply(draft)}
          >
            Apply
          </button>
        </div>
      </aside>
    </>
  );
}
