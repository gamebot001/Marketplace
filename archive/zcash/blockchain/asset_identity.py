"""ZIP 227 asset identity helpers.

Implements the exact asset-description hashing defined in ZIP 227
(Issuance of Zcash Shielded Assets):

    assetDescHash = BLAKE2b-256(person="ZSA-AssetDescCRH", data=asset_desc)
    AssetId       = (issuer, assetDescHash)

This is the real derivation Zcash consensus uses for ZSA issuance.
Reference: https://zips.z.cash/zip-0227
"""

import hashlib

ASSET_DESC_PERSON = b"ZSA-AssetDescCRH"
ISSUER_VERSION_BYTE = b"\x00"


def asset_desc_hash(asset_desc: str) -> str:
    """Return the hex-encoded ZIP 227 assetDescHash for an asset description."""
    digest = hashlib.blake2b(
        asset_desc.encode("utf-8"), digest_size=32, person=ASSET_DESC_PERSON
    ).hexdigest()
    return digest


def canonical_asset_id(asset_desc_hash_hex: str, issuer_ik_encoding_hex: str) -> str:
    """Encode AssetId per ZIP 227: 0x00 || issuer(ik_encoding) || assetDescHash.

    issuer_ik_encoding_hex must already include its leading signature-scheme
    byte (0x00 for BIP-340) as specified by ZIP 227.
    """
    return ISSUER_VERSION_BYTE.hex() + issuer_ik_encoding_hex + asset_desc_hash_hex


def zecians_asset_desc(prefix: str, collection: str, nft_number: int) -> str:
    """Zecians project convention for asset descriptions.

    Example: zecians_asset_desc("zsc1", "zecians", 1) == "zsc1|zecians-genesis|001"
    This string format is a project-specific convention; the protocol only
    cares about the bytes being unique per issuer.
    """
    return "%s|%s|%03d" % (prefix, collection, nft_number)
