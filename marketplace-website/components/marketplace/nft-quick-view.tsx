"use client";

/**
 * THE reusable in-context NFT detail experience — lightweight entry point.
 *
 * This module owns only the shared context and a lazily-loaded panel. Keeping
 * the heavy panel (transaction flows, wallet, artwork, styles) behind
 * next/dynamic means the artwork surfaces that merely *open* the quick view —
 * the homepage included — do not carry its cost until a piece is actually
 * opened. That preserves the flicker-free, low-JS footprint of the initial
 * paint.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import type { MarketplaceAsset } from "@/lib/api/types";
import type { ListingView } from "@/lib/marketplace/views";

export interface QuickViewInput {
  address: string;
  view?: ListingView | null;
  asset?: MarketplaceAsset | null;
}

interface QuickViewValue {
  open: (input: QuickViewInput) => void;
  close: () => void;
}

const QuickViewContext = createContext<QuickViewValue | null>(null);

export function useNftQuickView(): QuickViewValue {
  const value = useContext(QuickViewContext);
  if (!value) {
    throw new Error("useNftQuickView must be used within NftQuickViewProvider.");
  }
  return value;
}

const NftQuickViewPanel = dynamic(
  () =>
    import("./nft-quick-view-panel").then((mod) => mod.NftQuickViewPanel),
  { ssr: false }
);

export function NftQuickViewProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<QuickViewInput | null>(null);
  const open = useCallback((input: QuickViewInput) => setCurrent(input), []);
  const close = useCallback(() => setCurrent(null), []);
  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <QuickViewContext.Provider value={value}>
      {children}
      {current ? (
        <NftQuickViewPanel
          key={`${current.address}-${current.view?.listing.listing_id ?? "route"}`}
          input={current}
          onClose={close}
        />
      ) : null}
    </QuickViewContext.Provider>
  );
}
