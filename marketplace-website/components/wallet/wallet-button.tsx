"use client";

/**
 * Premium wallet control.
 *
 * States: Disconnected → Connecting → Connected. The connected menu shows the
 * short address, network, copy action, explorer, profile and disconnect.
 * Adapter logic is untouched — this is presentation only.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  ChevronDown,
  Copy,
  Check,
  LogOut,
  User,
  ExternalLink,
  Wallet,
} from "lucide-react";
import { shorten } from "@/lib/format";
import { NETWORK_LABEL } from "@/lib/config";
import { explorerAddressUrl } from "@/lib/solana/cluster";
import { useWalletDialog } from "./wallet-provider";

export function WalletButton({
  presentation = "dialog",
}: {
  presentation?: "dialog" | "compact";
}) {
  const { open } = useWalletDialog();
  const { connected, connecting, publicKey, disconnect, wallet } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const address = publicKey?.toBase58() ?? null;

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    if (connected) setMenuOpen(false);
  }, [connected]);

  if (!connected) {
    /* Disconnected — the compact header control opens the centered
       wallet-selection overlay. No business logic here. */
    if (presentation === "compact") {
      return (
        <button
          className="wallet-btn"
          onClick={open}
          disabled={connecting}
          data-connecting={connecting}
          aria-haspopup="dialog"
        >
          <Wallet size={14} strokeWidth={2.2} aria-hidden />
          {connecting ? "Connecting…" : "Connect Wallet"}
        </button>
      );
    }

    return (
      <button
        className="wallet-btn"
        onClick={open}
        disabled={connecting}
        data-connecting={connecting}
        aria-haspopup="dialog"
      >
        <span className="wallet-avatar" aria-hidden />
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        className="wallet-btn"
        data-connected="true"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className="wallet-avatar" aria-hidden />
        <span className="mono">{shorten(address, 4, 4)}</span>
        <ChevronDown
          size={14}
          style={{
            transition: "transform 220ms var(--ease)",
            transform: menuOpen ? "rotate(180deg)" : undefined,
          }}
        />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="panel"
          style={{
            position: "absolute",
            right: 0,
            top: 46,
            width: 272,
            padding: 6,
            boxShadow: "var(--shadow-lift)",
            zIndex: 70,
            animation: "rise 220ms var(--ease-lux)",
          }}
        >
          <div
            style={{
              padding: "12px 12px 10px",
              borderBottom: "1px solid var(--line)",
              display: "grid",
              gap: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <span className="eyebrow">{wallet?.adapter.name ?? "Wallet"}</span>
              <span
                className="badge badge-gold"
                style={{ height: 19, fontSize: 9.5 }}
              >
                <span className="status-dot" aria-hidden />
                {NETWORK_LABEL.replace("Solana ", "")}
              </span>
            </div>
            <div className="mono" style={{ color: "var(--text-strong)" }}>
              {shorten(address, 8, 8)}
            </div>
          </div>

          <button
            role="menuitem"
            className="btn btn-ghost btn-block"
            style={{ justifyContent: "flex-start", marginTop: 4 }}
            onClick={async () => {
              if (address) {
                await navigator.clipboard.writeText(address).catch(() => {});
                setCopied(true);
              }
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Address copied" : "Copy address"}
          </button>

          <Link
            role="menuitem"
            className="btn btn-ghost btn-block"
            style={{ justifyContent: "flex-start" }}
            href="/profile"
            onClick={() => setMenuOpen(false)}
          >
            <User size={14} /> Profile
          </Link>

          {address && (
            <a
              role="menuitem"
              className="btn btn-ghost btn-block"
              style={{ justifyContent: "flex-start" }}
              href={explorerAddressUrl(address)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} /> View on Explorer
            </a>
          )}

          <button
            role="menuitem"
            className="btn btn-ghost btn-block"
            style={{ justifyContent: "flex-start", color: "var(--danger)" }}
            onClick={() => {
              disconnect().catch(() => {});
              setMenuOpen(false);
            }}
          >
            <LogOut size={14} /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
