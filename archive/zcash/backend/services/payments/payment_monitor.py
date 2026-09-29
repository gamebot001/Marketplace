"""Payment requests: creation, matching of observed transactions, states.

Design summary (docs/payment_flow.md):
  - Every request carries a unique payment_ref meant for the tx memo.
  - Matching: memo reference first, unique-amount fallback (flagged).
  - Underpayment → terminal `underpaid`. Overpayment → accepted + flagged
    for review; excess is NEVER auto-refunded. Duplicates → orphans.
  - Statuses: pending → matched → confirmed → consumed; side: underpaid,
    expired, needs_review. Reorg reverts confirmed → pending.
"""

import hashlib
import secrets

STATUS_PENDING = "pending"
STATUS_MATCHED = "matched"
STATUS_CONFIRMED = "confirmed"
STATUS_CONSUMED = "consumed"
STATUS_UNDERPAID = "underpaid"
STATUS_EXPIRED = "expired"

RESULT_MATCHED = "matched"
RESULT_UNDERPAID = "underpaid"
RESULT_OVERPAID = "overpaid"
RESULT_UNMATCHED = "unmatched"
RESULT_DUPLICATE_TX = "duplicate_txid"


def _new_ids() -> tuple:
    raw = secrets.token_hex(16)
    request_id = "pay_" + hashlib.blake2b(raw.encode(), digest_size=5).hexdigest()
    payment_ref = "ZC-" + hashlib.blake2b((raw + "ref").encode(), digest_size=5).hexdigest().upper()
    return request_id, payment_ref


def create_payment_request(store, nft_number: int, amount_zat: int, recipient_address: str,
                           now: int, ttl_seconds: int, idempotency_key: str = None) -> dict:
    if amount_zat <= 0:
        raise ValueError("amount_zat must be positive (integer zatoshi)")

    created = {}

    def mutate(data):
        if idempotency_key and idempotency_key in data.get("idempotency", {}):
            created["request"] = data["requests"][data["idempotency"][idempotency_key]]
            return data
        request_id, payment_ref = _new_ids()
        request = {
            "request_id": request_id,
            "payment_ref": payment_ref,
            "nft_number": nft_number,
            "amount_zat": amount_zat,
            "recipient_address": recipient_address,
            "status": STATUS_PENDING,
            "created_at": now,
            "expires_at": now + ttl_seconds,
            "observed_txid": None,
            "observed_amount_zat": None,
            "observed_height": None,
            "match_mode": None,
            "overpay_excess_zat": 0,
            "shortfall_zat": 0,
            "needs_review": False,
            "confirmed_at": None,
            "consumed_by": None,
            "enqueued": False,
        }
        data.setdefault("requests", {})[request_id] = request
        if idempotency_key:
            data.setdefault("idempotency", {})[idempotency_key] = request_id
        data.setdefault("events", []).append({"event": "payment_request_created", "request_id": request_id, "now": now})
        created["request"] = request
        return data

    store.update(mutate)
    return created["request"]


def _find_open_request_by_ref(requests: dict, memo: str):
    """The payment_ref uniquely identifies a request, so look across ALL
    states — a second payment referencing a settled request must be caught
    as a duplicate, not silently unmatched."""
    for request in requests.values():
        if request["payment_ref"] and request["payment_ref"] in (memo or ""):
            return request
    return None


def _find_open_request_by_unique_amount(requests: dict, amount_zat: int):
    candidates = [r for r in requests.values() if r["status"] == STATUS_PENDING and r["amount_zat"] == amount_zat]
    if len(candidates) == 1:
        return candidates[0]
    return None


def match_observed_payment(store, observed: dict, now: int) -> dict:
    """Feed one observed transaction into the store.

    observed: {"txid", "amount_zat", "memo": str|None, "address": str|None,
               "height": int|None}
    Returns an outcome dict describing what happened.
    """
    txid = observed["txid"]
    amount_zat = observed["amount_zat"]
    memo = observed.get("memo") or ""
    outcome = {}

    def mutate(data):
        seen = data.setdefault("seen_txids", {})
        if txid in seen:
            outcome.update({"result": RESULT_DUPLICATE_TX, "request_id": None})
            data.setdefault("events", []).append({"event": "duplicate_txid_ignored", "txid": txid, "now": now})
            return data
        seen[txid] = {"observed_at": now, "amount_zat": amount_zat}

        requests = data.setdefault("requests", {})
        request = _find_open_request_by_ref(requests, memo)
        match_mode = "memo_ref"
        if request is None:
            request = _find_open_request_by_unique_amount(requests, amount_zat)
            match_mode = "amount_fallback"

        if request is None:
            data.setdefault("orphans", {})[txid] = {
                "txid": txid, "amount_zat": amount_zat, "reason": RESULT_UNMATCHED,
                "status": "needs_review", "first_seen": now, "review": False,
            }
            data.setdefault("events", []).append({"event": "orphan_unmatched", "txid": txid, "now": now})
            outcome.update({"result": RESULT_UNMATCHED, "request_id": None})
            return data

        if request["status"] != STATUS_PENDING:
            # second payment for an already-matched/confirmed/expired request
            data.setdefault("orphans", {})[txid] = {
                "txid": txid, "amount_zat": amount_zat, "reason": "duplicate_payment",
                "status": "needs_review", "first_seen": now, "review": True,
                "related_request": request["request_id"],
            }
            data["events"].append({"event": "orphan_duplicate_payment", "request_id": request["request_id"], "txid": txid, "now": now})
            outcome.update({"result": "duplicate_payment", "request_id": None,
                            "related_request": request["request_id"]})
            return data

        if amount_zat < request["amount_zat"]:
            request["status"] = STATUS_UNDERPAID
            request["shortfall_zat"] = request["amount_zat"] - amount_zat
            request["observed_txid"] = txid
            request["observed_height"] = observed.get("height")
            data["events"].append({"event": "payment_underpaid", "request_id": request["request_id"], "txid": txid, "now": now})
            outcome.update({"result": RESULT_UNDERPAID, "request_id": request["request_id"],
                            "shortfall_zat": request["shortfall_zat"]})
            return data

        request["status"] = STATUS_MATCHED
        request["observed_txid"] = txid
        request["observed_amount_zat"] = amount_zat
        request["observed_height"] = observed.get("height")
        request["match_mode"] = match_mode
        result = RESULT_MATCHED
        if match_mode == "amount_fallback":
            request["needs_review"] = True  # still confirmable, but audited
        if amount_zat > request["amount_zat"]:
            request["overpay_excess_zat"] = amount_zat - request["amount_zat"]
            request["needs_review"] = True
            result = RESULT_OVERPAID
            data["events"].append({"event": "payment_overpaid", "request_id": request["request_id"], "txid": txid, "excess": request["overpay_excess_zat"], "now": now})
        data["events"].append({"event": "payment_matched", "request_id": request["request_id"], "txid": txid, "now": now})
        outcome.update({"result": result, "request_id": request["request_id"], "match_mode": match_mode})
        return data

    store.update(mutate)
    return outcome


def confirm_payment(store, txid: str, tip_height: int, now: int,
                    min_confirmations: int, tx_present_on_chain: bool = True) -> dict:
    """Apply the confirmation policy to the request matched with `txid`."""
    from backend.services.payments import payment_confirmation as confirmation

    def mutate(data):
        request = next((r for r in data.get("requests", {}).values() if r.get("observed_txid") == txid), None)
        if request is None:
            return data
        observed_height = request.get("observed_height")
        if request["status"] == STATUS_CONFIRMED and confirmation.detect_reorg(observed_height, tip_height, tx_present_on_chain):
            request["status"] = STATUS_PENDING
            request["confirmed_at"] = None
            data.setdefault("events", []).append({"event": "reorg_detected", "request_id": request["request_id"], "txid": txid, "now": now})
            return data
        state = confirmation.evaluate({"height": observed_height}, tip_height, min_confirmations)
        if state == confirmation.STATUS_CONFIRMED and request["status"] == STATUS_MATCHED:
            request["status"] = STATUS_CONFIRMED
            request["confirmed_at"] = now
            data["events"].append({"event": "payment_confirmed", "request_id": request["request_id"], "txid": txid, "now": now})
        return data

    data = store.update(mutate)
    request = next((r for r in data["requests"].values() if r.get("observed_txid") == txid), None)
    return {"request": request}


def consume_request(store, request_id: str, consumed_by: str, now: int) -> dict:
    """Mark a confirmed request as consumed by a mint/sale (exactly once)."""
    def mutate(data):
        request = data.get("requests", {}).get(request_id)
        if request is None:
            raise KeyError("unknown payment request %s" % request_id)
        if request["status"] == STATUS_CONSUMED:
            if request["consumed_by"] != consumed_by:
                raise ValueError("request %s already consumed by %s" % (request_id, request["consumed_by"]))
            return data  # idempotent for the same consumer
        if request["status"] != STATUS_CONFIRMED:
            raise ValueError("request %s is %s, not confirmed" % (request_id, request["status"]))
        request["status"] = STATUS_CONSUMED
        request["consumed_by"] = consumed_by
        data.setdefault("events", []).append({"event": "payment_consumed", "request_id": request_id, "by": consumed_by, "now": now})
        return data

    return store.update(mutate)["requests"][request_id]


def get_request(store, request_id: str):
    return store.get("requests", {}).get(request_id)
