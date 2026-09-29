"""WalletService — Solana address parsing/validation.

This service NEVER handles private keys or seed phrases. It only validates
public base58 Solana addresses (32-byte ed25519 public keys). Signing happens
in the user's own wallet, not here.
"""

_B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
_B58_INDEX = {c: i for i, c in enumerate(_B58_ALPHABET)}


class WalletError(ValueError):
    pass


def _base58_decode(value: str) -> bytes:
    if not value:
        raise WalletError("empty address")
    number = 0
    for ch in value:
        if ch not in _B58_INDEX:
            raise WalletError("address contains a non-base58 character")
        number = number * 58 + _B58_INDEX[ch]
    # Preserve leading zero bytes encoded as '1'.
    leading = len(value) - len(value.lstrip("1"))
    body = number.to_bytes((number.bit_length() + 7) // 8, "big") if number else b""
    return b"\x00" * leading + body


def is_valid_address(address: str) -> bool:
    """True iff `address` is a base58 string decoding to exactly 32 bytes."""
    if not isinstance(address, str):
        return False
    candidate = address.strip()
    if not 32 <= len(candidate) <= 44:
        return False
    try:
        return len(_base58_decode(candidate)) == 32
    except WalletError:
        return False


def normalize(address: str) -> str:
    """Return the trimmed address. Base58 is case-sensitive, so never lower-case."""
    return (address or "").strip()


def validate(address: str) -> str:
    """Return the normalized address or raise WalletError."""
    normalized = normalize(address)
    if not is_valid_address(normalized):
        raise WalletError("not a valid Solana address: %r" % address)
    return normalized


class WalletService:
    """Stateless helper object; provided for interface parity with other services."""

    @staticmethod
    def is_valid_address(address: str) -> bool:
        return is_valid_address(address)

    @staticmethod
    def normalize(address: str) -> str:
        return normalize(address)

    @staticmethod
    def validate(address: str) -> str:
        normalized = normalize(address)
        if not is_valid_address(normalized):
            raise WalletError("not a valid Solana address: %r" % address)
        return normalized
