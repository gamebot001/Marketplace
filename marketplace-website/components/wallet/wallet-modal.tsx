"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { X, ShieldCheck, ArrowRight, ExternalLink } from "lucide-react";
import { OverlayPortal, useDialogFocus } from "@/components/ui/overlay-portal";

export interface WalletModalHandle {
  open: () => void;
  close: () => void;
}

/**
 * Centered wallet-selection overlay. Presentation only — the connect
 * handoff (select → connect) is the existing adapter logic, untouched.
 */
export const WalletModal = forwardRef<WalletModalHandle>(function WalletModal(_, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  useImperativeHandle(ref, () => ({ open, close }), [open, close]);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isOpen, dialogRef);

  const { wallets, select, connect, connected } = useWallet();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const installed = wallets.filter(
    (w) => w.readyState === WalletReadyState.Installed
  );
  const loadable = wallets.filter(
    (w) => w.readyState === WalletReadyState.Loadable
  );
  const listed = [...installed, ...loadable];

  // Connect once the chosen adapter is actually selected in provider state.
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
    if (connected) {
      setError(null);
      setPending(null);
      close();
    }
  }, [connected, close]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, close]);

  const handleSelect = useCallback(
    (name: string) => {
      setError(null);
      setPending(name);
      select(name as WalletName);
    },
    [select]
  );

  return (
    <OverlayPortal>
      {isOpen && (
    <div
      className="mk-wallet-overlay"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className="mk-wallet-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
        tabIndex={-1}
      >
        <div className="mk-wallet-head">
          <div className="mk-wallet-headtext">
            <span className="mk-wallet-kicker">Wallet</span>
            <h2 id="wallet-modal-title">Connect a wallet</h2>
          </div>
          <button
            type="button"
            className="mk-wallet-close"
            onClick={close}
            aria-label="Close"
          >
            <X size={15} strokeWidth={2.2} aria-hidden />
          </button>
        </div>

        <div className="mk-wallet-body">
          {listed.length === 0 ? (
            <div className="mk-wallet-empty">
              <span className="mk-wallet-emptymark" aria-hidden>
                <ShieldCheck size={18} strokeWidth={1.8} />
              </span>
              <h3>No wallet detected</h3>
              <p>
                Install a Solana wallet extension such as Phantom or Solflare,
                then reload this page.
              </p>
              <a
                className="mk-wallet-get"
                href="https://phantom.app/download"
                target="_blank"
                rel="noreferrer"
              >
                Get Phantom <ExternalLink size={13} aria-hidden />
              </a>
            </div>
          ) : (
            <div className="mk-wallet-rows">
              {listed.map((w) => (
                <button
                  key={w.adapter.name}
                  type="button"
                  className="mk-wallet-row"
                  onClick={() => handleSelect(w.adapter.name)}
                  disabled={pending !== null}
                >
                  {w.adapter.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="mk-wallet-icon"
                      src={w.adapter.icon}
                      alt=""
                      width={34}
                      height={34}
                    />
                  ) : (
                    <span className="wallet-avatar mk-wallet-icon" aria-hidden />
                  )}
                  <span className="mk-wallet-rowmeta">
                    <span className="mk-wallet-rowname">{w.adapter.name}</span>
                    <span className="mk-wallet-rowtag">
                      {w.readyState === WalletReadyState.Installed
                        ? "Detected"
                        : "Available"}
                    </span>
                  </span>
                  {pending === w.adapter.name ? (
                    <span className="mk-wallet-pending">Connecting…</span>
                  ) : (
                    <span className="mk-wallet-rowarrow" aria-hidden>
                      <ArrowRight size={14} strokeWidth={2} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {error && <div className="mk-wallet-error">{error}</div>}

          <p className="mk-wallet-note">
            Zecians never asks for your seed phrase or private key.
          </p>
        </div>
      </div>
    </div>
      )}
    </OverlayPortal>
  );
});
