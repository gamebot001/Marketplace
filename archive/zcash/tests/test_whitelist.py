"""Whitelist/eligibility store + address rules. Infrastructure only."""

import pytest

from backend.services.whitelist import allowlist_store, address_rules

VALID = "u1" + "a" * 30
VALID2 = "zs1" + "b" * 30


def test_ensure_initialized_creates_empty_entries_and_closed_phase(store):
    allowlist_store.ensure_initialized(store)
    assert allowlist_store.list_entries(store) == []
    assert allowlist_store.get_phase(store)["current"] == "closed"


def test_add_entry_stores_and_normalizes(store):
    allowlist_store.ensure_initialized(store)
    entry = allowlist_store.add_entry(
        store, "  U1" + "A" * 30 + "  ", notes="n", mint_limit=2, now=100
    )
    assert entry["address"] == ("u1" + "a" * 30)
    assert entry["status"] == "approved"
    assert entry["mint_limit"] == 2
    assert entry["mints_used"] == 0
    assert allowlist_store.get_entry(store, "u1" + "a" * 30)["notes"] == "n"


def test_add_entry_rejects_empty_address(store):
    allowlist_store.ensure_initialized(store)
    with pytest.raises(ValueError):
        allowlist_store.add_entry(store, "   ")


def test_address_rules_rejects_non_shielded():
    assert address_rules.is_shielded_address(VALID)
    assert address_rules.is_shielded_address(VALID2)
    assert not address_rules.is_shielded_address("t1transparentaddress0000000000")
    assert not address_rules.is_shielded_address("u1short")
    assert not address_rules.is_shielded_address("")


def test_remove_entry(store):
    allowlist_store.ensure_initialized(store)
    allowlist_store.add_entry(store, VALID, now=1)
    assert allowlist_store.remove_entry(store, VALID, now=2) is True
    assert allowlist_store.remove_entry(store, VALID, now=3) is False
    assert allowlist_store.get_entry(store, VALID) is None


def test_set_phase_validates_values(store):
    allowlist_store.ensure_initialized(store)
    assert allowlist_store.set_phase(store, "open", now=10)["current"] == "open"
    assert allowlist_store.set_phase(store, "paused", now=11)["current"] == "paused"
    assert allowlist_store.set_phase(store, "closed", now=12)["current"] == "closed"
    with pytest.raises(ValueError):
        allowlist_store.set_phase(store, "bogus")


def test_get_entry_missing_returns_none(store):
    allowlist_store.ensure_initialized(store)
    assert allowlist_store.get_entry(store, VALID) is None


def test_increment_mints_used_updates_entry(store):
    allowlist_store.ensure_initialized(store)
    allowlist_store.add_entry(store, VALID, now=1)
    assert allowlist_store.increment_mints_used(store, VALID)["mints_used"] == 1
    assert allowlist_store.increment_mints_used(store, VALID)["mints_used"] == 2
    with pytest.raises(KeyError):
        allowlist_store.increment_mints_used(store, "u1" + "c" * 30)
