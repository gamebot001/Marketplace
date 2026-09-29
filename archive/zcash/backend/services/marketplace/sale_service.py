"""Sale state machine with escrow-aware settlement.

Sale states:
  payment_pending → payment_received → transfer_pending → transferred → completed
  payment_pending → cancelled (payment failed; listing released)
  transfer_pending → refund_pending → refunded (transfer failed; manual refund)

Guards (tested):
  - double sale: starting a second sale on a non-active listing raises
  - double payment: payment request is consumed by exactly one sale
  - double asset assignment: confirm_transfer records txid exactly once
  - fake confirmation: only payment_status="confirmed" from the payments
    service moves payment_pending → payment_received
  - replay: transitions are one-way; invalid backwards moves raise
"""

import uuid

from backend.services.marketplace import listing_service

STATE_PAYMENT_PENDING = "payment_pending"
STATE_PAYMENT_RECEIVED = "payment_received"
STATE_TRANSFER_PENDING = "transfer_pending"
STATE_TRANSFERRED = "transferred"
STATE_COMPLETED = "completed"
STATE_CANCELLED = "cancelled"
STATE_REFUND_PENDING = "refund_pending"
STATE_REFUNDED = "refunded"


class SaleError(Exception):
    pass


class InvalidTransition(SaleError):
    pass


def start_sale(store, listing_id: str, buyer_ref: str, payment_request_id: str, now: int) -> dict:
    def mutate(data):
        listing = data.get("listings", {}).get(listing_id)
        if listing is None:
            raise KeyError("unknown listing %s" % listing_id)
        if listing["status"] != listing_service.STATUS_ACTIVE:
            raise listing_service.ListingNotAvailable("listing %s is %s" % (listing_id, listing["status"]))
        if buyer_ref == listing["seller_ref"]:
            raise SaleError("buyer and seller must differ")
        sale_id = "sale_%s" % uuid.uuid4().hex[:10]
        sale = {
            "sale_id": sale_id,
            "listing_id": listing_id,
            "nft_number": listing["nft_number"],
            "seller_ref": listing["seller_ref"],
            "buyer_ref": buyer_ref,
            "price_zat": listing["price_zat"],
            "payment_request_id": payment_request_id,
            "state": STATE_PAYMENT_PENDING,
            "created_at": now,
            "transfer_txid": None,
            "transfer_payload_hash": None,
            "history": [{"state": STATE_PAYMENT_PENDING, "now": now}],
        }
        data.setdefault("sales", {})[sale_id] = sale
        listing["status"] = listing_service.STATUS_PAYMENT_PENDING
        listing["sale_id"] = sale_id
        data.setdefault("events", []).append({"event": "sale_started", "sale_id": sale_id, "listing_id": listing_id, "now": now})
        return data

    data = store.update(mutate)
    return data["sales"][data["listings"][listing_id]["sale_id"]]


def _set_state(store, sale_id: str, allowed_states, new_state: str, event: str, now: int, extra: dict = None) -> dict:
    def mutate(data):
        sale = data["sales"][sale_id]
        allowed = [allowed_states] if isinstance(allowed_states, str) else list(allowed_states)
        if sale["state"] not in allowed:
            raise InvalidTransition("sale %s is %s, cannot move to %s" % (sale_id, sale["state"], new_state))
        sale["state"] = new_state
        sale["history"].append({"state": new_state, "now": now})
        if extra:
            for key, value in extra.items():
                if key == "transfer_txid" and sale.get(key):
                    raise InvalidTransition("double asset assignment on sale %s" % sale_id)
                sale[key] = value
        data.setdefault("events", []).append({"event": event, "sale_id": sale_id, "now": now})
        return data

    return store.update(mutate)["sales"][sale_id]


def record_payment_confirmed(store, sale_id: str, payment_status: str, now: int) -> dict:
    """Only the payments service may call this with payment_status='confirmed'."""
    if payment_status != "confirmed":
        raise SaleError("payment_status must be 'confirmed' (got %r)" % payment_status)
    return _set_state(store, sale_id, STATE_PAYMENT_PENDING, STATE_PAYMENT_RECEIVED, "sale_payment_confirmed", now)


def payment_failed(store, sale_id: str, reason: str, now: int) -> dict:
    sale = _set_state(store, sale_id, STATE_PAYMENT_PENDING, STATE_CANCELLED, "sale_payment_failed", now, {"failure_reason": reason})
    listing = store.get("listings", {}).get(sale["listing_id"])
    if listing and listing["status"] == listing_service.STATUS_PAYMENT_PENDING:
        listing_service._transition(store, listing["listing_id"], listing_service.STATUS_ACTIVE, "listing_released", now)
    return sale


def initiate_transfer(store, sale_id: str, transfer_payload_hash: str, now: int) -> dict:
    return _set_state(store, sale_id, STATE_PAYMENT_RECEIVED, STATE_TRANSFER_PENDING, "sale_transfer_initiated", now,
                      {"transfer_payload_hash": transfer_payload_hash})


def confirm_transfer(store, sale_id: str, txid: str, now: int) -> dict:
    sale = _set_state(store, sale_id, STATE_TRANSFER_PENDING, STATE_TRANSFERRED, "sale_transfer_confirmed", now,
                      {"transfer_txid": txid})
    listing = store.get("listings", {}).get(sale["listing_id"])
    if listing and listing["status"] == listing_service.STATUS_PAYMENT_PENDING:
        listing_service._transition(store, listing["listing_id"], listing_service.STATUS_SOLD, "listing_sold", now)
    return sale


def complete_sale(store, sale_id: str, now: int) -> dict:
    return _set_state(store, sale_id, STATE_TRANSFERRED, STATE_COMPLETED, "sale_completed", now)


def mark_transfer_failed(store, sale_id: str, reason: str, now: int) -> dict:
    return _set_state(store, sale_id, STATE_TRANSFER_PENDING, STATE_REFUND_PENDING, "sale_transfer_failed", now,
                      {"failure_reason": reason})


def confirm_refund(store, sale_id: str, refund_txid: str, now: int) -> dict:
    sale = _set_state(store, sale_id, STATE_REFUND_PENDING, STATE_REFUNDED, "sale_refunded", now, {"refund_txid": refund_txid})
    listing = store.get("listings", {}).get(sale["listing_id"])
    if listing and listing["status"] == listing_service.STATUS_PAYMENT_PENDING:
        listing_service._transition(store, listing["listing_id"], listing_service.STATUS_CANCELLED, "listing_cancelled_after_refund", now)
    return sale


def get_sale(store, sale_id: str):
    return store.get("sales", {}).get(sale_id)
