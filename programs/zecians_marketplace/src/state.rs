use anchor_lang::prelude::*;

/// PDA seed for the single marketplace configuration account.
pub const MARKETPLACE_SEED: &[u8] = b"marketplace";

/// PDA seed for a per-asset escrow listing account.
pub const LISTING_SEED: &[u8] = b"listing";

/// Hard cap on the marketplace fee (20%). A misconfigured marketplace can
/// never take the majority of a sale.
pub const MAX_MARKETPLACE_FEE_BPS: u16 = 2_000;

/// Basis-point denominator (1 bps = 0.01%).
pub const BPS_DENOMINATOR: u128 = 10_000;

/// Phase 1 marketplace configuration. Deliberately small: only the switches
/// and fee that the escrow listing flow actually needs.
#[account]
#[derive(InitSpace)]
pub struct Marketplace {
    /// Platform authority that initialised the marketplace.
    pub authority: Pubkey,
    /// Public key that receives marketplace fees. Never a signing wallet.
    pub treasury: Pubkey,
    /// Marketplace fee in basis points. Integer lamports settlement only.
    pub marketplace_fee_bps: u16,
    /// When false, new listings are refused.
    pub listing_enabled: bool,
    /// When false, purchases are refused.
    pub buy_enabled: bool,
    /// Global kill switch.
    pub paused: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

/// Listing lifecycle. Phase 1 only needs these four states; expiry is not
/// implemented.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum ListingStatus {
    Pending,
    Active,
    Sold,
    Cancelled,
}

/// A per-asset escrow listing. The listing PDA itself becomes the owner of the
/// Metaplex Core asset while `status == Active`, which is what makes the escrow
/// real on-chain rather than a database flag.
#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub marketplace: Pubkey,
    pub asset: Pubkey,
    /// Optional Metaplex Core collection the asset belongs to.
    pub collection: Option<Pubkey>,
    pub seller: Pubkey,
    pub price_lamports: u64,
    pub status: ListingStatus,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}
