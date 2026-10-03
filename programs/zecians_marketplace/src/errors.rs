use anchor_lang::prelude::*;

/// Descriptive, non-generic program errors. UI code maps these to honest
/// messages instead of hiding the real failure.
#[error_code]
pub enum MarketplaceError {
    #[msg("The marketplace is paused.")]
    MarketplacePaused,
    #[msg("The listing was not found.")]
    ListingNotFound,
    #[msg("The listing is not active.")]
    ListingNotActive,
    #[msg("Only the seller may perform this action.")]
    UnauthorizedSeller,
    #[msg("The provided asset does not match the listing.")]
    InvalidAsset,
    #[msg("The asset is not held in escrow by the listing.")]
    AssetNotEscrowed,
    #[msg("The signer does not own the asset.")]
    AssetNotOwned,
    #[msg("The provided price does not match the listing.")]
    PriceMismatch,
    #[msg("Insufficient funds for this transaction.")]
    InsufficientFunds,
    #[msg("The marketplace account is invalid.")]
    InvalidMarketplace,
    #[msg("The treasury account is invalid.")]
    InvalidTreasury,
    #[msg("Trading is currently disabled.")]
    TradingDisabled,
    #[msg("Buying is currently disabled.")]
    BuyDisabled,
    #[msg("Listing is currently disabled.")]
    ListingDisabled,
    #[msg("This listing has already been settled.")]
    AlreadySettled,
    #[msg("The marketplace fee is invalid.")]
    InvalidFee,
    #[msg("Buyer and seller must be different accounts.")]
    SelfPurchaseNotAllowed,
    #[msg("The price must be greater than zero.")]
    InvalidPrice,
    #[msg("The asset does not belong to the provided collection.")]
    InvalidCollection,
    #[msg("Arithmetic overflow or underflow.")]
    ArithmeticOverflow,
}
