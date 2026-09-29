"""Zcash shielded address validation. Accepts unified (u1...) and sapling (zs1...).

This is syntax/prefix validation only. It does NOT cryptographically verify
that the address is a valid Zcash address, nor that the checksum is correct.
Cryptographic validation requires a wallet or light client and is out of scope
for this phase.
"""

import re

# Prefix + length heuristic only. Not cryptographic validation.
SHIELDED_RE = re.compile(r"^(u1|zs1)[0-9a-z]{20,}$")


def is_shielded_address(address: str) -> bool:
    # Prefix + length heuristic only. Not cryptographic validation.
    if not address:
        return False
    return bool(SHIELDED_RE.match(address.strip().lower()))


def normalize(address: str) -> str:
    return (address or "").strip().lower()
