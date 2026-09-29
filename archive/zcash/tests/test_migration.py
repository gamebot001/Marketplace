"""Migration: snapshots, eligibility, claims, duplicate protection."""

import pytest

from backend.services.json_file_store import JsonFileStore
from backend.services.migration import claim_service, eligibility_service, migration_state
from backend.services.migration.claim_validator import (
    ClaimConflict,
    InvalidRecipient,
)
from backend.services.ownership import ownership_state


def _ownership_state():
    state = ownership_state.create_initial_state([1, 2, 3])
    ownership_state.apply_event(state, {
        "type": "issuance", "nft_number": 1, "to_ref": "buyer_a",
        "txid": "tx1", "action_index": 0, "height": 100,
    })
    return state


def test_snapshot_is_deterministic():
    snap1 = migration_state.build_snapshot(_ownership_state(), {}, {}, "zecians-genesis", 500)
    snap2 = migration_state.build_snapshot(_ownership_state(), {}, {}, "zecians-genesis", 500)
    assert snap1 == snap2
    assert migration_state.snapshot_hash(snap1) == migration_state.snapshot_hash(snap2)
    assert len(snap1["snapshot_hash"]) == 64


def test_asset_without_escrow_is_eligible():
    snap = migration_state.build_snapshot(_ownership_state(), {}, {}, "zecians-genesis", 500)
    ok, reason = eligibility_service.is_asset_eligible(snap, 1)
    assert ok and reason == "eligible"


def test_asset_in_escrow_is_ineligible():
    listings = {"lst_1": {"listing_id": "lst_1", "nft_number": 1, "seller_ref": "buyer_a",
                          "price_zat": 1, "status": "payment_pending", "created_at": 0, "sale_id": "sale_1"}}
    sales = {"sale_1": {"state": "payment_received"}}
    snap = migration_state.build_snapshot(_ownership_state(), listings, sales, "zecians-genesis", 500)
    ok, reason = eligibility_service.is_asset_eligible(snap, 1)
    assert not ok and "escrow" in reason


def test_already_claimed_asset_is_ineligible(tmp_path):
    claims_store = JsonFileStore(tmp_path / "claims.json")
    claims_store.put("claims", {"clm_x": {
        "claim_id": "clm_x", "nft_number": 1, "state": "approved",
    }})
    snap = migration_state.build_snapshot(_ownership_state(), {}, {}, "zecians-genesis", 500)
    ok, reason = eligibility_service.is_asset_eligible(snap, 1, claims_store=claims_store)
    assert not ok and "claim" in reason


def test_claim_lifecycle_with_correct_claim_code(tmp_path):
    claims_store = JsonFileStore(tmp_path / "claims.json")
    secret = "server_secret_for_tests"
    snap = migration_state.build_snapshot(_ownership_state(), {}, {}, "zecians-genesis", 500)

    claim = claim_service.create_claim(claims_store, secret, 1, "buyer_a", snap["snapshot_hash"], now=1000)
    assert claim["state"] == "challenged"
    assert claim["challenge"]

    claim_code = "ZECIANS-CLAIM-CODE-001"
    claim_service.set_proof_code(claims_store, claim["claim_id"], claim_code)
    claim_service.submit_proof(claims_store, claim["claim_id"], claim_code, now=1100)
    validated = claim_service.validate_claim(
        claims_store, claim["claim_id"],
        eligibility_service.hash_claim_code(claim_code), now=1200,
    )
    assert validated["state"] == "validated"

    claim_service.approve(claims_store, claim["claim_id"], "admin", now=1300)
    again = claim_service.approve(claims_store, claim["claim_id"], "admin", now=1400)  # idempotent
    assert again["state"] == "approved"

    claim_service.set_recipient(claims_store, claim["claim_id"], "u1testrecipientaddress1234567890abcdef")
    assert claim_service.get_claim(claims_store, claim["claim_id"])["recipient_address"].startswith("u1")


def test_wrong_claim_code_is_rejected(tmp_path):
    claims_store = JsonFileStore(tmp_path / "claims.json")
    secret = "server_secret_for_tests"
    snap = migration_state.build_snapshot(_ownership_state(), {}, {}, "zecians-genesis", 500)
    claim = claim_service.create_claim(claims_store, secret, 2, "buyer_b", snap["snapshot_hash"], now=1000)
    code = "right-code"
    claim_service.set_proof_code(claims_store, claim["claim_id"], "wrong-code")
    claim_service.submit_proof(claims_store, claim["claim_id"], code, now=1100)
    result = claim_service.validate_claim(
        claims_store, claim["claim_id"], eligibility_service.hash_claim_code(code), now=1200,
    )
    assert result["state"] == "rejected"


def test_duplicate_claims_are_blocked(tmp_path):
    claims_store = JsonFileStore(tmp_path / "claims.json")
    secret = "server_secret_for_tests"
    snap = migration_state.build_snapshot(_ownership_state(), {}, {}, "zecians-genesis", 500)
    claim_service.create_claim(claims_store, secret, 3, "buyer_c", snap["snapshot_hash"], now=1000)
    with pytest.raises(ClaimConflict):
        claim_service.create_claim(claims_store, secret, 3, "attacker", snap["snapshot_hash"], now=1100)


def test_transparent_recipient_is_refused(tmp_path):
    claims_store = JsonFileStore(tmp_path / "claims.json")
    secret = "server_secret_for_tests"
    snap = migration_state.build_snapshot(_ownership_state(), {}, {}, "zecians-genesis", 500)
    claim = claim_service.create_claim(claims_store, secret, 3, "buyer_c", snap["snapshot_hash"], now=1000)
    claim_service.set_proof_code(claims_store, claim["claim_id"], "code")
    claim_service.submit_proof(claims_store, claim["claim_id"], "code", now=1100)
    claim_service.validate_claim(claims_store, claim["claim_id"], eligibility_service.hash_claim_code("code"), now=1200)
    claim_service.approve(claims_store, claim["claim_id"], "admin", now=1300)
    with pytest.raises(InvalidRecipient):
        claim_service.set_recipient(claims_store, claim["claim_id"], "t1transparentaddressnotallowed")


def test_mainnet_issuance_is_hard_disabled(tmp_path):
    claims_store = JsonFileStore(tmp_path / "claims.json")
    with pytest.raises(claim_service.MainnetNotEnabled):
        claim_service.issue_mainnet(claims_store, "clm_whatever", now=1)


def test_wallet_signature_proof_is_explicitly_unavailable():
    with pytest.raises(eligibility_service.ProofMechanismNotAvailable):
        eligibility_service.validate_wallet_signature({"claim_id": "clm_x"}, "sig")
