"""Attested demo issuance bridge (backend/services/minting/issuance_bridge.py).

No signing, no network, no real txid. These tests exercise the recorded
state transitions and their idempotency.
"""

import re

import pytest

from blockchain.asset_identity import asset_desc_hash
from backend.services.json_file_store import JsonFileStore
from backend.services.minting import issuance_bridge, mint_service

PREFIX = "zsc1"
COLLECTION = "zecians-genesis"
NFT = 5
NOW = 1000


@pytest.fixture
def mint_store(tmp_path):
    return JsonFileStore(tmp_path / "mint_requests.json")


def _queued_mint(store, idem="idem-1"):
    mint = mint_service.create_mint_request(
        store, NFT, "buyer", "pay_1", idem, NOW
    )
    return mint_service.record_payment_confirmed(store, mint["mint_id"], NOW)


def _events(store, name):
    return [e for e in store.get("events", []) if e["event"] == name]


def test_build_issuance_payload_asset_desc():
    payload = issuance_bridge.build_issuance_payload(NFT, PREFIX, COLLECTION)
    assert payload["asset_desc"] == "zsc1|zecians-genesis|005"


def test_build_issuance_payload_hash_matches_zip227():
    payload = issuance_bridge.build_issuance_payload(NFT, PREFIX, COLLECTION)
    assert payload["asset_desc_hash"] == asset_desc_hash(payload["asset_desc"])
    assert payload["value"] == 1
    assert payload["finalize"] is True
    assert payload["note"] == "attested_demo_issuance"


def test_make_attested_txid_prefix_and_not_64_hex():
    txid = issuance_bridge.make_attested_txid("mint_abc123")
    assert txid.startswith("attested:demo:")
    assert txid.startswith("attested:demo:mint_abc123:")
    assert not re.fullmatch(r"[0-9a-f]{64}", txid)
    assert len(txid) != 64


def test_advance_queued_to_submitted_to_issued(mint_store):
    mint = _queued_mint(mint_store)
    assert mint["state"] == mint_service.STATE_QUEUED_FOR_ISSUANCE

    record = issuance_bridge.advance_to_issued(
        mint_store, mint["mint_id"], NFT, PREFIX, COLLECTION, NOW
    )
    assert record["state"] == mint_service.STATE_ISSUED
    assert record["issuance_txid"].startswith("attested:demo:")
    assert record["issuance_height"] == 0
    assert record["issuance_network"] == "demo"
    assert len(_events(mint_store, "mint_issuance_submitted")) == 1
    assert len(_events(mint_store, "mint_issued")) == 1


def test_advance_submitted_without_resubmitting(mint_store):
    mint = _queued_mint(mint_store)
    payload = issuance_bridge.build_issuance_payload(NFT, PREFIX, COLLECTION)
    mint_service.mark_issuance_submitted(mint_store, mint["mint_id"], payload, NOW)
    assert len(_events(mint_store, "mint_issuance_submitted")) == 1

    record = issuance_bridge.advance_to_issued(
        mint_store, mint["mint_id"], NFT, PREFIX, COLLECTION, NOW
    )
    assert record["state"] == mint_service.STATE_ISSUED
    # mark_issuance_submitted must not have been called a second time
    assert len(_events(mint_store, "mint_issuance_submitted")) == 1
    assert len(_events(mint_store, "mint_issued")) == 1


def test_advance_issued_returns_existing_unchanged(mint_store):
    mint = _queued_mint(mint_store)
    first = issuance_bridge.advance_to_issued(
        mint_store, mint["mint_id"], NFT, PREFIX, COLLECTION, NOW
    )
    second = issuance_bridge.advance_to_issued(
        mint_store, mint["mint_id"], NFT, PREFIX, COLLECTION, NOW + 10
    )
    assert second == first
    assert second["issuance_txid"] == first["issuance_txid"]
    assert len(_events(mint_store, "mint_issued")) == 1


def test_advance_invalid_pre_state_raises(mint_store):
    mint = mint_service.create_mint_request(
        mint_store, NFT, "buyer", "pay_1", "idem-x", NOW
    )
    assert mint["state"] == mint_service.STATE_AWAITING_PAYMENT
    with pytest.raises(issuance_bridge.IssuanceBridgeError):
        issuance_bridge.advance_to_issued(
            mint_store, mint["mint_id"], NFT, PREFIX, COLLECTION, NOW
        )


def test_advance_unknown_mint_raises(mint_store):
    with pytest.raises(issuance_bridge.IssuanceBridgeError):
        issuance_bridge.advance_to_issued(
            mint_store, "mint_missing", NFT, PREFIX, COLLECTION, NOW
        )


def test_repeated_calls_do_not_duplicate_issuance_state(mint_store):
    mint = _queued_mint(mint_store)
    for _ in range(4):
        issuance_bridge.advance_to_issued(
            mint_store, mint["mint_id"], NFT, PREFIX, COLLECTION, NOW
        )
    final = mint_service.get_mint(mint_store, mint["mint_id"])
    assert final["state"] == mint_service.STATE_ISSUED
    assert len(_events(mint_store, "mint_issuance_submitted")) == 1
    assert len(_events(mint_store, "mint_issued")) == 1
