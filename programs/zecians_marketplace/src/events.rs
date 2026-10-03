use anchor_lang::prelude::*;

/// Emitted once when the marketplace configuration account is created.
#[event]
pub struct MarketplaceInitialized {
    pub marketplace: Pubkey,
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub marketplace_fee_bps: u16,
    pub timestamp: i64,
}

/// Emitted when a Core asset has been escrowed and a listing becomes Active.
#[event]
pub struct ListingCreated {
    pub marketplace: Pubkey,
    pub listing: Pubkey,
    pub asset: Pubkey,
    pub seller: Pubkey,
    pub price_lamports: u64,
    pub timestamp: i64,
}

/// Emitted when the atomic settlement succeeds and the asset moves to the buyer.
#[event]
pub struct NftSold {
    pub marketplace: Pubkey,
    pub listing: Pubkey,
    pub asset: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub price_lamports: u64,
    pub fee_lamports: u64,
    pub seller_proceeds_lamports: u64,
    pub timestamp: i64,
}

/// Emitted when the seller reclaims an escrowed asset.
#[event]
pub struct ListingCancelled {
    pub marketplace: Pubkey,
    pub listing: Pubkey,
    pub asset: Pubkey,
    pub seller: Pubkey,
    pub timestamp: i64,
}
