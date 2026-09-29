"""Ownership state model.

Knowledge tiers (docs/ownership_and_privacy.md):
  custody: project | transparent_holder | shielded | unknown
  known_holder: set only when knowledge is real
  knowledge_basis: issuance_record | transfer_event | escrow_state | none

The model is deliberately unable to "guess" a holder after a shielded
transfer: the state becomes `shielded` with known_holder=None.
"""

import hashlib
import json

CUSTODY_PROJECT = "project"
CUSTODY_TRANSPARENT = "transparent_holder"
CUSTODY_SHIELDED = "shielded"
CUSTODY_UNKNOWN = "unknown"


class OwnershipEventError(Exception):
    pass


def create_initial_state(nft_numbers: list) -> dict:
    """Pre-issuance state: the project controls every Zecian."""
    return {
        "version": 1,
        "assets": {
            str(n): {
                "nft_number": n,
                "custody": CUSTODY_PROJECT,
                "known_holder": "project",
                "knowledge_basis": "issuance_record",
                "last_transfer": None,
                "notes": [],
            }
            for n in sorted(nft_numbers)
        },
    }


def apply_event(state: dict, event: dict) -> dict:
    """Apply one normalized transfer/issuance event. Mutates and returns state.

    Event shapes:
      {"type": "issuance", "nft_number": n, "to_ref": str, "txid": ..., "action_index": int, "height": int}
      {"type": "transfer",  "nft_number": n, "from_ref": str|None, "to_ref": str|None,
       "visibility": "transparent" | "shielded" | "unknown", "txid": ..., "action_index": int, "height": int}
    """
    nft_key = str(event["nft_number"])
    asset = state["assets"].get(nft_key)
    if asset is None:
        raise OwnershipEventError("event for unknown nft %s" % nft_key)

    if event["type"] == "issuance":
        asset["custody"] = CUSTODY_TRANSPARENT if event.get("to_ref") else CUSTODY_PROJECT
        asset["known_holder"] = event.get("to_ref") or "project"
        asset["knowledge_basis"] = "issuance_record"
        asset["last_transfer"] = {"txid": event["txid"], "action_index": event["action_index"], "height": event["height"]}
        return state

    if event["type"] != "transfer":
        raise OwnershipEventError("unknown event type %r" % event["type"])

    expected_from = asset.get("known_holder")
    declared_from = event.get("from_ref")
    if expected_from and declared_from and expected_from != declared_from:
        asset["notes"].append({
            "kind": "from_mismatch",
            "expected": expected_from,
            "declared": declared_from,
            "txid": event["txid"],
        })

    visibility = event["visibility"]
    if visibility == "transparent":
        asset["custody"] = CUSTODY_TRANSPARENT
        asset["known_holder"] = event.get("to_ref")
        asset["knowledge_basis"] = "transfer_event"
    elif visibility == "shielded":
        # Publicly unknowable: we may know an outgoing event happened, but
        # the new holder is a shielded note. We do NOT guess.
        asset["custody"] = CUSTODY_SHIELDED
        asset["known_holder"] = None
        asset["knowledge_basis"] = "transfer_event"
    elif visibility == "unknown":
        asset["custody"] = CUSTODY_UNKNOWN
        asset["known_holder"] = None
        asset["knowledge_basis"] = "none"
    else:
        raise OwnershipEventError("unknown visibility %r" % visibility)

    asset["last_transfer"] = {"txid": event["txid"], "action_index": event["action_index"], "height": event["height"]}
    return state


def state_hash(state: dict) -> str:
    """Deterministic hash of the ownership state (canonical JSON)."""
    canonical = json.dumps(state, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def public_view(state: dict) -> list:
    """What the website may display. Never leaks `project_recorded` holders
    as if they were public facts — knowledge_basis travels with the row."""
    view = []
    for nft_key in sorted(state["assets"], key=int):
        a = state["assets"][nft_key]
        view.append({
            "nft_number": a["nft_number"],
            "custody": a["custody"],
            "holder_visible": a["custody"] in (CUSTODY_PROJECT, CUSTODY_TRANSPARENT),
            "knowledge_basis": a["knowledge_basis"],
        })
    return view
