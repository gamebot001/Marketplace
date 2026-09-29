/**
 * Presentation-only formatters. Pure functions, safe on server and client.
 * Money values from the API are integer lamports; nothing here invents a value.
 */

const LAMPORTS_PER_SOL = BigInt(1_000_000_000);
const ZERO = BigInt(0);

/** Exact lamports → SOL string (integer math; never floating point). */
export function lamportsToSol(lamports: number | string | bigint | null | undefined): string {
  if (lamports === null || lamports === undefined) return "—";
  let value: bigint;
  try {
    value = BigInt(lamports);
  } catch {
    return "—";
  }
  const negative = value < ZERO;
  if (negative) value = -value;
  const whole = value / LAMPORTS_PER_SOL;
  const fraction = value % LAMPORTS_PER_SOL;
  const fractionText = fraction
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");
  const text = fractionText ? `${whole}.${fractionText}` : `${whole}`;
  return negative ? `-${text}` : text;
}

/** SOL amounts with a trailing unit, e.g. "1.25 SOL". */
export function formatSol(lamports: number | string | bigint | null | undefined): string {
  const value = lamportsToSol(lamports);
  return value === "—" ? value : `${value} SOL`;
}

/** Convert a user-entered SOL amount into integer lamports, or null if invalid. */
export function solToLamports(input: string): bigint | null {
  const text = input.trim();
  if (!/^\d*(\.\d{0,9})?$/.test(text) || text === "" || text === ".") return null;
  const [whole, fraction = ""] = text.split(".");
  const padded = (fraction + "000000000").slice(0, 9);
  try {
    return BigInt(whole || "0") * LAMPORTS_PER_SOL + BigInt(padded || "0");
  } catch {
    return null;
  }
}

/** Address/signature shortening. */
export function shorten(value: string | null | undefined, head = 4, tail = 4): string {
  if (!value) return "—";
  const trimmed = value.trim();
  if (trimmed.length <= head + tail + 1) return trimmed;
  return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`;
}

/** Basis points → percent string, e.g. 250 → "2.5%". Null when zero/unset. */
export function bpsToPercent(bps: number | null | undefined): string | null {
  if (typeof bps !== "number" || !Number.isFinite(bps) || bps <= 0) return null;
  const whole = Math.floor(bps / 100);
  const remainder = bps % 100;
  if (remainder === 0) return `${whole}%`;
  const fraction = String(remainder).padStart(2, "0").replace(/0$/, "");
  return `${whole}.${fraction}%`;
}

/** Human date from a unix-seconds timestamp, or null when unavailable. */
export function formatTimestamp(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  try {
    return new Date(seconds * 1000).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

/** Relative time ("3m ago") from unix seconds, or null when unavailable. */
export function relativeTime(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

const IMAGE_RE = /\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i;

/** Resolve an artwork URL only when the URI genuinely points at an image. */
export function resolveImageUrl(uri: string | null | undefined): string | null {
  if (!uri) return null;
  const value = uri.trim();
  if (!IMAGE_RE.test(value)) return null;
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/") ||
    value.startsWith("data:image/")
  ) {
    return value;
  }
  return `/${value}`;
}

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isSolanaAddress(value: string | null | undefined): boolean {
  return typeof value === "string" && BASE58_RE.test(value.trim());
}

/** Title-case a raw activity/listing status for display. */
export function humanizeStatus(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
