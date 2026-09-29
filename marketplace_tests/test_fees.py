"""Fee/royalty split: integer-only lamport math with exact conservation."""

import pytest

from marketplace_backend.services.solana import fees


def test_bps_of_is_integer_floor():
    assert fees.bps_of(1_000_000_000, 250) == 25_000_000  # 2.5%
    assert fees.bps_of(1, 250) == 0  # floors, never a float
    assert fees.bps_of(3, 3333) == 0


def test_split_sale_conservation():
    split = fees.split_sale(price_lamports=1_000_000_000, fee_bps=250, royalty_bps=500)
    assert split["fee_lamports"] == 25_000_000
    assert split["royalty_lamports"] == 50_000_000
    assert split["seller_proceeds_lamports"] == 925_000_000
    assert (
        split["fee_lamports"]
        + split["royalty_lamports"]
        + split["seller_proceeds_lamports"]
        == split["price_lamports"]
    )


def test_split_sale_zero_fees_is_disabled():
    split = fees.split_sale(1_234_567, fee_bps=0, royalty_bps=0)
    assert split["fee_lamports"] == 0
    assert split["royalty_lamports"] == 0
    assert split["seller_proceeds_lamports"] == 1_234_567


def test_split_sale_rejects_impossible_fees():
    with pytest.raises(ValueError):
        fees.split_sale(1_000, fee_bps=6000, royalty_bps=6000)


def test_money_math_never_returns_float():
    split = fees.split_sale(7, fee_bps=1234, royalty_bps=567)
    for key in ("fee_lamports", "royalty_lamports", "seller_proceeds_lamports"):
        assert isinstance(split[key], int)
