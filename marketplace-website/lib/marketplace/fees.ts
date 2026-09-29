/**
 * Integer-lamport fee math for the review screens.
 *
 * Conservation is exact: `price + fee + royalty === total` paid by the buyer,
 * because the buyer covers the configured marketplace fee and creator royalty.
 * This mirrors the backend's integer-only settlement model.
 */

export interface FeeBreakdown {
  price: bigint;
  fee: bigint;
  royalty: bigint;
  total: bigint;
  feeBps: number;
  royaltyBps: number;
}

export function splitFees(
  priceLamports: number | string | bigint,
  marketplaceFeeBps: number,
  royaltyBps: number
): FeeBreakdown {
  const price = BigInt(priceLamports);
  const safeFeeBps = Number.isFinite(marketplaceFeeBps) ? Math.max(0, marketplaceFeeBps) : 0;
  const safeRoyaltyBps = Number.isFinite(royaltyBps) ? Math.max(0, royaltyBps) : 0;
  const fee = (price * BigInt(Math.round(safeFeeBps))) / 10_000n;
  const royalty = (price * BigInt(Math.round(safeRoyaltyBps))) / 10_000n;
  return {
    price,
    fee,
    royalty,
    total: price + fee + royalty,
    feeBps: safeFeeBps,
    royaltyBps: safeRoyaltyBps,
  };
}
