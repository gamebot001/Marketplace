"""Recorded / attested issuance bridge for the demo Zecian #005.

THIS IS NOT A REAL ZCASH ISSUANCE.

The bridge exists so the `issued` mint state is reachable in the demo
without touching a chain. It deliberately performs *no* signing, *no*
wallet signing, *no* blockchain RPC call, *no* broadcast and never talks
to mainnet. It computes the correct ZIP 227 asset description and
assetDescHash (BLAKE2b-256, person "ZSA-AssetDescCRH") using the real
implementation in blockchain/asset_identity.py, then records the result as
an attestation.

The txid is SYNTHETIC and intentionally not 64 hex characters:

    attested:demo:<mint_id>:<short_random_hex>

A real Zcash txid is a 64-hex string; this format contains colons and the
`attested:demo:` prefix, so it can never be mistaken for a real on-chain
transaction id. No real chain txid is invented here.

Transitions supported (idempotently):

    queued_for_issuance  -> issuance_submitted -> issued
    issuance_submitted   -> issued
    issued               -> return existing record unchanged
"""

import secrets

from blockchain.asset_identity import asset_desc_hash, zecians_asset_desc
from backend.services.minting import mint_service

ATTESTED_TXID_PREFIX = "attested:demo:"
ATTESTED_NOTE = "attested_demo_issuance"

_VALID_PRE_STATES = (
    mint_service.STATE_QUEUED_FOR_ISSUANCE,
    mint_service.STATE_ISSUANCE_SUBMITTED,
    mint_service.STATE_ISSUED,
)


class IssuanceBridgeError(Exception):
    """Raised when a mint cannot be advanced to the attested issued state."""


def build_issuance_payload(nft_number: int, asset_desc_prefix: str,
                           collection_id: str) -> dict:
    """Build the demo issuance payload.

    The asset_desc/hash are the real ZIP 227 derivation; nothing else in
    this payload is signed or broadcast.
    """
    asset_desc = zecians_asset_desc(asset_desc_prefix, collection_id, nft_number)
    return {
        "nft_number": nft_number,
        "asset_desc": asset_desc,
        "asset_desc_hash": asset_desc_hash(asset_desc),
        "value": 1,
        "finalize": True,
        "note": ATTESTED_NOTE,
    }


def make_attested_txid(mint_id: str) -> str:
    """Return a synthetic, non-64-hex txid for a recorded demo issuance."""
    return "%s%s:%s" % (ATTESTED_TXID_PREFIX, mint_id, secrets.token_hex(6))


def advance_to_issued(mint_store, mint_id: str, nft_number: int,
                      asset_desc_prefix: str, collection_id: str,
                      now: int) -> dict:
    """Advance a mint to `issued` via a recorded attestation.

    Idempotent: safe to call repeatedly. Returns the resulting mint record.
    """
    mint = mint_service.get_mint(mint_store, mint_id)
    if mint is None:
        raise IssuanceBridgeError("unknown mint %s" % mint_id)

    state = mint["state"]

    if state == mint_service.STATE_ISSUED:
        # Already attested: return the existing record unchanged.
        return mint

    if state not in _VALID_PRE_STATES:
        raise IssuanceBridgeError(
            "mint %s is %s, cannot advance to issued" % (mint_id, state)
        )

    if state == mint_service.STATE_QUEUED_FOR_ISSUANCE:
        payload = build_issuance_payload(nft_number, asset_desc_prefix, collection_id)
        mint = mint_service.mark_issuance_submitted(mint_store, mint_id, payload, now)
    else:
        # STATE_ISSUANCE_SUBMITTED: never call mark_issuance_submitted again.
        mint = mint_service.get_mint(mint_store, mint_id)

    if mint["state"] == mint_service.STATE_ISSUED:
        return mint

    txid = make_attested_txid(mint_id)
    return mint_service.record_issued(
        mint_store, mint_id, txid=txid, height=0, network="demo", now=now
    )
