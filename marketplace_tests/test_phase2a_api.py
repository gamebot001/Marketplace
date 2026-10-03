"""Phase 2A API tests: unverified collections, metadata/artwork serving, stats.

All records are registered through the same `/api/indexer/register` surface the
mint pipeline uses; addresses come from the deterministic test helper. No
network access.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from marketplace_backend.app import main as app_main
from marketplace_backend.app.settings import Settings


def _build_client(tmp_path, monkeypatch):
    settings = Settings(
        network="solana-devnet",
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


def _register_phase2a(client, tmp_path, addr):
    collection_address = addr(2_000_001)
    asset_address = addr(2_000_002)
    owner = addr(2_000_003)
    png = tmp_path / "art.png"
    png.write_bytes(bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))

    response = client.post(
        "/api/indexer/register",
        json={
            "collection": {
                "name": "Cats",
                "slug": "cats",
                "collection_address": collection_address,
                "description": "Phase 2A test collection.",
                "image": f"/api/artwork/{collection_address}",
                "artwork_path": str(png),
                "verified": False,
            },
            "assets": [
                {
                    "asset_address": asset_address,
                    "collection_address": collection_address,
                    "owner_address": owner,
                    "metadata_uri": f"/api/metadata/{asset_address}",
                    "name": "Cats #1",
                    "image": f"/api/artwork/{asset_address}",
                    "artwork_path": str(png),
                    "mime_type": "image/png",
                    "attributes": [],
                }
            ],
        },
    )
    assert response.status_code == 200
    return collection_address, asset_address, owner


def test_phase2a_collection_is_unverified(client, tmp_path, addr):
    _, _, owner = _register_phase2a(client, tmp_path, addr)
    body = client.get("/api/collections/cats").json()
    collection = body["collection"]
    assert collection["verification_status"] == "unverified"
    assert collection["collection_address"] is not None
    assert body["asset_count"] == 1
    assert len(body["assets"]) == 1
    assert collection["stats"]["supply"] == 1
    assert collection["stats"]["owners"] == 1
    assert collection["stats"]["floor_lamports"] is None
    assert collection["stats"]["listed_count"] == 0

    listed = client.get("/api/collections").json()["collections"]
    cats = [c for c in listed if c["slug"] == "cats"][0]
    assert cats["verification_status"] == "unverified"
    assert cats["stats"]["supply"] == 1


def test_metadata_and_artwork_endpoints(client, tmp_path, addr):
    _, asset_address, _ = _register_phase2a(client, tmp_path, addr)

    metadata = client.get(f"/api/metadata/{asset_address}").json()
    assert metadata["name"] == "Cats #1"
    assert metadata["attributes"] == []
    assert metadata["image"].endswith(f"/api/artwork/{asset_address}")

    artwork = client.get(f"/api/artwork/{asset_address}")
    assert artwork.status_code == 200
    assert artwork.headers["content-type"].startswith("image/png")
    assert artwork.content[:4] == bytes([0x89, 0x50, 0x4E, 0x47])


def test_owner_asset_query(client, tmp_path, addr):
    _, asset_address, owner = _register_phase2a(client, tmp_path, addr)
    body = client.get("/api/assets", params={"owner_address": owner}).json()
    assert [a["asset_address"] for a in body["assets"]] == [asset_address]
    assert client.get(
        "/api/assets", params={"owner_address": addr(9_999_999)}
    ).json()["assets"] == []


def test_unknown_metadata_and_artwork_are_404(client):
    assert client.get("/api/metadata/nope").status_code == 404
    assert client.get("/api/artwork/nope").status_code == 404
