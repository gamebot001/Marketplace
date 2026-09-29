"""Mint request lifecycle: payment → issuance, exactly once.

States:
  awaiting_payment → payment_confirmed → queued_for_issuance
                   → issuance_submitted → issued
  any (except issued) → failed (with reason; retryable via new request)

Rules:
  - at most one non-failed mint request per NFT
  - idempotency_key returns the same request on retries
  - only the payments service can set payment_confirmed
  - issuance payload is hashed before submission; retries reuse the hash
  - mainnet is refused at the code level
"""

import hashlib
import secrets

STATE_AWAITING_PAYMENT = "awaiting_payment"
STATE_PAYMENT_CONFIRMED = "payment_confirmed"
STATE_QUEUED_FOR_ISSUANCE = "queued_for_issuance"
STATE_ISSUANCE_SUBMITTED = "issuance_submitted"
STATE_ISSUED = "issued"
STATE_FAILED = "failed"


class MintError(Exception):
    pass


class MainnetNotEnabled(MintError):
    pass


def create_mint_request(store, nft_number: int, buyer_ref: str, payment_request_id: str,
                        idempotency_key: str, now: int) -> dict:
    def mutate(data):
        if idempotency_key in data.get("idempotency", {}):
            return data
        for existing in data.get("mint_requests", {}).values():
            if existing["nft_number"] == nft_number and existing["state"] != STATE_FAILED:
                raise MintError("nft %s already has a mint request %s" % (nft_number, existing["mint_id"]))
        mint_id = "mint_" + secrets.token_hex(6)
        data.setdefault("mint_requests", {})[mint_id] = {
            "mint_id": mint_id,
            "nft_number": nft_number,
            "buyer_ref": buyer_ref,
            "payment_request_id": payment_request_id,
            "idempotency_key": idempotency_key,
            "state": STATE_AWAITING_PAYMENT,
            "created_at": now,
            "issuance_payload_hash": None,
            "issuance_txid": None,
            "failure_reason": None,
        }
        data.setdefault("idempotency", {})[idempotency_key] = mint_id
        data.setdefault("events", []).append({"event": "mint_request_created", "mint_id": mint_id, "nft_number": nft_number, "now": now})
        return data

    data = store.update(mutate)
    return data["mint_requests"][data["idempotency"][idempotency_key]]


def record_payment_confirmed(store, mint_id: str, now: int) -> dict:
    def mutate(data):
        mint = data["mint_requests"][mint_id]
        if mint["state"] == STATE_PAYMENT_CONFIRMED:
            return data  # idempotent
        if mint["state"] != STATE_AWAITING_PAYMENT:
            raise MintError("mint %s is %s, not awaiting payment" % (mint_id, mint["state"]))
        mint["state"] = STATE_QUEUED_FOR_ISSUANCE
        data.setdefault("events", []).append({"event": "mint_payment_confirmed", "mint_id": mint_id, "now": now})
        return data

    return store.update(mutate)["mint_requests"][mint_id]


def mark_issuance_submitted(store, mint_id: str, issuance_payload: dict, now: int) -> dict:
    payload_hash = hashlib.sha256(
        repr(sorted(issuance_payload.items(), key=lambda kv: kv[0])).encode()
    ).hexdigest()

    def mutate(data):
        mint = data["mint_requests"][mint_id]
        if mint["state"] == STATE_ISSUANCE_SUBMITTED:
            if mint["issuance_payload_hash"] != payload_hash:
                raise MintError("issuance payload changed for mint %s — refusing to submit twice with different payloads" % mint_id)
            return data  # retry with identical payload is a no-op
        if mint["state"] != STATE_QUEUED_FOR_ISSUANCE:
            raise MintError("mint %s is %s, cannot submit issuance" % (mint_id, mint["state"]))
        mint["state"] = STATE_ISSUANCE_SUBMITTED
        mint["issuance_payload_hash"] = payload_hash
        data.setdefault("events", []).append({"event": "mint_issuance_submitted", "mint_id": mint_id, "now": now})
        return data

    return store.update(mutate)["mint_requests"][mint_id]


def record_issued(store, mint_id: str, txid: str, height: int, network: str, now: int) -> dict:
    if network == "mainnet":
        raise MainnetNotEnabled("mainnet issuance is disabled until the approved launch phase")

    def mutate(data):
        mint = data["mint_requests"][mint_id]
        if mint["state"] == STATE_ISSUED:
            return data  # idempotent
        if mint["state"] != STATE_ISSUANCE_SUBMITTED:
            raise MintError("mint %s is %s, cannot record issuance" % (mint_id, mint["state"]))
        if mint["issuance_txid"] is not None and mint["issuance_txid"] != txid:
            raise MintError("mint %s already issued in %s" % (mint_id, mint["issuance_txid"]))
        mint["state"] = STATE_ISSUED
        mint["issuance_txid"] = txid
        mint["issuance_height"] = height
        mint["issuance_network"] = network
        data.setdefault("events", []).append({"event": "mint_issued", "mint_id": mint_id, "txid": txid, "now": now})
        return data

    return store.update(mutate)["mint_requests"][mint_id]


def mark_failed(store, mint_id: str, reason: str, now: int) -> dict:
    def mutate(data):
        mint = data["mint_requests"][mint_id]
        if mint["state"] == STATE_ISSUED:
            raise MintError("cannot fail an issued mint")
        mint["state"] = STATE_FAILED
        mint["failure_reason"] = reason
        data.setdefault("events", []).append({"event": "mint_failed", "mint_id": mint_id, "reason": reason, "now": now})
        return data

    return store.update(mutate)["mint_requests"][mint_id]


def get_mint(store, mint_id: str):
    return store.get("mint_requests", {}).get(mint_id)
