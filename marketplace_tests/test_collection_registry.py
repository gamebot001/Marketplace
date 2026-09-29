"""Collection registry: projects, collections, verification statuses."""

import pytest

from marketplace_backend.services.json_file_store import JsonFileStore
from marketplace_backend.services.solana import collection_registry as reg
from marketplace_backend.services.solana import models as m
from marketplace_tests.conftest import b58_address

NOW = 1_700_000_000


@pytest.fixture
def registry(tmp_path):
    return JsonFileStore(tmp_path / "registry.json")


def test_register_project_and_collection(registry):
    reg.register_project(registry, "Project A", "project-a", creator_address=b58_address(1), now=NOW)
    collection = reg.register_collection(
        registry, "Project A Genesis", "project-a-genesis", "project-a",
        collection_address=b58_address(100), creator_address=b58_address(1),
        standard=m.STANDARD_METAPLEX_CORE, royalty_bps=500, now=NOW,
    )
    assert collection["verification_status"] == m.VERIFICATION_PENDING
    assert collection["chain_deployed"] is True
    assert reg.get_collection(registry, "project-a-genesis")["slug"] == "project-a-genesis"


def test_verification_status_transitions(registry):
    reg.register_project(registry, "B", "b", now=NOW)
    reg.register_collection(registry, "B", "b-col", "b", collection_address=b58_address(101), now=NOW)
    reg.set_verification_status(registry, "b-col", m.VERIFICATION_VERIFIED)
    assert reg.get_collection(registry, "b-col")["verification_status"] == m.VERIFICATION_VERIFIED
    reg.set_verification_status(registry, "b-col", m.VERIFICATION_SUSPENDED)
    assert reg.get_collection(registry, "b-col")["verification_status"] == m.VERIFICATION_SUSPENDED
    with pytest.raises(reg.RegistryError):
        reg.set_verification_status(registry, "b-col", "bogus")


def test_invalid_inputs_are_rejected(registry):
    with pytest.raises(reg.RegistryError):
        reg.register_project(registry, "bad", "!!!", now=NOW)
    reg.register_project(registry, "C", "c", now=NOW)
    with pytest.raises(reg.RegistryError):
        reg.register_collection(registry, "C", "c-col", "c", creator_address="not-an-address", now=NOW)
    with pytest.raises(reg.RegistryError):
        reg.register_collection(registry, "C", "c-col", "c", standard="unknown-standard", now=NOW)


def test_seed_flagship_is_real_and_undeployed(registry):
    flagship = reg.seed_flagship_collection(registry, now=NOW)
    assert flagship["slug"] == "zecians"
    assert flagship["flagship"] is True
    # No Solana address is invented before deployment.
    assert flagship["collection_address"] is None
    assert flagship["chain_deployed"] is False
    assert flagship["verification_status"] == m.VERIFICATION_VERIFIED
    assert flagship["standard"] == m.STANDARD_METAPLEX_CORE
    # Idempotent: only one collection, no fakes.
    reg.seed_flagship_collection(registry, now=NOW + 1)
    assert len(reg.list_collections(registry)) == 1
