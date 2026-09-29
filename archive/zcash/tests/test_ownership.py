"""Ownership indexing: dedup, replay protection, privacy knowledge limits."""

import pytest

from backend.services.json_file_store import JsonFileStore
from backend.services.ownership import ownership_state, transfer_processor
from backend.services.ownership.ownership_indexer import OwnershipIndexer


def _issuance(nft_number, to_ref):
    return {"type": "issuance", "nft_number": nft_number, "to_ref": to_ref,
            "txid": "tx_issue_%d" % nft_number, "action_index": 0, "height": 100}


def test_initial_state_is_project_custody():
    state = ownership_state.create_initial_state([1, 2, 3])
    assert state["assets"]["2"]["custody"] == "project"
    assert state["assets"]["2"]["known_holder"] == "project"


def test_issuance_makes_holder_known():
    state = ownership_state.create_initial_state([1])
    ownership_state.apply_event(state, _issuance(1, "buyer_a"))
    assert state["assets"]["1"]["custody"] == "transparent_holder"
    assert state["assets"]["1"]["known_holder"] == "buyer_a"


def test_shielded_transfer_hides_holder():
    state = ownership_state.create_initial_state([1])
    ownership_state.apply_event(state, _issuance(1, "buyer_a"))
    ownership_state.apply_event(state, {
        "type": "transfer", "nft_number": 1, "from_ref": "buyer_a", "to_ref": None,
        "visibility": "shielded", "txid": "tx_s1", "action_index": 0, "height": 200,
    })
    asset = state["assets"]["1"]
    assert asset["custody"] == "shielded"
    assert asset["known_holder"] is None


def test_public_view_never_exposes_shielded_holder():
    state = ownership_state.create_initial_state([1])
    ownership_state.apply_event(state, _issuance(1, "buyer_a"))
    ownership_state.apply_event(state, {
        "type": "transfer", "nft_number": 1, "from_ref": "buyer_a", "to_ref": None,
        "visibility": "shielded", "txid": "tx_s2", "action_index": 0, "height": 201,
    })
    view = {v["nft_number"]: v for v in ownership_state.public_view(state)}[1]
    assert view["holder_visible"] is False
    assert view["custody"] == "shielded"


def test_unknown_visibility_marks_unknown():
    state = ownership_state.create_initial_state([1])
    ownership_state.apply_event(state, _issuance(1, "buyer_a"))
    ownership_state.apply_event(state, {
        "type": "transfer", "nft_number": 1, "from_ref": "buyer_a", "to_ref": None,
        "visibility": "unknown", "txid": "tx_u1", "action_index": 0, "height": 202,
    })
    assert state["assets"]["1"]["custody"] == "unknown"


def test_from_mismatch_recorded_not_crashed():
    state = ownership_state.create_initial_state([1])
    ownership_state.apply_event(state, _issuance(1, "buyer_a"))
    ownership_state.apply_event(state, {
        "type": "transfer", "nft_number": 1, "from_ref": "someone_else", "to_ref": None,
        "visibility": "shielded", "txid": "tx_m1", "action_index": 0, "height": 203,
    })
    assert state["assets"]["1"]["notes"][0]["kind"] == "from_mismatch"


def test_normalize_orders_and_dedupes():
    events = [
        {"type": "transfer", "nft_number": 1, "from_ref": "a", "to_ref": "b", "visibility": "transparent",
         "txid": "z_tx", "action_index": 0, "height": 10},
        {"type": "transfer", "nft_number": 2, "from_ref": "a", "to_ref": "c", "visibility": "transparent",
         "txid": "a_tx", "action_index": 1, "height": 20},
        {"type": "transfer", "nft_number": 1, "from_ref": "a", "to_ref": "b", "visibility": "transparent",
         "txid": "z_tx", "action_index": 0, "height": 10},  # duplicate
    ]
    stream = transfer_processor.normalize(events)
    assert [e["txid"] for e in stream["events"]] == ["z_tx", "a_tx"]
    assert stream["conflicts"] == []


def test_conflicting_duplicate_is_flagged():
    events = [
        {"type": "transfer", "nft_number": 1, "from_ref": "a", "to_ref": "b", "visibility": "transparent",
         "txid": "tx", "action_index": 0, "height": 10},
        {"type": "transfer", "nft_number": 9, "from_ref": "a", "to_ref": "c", "visibility": "transparent",
         "txid": "tx", "action_index": 0, "height": 10},
    ]
    stream = transfer_processor.normalize(events)
    assert len(stream["conflicts"]) == 1
    assert len(stream["events"]) == 1


def test_indexer_is_idempotent_across_ingests(tmp_path):
    store = JsonFileStore(tmp_path / "ownership.json")
    indexer = OwnershipIndexer(store)
    indexer.ensure_state([1, 2])

    batch = [
        _issuance(1, "buyer_a"),
        {"type": "transfer", "nft_number": 1, "from_ref": "buyer_a", "to_ref": "buyer_b",
         "visibility": "transparent", "txid": "tx_1", "action_index": 0, "height": 150},
    ]
    first = indexer.ingest(batch)
    assert first["applied"] == 2

    state = indexer.state()
    assert state["assets"]["1"]["known_holder"] == "buyer_b"

    # replay the same batch: nothing changes
    second = indexer.ingest(batch)
    assert second["applied"] == 0
    assert second["skipped"] == 2
    assert indexer.state()["assets"]["1"]["known_holder"] == "buyer_b"


def test_state_hash_is_deterministic():
    state = ownership_state.create_initial_state([1, 2])
    hash1 = ownership_state.state_hash(state)
    state2 = ownership_state.create_initial_state([2, 1])  # different order
    assert hash1 == ownership_state.state_hash(state2)
