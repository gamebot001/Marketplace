use anchor_lang::prelude::*;
use mpl_core::instructions::TransferV1CpiBuilder;

use crate::core_asset::read_core_asset_owner;
use crate::errors::MarketplaceError;
use crate::events::ListingCreated;
use crate::state::{Listing, ListingStatus, Marketplace, LISTING_SEED, MARKETPLACE_SEED};

#[derive(Accounts)]
pub struct CreateListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(seeds = [MARKETPLACE_SEED], bump = marketplace.bump)]
    pub marketplace: Box<Account<'info, Marketplace>>,

    /// CHECK: Metaplex Core asset. Ownership is verified directly from account
    /// data in the handler before any transfer.
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    #[account(
        init,
        payer = seller,
        space = 8 + Listing::INIT_SPACE,
        seeds = [LISTING_SEED, marketplace.key().as_ref(), asset.key().as_ref()],
        bump
    )]
    pub listing: Box<Account<'info, Listing>>,

    /// CHECK: Metaplex Core program.
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: optional Metaplex Core collection account for the asset. Must be
    /// the last account because it is optional.
    #[account(mut)]
    pub collection: Option<UncheckedAccount<'info>>,
}

pub fn handler(ctx: Context<CreateListing>, price_lamports: u64) -> Result<()> {
    let marketplace = &ctx.accounts.marketplace;
    require!(!marketplace.paused, MarketplaceError::MarketplacePaused);
    require!(marketplace.listing_enabled, MarketplaceError::ListingDisabled);
    require!(price_lamports > 0, MarketplaceError::InvalidPrice);

    // Direct Core ownership verification: the seller must currently own the
    // asset, read from the asset account itself.
    let owner = read_core_asset_owner(&ctx.accounts.asset.to_account_info())?;
    require_keys_eq!(
        owner,
        ctx.accounts.seller.key(),
        MarketplaceError::AssetNotOwned
    );

    let collection_key = ctx.accounts.collection.as_ref().map(|c| c.key());
    let provided_collection = ctx
        .accounts
        .collection
        .as_ref()
        .map(|c| c.to_account_info());
    let cpi_collection = crate::core_asset::resolve_collection_for_cpi(
        &ctx.accounts.asset.to_account_info(),
        provided_collection.as_ref(),
    )?;

    // Escrow the Core asset into the listing PDA.
    TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&ctx.accounts.asset.to_account_info())
        .collection(cpi_collection.as_ref())
        .payer(&ctx.accounts.seller.to_account_info())
        .authority(Some(&ctx.accounts.seller.to_account_info()))
        .new_owner(&ctx.accounts.listing.to_account_info())
        .system_program(Some(&ctx.accounts.system_program.to_account_info()))
        .invoke()?;

    let now = Clock::get()?.unix_timestamp;
    let listing = &mut ctx.accounts.listing;
    listing.marketplace = marketplace.key();
    listing.asset = ctx.accounts.asset.key();
    listing.collection = collection_key;
    listing.seller = ctx.accounts.seller.key();
    listing.price_lamports = price_lamports;
    listing.status = ListingStatus::Active;
    listing.created_at = now;
    listing.updated_at = now;
    listing.bump = ctx.bumps.listing;

    emit!(ListingCreated {
        marketplace: marketplace.key(),
        listing: listing.key(),
        asset: listing.asset,
        seller: listing.seller,
        price_lamports,
        timestamp: now,
    });

    Ok(())
}
