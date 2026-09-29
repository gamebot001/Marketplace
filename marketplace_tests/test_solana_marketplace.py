"""Generic NFT asset model + marketplace settlement + treasury + accounting."""

import pytest

from marketplace_backend.services.json_file_store import JsonFileStore
from marketplace_backend.services.solana import accounting
from marketplace_backend.services.solana import marketplace_service as mkt
from marketplace_backend.services.solana import models as m
from marketplace_backend.services.solana import nft_asset_service as assets
from marketplace_backend.services.solana import treasury_service
from marketplace_tests.conftest import b58_address

NOW = 1_700_000_000


@pytest.fixture
def asset_store(tmp_path):
    return JsonFileStore(tmp_path / "assets.json")


@pytest.fixture
def market_store(tmp_path):
    return JsonFileStore(tmp_path / "marketplace.json")


@pytest.fixture
def treasury_store(tmp_path):
    return JsonFileStore(tmp_path / "treasury.json")


@pytest.fixture
def accounting_store(tmp_path):
    return JsonFileStore(tmp_path / "accounting.json")


def _register(asset_store, asset, collection, owner, creator, royalty_bps=500, now=NOW):
    return assets.register_asset(
        asset_store,
        {
            "asset_address": asset,
            "collection_address": collection,
            "owner_address": owner,
            "standard": m.STANDARD_METAPLEX_CORE,
            "metadata_uri": "ipfs://example/%s" % asset,
            "creator_address": creator,
            "royalty_bps": royalty_bps,
            "verified_collection": True,
        },
        now=now,
    )


def test_register_and_query_assets(asset_store):
    collection = b58_address(100)
    owner = b58_address(1)
    creator = b58_address(2)
    a1 = b58_address(10)
    a2 = b58_address(11)
    _register(asset_store, a1, collection, owner, creator)
    _register(asset_store, a2, collection, b58_address(3), creator)

    assert assets.get_asset(asset_store, a1)["owner_address"] == owner
    assert len(assets.list_assets(asset_store, collection_address=collection)) == 2
    assert len(assets.list_assets(asset_store, owner_address=owner)) == 1
    assert assets.is_owned_by(asset_store, a1, owner)
    assert not assets.is_owned_by(asset_store, a1, b58_address(3))


def test_unknown_standard_is_rejected(asset_store):
    with pytest.raises(assets.UnknownStandard):
        assets.register_asset(
            asset_store,
            {
                "asset_address": b58_address(10),
                "collection_address": b58_address(100),
                "owner_address": b58_address(1),
                "standard": "some-future-standard",
                "metadata_uri": "ipfs://x",
            },
            now=NOW,
        )


def test_asset_adapter_is_swappable(asset_store):
    """A second standard can be registered without touching marketplace logic."""
    from marketplace_backend.services.solana.nft_asset_service import AssetAdapter

    class FakeAdapter(AssetAdapter):
        standard = "fake-standard"

        def normalize(self, raw):
            return {
                "asset_address": raw["asset_address"],
                "collection_address": raw["collection_address"],
                "owner_address": raw["owner_address"],
                "standard": self.standard,
                "metadata_uri": raw["metadata_uri"],
                "creator_address": None,
                "royalty_bps": 0,
                "verified_collection": False,
            }

    assets.register_adapter(FakeAdapter())
    assert m.STANDARD_METAPLEX_CORE in m.SUPPORTED_STANDARDS  # core untouched


def test_create_listing_requires_ownership(asset_store, market_store):
    collection = b58_address(100)
    owner = b58_address(1)
    asset = b58_address(10)
    _register(asset_store, asset, collection, owner, b58_address(2))

    with pytest.raises(assets.NotOwner):
        mkt.create_listing(
            market_store, asset, b58_address(9), 1_000_000, now=NOW, asset_store=asset_store
        )

    listing = mkt.create_listing(
        market_store, asset, owner, 1_000_000, now=NOW, asset_store=asset_store
    )
    assert listing["status"] == m.LISTING_ACTIVE
    assert listing["collection_address"] == collection
    assert listing["price_lamports"] == 1_000_000


def test_one_live_listing_per_asset(asset_store, market_store):
    collection = b58_address(100)
    owner = b58_address(1)
    asset = b58_address(10)
    _register(asset_store, asset, collection, owner, b58_address(2))
    mkt.create_listing(market_store, asset, owner, 1_000_000, now=NOW, asset_store=asset_store)
    with pytest.raises(mkt.ListingNotAvailable):
        mkt.create_listing(market_store, asset, owner, 2_000_000, now=NOW + 1, asset_store=asset_store)


def test_record_sale_settles_fee_royalty_ownership_and_accounting(
    asset_store, market_store, treasury_store, accounting_store
):
    collection = b58_address(100)
    seller = b58_address(1)
    creator = b58_address(2)
    buyer = b58_address(3)
    asset = b58_address(10)
    _register(asset_store, asset, collection, seller, creator, royalty_bps=500)

    listing = mkt.create_listing(
        market_store, asset, seller, 1_000_000_000, now=NOW, asset_store=asset_store
    )
    sale = mkt.record_sale(
        market_store, listing["listing_id"], buyer, 1_000_000_000, signature="sig_real_1",
        now=NOW + 10, fee_bps=250, asset_store=asset_store,
        treasury_store=treasury_store, accounting_store=accounting_store,
    )

    assert sale["fee_lamports"] == 25_000_000
    assert sale["royalty_lamports"] == 50_000_000
    assert sale["seller_proceeds_lamports"] == 925_000_000
    assert (
        sale["fee_lamports"] + sale["royalty_lamports"] + sale["seller_proceeds_lamports"]
        == sale["price_lamports"]
    )
    assert mkt.get_listing(market_store, listing["listing_id"])["status"] == m.LISTING_SOLD
    # ownership transferred from the observed sale
    assert assets.get_asset(asset_store, asset)["owner_address"] == buyer
    # marketplace fee landed in the treasury, idempotently
    summary = treasury_service.summary(treasury_store)
    assert summary["total_lamports"] == 25_000_000
    assert summary["by_kind"][m.TREASURY_MARKETPLACE_FEE] == 25_000_000
    # neutral participation accounting only; promises nothing
    kinds = accounting.participation_summary(accounting_store)["by_kind"]
    assert kinds[m.PARTICIPATION_MARKETPLACE_BUY] == 1_000_000_000
    assert kinds[m.PARTICIPATION_MARKETPLACE_SELL] == 1_000_000_000


def test_sale_replay_is_idempotent(asset_store, market_store, treasury_store):
    collection = b58_address(100)
    seller = b58_address(1)
    asset = b58_address(10)
    _register(asset_store, asset, collection, seller, b58_address(2))
    listing = mkt.create_listing(
        market_store, asset, seller, 2_000_000, now=NOW, asset_store=asset_store
    )
    first = mkt.record_sale(
        market_store, listing["listing_id"], b58_address(3), 2_000_000,
        signature="sig_replay", now=NOW + 1, fee_bps=250,
        asset_store=asset_store, treasury_store=treasury_store,
    )
    second = mkt.record_sale(
        market_store, listing["listing_id"], b58_address(3), 2_000_000,
        signature="sig_replay", now=NOW + 2, fee_bps=250,
        asset_store=asset_store, treasury_store=treasury_store,
    )
    assert first["sale_id"] == second["sale_id"]
    assert len(mkt.list_sales(market_store)) == 1
    assert treasury_service.summary(treasury_store)["event_count"] == 1


def test_cannot_buy_own_listing(asset_store, market_store):
    collection = b58_address(100)
    seller = b58_address(1)
    asset = b58_address(10)
    _register(asset_store, asset, collection, seller, b58_address(2))
    listing = mkt.create_listing(
        market_store, asset, seller, 1_000_000, now=NOW, asset_store=asset_store
    )
    with pytest.raises(mkt.MarketplaceError):
        mkt.record_sale(
            market_store, listing["listing_id"], seller, 1_000_000,
            signature="sig_self", now=NOW + 1, asset_store=asset_store,
        )


def test_sale_requires_real_signature(asset_store, market_store):
    collection = b58_address(100)
    seller = b58_address(1)
    asset = b58_address(10)
    _register(asset_store, asset, collection, seller, b58_address(2))
    listing = mkt.create_listing(
        market_store, asset, seller, 1_000_000, now=NOW, asset_store=asset_store
    )
    with pytest.raises(mkt.MarketplaceError):
        mkt.record_sale(
            market_store, listing["listing_id"], b58_address(3), 1_000_000,
            signature="", now=NOW + 1, asset_store=asset_store,
        )


def test_price_mismatch_is_rejected(asset_store, market_store):
    collection = b58_address(100)
    seller = b58_address(1)
    asset = b58_address(10)
    _register(asset_store, asset, collection, seller, b58_address(2))
    listing = mkt.create_listing(
        market_store, asset, seller, 1_000_000, now=NOW, asset_store=asset_store
    )
    with pytest.raises(mkt.MarketplaceError):
        mkt.record_sale(
            market_store, listing["listing_id"], b58_address(3), 999,
            signature="sig_price", now=NOW + 1, asset_store=asset_store,
        )


def test_cancel_only_by_seller(asset_store, market_store):
    collection = b58_address(100)
    seller = b58_address(1)
    asset = b58_address(10)
    _register(asset_store, asset, collection, seller, b58_address(2))
    listing = mkt.create_listing(
        market_store, asset, seller, 1_000_000, now=NOW, asset_store=asset_store
    )
    with pytest.raises(mkt.NotAuthorized):
        mkt.cancel_listing(market_store, listing["listing_id"], b58_address(9), now=NOW + 1)
    mkt.cancel_listing(market_store, listing["listing_id"], seller, now=NOW + 2)
    with pytest.raises(mkt.MarketplaceError):
        mkt.cancel_listing(market_store, listing["listing_id"], seller, now=NOW + 3)
