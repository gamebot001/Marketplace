use anchor_lang::prelude::*;

use crate::errors::MarketplaceError;
use crate::events::MarketplaceInitialized;
use crate::state::{Marketplace, MAX_MARKETPLACE_FEE_BPS, MARKETPLACE_SEED};

#[derive(Accounts)]
pub struct InitializeMarketplace<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Marketplace::INIT_SPACE,
        seeds = [MARKETPLACE_SEED],
        bump
    )]
    pub marketplace: Account<'info, Marketplace>,

    /// CHECK: treasury receives marketplace fees. Public address only, never a
    /// signing wallet. Stored verbatim in the marketplace account.
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeMarketplace>, marketplace_fee_bps: u16) -> Result<()> {
    require!(
        marketplace_fee_bps <= MAX_MARKETPLACE_FEE_BPS,
        MarketplaceError::InvalidFee
    );
    require_keys_neq!(
        ctx.accounts.treasury.key(),
        Pubkey::default(),
        MarketplaceError::InvalidTreasury
    );

    let now = Clock::get()?.unix_timestamp;
    let marketplace = &mut ctx.accounts.marketplace;
    marketplace.authority = ctx.accounts.authority.key();
    marketplace.treasury = ctx.accounts.treasury.key();
    marketplace.marketplace_fee_bps = marketplace_fee_bps;
    marketplace.listing_enabled = true;
    marketplace.buy_enabled = true;
    marketplace.paused = false;
    marketplace.created_at = now;
    marketplace.updated_at = now;
    marketplace.bump = ctx.bumps.marketplace;

    emit!(MarketplaceInitialized {
        marketplace: marketplace.key(),
        authority: marketplace.authority,
        treasury: marketplace.treasury,
        marketplace_fee_bps,
        timestamp: now,
    });

    Ok(())
}
