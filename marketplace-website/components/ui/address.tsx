"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { shorten } from "@/lib/format";
import { explorerAddressUrl } from "@/lib/solana/cluster";

/**
 * Shortened Solana address with a copy action. Optionally links to the devnet
 * explorer. No keys, no signing.
 */
export function Address({
  value,
  head = 4,
  tail = 4,
  link = false,
  className,
}: {
  value: string | null | undefined;
  head?: number;
  tail?: number;
  link?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const text = value ?? "";

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  if (!value) return <span className={className}>—</span>;

  const display = shorten(value, head, tail);

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      {link ? (
        <a
          className="mono"
          href={explorerAddressUrl(value)}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--text)" }}
        >
          {display}
        </a>
      ) : (
        <span className="mono">{display}</span>
      )}
      <button
        type="button"
        className="copy-btn"
        aria-label={`Copy address ${value}`}
        onClick={async () => {
          await navigator.clipboard.writeText(text).catch(() => {});
          setCopied(true);
        }}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </span>
  );
}
