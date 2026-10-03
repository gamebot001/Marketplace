"""CoreAssetService — direct, read-only Metaplex Core asset inspection.

Phase 1 needs to prove real on-chain ownership without building a full
reconciliation engine. This service reads a Core asset account from the RPC and
decodes exactly the fixed prefix the marketplace relies on:

    [0]      key: Key::AssetV1 (== 1)
    [1..33]  owner: Pubkey
    [33]     update_authority variant (0 None | 1 Collection | 2 Address)
    ...

It is deliberately independent of any off-chain index: it is the chain's answer
to "who owns this asset right now".
"""

import base64

from marketplace_backend.services.solana import wallet_service

# Metaplex Core program id (the asset standard, not the Zecians marketplace).
MPL_CORE_PROGRAM_ID = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"

CORE_KEY_ASSET_V1 = 1


class CoreAssetError(ValueError):
    pass


def _read_string(data: bytes, offset: int):
    if offset + 4 > len(data):
        raise CoreAssetError("truncated string length")
    length = int.from_bytes(data[offset : offset + 4], "little")
    offset += 4
    if offset + length > len(data):
        raise CoreAssetError("truncated string body")
    value = data[offset : offset + length].decode("utf-8", errors="replace")
    return value, offset + length


def decode_base_asset(data: bytes) -> dict:
    """Decode the stable prefix of a BaseAssetV1 account."""
    if len(data) < 33 or data[0] != CORE_KEY_ASSET_V1:
        raise CoreAssetError("account is not a Metaplex Core AssetV1")

    owner = wallet_service.encode_base58(data[1:33])
    offset = 33

    variant = data[offset]
    offset += 1
    collection = None
    if variant == 1:
        if offset + 32 > len(data):
            raise CoreAssetError("truncated collection authority")
        collection = wallet_service.encode_base58(data[offset : offset + 32])
        offset += 32
    elif variant == 2:
        offset += 32  # update authority is a plain address, not a collection

    name, offset = _read_string(data, offset)
    uri, offset = _read_string(data, offset)

    return {
        "asset_address": None,  # filled in by the caller (the requested address)
        "owner_address": owner,
        "collection_address": collection,
        "name": name or None,
        "metadata_uri": uri or None,
        "standard": "metaplex-core",
    }


def read_core_asset(chain_service, asset_address: str) -> dict:
    """Read and decode a Core asset directly from the cluster."""
    info = chain_service.get_account_info(asset_address, encoding="base64")
    value = (info or {}).get("value")
    if not value:
        raise CoreAssetError("asset account %s not found" % asset_address)

    account_owner = value.get("owner")
    if account_owner != MPL_CORE_PROGRAM_ID:
        raise CoreAssetError(
            "account %s is not owned by the Metaplex Core program" % asset_address
        )

    encoded = value.get("data")
    # getAccountInfo returns [base64, "base64"].
    if isinstance(encoded, list) and encoded:
        encoded = encoded[0]
    try:
        raw = base64.b64decode(encoded)
    except Exception as exc:  # pragma: no cover - defensive
        raise CoreAssetError("asset account data is not valid base64") from exc

    decoded = decode_base_asset(raw)
    decoded["asset_address"] = asset_address
    return decoded
