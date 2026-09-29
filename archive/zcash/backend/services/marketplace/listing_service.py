"""Listing state machine: list / cancel / expire.

Listing states: active → payment_pending (a sale started) → sold
             active → cancelled / expired

Guards:
  - at most one live listing per NFT (active or payment_pending)
  - only the seller can cancel, and only while active
  - optional ownership check: seller must plausibly control the asset
"""

STATUS_ACTIVE = "active"
STATUS_PAYMENT_PENDING = "payment_pending"
STATUS_SOLD = "sold"
STATUS_CANCELLED = "cancelled"
STATUS_EXPIRED = "expired"


class ListingError(Exception):
    pass


class ListingNotAvailable(ListingError):
    pass


class NotAuthorized(ListingError):
    pass


def create_listing(store, nft_number: int, seller_ref: str, price_zat: int,
                   now: int, ownership_store=None) -> dict:
    if price_zat <= 0:
        raise ValueError("price_zat must be positive (integer zatoshi)")

    created = {}

    def mutate(data):
        listings = data.setdefault("listings", {})
        for existing in listings.values():
            if existing["nft_number"] == nft_number and existing["status"] in (STATUS_ACTIVE, STATUS_PAYMENT_PENDING):
                raise ListingNotAvailable("nft %s already has a live listing %s" % (nft_number, existing["listing_id"]))
        if ownership_store is not None:
            state = ownership_store.get("ownership", {})
            asset = (state.get("assets") or {}).get(str(nft_number))
            if asset is None:
                raise ListingError("no ownership record for nft %s" % nft_number)
            holder_ok = asset["custody"] in ("project", "transparent_holder") and asset.get("known_holder") == seller_ref
            if not holder_ok:
                raise NotAuthorized("seller %s does not control nft %s (custody=%s)" % (seller_ref, nft_number, asset["custody"]))
        listing_id = "lst_%06d" % (len(listings) + 1)
        listings[listing_id] = {
            "listing_id": listing_id,
            "nft_number": nft_number,
            "seller_ref": seller_ref,
            "price_zat": price_zat,
            "status": STATUS_ACTIVE,
            "created_at": now,
            "sale_id": None,
        }
        data.setdefault("events", []).append({"event": "listing_created", "listing_id": listing_id, "nft_number": nft_number, "now": now})
        created["listing"] = listings[listing_id]
        return data

    store.update(mutate)
    return created["listing"]


def cancel_listing(store, listing_id: str, by_ref: str, now: int) -> dict:
    def mutate(data):
        listing = data["listings"][listing_id]
        if listing["status"] != STATUS_ACTIVE:
            raise ListingError("listing %s is %s, not cancellable" % (listing_id, listing["status"]))
        if listing["seller_ref"] != by_ref:
            raise NotAuthorized("only the seller can cancel")
        listing["status"] = STATUS_CANCELLED
        data.setdefault("events", []).append({"event": "listing_cancelled", "listing_id": listing_id, "now": now})
        return data

    return store.update(mutate)["listings"][listing_id]


def _transition(store, listing_id: str, new_status: str, event: str, now: int, extra: dict = None) -> dict:
    def mutate(data):
        listing = data["listings"][listing_id]
        listing["status"] = new_status
        if extra:
            listing.update(extra)
        data.setdefault("events", []).append({"event": event, "listing_id": listing_id, "now": now})
        return data

    return store.update(mutate)["listings"][listing_id]


def get_listing(store, listing_id: str):
    return store.get("listings", {}).get(listing_id)


def active_listings(store) -> list:
    return [l for l in store.get("listings", {}).values() if l["status"] == STATUS_ACTIVE]
