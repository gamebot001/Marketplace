use anchor_lang::prelude::*;

use crate::errors::MarketplaceError;

/// Metaplex Core program id.
pub const MPL_CORE_PROGRAM_ID: Pubkey =
    pubkey!("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

/// Metaplex Core `Key::AssetV1` discriminator (first byte of an asset account).
const CORE_KEY_ASSET_V1: u8 = 1;

/// Read the current owner of a Metaplex Core asset directly from its account
/// data. This is the program's own chain-verified source of ownership truth and
/// never trusts a caller-supplied owner.
///
/// Layout of a Core asset account starts with the serialized `BaseAssetV1`:
///
/// ```text
///   [0]      key: Key::AssetV1 (== 1)
///   [1..33]  owner: Pubkey
///   ...      update_authority, name, uri, seq (and optional plugins)
/// ```
///
/// Only the fixed 33-byte prefix is needed to prove ownership, which keeps this
/// independent of the off-chain metadata payload.
pub fn read_core_asset_owner(asset: &AccountInfo) -> Result<Pubkey> {
    require_keys_eq!(
        *asset.owner,
        MPL_CORE_PROGRAM_ID,
        MarketplaceError::InvalidAsset
    );
    let data = asset.try_borrow_data()?;
    require!(data.len() >= 33, MarketplaceError::InvalidAsset);
    require!(data[0] == CORE_KEY_ASSET_V1, MarketplaceError::InvalidAsset);
    let mut owner = [0u8; 32];
    owner.copy_from_slice(&data[1..33]);
    Ok(Pubkey::new_from_array(owner))
}

/// Read the asset's collection address when its update authority is
/// `UpdateAuthority::Collection`. Returns None for `None`/`Address` authorities.
///
/// Core enum order is `None = 0, Address = 1, Collection = 2`.
pub fn read_core_asset_collection(asset: &AccountInfo) -> Result<Option<Pubkey>> {
    let data = asset.try_borrow_data()?;
    if data.len() < 34 {
        return Ok(None);
    }
    if data[33] == 2 && data.len() >= 66 {
        let mut collection = [0u8; 32];
        collection.copy_from_slice(&data[34..66]);
        Ok(Some(Pubkey::new_from_array(collection)))
    } else {
        Ok(None)
    }
}

/// Resolve the collection account to hand to a Core CPI.
///
/// If the asset is collection-managed, the provided collection account must be
/// present and match the asset's stored collection. If the asset is not
/// collection-managed, no collection is passed (passing one is an error in
/// Core). This keeps the program correct for both collection and
/// collectionless Core assets.
pub fn resolve_collection_for_cpi<'a>(
    asset: &AccountInfo<'a>,
    provided: Option<&AccountInfo<'a>>,
) -> Result<Option<AccountInfo<'a>>> {
    match read_core_asset_collection(asset)? {
        Some(expected) => {
            let info = provided
                .map(|c| c.to_account_info())
                .ok_or(error!(MarketplaceError::InvalidCollection))?;
            require_keys_eq!(info.key(), expected, MarketplaceError::InvalidCollection);
            Ok(Some(info))
        }
        None => Ok(None),
    }
}
