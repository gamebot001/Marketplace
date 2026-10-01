"use client";

/**
 * SortSelect — the marketplace's shared sort control.
 *
 * One control, one visual language: the trigger and its menu share the exact
 * same width and left/right edges, so opening it reads as the same component
 * rather than a floating box. The menu is always mounted and only toggles
 * opacity / transform / visibility, so opening never shifts layout, remounts,
 * or flickers. Used by the collections directory and available to every
 * marketplace surface that needs a sort dropdown.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface SortOption<T extends string> {
  value: T;
  label: string;
}

export function SortSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  ariaLabel,
  className,
}: {
  value: T;
  options: SortOption<T>[];
  onChange: (value: T) => void;
  /** Optional leading label. Omit it to show only the active option. */
  label?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close on an outside press or Escape. One listener while open only — never
  // a per-frame or scroll-bound handler.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className={`mkt-sort${className ? ` ${className}` : ""}`} ref={rootRef}>
      <button
        type="button"
        className="mkt-sort-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={ariaLabel ?? label ?? "Sort"}
        onClick={() => setOpen((prev) => !prev)}
      >
        {label && <span className="mkt-sort-label">{label}</span>}
        <span className="mkt-sort-value">{active?.label}</span>
        <ChevronDown
          size={14}
          className="mkt-sort-chevron"
          data-open={open}
          aria-hidden
        />
      </button>

      <div
        id={menuId}
        className="mkt-sort-menu"
        role="listbox"
        aria-label={ariaLabel ?? label ?? "Sort"}
        data-open={open}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={option.value === value}
            className="mkt-sort-option"
            data-active={option.value === value}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
          >
            <span>{option.label}</span>
            {option.value === value && <Check size={14} aria-hidden />}
          </button>
        ))}
      </div>
    </div>
  );
}
