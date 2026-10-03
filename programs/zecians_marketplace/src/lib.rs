use anchor_lang::prelude::*;

pub mod core_asset;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("5E5HHbGwZbhmEcoRwBXArzoGqxX6Yh9ACPHET6EwnAwJ");

/// Zecians marketplace — Phase 1 escrow listing program.
///
/// Architecture (locked): a Metaplex Core asset is transferred into the listing
/// PDA on `create_listing`, making the PDA the real on-chain owner (escrow).
/// `buy_nft` settles SOL and the asset atomically, `cancel_listing` returns the
/// asset to the seller. Only the four Phase 1 instructions exist.
#[program]
pub mod zecians_marketplace {
    use super::*;

    pub fn initialize_marketplace(
        ctx: Context<InitializeMarketplace>,
        marketplace_fee_bps: u16,
    ) -> Result<()> {
        instructions::initialize_marketplace::handler(ctx, marketplace_fee_bps)
    }

    pub fn create_listing(ctx: Context<CreateListing>, price_lamports: u64) -> Result<()> {
        instructions::create_listing::handler(ctx, price_lamports)
    }

    pub fn buy_nft(ctx: Context<BuyNft>) -> Result<()> {
        instructions::buy_nft::handler(ctx)
    }

    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        instructions::cancel_listing::handler(ctx)
    }
}
