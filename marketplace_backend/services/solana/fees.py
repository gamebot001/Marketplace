"""Integer-lamport fee model.

All money is integer lamports (1 SOL = 1,000,000,000 lamports). Floating
point never touches money.

Marketplace settlement:

    buyer pays price
      ├── creator royalty   (royalty_bps  of price)
      ├── Zecians fee       (fee_bps      of price)  → Zecians Treasury
      └── seller proceeds   (remainder)

Percentages are basis points (1 bps = 0.01%). They live in configuration so
changing a fee never requires rewriting marketplace logic.
"""

BPS_DENOMINATOR = 10_000


def bps_of(lamports: int, bps: int) -> int:
    """Floor of `lamports * bps / 10000`, using integer math only."""
    if not isinstance(lamports, int) or isinstance(lamports, bool):
        raise TypeError("lamports must be an int")
    if not isinstance(bps, int) or isinstance(bps, bool):
        raise TypeError("bps must be an int")
    if lamports < 0:
        raise ValueError("lamports must be non-negative")
    if bps < 0:
        raise ValueError("bps must be non-negative")
    return (lamports * bps) // BPS_DENOMINATOR


def split_sale(price_lamports: int, fee_bps: int, royalty_bps: int) -> dict:
    """Split a sale price into (fee, royalty, seller proceeds).

    Guarantees exact conservation: fee + royalty + seller == price.
    """
    if not isinstance(price_lamports, int) or isinstance(price_lamports, bool):
        raise TypeError("price_lamports must be an int")
    if price_lamports <= 0:
        raise ValueError("price_lamports must be positive")
    if fee_bps < 0 or royalty_bps < 0:
        raise ValueError("fee_bps and royalty_bps must be non-negative")
    if fee_bps + royalty_bps > BPS_DENOMINATOR:
        raise ValueError(
            "fee_bps + royalty_bps must be <= %d (got %d)"
            % (BPS_DENOMINATOR, fee_bps + royalty_bps)
        )

    fee = bps_of(price_lamports, fee_bps)
    royalty = bps_of(price_lamports, royalty_bps)
    seller = price_lamports - fee - royalty
    assert fee + royalty + seller == price_lamports  # conservation, by construction
    return {
        "price_lamports": price_lamports,
        "fee_bps": fee_bps,
        "royalty_bps": royalty_bps,
        "fee_lamports": fee,
        "royalty_lamports": royalty,
        "seller_proceeds_lamports": seller,
    }
