"""CatalogService — read-model roll-ups for collection surfaces.

Everything here is derived from records the indexer/registry already stored.
Nothing is estimated or fabricated: if there are no listings or sales, the
floor is null and volume is zero, and the UI renders "—" / "0".

Owner counts are *beneficial* owner counts. An actively listed Core asset is
held in escrow by its listing PDA, so the asset's stored owner can be an escrow
account rather than a person. The beneficial owner is the active listing's
seller; a sold asset's beneficial owner is the buyer the indexer recorded; a
cancelled or unlisted asset's beneficial owner is the current owner. Listing
PDAs, the marketplace program and the treasury are never counted as owners.
"""

from marketplace_backend.services.solana import collection_registry
from marketplace_backend.services.solana import marketplace_service
from marketplace_backend.services.solana import models as m
from marketplace_backend.services.solana import nft_asset_service


# --- Activity presentation -------------------------------------------------
# The backend owns the final human-readable label for every indexed event type
# so that /activity, profile activity, notifications and future surfaces all
# show identical terminology. The frontend never maps raw types to labels.
ACTIVITY_LABELS = {
    "list": "Listed",
    "sale": "Sold",
    "cancel": "Cancelled",
    "transfer": "Transferred",
}


def activity_label(event_type) -> str:
    """Final UI label for an indexed activity event type."""
    if not event_type:
        return "Activity"
    key = str(event_type).strip().lower()
    if key in ACTIVITY_LABELS:
        return ACTIVITY_LABELS[key]
    # Unknown types are not invented into a marketplace meaning; they are
    # surfaced verbatim in title case.
    return key.replace("_", " ").replace("-", " ").title()


def activity_view(event: dict) -> dict:
    """An indexed activity record enriched with its final UI label."""
    enriched = dict(event)
    enriched["label"] = activity_label(event.get("type"))
    return enriched


def collection_assets(asset_store, collection_address):
    if not collection_address:
        return []
    return nft_asset_service.list_assets(
        asset_store, collection_address=collection_address
    )


def _excluded_owner_accounts(marketplace_store) -> set:
    """Accounts that can hold an asset but are never human/collection owners.

    Listing PDAs (escrow), the marketplace program and the treasury are
    excluded. Real wallet addresses are never added to this set.
    """
    from marketplace_backend.app.settings import get_settings

    excluded = set()
    try:
        settings = get_settings()
    except Exception:  # pragma: no cover - settings only fail on mainnet misuse
        settings = None
    if settings is not None:
        if settings.marketplace_program_id:
            excluded.add(settings.marketplace_program_id)
        if settings.treasury_address:
            excluded.add(settings.treasury_address)
    for listing in marketplace_service.list_listings(marketplace_store):
        listing_id = listing.get("listing_id")
        if listing_id:
            excluded.add(listing_id)
    return excluded


def _beneficial_owner(asset, active_by_asset, sold_buyer_by_asset, excluded):
    """Resolve the human owner of an asset, honouring escrow semantics."""
    address = asset.get("asset_address")
    owner = asset.get("owner_address")
    active = active_by_asset.get(address)
    if active and active.get("seller_address"):
        # Escrow: the seller is the beneficial owner while a listing is live.
        owner = active["seller_address"]
    elif (not owner or owner in excluded) and sold_buyer_by_asset.get(address):
        # Settled: the buyer recorded by the indexer is the current owner.
        owner = sold_buyer_by_asset[address]
    if not owner or owner in excluded:
        return None
    return owner


def collection_stats(asset_store, marketplace_store, collection_address) -> dict:
    """Real market roll-up for one collection address."""
    assets = collection_assets(asset_store, collection_address)

    listings = []
    if collection_address:
        listings = [
            l
            for l in marketplace_service.list_listings(marketplace_store)
            if l.get("collection_address") == collection_address
        ]
    active = [l for l in listings if l.get("status") == m.LISTING_ACTIVE]
    sold = [l for l in listings if l.get("status") == m.LISTING_SOLD]

    active_by_asset = {}
    for listing in active:
        active_by_asset.setdefault(listing.get("asset_address"), listing)

    sales = []
    sold_buyer_by_asset = {}
    for listing in sold:
        sale = None
        if listing.get("sale_id"):
            sale = marketplace_service.get_sale(marketplace_store, listing["sale_id"])
        if sale:
            sales.append(sale)
            buyer = sale.get("buyer_address")
            if buyer:
                sold_buyer_by_asset[listing.get("asset_address")] = buyer

    excluded = _excluded_owner_accounts(marketplace_store)
    owners = set()
    for asset in assets:
        owner = _beneficial_owner(asset, active_by_asset, sold_buyer_by_asset, excluded)
        if owner:
            owners.add(owner)

    floor = min((int(l.get("price_lamports") or 0) for l in active), default=None)
    if floor == 0:
        floor = None

    volume = sum(int(s.get("price_lamports") or 0) for s in sales)

    return {
        "supply": len(assets),
        "owners": len(owners),
        "listed_count": len(active),
        "sales": len(sales),
        "floor_lamports": floor,
        "volume_lamports": volume,
        # 24h deltas are not tracked yet; null is honest ("—"), never invented.
        "floor_change_24h": None,
        "volume_change_24h": None,
        "sales_change_24h": None,
        "listed_change_24h": None,
    }


def collection_view(collection: dict, asset_store, marketplace_store) -> dict:
    """A registry collection enriched with derived stats for the API."""
    if not collection:
        return collection
    enriched = dict(collection)
    stats = collection_stats(
        asset_store, marketplace_store, collection.get("collection_address")
    )
    enriched["stats"] = stats
    # The top-level `owners` metric the directory reads, and the public
    # visibility decision (owned by the backend, never guessed by the UI).
    enriched["owners"] = stats["owners"]
    enriched["public_visible"] = collection_registry.is_publicly_visible(collection)
    return enriched
