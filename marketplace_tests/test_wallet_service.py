"""Solana address validation. Never handles keys."""

from marketplace_backend.services.solana import wallet_service
from marketplace_tests.conftest import b58_address


def test_known_valid_addresses():
    assert wallet_service.is_valid_address("11111111111111111111111111111111")
    assert wallet_service.is_valid_address("So11111111111111111111111111111111111111112")
    assert wallet_service.is_valid_address(b58_address(42))


def test_rejects_invalid_addresses():
    assert not wallet_service.is_valid_address("")
    assert not wallet_service.is_valid_address("not base58 0OIl")
    assert not wallet_service.is_valid_address("abc")
    assert not wallet_service.is_valid_address(None)


def test_normalize_trims_but_preserves_case():
    raw = "  So11111111111111111111111111111111111111112  "
    assert wallet_service.normalize(raw) == "So11111111111111111111111111111111111111112"
    assert wallet_service.normalize(raw) != "So11111111111111111111111111111111111111112".lower()


def test_validate_raises_on_invalid():
    import pytest

    with pytest.raises(wallet_service.WalletError):
        wallet_service.WalletService.validate("nope")
    assert wallet_service.WalletService.validate(b58_address(9)) == b58_address(9)
