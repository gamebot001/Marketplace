use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use mpl_core::instructions::TransferV1CpiBuilder;

use crate::core_asset::read_core_asset_owner;
use crate::errors::MarketplaceError;
use crate::events::NftSold;
use crate::state::{
    Listing, ListingStatus, Marketplace, BPS_DENOMINATOR, LISTING_SEED, MARKETPLACE_SEED,
};

#[derive(Accounts)]
pub struct BuyNft<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(seeds = [MARKETPLACE_SEED], bump = marketplace.bump)]
    pub marketplace: Box<Account<'info, Marketplace>>,

    /// CHECK: Metaplex Core asset, verified against the listing in the handler.
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [LISTING_SEED, marketplace.key().as_ref(), asset.key().as_ref()],
        bump = listing.bump,
        close = buyer
    )]
    pub listing: Box<Account<'info, Listing>>,

    /// CHECK: seller proceeds recipient, bound to the listing seller.
    #[account(mut, address = listing.seller)]
    pub seller: UncheckedAccount<'info>,

    /// CHECK: treasury fee recipient, bound to the marketplace treasury.
    #[account(mut, address = marketplace.treasury)]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: Metaplex Core program.
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: optional Metaplex Core collection account. Must be last (optional).
    #[account(mut)]
    pub collection: Option<UncheckedAccount<'info>>,
}

pub fn handler(ctx: Context<BuyNft>) -> Result<()> {
    let marketplace = &ctx.accounts.marketplace;
    require!(!marketplace.paused, MarketplaceError::MarketplacePaused);
    require!(marketplace.buy_enabled, MarketplaceError::BuyDisabled);

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
    require_keys_eq!(
        ctx.accounts.treasury.key(),
        marketplace.treasury,
        MarketplaceError::InvalidTreasury
    );

    let buyer = ctx.accounts.buyer.key();
    require_keys_neq!(
        buyer,
        listing.seller,
        MarketplaceError::SelfPurchaseNotAllowed
    );

    // The escrow PDA must actually hold the asset right now.
    let escrow_owner = read_core_asset_owner(&ctx.accounts.asset.to_account_info())?;
    require_keys_eq!(
        escrow_owner,
        listing.key(),
        MarketplaceError::AssetNotEscrowed
    );

    let price = listing.price_lamports;
    let fee = (price as u128)
        .checked_mul(marketplace.marketplace_fee_bps as u128)
        .ok_or(MarketplaceError::ArithmeticOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(MarketplaceError::ArithmeticOverflow)? as u64;
    let proceeds = price
        .checked_sub(fee)
        .ok_or(MarketplaceError::ArithmeticOverflow)?;

    // Buyer must hold at least the listed price. The transfers below also
    // enforce this atomically; this gives a precise error first.
    require!(
        ctx.accounts.buyer.lamports() >= price,
        MarketplaceError::InsufficientFunds
    );

    // 1) marketplace fee: buyer -> treasury
    if fee > 0 {
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            fee,
        )?;
    }

    // 2) seller proceeds: buyer -> seller
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.seller.to_account_info(),
            },
        ),
        proceeds,
    )?;

    // 3) escrow -> buyer, signed by the listing PDA.
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

    TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&ctx.accounts.asset.to_account_info())
        .collection(cpi_collection.as_ref())
        .payer(&ctx.accounts.buyer.to_account_info())
        .authority(Some(&ctx.accounts.listing.to_account_info()))
        .new_owner(&ctx.accounts.buyer.to_account_info())
        .system_program(Some(&ctx.accounts.system_program.to_account_info()))
        .invoke_signed(&[seeds])?;

    emit!(NftSold {
        marketplace: marketplace.key(),
        listing: listing.key(),
        asset: asset_key,
        seller: listing.seller,
        buyer,
        price_lamports: price,
        fee_lamports: fee,
        seller_proceeds_lamports: proceeds,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
