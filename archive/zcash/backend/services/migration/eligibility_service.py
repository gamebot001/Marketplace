"""Eligibility rules for mainnet migration claims.

An asset is eligible iff (in a given snapshot):
  - it exists in the snapshot, and
  - it is not inside a live marketplace escrow, and
  - no earlier claim for it reached validated/approved/issued.

A holder proves control in v1 with the claim_code issued at purchase
(stored only as a SHA-256 hash). The production mechanism — a wallet
signature over a server challenge — is specified but NOT implemented,
because ZSA wallet tooling does not exist yet. The stub below says so
loudly instead of pretending.
"""

import hashlib


class IneligibleAsset(Exception):
    pass


def is_asset_eligible(snapshot: dict, nft_number: int, claims_store=None) -> tuple:
    assets = {a["nft_number"]: a for a in snapshot["assets"]}
    if nft_number not in assets:
        return False, "asset not in snapshot"
    asset = assets[nft_number]
    if asset["escrow_state"] != "none":
        return False, "asset in live escrow (%s)" % asset["escrow_state"]
    if claims_store is not None:
        for claim in claims_store.get("claims", {}).values():
            if claim["nft_number"] != nft_number:
                continue
            if claim["state"] in ("validated", "approved", "issued", "completed"):
                return False, "claim %s already %s" % (claim["claim_id"], claim["state"])
    return True, "eligible"


def hash_claim_code(claim_code: str) -> str:
    return hashlib.sha256(claim_code.encode("utf-8")).hexdigest()


def check_claim_code(recorded_hash: str, provided_code: str) -> bool:
    """Constant-time comparison of the provided claim code against the
    recorded hash (we never store claim codes themselves)."""
    import hmac
    return hmac.compare_digest(recorded_hash, hash_claim_code(provided_code))


class ProofMechanismNotAvailable(NotImplementedError):
    pass


def validate_wallet_signature(claim: dict, signature: str) -> bool:
    """Future mechanism: wallet signature over the server challenge.

    NOT IMPLEMENTED — requires ZSA wallet tooling that does not exist yet
    (see docs/ecosystem_research.md §5). Raises instead of faking success.
    """
    raise ProofMechanismNotAvailable(
        "Wallet-signature control proof is designed but not implemented: "
        "ZSA wallets cannot sign challenges yet. Use the claim_code v1 flow "
        "for the prototype; this method activates when wallet tooling ships."
    )
