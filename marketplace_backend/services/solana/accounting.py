"""Future-compatible participation accounting.

This module ONLY records neutral participation facts so that a future
ecosystem distribution could be computed from real activity. It does not
define a token, tokenomics, allocations, or promises of any kind.

Recorded kinds (see models.PARTICIPATION_KINDS):
    marketplace_buy, marketplace_sell, mint, creator,
    verified_activity, treasury_fee

Records are idempotent by (kind, address, ref).
"""

import time

from marketplace_backend.services.solana import models as m
from marketplace_backend.services.solana import wallet_service


class AccountingError(ValueError):
    pass


def record_participation(store, address: str, kind: str, weight: int = 1,
                         ref: str = None, now: int = None) -> dict:
    if kind not in m.PARTICIPATION_KINDS:
        raise AccountingError("unknown participation kind %r" % kind)
    if not isinstance(weight, int) or isinstance(weight, bool) or weight < 0:
        raise AccountingError("weight must be a non-negative int")
    now = int(now if now is not None else time.time())

    result = {}

    def mutate(data):
        records = data.setdefault("participation", [])
        for existing in records:
            if existing["kind"] == kind and existing["address"] == address and existing.get("ref") == ref:
                result["record"] = existing
                return data
        record = {
            "address": address,
            "kind": kind,
            "weight": weight,
            "ref": ref,
            "created_at": now,
        }
        records.append(record)
        result["record"] = record
        return data

    store.update(mutate)
    return result["record"]


def participation_summary(store, address: str = None) -> dict:
    records = [r for r in store.get("participation", []) if address is None or r["address"] == address]
    by_kind = {}
    for record in records:
        by_kind[record["kind"]] = by_kind.get(record["kind"], 0) + record["weight"]
    return {"records": len(records), "by_kind": by_kind}


def snapshot(store, snapshot_name: str, now: int = None) -> dict:
    """Deterministic address→weight snapshot from participation records.

    Accounting data only; it grants nothing and promises nothing.
    """
    now = int(now if now is not None else time.time())
    totals = {}
    for record in store.get("participation", []):
        address = record["address"]
        totals[address] = totals.get(address, 0) + int(record["weight"])
    return {
        "snapshot": snapshot_name,
        "created_at": now,
        "weights": dict(sorted(totals.items())),
    }
