"""Shared pytest fixtures. No test touches the network or real money."""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

_B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def b58_address(n: int) -> str:
    """Deterministic, valid 32-byte base58 Solana address for tests.

    Only used to build fixtures; it is not a real keypair (no signing happens
    anywhere in the tests).
    """
    raw = int(n).to_bytes(32, "big")
    num = int.from_bytes(raw, "big")
    out = ""
    while num > 0:
        num, rem = divmod(num, 58)
        out = _B58_ALPHABET[rem] + out
    leading = len(raw) - len(raw.lstrip(b"\x00"))
    return "1" * leading + out


@pytest.fixture
def store(tmp_path, request):
    from marketplace_backend.services.json_file_store import JsonFileStore

    name = getattr(request, "param", "store")
    return JsonFileStore(tmp_path / ("%s.json" % name))


@pytest.fixture
def addr():
    return b58_address
