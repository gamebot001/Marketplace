"""Solana API smoke tests: collection-agnostic, no fabricated data."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from marketplace_backend.app import main as app_main
from marketplace_backend.app.settings import Settings

ROOT = Path(__file__).resolve().parent.parent


def _build_client(tmp_path, monkeypatch, network="solana-devnet"):
    # Isolate from any developer .env: explicit empty chain values keep these
    # tests deterministic regardless of local Phase 1 configuration.
    settings = Settings(
        network=network,
        env="test",
        data_dir=tmp_path,
        treasury_address="",
        marketplace_program_id="",
        solana_rpc_url="",
    )
    monkeypatch.setattr(app_main, "get_settings", lambda: settings)
    app_main._STORES.clear()
    return TestClient(app_main.app)


@pytest.fixture
def client(tmp_path, monkeypatch):
    with _build_client(tmp_path, monkeypatch) as test_client:
        yield test_client


def test_health_is_solana_native(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["chain"] == "solana"
    assert body["network"] == "solana-devnet"
    assert body["nft_standard"] == "metaplex-core"
    assert body["treasury_configured"] is False


def test_config_shape_and_phase1_defaults(client):
    body = client.get("/api/config").json()
    assert body["chain"] == "solana"
    assert body["nft_standard"] == "metaplex-core"
    assert body["mint_enabled"] is False
    # Phase 1 enables the escrow marketplace on Devnet with a 2.5% fee.
    assert body["marketplace_enabled"] is True
    assert set(body["fees"].keys()) == {
        "marketplace_fee_bps", "royalty_bps_default", "currency"
    }
    assert body["fees"]["marketplace_fee_bps"] == 250
    assert body["fees"]["royalty_bps_default"] == 0


def test_public_directory_excludes_undeployed_flagship(client):
    """The undeployed Zecians placeholder is not part of the public directory."""
    body = client.get("/api/collections").json()
    assert body["collections"] == []


def test_collection_detail_still_reachable_by_direct_id(client):
    """Direct routes keep working for collections hidden from the directory."""
    body = client.get("/api/collections/zecians").json()
    assert body["collection"]["slug"] == "zecians"
    assert body["collection"]["public_visible"] is False
    assert body["asset_count"] == 0
    assert client.get("/api/collections/does-not-exist").status_code == 404


def test_unknown_asset_is_404(client):
    assert client.get("/api/nft/does-not-exist").status_code == 404


def test_listings_empty_by_default(client):
    body = client.get("/api/marketplace/listings").json()
    assert body["listings"] == []
    assert client.get("/api/marketplace/listings/none").status_code == 404


def test_activity_empty_by_default(client):
    assert client.get("/api/activity").json() == {"events": []}


def test_treasury_empty_and_honest(client):
    body = client.get("/api/treasury").json()
    assert body["treasury_address"] is None
    assert body["summary"] == {"total_lamports": 0, "event_count": 0, "by_kind": {}}
    assert body["events"] == []


def test_settings_refuse_mainnet():
    with pytest.raises(RuntimeError):
        Settings(network="solana-mainnet-beta").assert_not_mainnet()
