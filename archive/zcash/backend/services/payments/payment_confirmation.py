"""Confirmation policy for observed Zcash payments.

Pure functions: no I/O, fully unit-testable. The rest of the system may
only treat a payment as real when these functions say so.
"""

# Default minimum confirmations (testnet/dev). Configurable via env in settings.
DEFAULT_MIN_CONFIRMATIONS = 3

STATUS_SEEN = "seen"
STATUS_CONFIRMED = "confirmed"


def evaluate(observed_tx: dict, tip_height: int, min_confirmations: int = DEFAULT_MIN_CONFIRMATIONS) -> str:
    """Classify an observed transaction against the current chain tip.

    observed_tx: {"txid": str, "height": int | None, ...}
      height None = still in mempool.
    Returns STATUS_SEEN or STATUS_CONFIRMED.
    """
    height = observed_tx.get("height")
    if height is None:
        return STATUS_SEEN
    confirmations = tip_height - height + 1
    if confirmations >= min_confirmations:
        return STATUS_CONFIRMED
    return STATUS_SEEN


def detect_reorg(recorded_height, current_tip: int, tx_present_on_chain: bool) -> bool:
    """A reorg invalidates a previously-confirmed tx when either the block
    fell out of the chain (tip moved below it) or the tx is simply gone."""
    if not tx_present_on_chain:
        return True
    if recorded_height is not None and current_tip is not None and current_tip < recorded_height:
        return True
    return False
