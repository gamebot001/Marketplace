"""Tests for the direct Metaplex Core asset decoder (no network)."""

import pytest

from marketplace_backend.services.solana import core_asset_service
from marketplace_backend.services.solana.wallet_service import (
    encode_base58,
    is_valid_address,
)

OWNER = encode_base58((7).to_bytes(32, "big"))
COLLECTION = encode_base58((8).to_bytes(32, "big"))
OTHER = encode_base58((9).to_bytes(32, "big"))


def _string(value: str) -> bytes:
    raw = value.encode()
    return len(raw).to_bytes(4, "little") + raw


def build_asset(key=1, owner=OWNER, variant=1, collection=COLLECTION, name="Test", uri="https://x/y.json"):
    from marketplace_backend.services.solana.wallet_service import _base58_decode

    body = bytes([key]) + _base58_decode(owner)
    body += bytes([variant])
    if variant == 1:
        body += _base58_decode(collection)
    elif variant == 2:
        body += _base58_decode(OTHER)
    body += _string(name) + _string(uri)
    return body


def test_decodes_collection_asset_owner_and_collection():
    decoded = core_asset_service.decode_base_asset(build_asset())
    assert decoded["owner_address"] == OWNER
    assert decoded["collection_address"] == COLLECTION
    assert decoded["name"] == "Test"
    assert decoded["metadata_uri"] == "https://x/y.json"
    assert decoded["standard"] == "metaplex-core"


def test_decodes_collectionless_asset():
    decoded = core_asset_service.decode_base_asset(build_asset(variant=0))
    assert decoded["owner_address"] == OWNER
    assert decoded["collection_address"] is None


def test_rejects_non_asset_account():
    with pytest.raises(core_asset_service.CoreAssetError):
        core_asset_service.decode_base_asset(b"\x02" + b"\x00" * 64)


def test_base58_roundtrip():
    raw = (123456789).to_bytes(32, "big")
    encoded = encode_base58(raw)
    assert is_valid_address(encoded)
    from marketplace_backend.services.solana.wallet_service import _base58_decode

    assert _base58_decode(encoded) == raw
