"""Validation guards for migration claims.

- duplicate-claim protection: one active/completed claim per asset
- recipient policy: mainnet recipients must be shielded (u1…/zs1…)
"""

import re


class ClaimConflict(Exception):
    pass


class InvalidRecipient(Exception):
    pass


ACTIVE_STATES = ("draft", "challenged", "proof_submitted", "validated", "approved", "issued", "completed")


def find_active_claim(claims_store, nft_number: int):
    for claim in claims_store.get("claims", {}).values():
        if claim["nft_number"] == nft_number and claim["state"] in ACTIVE_STATES:
            return claim
    return None


def validate_new_claim(claims_store, nft_number: int) -> dict:
    """Raise ClaimConflict if a live claim exists; return it for reference."""
    existing = find_active_claim(claims_store, nft_number)
    if existing is not None:
        raise ClaimConflict(
            "nft %s already has claim %s in state %s" % (nft_number, existing["claim_id"], existing["state"])
        )
    return None


SHIELDED_ADDRESS_RE = re.compile(r"^(u1|zs1)[0-9a-z]{20,}$")


def validate_recipient_address(address: str) -> str:
    """Mainnet recipients must be shielded — policy, enforced."""
    address = (address or "").strip().lower()
    if not SHIELDED_ADDRESS_RE.match(address):
        raise InvalidRecipient(
            "recipient must be a shielded address (u1… unified or zs1… sapling); "
            "transparent recipients are not accepted for migration"
        )
    return address
