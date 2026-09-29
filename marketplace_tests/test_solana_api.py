"""Solana API smoke tests: collection-agnostic, no fabricated data."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from marketplace_backend.app import main as app_main
from marketplace_backend.app.settings import Settings

ROOT = Path(__file__).resolve().parent.parent


def _build_client(tmp_path, monkeypatch, network="solana-devnet"):
    settings = Settings(
        network=network,
        env="test",
        data_dir=tmp_path,
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


def test_config_shape_and_disabled_defaults(client):
    body = client.get("/api/config").json()
    assert body["chain"] == "solana"
    assert body["nft_standard"] == "metaplex-core"
    assert body["mint_enabled"] is False
    assert body["marketplace_enabled"] is False
    assert set(body["fees"].keys()) == {
        "marketplace_fee_bps", "royalty_bps_default", "currency"
    }


def test_collections_lists_only_real_flagship(client):
    body = client.get("/api/collections").json()
    slugs = [c["slug"] for c in body["collections"]]
    assert slugs == ["zecians"]
    z = body["collections"][0]
    assert z["flagship"] is True
    assert z["collection_address"] is None  # no invented address


def test_collection_detail(client):
    body = client.get("/api/collections/zecians").json()
    assert body["collection"]["slug"] == "zecians"
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
