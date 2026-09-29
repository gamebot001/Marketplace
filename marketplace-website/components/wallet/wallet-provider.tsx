"use client";

/**
 * Wallet wiring.
 *
 * Uses the Solana wallet-standard so any installed standard wallet (Phantom,
 * Solflare, Backpack, Glow, …) is discovered automatically. Connection is
 * always the configured devnet RPC. No private key or seed phrase is ever
 * requested, read, or stored.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { useStandardWalletAdapters } from "@solana/wallet-standard-wallet-adapter-react";
import { MARKETPLACE } from "@/lib/config";
import { WalletModal, type WalletModalHandle } from "./wallet-modal";

const WalletDialogContext = createContext<WalletModalHandle | null>(null);

export function useWalletDialog(): WalletModalHandle {
  const value = useContext(WalletDialogContext);
  if (!value) {
    throw new Error("useWalletDialog must be used within Providers.");
  }
  return value;
}

function WalletDialogProvider({ children }: { children: ReactNode }) {
  // Share stable commands only. The modal leaf owns visibility; opening it
  // neither updates this provider nor broadcasts state through the page.
  const modalRef = useRef<WalletModalHandle>(null);
  const open = useCallback(() => modalRef.current?.open(), []);
  const close = useCallback(() => modalRef.current?.close(), []);
  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <WalletDialogContext.Provider value={value}>
      {children}
      <WalletModal ref={modalRef} />
    </WalletDialogContext.Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  // Discovers installed standard wallets. Empty base list — no bundled adapters.
  const wallets = useStandardWalletAdapters([]);

  return (
    <ConnectionProvider endpoint={MARKETPLACE.rpcUrl}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletDialogProvider>{children}</WalletDialogProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
