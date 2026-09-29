"""Migration snapshots: deterministic record of testnet ownership.

A snapshot is the anchor of the whole migration design: eligibility,
claims, and audits all refer to a published snapshot hash. Building the
same snapshot from the same inputs twice produces byte-identical output
(ordered by nft_number, canonical JSON) — that property is tested.
"""

import hashlib
import json

ESCROW_NONE = "none"


def _escrow_state_for(listings: dict, sales: dict, nft_number: int) -> str:
    """Summarize live marketplace involvement for one NFT."""
    for listing in sorted(listings.values(), key=lambda l: l["listing_id"]):
        if listing["nft_number"] != nft_number:
            continue
        if listing["status"] == "payment_pending" and listing.get("sale_id"):
            sale = sales.get(listing["sale_id"], {})
            return "escrow:%s:%s" % (listing["sale_id"], sale.get("state", "unknown"))
    return ESCROW_NONE


def build_snapshot(ownership_state: dict, listings: dict, sales: dict,
                   collection: str, height: int) -> dict:
    assets = []
    for nft_key in sorted(ownership_state["assets"], key=int):
        asset = ownership_state["assets"][nft_key]
        assets.append({
            "nft_number": asset["nft_number"],
            "custody": asset["custody"],
            "known_holder": asset["known_holder"],
            "knowledge_basis": asset["knowledge_basis"],
            "escrow_state": _escrow_state_for(listings, sales, asset["nft_number"]),
        })
    snapshot = {
        "snapshot_version": "zecians.migration_snapshot.v1",
        "collection": collection,
        "height": height,
        "assets": assets,
    }
    snapshot["snapshot_hash"] = hashlib.sha256(
        json.dumps(snapshot, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    return snapshot


def snapshot_hash(snapshot: dict) -> str:
    payload = {k: v for k, v in snapshot.items() if k != "snapshot_hash"}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
