"""API smoke tests (FastAPI TestClient over httpx) against the v2 demo
collection (single Zecian #005). The real repo collection is read-only;
all service stores and the app config are redirected to a tmp dir, so the
real configuration/app.json is never mutated.
"""

import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from blockchain.asset_identity import asset_desc_hash
from backend.app import main as app_main
from backend.app.settings import Settings

ROOT = Path(__file__).resolve().parent.parent

VALID_ADDR = "u1testaddress000000000000000000000000000000"

DEFAULT_APP_CONFIG = {
    "features": {
        "mint_enabled": False,
        "marketplace_enabled": False,
        "allowlist_enabled": False,
        "payments_real_zec_enabled": False,
    },
    "limits": {"mint_limit_per_address": 1},
    "mint": {"price_zat": 10000000, "price_note": "PLACEHOLDER ONLY - final price TBD"},
}

GATED_APP_CONFIG = {
    "features": {
        "mint_enabled": True,
        "marketplace_enabled": False,
        "allowlist_enabled": True,
        "payments_real_zec_enabled": False,
    },
    "limits": {"mint_limit_per_address": 1},
    "mint": {"price_zat": 10000000, "price_note": "PLACEHOLDER ONLY - final price TBD"},
}

MINT_ONLY_APP_CONFIG = {
    "features": {
        "mint_enabled": True,
        "marketplace_enabled": False,
        "allowlist_enabled": False,
        "payments_real_zec_enabled": False,
    },
    "limits": {"mint_limit_per_address": 1},
    "mint": {"price_zat": 10000000, "price_note": "PLACEHOLDER ONLY - final price TBD"},
}


def _build_client(tmp_path, config, monkeypatch):
    config_path = tmp_path / "app.json"
    config_path.write_text(json.dumps(config))
    settings = Settings(
        network="local",
        env="test",
        collection_dir=ROOT / "collection",
        data_dir=tmp_path,
        app_config_path=config_path,
    )
    monkeypatch.setattr(app_main, "get_settings", lambda: settings)
    # Reset lazily-created store singletons so they bind to the tmp data_dir.
    for name in ("_MINT_STORE", "_PAYMENT_STORE", "_OWNERSHIP_STORE", "_ALLOWLIST_STORE"):
        monkeypatch.setattr(app_main, name, None, raising=False)
    return TestClient(app_main.app)


@pytest.fixture
def client(tmp_path, monkeypatch):
    with _build_client(tmp_path, DEFAULT_APP_CONFIG, monkeypatch) as test_client:
        yield test_client


@pytest.fixture
def allowlist_client(tmp_path, monkeypatch):
    with _build_client(tmp_path, GATED_APP_CONFIG, monkeypatch) as test_client:
        yield test_client


@pytest.fixture
def mint_client(tmp_path, monkeypatch):
    with _build_client(tmp_path, MINT_ONLY_APP_CONFIG, monkeypatch) as test_client:
        yield test_client


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["network"] == "local"


def test_config_endpoint_shape_and_types(client):
    response = client.get("/api/config")
    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"mint_enabled", "allowlist_enabled"}
    assert isinstance(body["mint_enabled"], bool)
    assert isinstance(body["allowlist_enabled"], bool)


def test_config_defaults_to_disabled(client):
    body = client.get("/api/config").json()
    assert body["mint_enabled"] is False
    assert body["allowlist_enabled"] is False


def test_config_reflects_enabled_flags(allowlist_client):
    body = allowlist_client.get("/api/config").json()
    assert body["mint_enabled"] is True
    assert body["allowlist_enabled"] is True


def test_collection_endpoint(client):
    response = client.get("/api/collection")
    assert response.status_code == 200
    body = response.json()
    assert body["collection"] == "zecians-genesis"
    assert body["nft_count"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["nft_number"] == 5


def test_nft_endpoint(client):
    response = client.get("/api/nft/5")
    assert response.status_code == 200
    body = response.json()
    assert body["nft_number"] == 5
    assert body["name"] == "Zecian #005"
    assert body["asset_identifier"]["asset_desc"] == "zsc1|zecians-genesis|005"

    assert client.get("/api/nft/999").status_code == 404
    assert client.get("/api/nft/0").status_code == 400


def test_activity_defaults_to_empty(client):
    response = client.get("/api/activity")
    assert response.status_code == 200
    assert response.json() == {"events": []}


def test_ownership_initializes_demo_asset(client):
    response = client.get("/api/ownership/5")
    assert response.status_code == 200
    body = response.json()
    assert body["nft_number"] == 5
    assert body["custody"] == "project"
    assert body["known_holder"] == "project"
    assert body["holder_visible"] is True
    assert body["knowledge_basis"] == "issuance_record"
    assert body["demo_state"] is True
    assert "note" in body
    assert client.get("/api/ownership/999").status_code == 404


def test_settings_refuse_mainnet():
    with pytest.raises(RuntimeError):
        Settings(network="mainnet").assert_not_mainnet()


# --- whitelist / allowlist -------------------------------------------------


def test_allowlist_defaults_to_empty_and_closed(client):
    response = client.get("/api/allowlist")
    assert response.status_code == 200
    body = response.json()
    assert body["entries"] == []
    assert body["phase"]["current"] == "closed"


def test_allowlist_add_rejects_non_shielded(client):
    response = client.post("/api/allowlist/add", json={"address": "t1notshielded"})
    assert response.status_code == 400


def test_allowlist_add_accepts_valid_and_check_eligible_when_disabled(client):
    response = client.post(
        "/api/allowlist/add", json={"address": VALID_ADDR, "notes": "test"}
    )
    assert response.status_code == 200
    assert response.json()["address"] == VALID_ADDR

    listing = client.get("/api/allowlist").json()
    assert len(listing["entries"]) == 1
    assert listing["phase"]["current"] == "closed"

    check = client.get("/api/allowlist/check/%s" % VALID_ADDR).json()
    assert check["eligible"] is True
    assert check["reason"] == "allowlist_disabled_mint_open"
    assert check["allowlist_enabled"] is False


def test_allowlist_check_rejects_non_shielded(client):
    check = client.get("/api/allowlist/check/t1nope").json()
    assert check["eligible"] is False
    assert check["reason"] == "not_a_shielded_address"


def test_allowlist_remove(client):
    client.post("/api/allowlist/add", json={"address": VALID_ADDR})
    assert client.delete("/api/allowlist/%s" % VALID_ADDR).status_code == 200
    assert client.delete("/api/allowlist/%s" % VALID_ADDR).status_code == 404


def test_allowlist_phase_validates(client):
    response = client.post("/api/allowlist/phase", json={"phase": "bogus"})
    assert response.status_code == 400


# --- mint gating -----------------------------------------------------------


def test_mint_disabled_returns_503(client):
    response = client.post(
        "/api/mint",
        json={
            "nft_number": 5,
            "buyer_ref": "buyer",
            "wallet_address": VALID_ADDR,
            "idempotency_key": "disabled-1",
        },
    )
    assert response.status_code == 503


def test_mint_requires_wallet_address_when_allowlist_enabled(allowlist_client):
    allowlist_client.post("/api/allowlist/phase", json={"phase": "open"})
    response = allowlist_client.post(
        "/api/mint",
        json={"nft_number": 5, "buyer_ref": "buyer", "idempotency_key": "no-wallet-1"},
    )
    assert response.status_code == 403


def test_mint_succeeds_and_increments_mints_used(allowlist_client):
    allowlist_client.post("/api/allowlist/add", json={"address": VALID_ADDR})
    allowlist_client.post("/api/allowlist/phase", json={"phase": "open"})

    check = allowlist_client.get("/api/allowlist/check/%s" % VALID_ADDR).json()
    assert check["eligible"] is True
    assert check["reason"] == "ok"

    response = allowlist_client.post(
        "/api/mint",
        json={
            "nft_number": 5,
            "buyer_ref": VALID_ADDR,
            "wallet_address": VALID_ADDR,
            "idempotency_key": "ok-1",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["mint"]["mint_id"]
    assert body["payment"]["payment_ref"]
    assert body["price_note"]

    entry = allowlist_client.get("/api/allowlist").json()["entries"][0]
    assert entry["mints_used"] == 1

    # second attempt on the same address is blocked by the mint limit
    second = allowlist_client.post(
        "/api/mint",
        json={
            "nft_number": 5,
            "buyer_ref": VALID_ADDR,
            "wallet_address": VALID_ADDR,
            "idempotency_key": "ok-2",
        },
    )
    assert second.status_code == 403


# --- attested demo issuance bridge -----------------------------------------


def _mint_and_pay(client, idempotency_key):
    created = client.post(
        "/api/mint",
        json={"nft_number": 5, "buyer_ref": "test", "idempotency_key": idempotency_key},
    ).json()
    payment = created["payment"]
    client.post(
        "/api/payments/observe",
        json={
            "txid": "deadbeef0001",
            "amount_zat": 10000000,
            "memo": payment["payment_ref"],
            "height": 1,
            "tip_height": 10,
        },
    )
    return created["mint"]


def test_observe_payment_auto_advances_to_issued(mint_client):
    mint = _mint_and_pay(mint_client, "phase6-api-auto")
    body = mint_client.get("/api/mint/%s" % mint["mint_id"]).json()
    assert body["mint"]["state"] == "issued"
    assert body["mint"]["issuance_network"] == "demo"
    assert body["mint"]["issuance_txid"].startswith("attested:demo:")


def test_advance_issuance_endpoint_is_idempotent(mint_client):
    mint = _mint_and_pay(mint_client, "phase6-api-adv")
    url = "/api/mint/%s/advance-issuance" % mint["mint_id"]

    first = mint_client.post(url)
    assert first.status_code == 200
    data = first.json()
    assert data["state"] == "issued"
    assert data["attested"] is True
    assert data["attested_txid"].startswith("attested:demo:")
    assert not re.fullmatch(r"[0-9a-f]{64}", data["attested_txid"])
    assert data["network"] == "demo"
    assert data["asset_desc"] == "zsc1|zecians-genesis|005"
    assert data["asset_desc_hash"] == asset_desc_hash(data["asset_desc"])

    second = mint_client.post(url)
    assert second.status_code == 200
    assert second.json()["attested_txid"] == data["attested_txid"]


def test_advance_issuance_rejects_unrelated_state(mint_client):
    created = mint_client.post(
        "/api/mint",
        json={"nft_number": 5, "buyer_ref": "test", "idempotency_key": "phase6-api-409"},
    ).json()
    response = mint_client.post(
        "/api/mint/%s/advance-issuance" % created["mint"]["mint_id"]
    )
    assert response.status_code == 409


def test_advance_issuance_unknown_mint_is_404(mint_client):
    assert mint_client.post("/api/mint/mint_missing/advance-issuance").status_code == 404


def test_issuance_endpoint_returns_attested_view(mint_client):
    _mint_and_pay(mint_client, "phase6-api-read")
    response = mint_client.get("/api/issuance/5")
    assert response.status_code == 200
    body = response.json()
    assert body["nft_number"] == 5
    assert body["attested"] is True
    assert body["network"] == "demo"
    assert body["attested_txid"].startswith("attested:demo:")
    assert body["payload"]["asset_desc"] == "zsc1|zecians-genesis|005"
    assert body["payload"]["asset_desc_hash"] == asset_desc_hash(body["payload"]["asset_desc"])
    assert "no real zcash transaction was broadcast" in body["note"].lower()


def test_issuance_endpoint_404_when_absent(mint_client):
    assert mint_client.get("/api/issuance/5").status_code == 404


def test_activity_contains_attested_events_without_duplicates(mint_client):
    mint = _mint_and_pay(mint_client, "phase6-api-activity")
    url = "/api/mint/%s/advance-issuance" % mint["mint_id"]
    mint_client.post(url)
    mint_client.post(url)

    events = mint_client.get("/api/activity").json()["events"]
    names = [e["event"] for e in events]
    for expected in ("mint_issued", "attested_issuance_recorded"):
        assert expected in names
    assert names.count("attested_issuance_recorded") == 1
    assert names.count("mint_issued") == 1
