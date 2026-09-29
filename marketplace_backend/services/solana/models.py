"""Shared constants and validation for the Solana marketplace data model.

The model is intentionally generic: a marketplace listing references an
`asset_address` and a `collection_address`, never "Zecians". Zecians is one
collection among many.
"""

# --- NFT standards ---------------------------------------------------------
# Metaplex Core is the PRIMARY supported standard for the first implementation.
# Metaplex is infrastructure; it is NOT the Zecians marketplace.
STANDARD_METAPLEX_CORE = "metaplex-core"
SUPPORTED_STANDARDS = (STANDARD_METAPLEX_CORE,)

# --- Verification statuses -------------------------------------------------
VERIFICATION_PENDING = "pending"
VERIFICATION_VERIFIED = "verified"
VERIFICATION_REJECTED = "rejected"
VERIFICATION_SUSPENDED = "suspended"
VERIFICATION_STATUSES = (
    VERIFICATION_PENDING,
    VERIFICATION_VERIFIED,
    VERIFICATION_REJECTED,
    VERIFICATION_SUSPENDED,
)

# --- Marketplace status ----------------------------------------------------
MARKETPLACE_STATUS_PENDING = "pending"
MARKETPLACE_STATUS_ACTIVE = "active"
MARKETPLACE_STATUS_SUSPENDED = "suspended"
MARKETPLACE_STATUSES = (
    MARKETPLACE_STATUS_PENDING,
    MARKETPLACE_STATUS_ACTIVE,
    MARKETPLACE_STATUS_SUSPENDED,
)

# --- Listing statuses ------------------------------------------------------
LISTING_ACTIVE = "active"
LISTING_SOLD = "sold"
LISTING_CANCELLED = "cancelled"
LISTING_EXPIRED = "expired"
LISTING_STATUSES = (LISTING_ACTIVE, LISTING_SOLD, LISTING_CANCELLED, LISTING_EXPIRED)

# --- Sale statuses ---------------------------------------------------------
SALE_CONFIRMED = "confirmed"
SALE_STATUSES = (SALE_CONFIRMED,)

# --- Treasury event kinds --------------------------------------------------
TREASURY_MARKETPLACE_FEE = "marketplace_fee"
TREASURY_MINT_PROCEEDS = "mint_proceeds"
TREASURY_EVENT_KINDS = (TREASURY_MARKETPLACE_FEE, TREASURY_MINT_PROCEEDS)

# --- Participation kinds (future-compatible accounting only) ---------------
PARTICIPATION_MARKETPLACE_BUY = "marketplace_buy"
PARTICIPATION_MARKETPLACE_SELL = "marketplace_sell"
PARTICIPATION_MINT = "mint"
PARTICIPATION_CREATOR = "creator"
PARTICIPATION_VERIFIED_ACTIVITY = "verified_activity"
PARTICIPATION_TREASURY_FEE = "treasury_fee"
PARTICIPATION_KINDS = (
    PARTICIPATION_MARKETPLACE_BUY,
    PARTICIPATION_MARKETPLACE_SELL,
    PARTICIPATION_MINT,
    PARTICIPATION_CREATOR,
    PARTICIPATION_VERIFIED_ACTIVITY,
    PARTICIPATION_TREASURY_FEE,
)

# --- Default currency ------------------------------------------------------
CURRENCY_SOL = "SOL"
MARKETPLACE_ID = "zecians"


class ModelError(ValueError):
    """Raised when a record violates the generic asset/marketplace model."""


def require_fields(record: dict, fields, kind: str) -> None:
    """Raise ModelError if any required field is missing/empty."""
    missing = [f for f in fields if record.get(f) in (None, "")]
    if missing:
        raise ModelError("%s is missing required field(s): %s" % (kind, ", ".join(missing)))
