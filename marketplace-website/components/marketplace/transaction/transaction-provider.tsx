"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MarketplaceAsset } from "@/lib/api/types";
import type { ListingView } from "@/lib/marketplace/views";
import { BuyFlow } from "./buy-flow";
import { ListFlow } from "./list-flow";
import { CancelFlow } from "./cancel-flow";

export type TxRequest =
  | { kind: "buy"; view: ListingView }
  | { kind: "list"; asset: MarketplaceAsset; collectionName?: string }
  | { kind: "cancel"; view: ListingView };

interface TransactionContextValue {
  request: (request: TxRequest) => void;
  close: () => void;
}

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function useTransaction(): TransactionContextValue {
  const value = useContext(TransactionContext);
  if (!value) {
    throw new Error("useTransaction must be used within TransactionProvider.");
  }
  return value;
}

/**
 * Global host for the buy / list / cancel flows. Rendered once near the root so
 * any surface can start a transaction without duplicating modal logic.
 */
export function TransactionProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<TxRequest | null>(null);
  const [seq, setSeq] = useState(0);

  const request = useCallback((next: TxRequest) => {
    setCurrent(next);
    setSeq((n) => n + 1);
  }, []);
  const close = useCallback(() => setCurrent(null), []);

  const value = useMemo(() => ({ request, close }), [request, close]);

  return (
    <TransactionContext.Provider value={value}>
      {children}
      {current?.kind === "buy" && (
        <BuyFlow key={`buy-${seq}`} view={current.view} onClose={close} />
      )}
      {current?.kind === "list" && (
        <ListFlow
          key={`list-${seq}`}
          asset={current.asset}
          collectionName={current.collectionName}
          onClose={close}
        />
      )}
      {current?.kind === "cancel" && (
        <CancelFlow key={`cancel-${seq}`} view={current.view} onClose={close} />
      )}
    </TransactionContext.Provider>
  );
}
