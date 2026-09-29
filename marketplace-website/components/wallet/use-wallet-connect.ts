"use client";

/**
 * Shared connect-flow glue used by the wallet dialog and the compact header
 * panel: readiness-filtered wallet list plus the select → connect handoff.
 * The connection itself is the existing wallet-adapter logic — untouched.
 */

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";

export function useWalletConnect() {
  const { wallets, select, connect, connected } = useWallet();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listed = [
    ...wallets.filter((w) => w.readyState === WalletReadyState.Installed),
    ...wallets.filter((w) => w.readyState === WalletReadyState.Loadable),
  ];

  const connectWallet = useCallback(
    (name: string) => {
      setError(null);
      setPending(name);
      select(name as WalletName);
    },
    [select]
  );

  /* Connect once the chosen adapter is actually selected in provider state. */
  useEffect(() => {
    if (!pending) return;
    const selected = wallets.find((w) => w.adapter.name === pending);
    if (!selected) return;
    let cancelled = false;
    (async () => {
      try {
        await connect();
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : String(e);
          setError(
            /reject|declin|denied/i.test(message)
              ? "Connection request was rejected in your wallet."
              : "Could not connect to the wallet."
          );
        }
      } finally {
        if (!cancelled) setPending(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pending, wallets, connect]);

  useEffect(() => {
    if (!connected) return;
    setError(null);
    setPending(null);
  }, [connected]);

  return { listed, pending, error, connectWallet };
}
