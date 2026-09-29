"""Marketplace: list / buy / cancel / escrow transitions / double-guards."""

import pytest

from backend.services.json_file_store import JsonFileStore
from backend.services.marketplace import listing_service, sale_service


@pytest.fixture
def mkt_store(tmp_path):
    return JsonFileStore(tmp_path / "marketplace.json")


@pytest.fixture
def own_store(tmp_path):
    return JsonFileStore(tmp_path / "ownership.json")


def _ownership(store, nft_number, holder):
    from backend.services.ownership import ownership_state
    state = ownership_state.create_initial_state([nft_number])
    ownership_state.apply_event(state, {
        "type": "issuance", "nft_number": nft_number, "to_ref": holder,
        "txid": "issuance_tx", "action_index": 0, "height": 100,
    })
    store.put("ownership", state)


def test_create_listing_requires_control(mkt_store, own_store):
    _ownership(own_store, 3, "buyer_a")
    with pytest.raises(listing_service.NotAuthorized):
        listing_service.create_listing(mkt_store, 3, "seller_b", 2_000_000, now=1000, ownership_store=own_store)
    listing = listing_service.create_listing(mkt_store, 3, "buyer_a", 2_000_000, now=1000, ownership_store=own_store)
    assert listing["status"] == "active"


def test_only_one_live_listing_per_nft(mkt_store):
    listing_service.create_listing(mkt_store, 4, "seller", 1_000_000, now=1000)
    with pytest.raises(listing_service.ListingNotAvailable):
        listing_service.create_listing(mkt_store, 4, "seller", 1_000_000, now=1001)


def test_full_sale_lifecycle(mkt_store):
    listing = listing_service.create_listing(mkt_store, 5, "seller", 3_000_000, now=1000)
    sale = sale_service.start_sale(mkt_store, listing["listing_id"], "buyer", "pay_x", now=1010)
    assert sale["state"] == sale_service.STATE_PAYMENT_PENDING
    assert listing_service.get_listing(mkt_store, listing["listing_id"])["status"] == "payment_pending"

    sale_service.record_payment_confirmed(mkt_store, sale["sale_id"], "confirmed", now=1100)
    sale_service.initiate_transfer(mkt_store, sale["sale_id"], "payloadhash", now=1200)
    sale_service.confirm_transfer(mkt_store, sale["sale_id"], "transfer_tx_1", now=1300)
    sale_service.complete_sale(mkt_store, sale["sale_id"], now=1400)

    assert sale_service.get_sale(mkt_store, sale["sale_id"])["state"] == sale_service.STATE_COMPLETED
    assert listing_service.get_listing(mkt_store, listing["listing_id"])["status"] == "sold"


def test_double_sale_is_blocked(mkt_store):
    listing = listing_service.create_listing(mkt_store, 6, "seller", 1_000_000, now=1000)
    sale_service.start_sale(mkt_store, listing["listing_id"], "buyer1", "pay_1", now=1010)
    with pytest.raises(listing_service.ListingNotAvailable):
        sale_service.start_sale(mkt_store, listing["listing_id"], "buyer2", "pay_2", now=1020)


def test_cannot_buy_own_listing(mkt_store):
    listing = listing_service.create_listing(mkt_store, 7, "seller", 1_000_000, now=1000)
    with pytest.raises(sale_service.SaleError):
        sale_service.start_sale(mkt_store, listing["listing_id"], "seller", "pay_1", now=1010)


def test_fake_confirmation_is_rejected(mkt_store):
    listing = listing_service.create_listing(mkt_store, 8, "seller", 1_000_000, now=1000)
    sale = sale_service.start_sale(mkt_store, listing["listing_id"], "buyer", "pay_1", now=1010)
    with pytest.raises(sale_service.SaleError):
        sale_service.record_payment_confirmed(mkt_store, sale["sale_id"], "frontend_says_so", now=1020)


def test_double_asset_assignment_is_blocked(mkt_store):
    listing = listing_service.create_listing(mkt_store, 9, "seller", 1_000_000, now=1000)
    sale = sale_service.start_sale(mkt_store, listing["listing_id"], "buyer", "pay_1", now=1010)
    sale_service.record_payment_confirmed(mkt_store, sale["sale_id"], "confirmed", now=1100)
    sale_service.initiate_transfer(mkt_store, sale["sale_id"], "payloadhash", now=1200)
    sale_service.confirm_transfer(mkt_store, sale["sale_id"], "tx_1", now=1300)
    with pytest.raises(sale_service.InvalidTransition):
        sale_service.confirm_transfer(mkt_store, sale["sale_id"], "tx_2", now=1400)


def test_payment_failure_releases_listing(mkt_store):
    listing = listing_service.create_listing(mkt_store, 10, "seller", 1_000_000, now=1000)
    sale = sale_service.start_sale(mkt_store, listing["listing_id"], "buyer", "pay_1", now=1010)
    sale_service.payment_failed(mkt_store, sale["sale_id"], "expired_unpaid", now=1100)
    assert listing_service.get_listing(mkt_store, listing["listing_id"])["status"] == "active"
    # and the released listing can be bought again
    sale2 = sale_service.start_sale(mkt_store, listing["listing_id"], "buyer2", "pay_2", now=1200)
    assert sale2["state"] == sale_service.STATE_PAYMENT_PENDING


def test_cancel_only_by_seller_only_active(mkt_store):
    listing = listing_service.create_listing(mkt_store, 2, "seller", 1_000_000, now=1000)
    with pytest.raises(listing_service.NotAuthorized):
        listing_service.cancel_listing(mkt_store, listing["listing_id"], "attacker", now=1010)
    listing_service.cancel_listing(mkt_store, listing["listing_id"], "seller", now=1020)
    with pytest.raises(listing_service.ListingError):
        listing_service.cancel_listing(mkt_store, listing["listing_id"], "seller", now=1030)


def test_refund_path_on_transfer_failure(mkt_store):
    listing = listing_service.create_listing(mkt_store, 1, "seller", 1_000_000, now=1000)
    sale = sale_service.start_sale(mkt_store, listing["listing_id"], "buyer", "pay_1", now=1010)
    sale_service.record_payment_confirmed(mkt_store, sale["sale_id"], "confirmed", now=1100)
    sale_service.initiate_transfer(mkt_store, sale["sale_id"], "payloadhash", now=1200)
    sale_service.mark_transfer_failed(mkt_store, sale["sale_id"], "wallet_error", now=1300)
    sale_service.confirm_refund(mkt_store, sale["sale_id"], "refund_tx_1", now=1400)
    assert sale_service.get_sale(mkt_store, sale["sale_id"])["state"] == sale_service.STATE_REFUNDED
