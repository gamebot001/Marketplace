"""TreasuryService — the Zecians platform treasury ledger.

All Zecians marketplace fees and primary mint proceeds are destined for the
Zecians Treasury. This service records those events. It never invents income:
if no event is observed, the ledger is empty.

Rules:
  * amounts are integer lamports
  * events are idempotent by (kind, signature) when a signature is present
  * treasury address comes from configuration; no fake balance is ever reported
"""

import secrets
import time

from marketplace_backend.services.solana import models as m


class TreasuryError(ValueError):
    pass


def record_event(store, kind: str, lamports: int, now: int = None,
                 signature: str = None, slot: int = None,
                 block_time: int = None, ref: str = None) -> dict:
    if kind not in m.TREASURY_EVENT_KINDS:
        raise TreasuryError("unknown treasury event kind %r" % kind)
    if not isinstance(lamports, int) or isinstance(lamports, bool):
        raise TypeError("lamports must be an int")
    if lamports < 0:
        raise TreasuryError("lamports must be non-negative")
    now = int(now if now is not None else time.time())

    result = {}

    def mutate(data):
        events = data.setdefault("treasury_events", [])
        processed = data.setdefault("treasury_processed", [])
        key = "%s:%s" % (kind, signature) if signature else None
        if key and key in processed:
            for existing in events:
                if existing.get("kind") == kind and existing.get("signature") == signature:
                    result["event"] = existing
                    return data
        event = {
            "event_id": "tre_" + secrets.token_hex(8),
            "kind": kind,
            "lamports": lamports,
            "signature": signature,
            "slot": slot,
            "block_time": block_time,
            "ref": ref,
            "created_at": now,
        }
        events.append(event)
        if key:
            processed.append(key)
        result["event"] = event
        return data

    store.update(mutate)
    return result["event"]


def record_marketplace_fee(store, lamports: int, now: int, **kwargs) -> dict:
    return record_event(store, m.TREASURY_MARKETPLACE_FEE, lamports, now=now, **kwargs)


def record_mint_proceeds(store, lamports: int, now: int, **kwargs) -> dict:
    return record_event(store, m.TREASURY_MINT_PROCEEDS, lamports, now=now, **kwargs)


def list_events(store, limit: int = 100) -> list:
    events = list(store.get("treasury_events", []))
    events.sort(key=lambda e: (e.get("created_at") or 0, e.get("event_id") or ""), reverse=True)
    return events[:limit]


def summary(store) -> dict:
    events = list(store.get("treasury_events", []))
    by_kind = {}
    total = 0
    for event in events:
        total += int(event.get("lamports") or 0)
        by_kind[event["kind"]] = by_kind.get(event["kind"], 0) + int(event.get("lamports") or 0)
    return {
        "total_lamports": total,
        "event_count": len(events),
        "by_kind": by_kind,
    }
