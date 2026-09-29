/**
 * Types mirroring the collection-agnostic Zecians platform API.
 * Nothing here is hardcoded marketplace content — these describe real responses.
 */

export type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export type ListingStatus =
  | "active"
  | "sold"
  | "cancelled"
  | "expired"
  | string;

export interface MarketplaceListing {
  listing_id: string;
  asset_address: string;
  collection_address: string | null;
  seller_address: string;
  price_lamports: number;
  currency: string;
  marketplace?: string;
  status: ListingStatus;
  created_at?: number;
  sale_id?: string | null;
}

export interface MarketplaceSale {
  sale_id: string;
  listing_id: string;
  asset_address: string;
  collection_address: string | null;
  seller_address: string;
  buyer_address: string;
  currency: string;
  signature: string;
  slot?: number | null;
  block_time?: number | null;
  fee_bps?: number;
  royalty_bps?: number;
  fee_lamports?: number;
  royalty_lamports?: number;
  seller_proceeds_lamports?: number;
  price_lamports: number;
  status: string;
  created_at?: number;
}

export interface NftAttribute {
  trait: string;
  value: string;
}

export interface MarketplaceAsset {
  asset_address: string;
  collection_address: string | null;
  owner_address: string | null;
  standard: string;
  metadata_uri: string | null;
  creator_address: string | null;
  royalty_bps: number;
  verified_collection: boolean;
  name?: string | null;
  description?: string | null;
  image?: string | null;
  attributes?: NftAttribute[] | null;
}

export interface MarketplaceCollection {
  slug: string;
  name: string;
  description: string | null;
  image: string | null;
  standard: string;
  verification_status: string;
  marketplace_status: string;
  collection_address: string | null;
  chain_deployed: boolean;
  royalty_bps?: number;
  website?: string | null;
  socials?: Record<string, string>;
  supply?: number | null;
  flagship?: boolean;
  collection_id?: string;
}

export interface MarketplaceConfig {
  chain: string;
  network: string;
  nft_standard: string;
  mint_enabled: boolean;
  marketplace_enabled: boolean;
  allowlist_enabled: boolean;
  fees: {
    marketplace_fee_bps: number;
    royalty_bps_default: number;
    currency: string;
  };
}

export interface ActivityEvent {
  signature: string;
  slot: number;
  block_time: number | null;
  type: string;
  asset_address: string | null;
  collection_address: string | null;
  from_address: string | null;
  to_address: string | null;
  seller_address: string | null;
  buyer_address: string | null;
  lamports: number | null;
  now?: number;
}

export interface TreasuryEvent {
  event_id: string;
  kind: string;
  lamports: number;
  signature: string | null;
  slot: number | null;
  block_time: number | null;
  ref: string | null;
  created_at: number;
}

export interface TreasuryResponse {
  treasury_address: string | null;
  summary: {
    total_lamports: number;
    event_count: number;
    by_kind: Record<string, number>;
  };
  events: TreasuryEvent[];
}

export interface CollectionDetail {
  collection: MarketplaceCollection;
  asset_count: number;
}

export interface ListingDetail {
  listing: MarketplaceListing;
  sale: MarketplaceSale | null;
}

export interface HealthResponse {
  status: string;
  chain: string;
  network: string;
  env: string;
  nft_standard: string;
  rpc_configured: boolean;
  treasury_configured: boolean;
}
