"""CatalogService — beneficial owner counts and public collection visibility.

These are pure read-model tests: they feed the JSON stores the same records the
indexer writes and assert the roll-up the API exposes. No network access.
"""

import pytest

from marketplace_backend.services.json_file_store import JsonFileStore
from marketplace_backend.services.solana import catalog_service
from marketplace_backend.services.solana import collection_registry as reg
from marketplace_backend.services.solana import marketplace_service
from marketplace_backend.services.solana import models as m
from marketplace_backend.services.solana import nft_asset_service
from marketplace_tests.conftest import b58_address


@pytest.fixture
def stores(tmp_path):
    return {
        "assets": JsonFileStore(tmp_path / "assets.json"),
        "marketplace": JsonFileStore(tmp_path / "marketplace.json"),
    }


def _register_asset(store, asset, collection, owner, now=1):
    nft_asset_service.register_asset(
        store,
        {
            "asset_address": asset,
            "collection_address": collection,
            "owner_address": owner,
            "standard": "metaplex-core",
            "metadata_uri": "onchain://%s" % asset,
            "royalty_bps": 0,
            "verified_collection": False,
        },
        now=now,
    )


def test_owner_count_excludes_escrow_and_counts_beneficial_owners(stores):
    collection = b58_address(1000)
    owner_a = b58_address(1001)
    owner_b = b58_address(1002)
    escrow = b58_address(1003)
    asset_a = b58_address(1004)
    asset_b = b58_address(1005)

    # asset_a is unlisted and owned by A; asset_b is listed by B and — as an
    # escrowed Core asset — is held by the listing PDA, not by B directly.
    _register_asset(stores["assets"], asset_a, collection, owner_a)
    _register_asset(stores["assets"], asset_b, collection, escrow)

    marketplace_service.create_listing(
        stores["marketplace"],
        asset_address=asset_b,
        seller_address=owner_b,
        price_lamports=2_000_000_000,
        now=10,
        collection_address=collection,
    )

    stats = catalog_service.collection_stats(
        stores["assets"], stores["marketplace"], collection
    )
    # The escrow PDA is never counted; the beneficial seller B is.
    assert stats["owners"] == 2
    assert stats["listed_count"] == 1
    assert stats["supply"] == 2


def test_owner_count_uses_buyer_after_sale(stores):
    collection = b58_address(2000)
    seller = b58_address(2001)
    buyer = b58_address(2002)
    asset = b58_address(2003)

    # Sold asset: the indexer has moved stored ownership to the buyer already.
    _register_asset(stores["assets"], asset, collection, buyer)
    listing = marketplace_service.create_listing(
        stores["marketplace"],
        asset_address=asset,
        seller_address=seller,
        price_lamports=1_000_000_000,
        now=10,
        collection_address=collection,
    )
    marketplace_service.record_sale(
        stores["marketplace"],
        listing["listing_id"],
        buyer_address=buyer,
        price_lamports=1_000_000_000,
        signature="sig-sale",
        now=11,
        asset_store=stores["assets"],
    )

    stats = catalog_service.collection_stats(
        stores["assets"], stores["marketplace"], collection
    )
    assert stats["owners"] == 1


def test_public_visibility_rules():
    deployed = {
        "slug": "dogs",
        "collection_address": b58_address(3000),
    }
    undeployed = {"slug": "zecians", "collection_address": None}
    legacy = {
        "slug": "zecians-devnet-test",
        "collection_address": b58_address(3001),
    }
    explicit_hidden = {
        "slug": "hidden",
        "collection_address": b58_address(3002),
        "public_visible": False,
    }
    explicit_visible = {
        "slug": "legacy-but-allowed",
        "collection_address": None,
        "public_visible": True,
    }

    assert reg.is_publicly_visible(deployed) is True
    assert reg.is_publicly_visible(undeployed) is False
    assert reg.is_publicly_visible(legacy) is False
    assert reg.is_publicly_visible(explicit_hidden) is False
    assert reg.is_publicly_visible(explicit_visible) is True


def test_activity_labels_are_owned_by_backend():
    assert catalog_service.activity_label("list") == "Listed"
    assert catalog_service.activity_label("sale") == "Sold"
    assert catalog_service.activity_label("cancel") == "Cancelled"
    assert catalog_service.activity_label("transfer") == "Transferred"


def test_activity_label_handles_unknown_and_missing_types():
    assert catalog_service.activity_label(None) == "Activity"
    assert catalog_service.activity_label("observed_signature") == "Observed Signature"


def test_activity_view_adds_label_without_mutating_input():
    event = {"signature": "sig-1", "type": "sale", "lamports": 1_000_000}
    view = catalog_service.activity_view(event)
    assert view["label"] == "Sold"
    assert view["signature"] == "sig-1"
    # The stored record is untouched — labels are presentation only.
    assert "label" not in event


def test_collection_view_exposes_owners_and_public_visible(stores):
    collection = b58_address(4000)
    owner = b58_address(4001)
    asset = b58_address(4002)
    _register_asset(stores["assets"], asset, collection, owner)

    record = {
        "slug": "dogs",
        "name": "Dogs",
        "collection_address": collection,
        "verification_status": m.VERIFICATION_UNVERIFIED,
    }
    view = catalog_service.collection_view(
        record, stores["assets"], stores["marketplace"]
    )
    assert view["owners"] == 1
    assert view["public_visible"] is True
    assert view["stats"]["owners"] == 1
