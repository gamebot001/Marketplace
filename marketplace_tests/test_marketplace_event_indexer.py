"""Tests for the minimal on-chain event processor.

These use synthetic Anchor log lines (correctly Borsh-encoded) and a fake chain
service — no network access. They prove the read model only moves on real
events and that replay is idempotent.
"""

import base64
import struct

import pytest

from marketplace_backend.services.json_file_store import JsonFileStore
from marketplace_backend.services.solana import marketplace_event_indexer as mei
from marketplace_backend.services.solana import nft_asset_service
from marketplace_backend.services.solana.wallet_service import encode_base58

SELLER = encode_base58((1).to_bytes(32, "big"))
BUYER = encode_base58((2).to_bytes(32, "big"))
COLLECTION = encode_base58((3).to_bytes(32, "big"))
ASSET = encode_base58((4).to_bytes(32, "big"))
LISTING = encode_base58((5).to_bytes(32, "big"))
MARKETPLACE = encode_base58((6).to_bytes(32, "big"))


def _pk(value: str) -> bytes:
    from marketplace_backend.services.solana.wallet_service import _base58_decode

    return _base58_decode(value)


def _log(name: str, body: bytes) -> str:
    raw = mei.event_discriminator(name) + body
    return "Program data: " + base64.b64encode(raw).decode()


def listing_created_log(price=2_000_000_000, ts=1_700_000_000) -> str:
    body = (
        _pk(MARKETPLACE)
        + _pk(LISTING)
        + _pk(ASSET)
        + _pk(SELLER)
        + struct.pack("<Q", price)
        + struct.pack("<q", ts)
    )
    return _log("ListingCreated", body)


def nft_sold_log(price=2_000_000_000, fee=50_000_000, proceeds=1_950_000_000, ts=1_700_000_100) -> str:
    body = (
        _pk(MARKETPLACE)
        + _pk(LISTING)
        + _pk(ASSET)
        + _pk(SELLER)
        + _pk(BUYER)
        + struct.pack("<Q", price)
        + struct.pack("<Q", fee)
        + struct.pack("<Q", proceeds)
        + struct.pack("<q", ts)
    )
    return _log("NftSold", body)


def listing_cancelled_log(ts=1_700_000_200) -> str:
    body = _pk(MARKETPLACE) + _pk(LISTING) + _pk(ASSET) + _pk(SELLER) + struct.pack("<q", ts)
    return _log("ListingCancelled", body)


@pytest.fixture
def stores(tmp_path):
    return {
        "marketplace": JsonFileStore(tmp_path / "marketplace.json"),
        "asset": JsonFileStore(tmp_path / "assets.json"),
        "treasury": JsonFileStore(tmp_path / "treasury.json"),
        "indexer": JsonFileStore(tmp_path / "indexer.json"),
    }


def _register_asset(asset_store):
    nft_asset_service.register_asset(
        asset_store,
        {
            "asset_address": ASSET,
            "collection_address": COLLECTION,
            "owner_address": SELLER,
            "standard": "metaplex-core",
            "metadata_uri": "onchain://%s" % ASSET,
            "royalty_bps": 0,
            "verified_collection": True,
        },
        now=1,
    )


def _indexer(stores):
    return mei.MarketplaceEventIndexer(
        stores["marketplace"], stores["asset"], stores["treasury"], stores["indexer"]
    )


def test_decode_only_matches_marketplace_events():
    logs = [
        "Program log: hello",
        "Program data: " + base64.b64encode(b"not-an-event").decode(),
        listing_created_log(),
    ]
    events = mei.decode_events(logs)
    assert len(events) == 1
    name, payload = events[0]
    assert name == "ListingCreated"
    assert payload["asset"] == ASSET
    assert payload["seller"] == SELLER
    assert payload["price_lamports"] == 2_000_000_000


def test_listing_then_sale_updates_read_model(stores):
    _register_asset(stores["asset"])
    indexer = _indexer(stores)

    applied = indexer.apply_transaction("sig-list", 100, 1_700_000_000, [listing_created_log()])
    assert applied == 1
    listing = stores["marketplace"].get("listings", {})[LISTING]
    assert listing["status"] == "active"
    assert listing["collection_address"] == COLLECTION
    assert listing["price_lamports"] == 2_000_000_000

    applied = indexer.apply_transaction("sig-sale", 101, 1_700_000_100, [nft_sold_log()])
    assert applied == 1
    listing = stores["marketplace"].get("listings", {})[LISTING]
    assert listing["status"] == "sold"
    sale = stores["marketplace"].get("sales", {})[listing["sale_id"]]
    assert sale["buyer_address"] == BUYER
    assert sale["fee_lamports"] == 50_000_000
    assert sale["seller_proceeds_lamports"] == 1_950_000_000

    asset = nft_asset_service.get_asset(stores["asset"], ASSET)
    assert asset["owner_address"] == BUYER

    treasury_events = stores["treasury"].get("treasury_events", []) or []
    assert any(e["kind"] == "marketplace_fee" and e["lamports"] == 50_000_000 for e in treasury_events)


def test_processing_is_idempotent(stores):
    _register_asset(stores["asset"])
    indexer = _indexer(stores)

    assert indexer.apply_transaction("sig-list", 100, 1, [listing_created_log()]) == 1
    assert indexer.apply_transaction("sig-list", 100, 1, [listing_created_log()]) == 0

    activity = stores["indexer"].get("activity_events", [])
    assert len([e for e in activity if e["signature"] == "sig-list"]) == 1


def test_cancel_returns_ownership(stores):
    _register_asset(stores["asset"])
    indexer = _indexer(stores)
    indexer.apply_transaction("sig-list", 100, 1, [listing_created_log()])
    indexer.apply_transaction("sig-sale", 101, 2, [nft_sold_log()])
    # still active path is irrelevant; a fresh listing + cancel:
    indexer.apply_transaction("sig-list-2", 102, 3, [listing_created_log()])
    indexer.apply_transaction("sig-cancel", 103, 4, [listing_cancelled_log()])

    listing = stores["marketplace"].get("listings", {})[LISTING]
    assert listing["status"] == "cancelled"
    asset = nft_asset_service.get_asset(stores["asset"], ASSET)
    assert asset["owner_address"] == SELLER
