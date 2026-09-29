"""MarketplaceService — generic, multi-collection listings and settlement.

A listing references an *asset address*, not a Zecian number, so the same
logic serves the Zecians collection and any verified project.

    Collection-agnostic:  listings[asset_address]
    Seller-controlled:    only the asset owner may list; only the seller cancels
    One live listing:     at most one active listing per asset
    Idempotent sales:     a sale signature is recorded at most once

Settlement (integer lamports):

    buyer pays price
      ├── creator royalty  → creator
      ├── Zecians fee      → TreasuryService
      └── seller proceeds
"""

import secrets

from marketplace_backend.services.solana import fees
from marketplace_backend.services.solana import models as m
from marketplace_backend.services.solana import nft_asset_service
from marketplace_backend.services.solana import treasury_service
from marketplace_backend.services.solana import wallet_service


class MarketplaceError(Exception):
    pass


class ListingNotAvailable(MarketplaceError):
    pass


class NotAuthorized(MarketplaceError):
    pass


def _new_id(prefix: str) -> str:
    return "%s_%s" % (prefix, secrets.token_hex(6))


def create_listing(store, asset_address: str, seller_address: str, price_lamports: int,
                   now: int, collection_address: str = None, currency: str = m.CURRENCY_SOL,
                   marketplace: str = m.MARKETPLACE_ID, asset_store=None) -> dict:
    seller_address = wallet_service.validate(seller_address)
    asset_address = wallet_service.validate(asset_address)
    if not isinstance(price_lamports, int) or isinstance(price_lamports, bool):
        raise TypeError("price_lamports must be an int")
    if price_lamports <= 0:
        raise MarketplaceError("price_lamports must be positive")

    if asset_store is not None:
        asset = nft_asset_service.assert_owned_by(asset_store, asset_address, seller_address)
        collection_address = collection_address or asset.get("collection_address")

    if not collection_address:
        raise MarketplaceError("collection_address is required")
    if not wallet_service.is_valid_address(collection_address):
        raise MarketplaceError("invalid collection_address: %r" % collection_address)

    created = {}

    def mutate(data):
        listings = data.setdefault("listings", {})
        for existing in listings.values():
            if existing["asset_address"] == asset_address and existing["status"] == m.LISTING_ACTIVE:
                raise ListingNotAvailable(
                    "asset %s already has a live listing %s"
                    % (asset_address, existing["listing_id"])
                )
        listing_id = _new_id("lst")
        listings[listing_id] = {
            "listing_id": listing_id,
            "asset_address": asset_address,
            "collection_address": collection_address,
            "seller_address": seller_address,
            "price_lamports": price_lamports,
            "currency": currency,
            "marketplace": marketplace,
            "status": m.LISTING_ACTIVE,
            "created_at": now,
            "sale_id": None,
        }
        data.setdefault("events", []).append({
            "event": "listing_created",
            "listing_id": listing_id,
            "asset_address": asset_address,
            "now": now,
        })
        created["listing"] = listings[listing_id]
        return data

    store.update(mutate)
    return created["listing"]


def cancel_listing(store, listing_id: str, by_address: str, now: int) -> dict:
    by_address = wallet_service.normalize(by_address)

    def mutate(data):
        listing = data.get("listings", {}).get(listing_id)
        if listing is None:
            raise KeyError("unknown listing %s" % listing_id)
        if listing["status"] != m.LISTING_ACTIVE:
            raise MarketplaceError(
                "listing %s is %s, not cancellable" % (listing_id, listing["status"])
            )
        if listing["seller_address"] != by_address:
            raise NotAuthorized("only the seller can cancel a listing")
        listing["status"] = m.LISTING_CANCELLED
        data.setdefault("events", []).append({
            "event": "listing_cancelled", "listing_id": listing_id, "now": now,
        })
        return data

    return store.update(mutate)["listings"][listing_id]


def record_sale(store, listing_id: str, buyer_address: str, price_lamports: int,
                signature: str, now: int, fee_bps: int = 0, royalty_bps: int = None,
                slot: int = None, block_time: int = None,
                asset_store=None, treasury_store=None, accounting_store=None) -> dict:
    """Settle a sale that was observed on-chain.

    `signature` is the real Solana transaction signature. The same signature
    is only ever settled once (idempotency / replay protection).
    """
    buyer_address = wallet_service.validate(buyer_address)
    if not signature:
        raise MarketplaceError("a real on-chain signature is required to record a sale")

    # Fast path: idempotent replay.
    for existing in store.get("sales", {}).values():
        if existing.get("signature") == signature:
            return existing

    settled = {}

    def mutate(data):
        sales = data.setdefault("sales", {})
        for existing in sales.values():
            if existing.get("signature") == signature:
                settled["sale"] = existing
                return data

        listing = data.get("listings", {}).get(listing_id)
        if listing is None:
            raise KeyError("unknown listing %s" % listing_id)
        if listing["status"] != m.LISTING_ACTIVE:
            raise ListingNotAvailable(
                "listing %s is %s, not sellable" % (listing_id, listing["status"])
            )
        if buyer_address == listing["seller_address"]:
            raise MarketplaceError("buyer and seller must differ")
        if int(price_lamports) != int(listing["price_lamports"]):
            raise MarketplaceError(
                "observed price %s does not match listing price %s"
                % (price_lamports, listing["price_lamports"])
            )

        resolved_royalty_bps = royalty_bps
        if resolved_royalty_bps is None:
            resolved_royalty_bps = 0
            if asset_store is not None:
                asset = nft_asset_service.get_asset(asset_store, listing["asset_address"])
                if asset is not None:
                    resolved_royalty_bps = int(asset.get("royalty_bps") or 0)

        split = fees.split_sale(int(price_lamports), int(fee_bps), int(resolved_royalty_bps))
        sale_id = _new_id("sale")
        sale = {
            "sale_id": sale_id,
            "listing_id": listing_id,
            "asset_address": listing["asset_address"],
            "collection_address": listing["collection_address"],
            "seller_address": listing["seller_address"],
            "buyer_address": buyer_address,
            "currency": listing["currency"],
            "signature": signature,
            "slot": slot,
            "block_time": block_time,
            "fee_bps": split["fee_bps"],
            "royalty_bps": split["royalty_bps"],
            "fee_lamports": split["fee_lamports"],
            "royalty_lamports": split["royalty_lamports"],
            "seller_proceeds_lamports": split["seller_proceeds_lamports"],
            "price_lamports": split["price_lamports"],
            "status": m.SALE_CONFIRMED,
            "created_at": now,
        }
        sales[sale_id] = sale
        listing["status"] = m.LISTING_SOLD
        listing["sale_id"] = sale_id

        data.setdefault("royalties", []).append({
            "sale_id": sale_id,
            "asset_address": listing["asset_address"],
            "creator_address": (nft_asset_service.get_asset(asset_store, listing["asset_address"]) or {}).get("creator_address")
            if asset_store is not None else None,
            "lamports": split["royalty_lamports"],
            "signature": signature,
            "now": now,
        })
        data.setdefault("events", []).append({
            "event": "sale_recorded",
            "sale_id": sale_id,
            "listing_id": listing_id,
            "asset_address": listing["asset_address"],
            "signature": signature,
            "now": now,
        })
        settled["sale"] = sale
        return data

    store.update(mutate)
    sale = settled["sale"]

    # Side effects are best-effort and idempotent; the sale itself is recorded.
    if asset_store is not None:
        try:
            nft_asset_service.set_owner(
                asset_store, sale["asset_address"], buyer_address, now,
                signature=signature, slot=slot,
            )
        except nft_asset_service.AssetError:
            pass

    if treasury_store is not None and sale["fee_lamports"] > 0:
        treasury_service.record_event(
            treasury_store, m.TREASURY_MARKETPLACE_FEE, sale["fee_lamports"],
            now=now, signature=signature, slot=slot, block_time=block_time,
            ref=sale["sale_id"],
        )

    if accounting_store is not None:
        from marketplace_backend.services.solana import accounting

        accounting.record_participation(
            accounting_store, buyer_address, m.PARTICIPATION_MARKETPLACE_BUY,
            sale["price_lamports"], ref=sale["sale_id"], now=now,
        )
        accounting.record_participation(
            accounting_store, sale["seller_address"], m.PARTICIPATION_MARKETPLACE_SELL,
            sale["price_lamports"], ref=sale["sale_id"], now=now,
        )
        if sale["fee_lamports"] > 0:
            accounting.record_participation(
                accounting_store, "treasury", m.PARTICIPATION_TREASURY_FEE,
                sale["fee_lamports"], ref=sale["sale_id"], now=now,
            )

    return sale


def get_listing(store, listing_id: str):
    return store.get("listings", {}).get(listing_id)


def get_sale(store, sale_id: str):
    return store.get("sales", {}).get(sale_id)


def list_listings(store, status: str = None) -> list:
    listings = list(store.get("listings", {}).values())
    if status is not None:
        listings = [l for l in listings if l["status"] == status]
    return sorted(listings, key=lambda l: (l.get("created_at") or 0, l["listing_id"]), reverse=True)


def active_listings(store) -> list:
    return list_listings(store, status=m.LISTING_ACTIVE)


def list_sales(store) -> list:
    sales = list(store.get("sales", {}).values())
    return sorted(sales, key=lambda s: (s.get("created_at") or 0, s["sale_id"]), reverse=True)
