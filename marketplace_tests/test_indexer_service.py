"""IndexerService: idempotent ingestion, no fabricated activity."""

import pytest

from marketplace_backend.services.json_file_store import JsonFileStore
from marketplace_backend.services.solana.indexer_service import IndexerError, IndexerService
from marketplace_tests.conftest import b58_address

NOW = 1_700_000_000


@pytest.fixture
def indexer(tmp_path):
    service = IndexerService(JsonFileStore(tmp_path / "indexer.json"))
    service.ensure_state()
    return service


def test_starts_empty(indexer):
    assert indexer.activity() == []
    assert indexer.cursor()["last_slot"] == 0


def test_ingest_is_idempotent_by_signature(indexer):
    events = [
        {"signature": "sig_1", "slot": 10, "type": "sale", "now": NOW,
         "asset_address": b58_address(10), "lamports": 1_000},
        {"signature": "sig_2", "slot": 11, "type": "transfer", "now": NOW + 1},
    ]
    first = indexer.ingest(events)
    assert first == {"applied": 2, "skipped": 0, "signatures": ["sig_1", "sig_2"]}
    second = indexer.ingest(events)
    assert second["applied"] == 0 and second["skipped"] == 2
    assert len(indexer.activity()) == 2
    assert indexer.cursor()["last_slot"] == 11


def test_event_requires_signature(indexer):
    with pytest.raises(IndexerError):
        indexer.ingest([{"slot": 1, "type": "sale"}])


def test_fetch_from_chain_records_observed_signatures(indexer):
    class FakeChain:
        def get_signatures_for_address(self, address, limit=25):
            return [
                {"signature": "chain_sig_a", "slot": 100, "blockTime": NOW},
                {"signature": "chain_sig_b", "slot": 101, "blockTime": NOW + 1},
            ]

    service = IndexerService(indexer.store, chain_service=FakeChain())
    summary = service.fetch_from_chain(b58_address(1))
    assert summary["applied"] == 2
    assert {e["type"] for e in service.activity()} == {"observed_signature"}
