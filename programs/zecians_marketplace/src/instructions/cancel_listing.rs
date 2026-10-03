use anchor_lang::prelude::*;
use mpl_core::instructions::TransferV1CpiBuilder;

use crate::core_asset::read_core_asset_owner;
use crate::errors::MarketplaceError;
use crate::events::ListingCancelled;
use crate::state::{Listing, ListingStatus, Marketplace, LISTING_SEED, MARKETPLACE_SEED};

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(seeds = [MARKETPLACE_SEED], bump = marketplace.bump)]
    pub marketplace: Box<Account<'info, Marketplace>>,

    /// CHECK: Metaplex Core asset, verified against the listing in the handler.
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [LISTING_SEED, marketplace.key().as_ref(), asset.key().as_ref()],
        bump = listing.bump,
        close = seller
    )]
    pub listing: Box<Account<'info, Listing>>,

    /// CHECK: Metaplex Core program.
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: optional Metaplex Core collection account. Must be last (optional).
    #[account(mut)]
    pub collection: Option<UncheckedAccount<'info>>,
}

pub fn handler(ctx: Context<CancelListing>) -> Result<()> {
    let marketplace = &ctx.accounts.marketplace;
    require!(!marketplace.paused, MarketplaceError::MarketplacePaused);

    let listing = &ctx.accounts.listing;
    require!(
        listing.status == ListingStatus::Active,
        MarketplaceError::ListingNotActive
    );
    require_keys_eq!(
        listing.marketplace,
        marketplace.key(),
        MarketplaceError::InvalidMarketplace
    );
    require_keys_eq!(
        listing.asset,
        ctx.accounts.asset.key(),
        MarketplaceError::InvalidAsset
    );
    require_keys_eq!(
        listing.seller,
        ctx.accounts.seller.key(),
        MarketplaceError::UnauthorizedSeller
    );

    // The escrow PDA must actually hold the asset right now.
    let escrow_owner = read_core_asset_owner(&ctx.accounts.asset.to_account_info())?;
    require_keys_eq!(
        escrow_owner,
        listing.key(),
        MarketplaceError::AssetNotEscrowed
    );

    let provided_collection = ctx
        .accounts
        .collection
        .as_ref()
        .map(|c| c.to_account_info());
    let cpi_collection = crate::core_asset::resolve_collection_for_cpi(
        &ctx.accounts.asset.to_account_info(),
        provided_collection.as_ref(),
    )?;
    let marketplace_key = marketplace.key();
    let asset_key = ctx.accounts.asset.key();
    let bump = listing.bump;
    let seeds: &[&[u8]] = &[
        LISTING_SEED,
        marketplace_key.as_ref(),
        asset_key.as_ref(),
        &[bump],
    ];

    // Escrow -> seller, signed by the listing PDA.
    TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&ctx.accounts.asset.to_account_info())
        .collection(cpi_collection.as_ref())
        .payer(&ctx.accounts.seller.to_account_info())
        .authority(Some(&ctx.accounts.listing.to_account_info()))
        .new_owner(&ctx.accounts.seller.to_account_info())
        .system_program(Some(&ctx.accounts.system_program.to_account_info()))
        .invoke_signed(&[seeds])?;

    emit!(ListingCancelled {
        marketplace: marketplace.key(),
        listing: listing.key(),
        asset: asset_key,
        seller: listing.seller,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
