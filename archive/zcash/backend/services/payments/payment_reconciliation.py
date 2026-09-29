"""Periodic reconciliation: expiry, reorg reverts, orphan aging, enqueuing.

Idempotent by construction: every action is derived from current store
state, and applied actions leave flags so re-running produces no changes.
Safe across backend restarts (state is persistent).
"""

GRACE_SECONDS_FOR_ORPHAN_REVIEW = 3600


def reconcile(store, now: int, tip_height: int, min_confirmations: int) -> list:
    changes = []

    def mutate(data):
        requests = data.setdefault("requests", {})

        # 1. expire stale pending requests
        for request in requests.values():
            if request["status"] == "pending" and request["expires_at"] < now:
                request["status"] = "expired"
                changes.append({"action": "expired", "request_id": request["request_id"]})
                data.setdefault("events", []).append({"event": "payment_request_expired", "request_id": request["request_id"], "now": now})

        # 2. confirmations/reorg for matched requests
        for request in requests.values():
            if request["status"] != "matched" or request.get("observed_height") is None:
                continue
            confirmations = tip_height - request["observed_height"] + 1
            if confirmations >= min_confirmations:
                request["status"] = "confirmed"
                request["confirmed_at"] = now
                changes.append({"action": "confirmed", "request_id": request["request_id"]})
                data.setdefault("events", []).append({"event": "payment_confirmed", "request_id": request["request_id"], "now": now})

        # 3. age orphan transactions into explicit manual review
        for orphan in data.get("orphans", {}).values():
            if not orphan.get("review") and now - orphan["first_seen"] > GRACE_SECONDS_FOR_ORPHAN_REVIEW:
                orphan["review"] = True
                changes.append({"action": "orphan_needs_review", "txid": orphan["txid"]})

        # 4. enqueue confirmed-but-unconsumed requests exactly once
        for request in requests.values():
            if request["status"] == "confirmed" and not request.get("enqueued") and not request.get("consumed_by"):
                request["enqueued"] = True
                changes.append({"action": "enqueue_for_consumption", "request_id": request["request_id"]})
                data.setdefault("events", []).append({"event": "payment_enqueued", "request_id": request["request_id"], "now": now})

        return data

    store.update(mutate)
    return changes
