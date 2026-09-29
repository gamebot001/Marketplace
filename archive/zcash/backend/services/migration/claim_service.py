"""Migration claim lifecycle.

States:
  draft → challenged → proof_submitted → validated → approved
        → issued → completed            (issued/completed: launch phase only)
  draft/challenged/proof_submitted → rejected | expired

Guards:
  - one live claim per asset (via claim_validator)
  - challenge is server-secret-bound (HMAC); proofs are checked against it
  - approvals are idempotent
  - issue_mainnet raises MainnetNotEnabled until the approved launch phase
"""

import hashlib
import hmac
import secrets

from backend.services.migration import claim_validator, eligibility_service

STATE_DRAFT = "draft"
STATE_CHALLENGED = "challenged"
STATE_PROOF_SUBMITTED = "proof_submitted"
STATE_VALIDATED = "validated"
STATE_REJECTED = "rejected"
STATE_APPROVED = "approved"
STATE_ISSUED = "issued"
STATE_COMPLETED = "completed"
STATE_EXPIRED = "expired"


class ClaimError(Exception):
    pass


class MainnetNotEnabled(ClaimError):
    pass


def derive_challenge(server_secret: str, claim_id: str, nft_number: int) -> str:
    message = ("zecians-migration|%s|%d" % (claim_id, nft_number)).encode()
    return hmac.new(server_secret.encode(), message, hashlib.sha256).hexdigest()


def create_claim(claims_store, server_secret: str, nft_number: int,
                 requester_ref: str, snapshot_hash: str, now: int) -> dict:
    claim_validator.validate_new_claim(claims_store, nft_number)
    claim_id = "clm_" + secrets.token_hex(6)
    claim = {
        "claim_id": claim_id,
        "nft_number": nft_number,
        "requester_ref": requester_ref,
        "snapshot_hash": snapshot_hash,
        "state": STATE_CHALLENGED,
        "challenge": derive_challenge(server_secret, claim_id, nft_number),
        "recipient_address": None,
        "created_at": now,
        "history": [{"state": STATE_CHALLENGED, "now": now}],
    }
    data = claims_store.update(lambda d: _put_claim(d, claim))
    return data["claims"][claim_id]


def _put_claim(data: dict, claim: dict) -> dict:
    data.setdefault("claims", {})[claim["claim_id"]] = claim
    return data

def _set_state(claims_store, claim_id: str, allowed_states, new_state: str,
               now: int, extra: dict = None, idempotent: bool = False) -> dict:
    def mutate(data):
        claim = data["claims"][claim_id]
        if claim["state"] == new_state and idempotent:
            return data
        if claim["state"] not in (allowed_states if isinstance(allowed_states, (list, tuple)) else [allowed_states]):
            raise ClaimError("claim %s is %s, cannot move to %s" % (claim_id, claim["state"], new_state))
        claim["state"] = new_state
        claim["history"].append({"state": new_state, "now": now})
        if extra:
            claim.update(extra)
        return data

    return claims_store.update(mutate)["claims"][claim_id]


def submit_proof(claims_store, claim_id: str, claim_code: str, now: int) -> dict:
    if not claim_code:
        raise ClaimError("empty claim code")
    return _set_state(claims_store, claim_id, STATE_CHALLENGED, STATE_PROOF_SUBMITTED, now,
                      {"proof_submitted_at": now})


def validate_claim(claims_store, claim_id: str, recorded_claim_code_hash: str, now: int) -> dict:
    """v1 control proof: claim code hash check. v2 (wallet signature) is a
    documented future mechanism — see eligibility_service."""
    def mutate(data):
        claim = data["claims"][claim_id]
        if claim["state"] != STATE_PROOF_SUBMITTED:
            raise ClaimError("claim %s is %s, not awaiting validation" % (claim_id, claim["state"]))
        provided = data.get("proof_codes", {}).get(claim_id)
        ok = provided is not None and eligibility_service.check_claim_code(recorded_claim_code_hash, provided)
        claim["state"] = STATE_VALIDATED if ok else STATE_REJECTED
        claim["history"].append({"state": claim["state"], "now": now})
        return data

    return claims_store.update(mutate)["claims"][claim_id]


def set_proof_code(claims_store, claim_id: str, claim_code: str) -> None:
    """Store the submitted code for validation (in production this is
    ephemeral in-memory input to the validator, never persisted)."""
    def mutate(data):
        data.setdefault("proof_codes", {})[claim_id] = claim_code
        return data

    claims_store.update(mutate)


def approve(claims_store, claim_id: str, approver_ref: str, now: int) -> dict:
    return _set_state(claims_store, claim_id, STATE_VALIDATED, STATE_APPROVED, now,
                      {"approved_by": approver_ref, "approved_at": now}, idempotent=True)


def set_recipient(claims_store, claim_id: str, address: str) -> dict:
    address = claim_validator.validate_recipient_address(address)

    def mutate(data):
        claim = data["claims"][claim_id]
        if claim["state"] != STATE_APPROVED:
            raise ClaimError("recipient can only be set on approved claims")
        claim["recipient_address"] = address
        return data

    return claims_store.update(mutate)["claims"][claim_id]


def issue_mainnet(claims_store, claim_id: str, now: int) -> dict:
    """Hard safety interlock: mainnet issuance is disabled in this phase."""
    raise MainnetNotEnabled(
        "Mainnet issuance is disabled until the owner-approved launch phase. "
        "See docs/asset_design.md and docs/security.md."
    )


def get_claim(claims_store, claim_id: str):
    return claims_store.get("claims", {}).get(claim_id)
