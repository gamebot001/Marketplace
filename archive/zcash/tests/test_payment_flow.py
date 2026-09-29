"""Payment flow: matching, confirmation, reconciliation, restart safety."""

import pytest

from backend.services.json_file_store import JsonFileStore
from backend.services.payments import payment_monitor as monitor
from backend.services.payments import payment_reconciliation as recon

AMOUNT = 2_000_000  # 0.02 ZEC in zatoshi


@pytest.fixture
def pay_store(tmp_path):
    return JsonFileStore(tmp_path / "payments.json")


def _request(store, now=1000, amount=AMOUNT):
    return monitor.create_payment_request(
        store, nft_number=1, amount_zat=amount,
        recipient_address="u1test-recipient", now=now, ttl_seconds=1800,
    )


def test_exact_match_by_memo_then_confirm(pay_store):
    req = _request(pay_store)
    outcome = monitor.match_observed_payment(pay_store, {
        "txid": "tx1", "amount_zat": AMOUNT, "memo": "Zecians mint %s" % req["payment_ref"],
        "height": 500,
    }, now=1100)
    assert outcome["result"] == "matched"
    assert outcome["match_mode"] == "memo_ref"

    monitor.confirm_payment(pay_store, "tx1", tip_height=502, now=1200, min_confirmations=3)
    assert monitor.get_request(pay_store, req["request_id"])["status"] == "confirmed"


def test_confirmations_below_threshold_stay_matched(pay_store):
    req = _request(pay_store)
    monitor.match_observed_payment(pay_store, {"txid": "tx2", "amount_zat": AMOUNT, "memo": req["payment_ref"], "height": 500}, now=1100)
    monitor.confirm_payment(pay_store, "tx2", tip_height=500, now=1100, min_confirmations=3)
    assert monitor.get_request(pay_store, req["request_id"])["status"] == "matched"


def test_underpayment_is_terminal(pay_store):
    req = _request(pay_store)
    outcome = monitor.match_observed_payment(pay_store, {
        "txid": "tx3", "amount_zat": AMOUNT - 5000, "memo": req["payment_ref"], "height": 500,
    }, now=1100)
    assert outcome["result"] == "underpaid"
    request = monitor.get_request(pay_store, req["request_id"])
    assert request["status"] == "underpaid"
    assert request["shortfall_zat"] == 5000


def test_overpayment_flags_review_never_auto_refund(pay_store):
    req = _request(pay_store)
    outcome = monitor.match_observed_payment(pay_store, {
        "txid": "tx4", "amount_zat": AMOUNT + 250_000, "memo": req["payment_ref"], "height": 500,
    }, now=1100)
    assert outcome["result"] == "overpaid"
    request = monitor.get_request(pay_store, req["request_id"])
    assert request["status"] == "matched"
    assert request["overpay_excess_zat"] == 250_000
    assert request["needs_review"] is True


def test_duplicate_payment_becomes_orphan(pay_store):
    req = _request(pay_store)
    monitor.match_observed_payment(pay_store, {"txid": "txA", "amount_zat": AMOUNT, "memo": req["payment_ref"], "height": 500}, now=1100)
    monitor.confirm_payment(pay_store, "txA", tip_height=502, now=1150, min_confirmations=3)
    outcome = monitor.match_observed_payment(pay_store, {"txid": "txB", "amount_zat": AMOUNT, "memo": req["payment_ref"], "height": 501}, now=1200)
    orphan = pay_store.get("orphans", {})["txB"]
    assert orphan["reason"] == "duplicate_payment"
    assert orphan["review"] is True
    assert monitor.get_request(pay_store, req["request_id"])["status"] == "confirmed"


def test_unmatched_payment_becomes_orphan(pay_store):
    outcome = monitor.match_observed_payment(pay_store, {"txid": "txC", "amount_zat": 999, "memo": "", "height": 500}, now=1100)
    assert outcome["result"] == "unmatched"
    assert "txC" in pay_store.get("orphans", {})


def test_amount_fallback_matches_unique_amount(pay_store):
    req = _request(pay_store, amount=1_234_567)
    outcome = monitor.match_observed_payment(pay_store, {"txid": "txD", "amount_zat": 1_234_567, "memo": "", "height": 500}, now=1100)
    assert outcome["result"] == "matched"
    assert outcome["match_mode"] == "amount_fallback"
    assert monitor.get_request(pay_store, req["request_id"])["needs_review"] is True


def test_ambiguous_amount_fallback_does_not_match(pay_store):
    _request(pay_store, amount=777_000)
    _request(pay_store, amount=777_000)
    outcome = monitor.match_observed_payment(pay_store, {"txid": "txE", "amount_zat": 777_000, "memo": "", "height": 500}, now=1100)
    assert outcome["result"] == "unmatched"


def test_same_txid_processed_once(pay_store):
    req = _request(pay_store)
    first = monitor.match_observed_payment(pay_store, {"txid": "txF", "amount_zat": AMOUNT, "memo": req["payment_ref"], "height": 500}, now=1100)
    second = monitor.match_observed_payment(pay_store, {"txid": "txF", "amount_zat": AMOUNT, "memo": req["payment_ref"], "height": 500}, now=1200)
    assert first["result"] == "matched"
    assert second["result"] == "duplicate_txid"
    request = monitor.get_request(pay_store, req["request_id"])
    assert request["status"] == "matched"  # unchanged by the replay


def test_reorg_reverts_confirmation(pay_store):
    req = _request(pay_store)
    monitor.match_observed_payment(pay_store, {"txid": "txG", "amount_zat": AMOUNT, "memo": req["payment_ref"], "height": 500}, now=1100)
    monitor.confirm_payment(pay_store, "txG", tip_height=503, now=1150, min_confirmations=3)
    assert monitor.get_request(pay_store, req["request_id"])["status"] == "confirmed"
    monitor.confirm_payment(pay_store, "txG", tip_height=499, now=1200, min_confirmations=3, tx_present_on_chain=False)
    assert monitor.get_request(pay_store, req["request_id"])["status"] == "pending"
    events = [e["event"] for e in pay_store.get("events", [])]
    assert "reorg_detected" in events


def test_reconciliation_expires_confirms_enqueues_and_is_idempotent(pay_store):
    req = _request(pay_store, now=1000)
    # expire this one
    monitor.match_observed_payment(pay_store, {"txid": "txH", "amount_zat": AMOUNT, "memo": req["payment_ref"], "height": 500}, now=1100)
    req2 = _request(pay_store, now=1000)  # stays pending, will expire

    changes = recon.reconcile(pay_store, now=1000 + 1900, tip_height=505, min_confirmations=3)
    actions = {(c["action"], c.get("request_id")) for c in changes}
    assert ("expired", req2["request_id"]) in actions
    assert ("confirmed", req["request_id"]) in actions
    assert ("enqueue_for_consumption", req["request_id"]) in actions

    # second run: nothing left to do
    changes2 = recon.reconcile(pay_store, now=1000 + 2000, tip_height=505, min_confirmations=3)
    assert changes2 == []


def test_consume_is_exactly_once(pay_store):
    req = _request(pay_store)
    monitor.match_observed_payment(pay_store, {"txid": "txI", "amount_zat": AMOUNT, "memo": req["payment_ref"], "height": 500}, now=1100)
    monitor.confirm_payment(pay_store, "txI", tip_height=502, now=1150, min_confirmations=3)
    monitor.consume_request(pay_store, req["request_id"], "mint_1", now=1200)
    monitor.consume_request(pay_store, req["request_id"], "mint_1", now=1201)  # idempotent
    assert monitor.get_request(pay_store, req["request_id"])["status"] == "consumed"
    with pytest.raises(ValueError):
        monitor.consume_request(pay_store, req["request_id"], "mint_2", now=1202)


def test_backend_restart_preserves_state(pay_store):
    req = _request(pay_store)
    monitor.match_observed_payment(pay_store, {"txid": "txJ", "amount_zat": AMOUNT, "memo": req["payment_ref"], "height": 500}, now=1100)
    monitor.confirm_payment(pay_store, "txJ", tip_height=502, now=1150, min_confirmations=3)

    # simulate restart: fresh store object over the same file
    reopened = JsonFileStore(pay_store.path)
    request = monitor.get_request(reopened, req["request_id"])
    assert request["status"] == "confirmed"
    changes = recon.reconcile(reopened, now=1300, tip_height=502, min_confirmations=3)
    assert all(c["action"] != "confirmed" for c in changes)  # already confirmed; no double enqueue
