"""Minimal, idempotent on-chain event processor (Phase 1).

Consumes the real Anchor events emitted by the `zecians_marketplace` program:

    ListingCreated, NftSold, ListingCancelled  (+ MarketplaceInitialized)

and updates the JsonFileStore read model. It only ever reacts to confirmed
transactions fetched from the cluster, so the read model can never claim a
listing/sale/cancel that did not happen on-chain.

Idempotency is per transaction signature: replaying the same chain history
changes nothing.
"""

import base64
import hashlib
import time

from marketplace_backend.services.solana import models as m
from marketplace_backend.services.solana import nft_asset_service
from marketplace_backend.services.solana import treasury_service
from marketplace_backend.services.solana import wallet_service

PROGRAM_DATA_PREFIX = "Program data: "

EVENT_NAMES = (
    "MarketplaceInitialized",
    "ListingCreated",
    "NftSold",
    "ListingCancelled",
)


def event_discriminator(name: str) -> bytes:
    return hashlib.sha256(("event:%s" % name).encode()).digest()[:8]


_DISCRIMINATORS = {event_discriminator(name): name for name in EVENT_NAMES}


def _pubkey(body: bytes, offset: int) -> str:
    return wallet_service.encode_base58(body[offset : offset + 32])


def decode_event_payload(name: str, body: bytes) -> dict:
    """Decode one Anchor event payload (Borsh, little-endian)."""
    if name == "ListingCreated":
        return {
            "marketplace": _pubkey(body, 0),
            "listing": _pubkey(body, 32),
            "asset": _pubkey(body, 64),
            "seller": _pubkey(body, 96),
            "price_lamports": int.from_bytes(body[128:136], "little"),
            "timestamp": int.from_bytes(body[136:144], "little", signed=True),
        }
    if name == "NftSold":
        return {
            "marketplace": _pubkey(body, 0),
            "listing": _pubkey(body, 32),
            "asset": _pubkey(body, 64),
            "seller": _pubkey(body, 96),
            "buyer": _pubkey(body, 128),
            "price_lamports": int.from_bytes(body[160:168], "little"),
            "fee_lamports": int.from_bytes(body[168:176], "little"),
            "seller_proceeds_lamports": int.from_bytes(body[176:184], "little"),
            "timestamp": int.from_bytes(body[184:192], "little", signed=True),
        }
    if name == "ListingCancelled":
        return {
            "marketplace": _pubkey(body, 0),
            "listing": _pubkey(body, 32),
            "asset": _pubkey(body, 64),
            "seller": _pubkey(body, 96),
            "timestamp": int.from_bytes(body[128:136], "little", signed=True),
        }
    if name == "MarketplaceInitialized":
        return {
            "marketplace": _pubkey(body, 0),
            "authority": _pubkey(body, 32),
            "treasury": _pubkey(body, 64),
            "marketplace_fee_bps": int.from_bytes(body[96:98], "little"),
            "timestamp": int.from_bytes(body[98:106], "little", signed=True),
        }
    return {}


def decode_events(logs) -> list:
    """Extract marketplace events from a transaction's log messages."""
    events = []
    for line in logs or []:
        if not line.startswith(PROGRAM_DATA_PREFIX):
            continue
        try:
            raw = base64.b64decode(line[len(PROGRAM_DATA_PREFIX) :].strip())
        except Exception:
            continue
        if len(raw) < 8:
            continue
        name = _DISCRIMINATORS.get(raw[:8])
        if name is None:
            continue
        try:
            events.append((name, decode_event_payload(name, raw[8:])))
        except Exception:
            continue
    return events


class MarketplaceEventIndexer:
    """Applies decoded marketplace events to the JSON read model."""

    def __init__(self, marketplace_store, asset_store, treasury_store, indexer_store):
        self.marketplace_store = marketplace_store
        self.asset_store = asset_store
        self.treasury_store = treasury_store
        self.indexer_store = indexer_store

    # --- idempotency map ---------------------------------------------------

    def _processed(self) -> set:
        return set(self.indexer_store.get("processed_marketplace_signatures", []))

    def _mark_processed(self, signature: str) -> None:
        def mutate(data):
            processed = set(data.get("processed_marketplace_signatures", []))
            processed.add(signature)
            data["processed_marketplace_signatures"] = sorted(processed)
            return data

        self.indexer_store.update(mutate)

    # --- activity (reuses the generic IndexerService shape) ---------------

    def _record_activity(self, record: dict) -> None:
        def mutate(data):
            processed = set(data.get("processed_signatures", []))
            if record["signature"] in processed:
                return data
            data.setdefault("activity_events", []).append(record)
            processed.add(record["signature"])
            data["processed_signatures"] = sorted(processed)
            return data

        self.indexer_store.update(mutate)

    # --- event application -------------------------------------------------

    def _asset_collection(self, asset_address: str):
        asset = nft_asset_service.get_asset(self.asset_store, asset_address)
        return (asset or {}).get("collection_address")

    def _apply_listing_created(self, payload: dict, signature, slot, block_time) -> None:
        listing_id = payload["listing"]
        asset_address = payload["asset"]
        now = payload["timestamp"] or int(time.time())

        def mutate(data):
            listings = data.setdefault("listings", {})
            listings[listing_id] = {
                "listing_id": listing_id,
                "asset_address": asset_address,
                "collection_address": self._asset_collection(asset_address),
                "seller_address": payload["seller"],
                "price_lamports": payload["price_lamports"],
                "currency": m.CURRENCY_SOL,
                "marketplace": m.MARKETPLACE_ID,
                "status": m.LISTING_ACTIVE,
                "created_at": now,
                "sale_id": None,
                "signature": signature,
                "slot": slot,
            }
            return data

        self.marketplace_store.update(mutate)
        self._record_activity(
            {
                "signature": signature,
                "slot": slot,
                "block_time": block_time,
                "type": "list",
                "asset_address": asset_address,
                "collection_address": self._asset_collection(asset_address),
                "from_address": payload["seller"],
                "to_address": None,
                "seller_address": payload["seller"],
                "buyer_address": None,
                "lamports": payload["price_lamports"],
                "now": now,
            }
        )

    def _apply_nft_sold(self, payload: dict, signature, slot, block_time) -> None:
        listing_id = payload["listing"]
        asset_address = payload["asset"]
        now = payload["timestamp"] or int(time.time())
        sale_id = "sale_%s" % signature[:16]

        def mutate(data):
            listings = data.setdefault("listings", {})
            listing = listings.get(listing_id) or {}
            listings[listing_id] = {
                **listing,
                "listing_id": listing_id,
                "asset_address": asset_address,
                "collection_address": listing.get("collection_address")
                or self._asset_collection(asset_address),
                "seller_address": payload["seller"],
                "price_lamports": payload["price_lamports"],
                "currency": m.CURRENCY_SOL,
                "marketplace": m.MARKETPLACE_ID,
                "status": m.LISTING_SOLD,
                "created_at": listing.get("created_at", now),
                "sale_id": sale_id,
                "signature": signature,
                "slot": slot,
            }
            data.setdefault("sales", {})[sale_id] = {
                "sale_id": sale_id,
                "listing_id": listing_id,
                "asset_address": asset_address,
                "collection_address": self._asset_collection(asset_address),
                "seller_address": payload["seller"],
                "buyer_address": payload["buyer"],
                "currency": m.CURRENCY_SOL,
                "signature": signature,
                "slot": slot,
                "block_time": block_time,
                "fee_lamports": payload["fee_lamports"],
                "royalty_lamports": 0,
                "seller_proceeds_lamports": payload["seller_proceeds_lamports"],
                "price_lamports": payload["price_lamports"],
                "status": m.SALE_CONFIRMED,
                "created_at": now,
            }
            return data

        self.marketplace_store.update(mutate)

        try:
            nft_asset_service.set_owner(
                self.asset_store,
                asset_address,
                payload["buyer"],
                now,
                signature=signature,
                slot=slot,
            )
        except nft_asset_service.AssetError:
            pass

        if payload["fee_lamports"] > 0:
            treasury_service.record_event(
                self.treasury_store,
                m.TREASURY_MARKETPLACE_FEE,
                payload["fee_lamports"],
                now=now,
                signature=signature,
                slot=slot,
                block_time=block_time,
                ref=sale_id,
            )

        self._record_activity(
            {
                "signature": signature,
                "slot": slot,
                "block_time": block_time,
                "type": "sale",
                "asset_address": asset_address,
                "collection_address": self._asset_collection(asset_address),
                "from_address": payload["seller"],
                "to_address": payload["buyer"],
                "seller_address": payload["seller"],
                "buyer_address": payload["buyer"],
                "lamports": payload["price_lamports"],
                "now": now,
            }
        )

    def _apply_listing_cancelled(self, payload: dict, signature, slot, block_time) -> None:
        listing_id = payload["listing"]
        asset_address = payload["asset"]
        now = payload["timestamp"] or int(time.time())

        def mutate(data):
            listings = data.setdefault("listings", {})
            listing = listings.get(listing_id)
            if listing is None:
                listing = {
                    "listing_id": listing_id,
                    "asset_address": asset_address,
                    "collection_address": self._asset_collection(asset_address),
                    "seller_address": payload["seller"],
                    "price_lamports": 0,
                    "currency": m.CURRENCY_SOL,
                    "marketplace": m.MARKETPLACE_ID,
                    "created_at": now,
                    "sale_id": None,
                }
            listing["status"] = m.LISTING_CANCELLED
            listing["signature"] = signature
            listing["slot"] = slot
            listings[listing_id] = listing
            return data

        self.marketplace_store.update(mutate)

        try:
            nft_asset_service.set_owner(
                self.asset_store,
                asset_address,
                payload["seller"],
                now,
                signature=signature,
                slot=slot,
            )
        except nft_asset_service.AssetError:
            pass

        self._record_activity(
            {
                "signature": signature,
                "slot": slot,
                "block_time": block_time,
                "type": "cancel",
                "asset_address": asset_address,
                "collection_address": self._asset_collection(asset_address),
                "from_address": payload["seller"],
                "to_address": payload["seller"],
                "seller_address": payload["seller"],
                "buyer_address": None,
                "lamports": None,
                "now": now,
            }
        )

    def apply_transaction(self, signature, slot, block_time, logs) -> int:
        if signature in self._processed():
            return 0
        applied = 0
        for name, payload in decode_events(logs):
            if name == "ListingCreated":
                self._apply_listing_created(payload, signature, slot, block_time)
                applied += 1
            elif name == "NftSold":
                self._apply_nft_sold(payload, signature, slot, block_time)
                applied += 1
            elif name == "ListingCancelled":
                self._apply_listing_cancelled(payload, signature, slot, block_time)
                applied += 1
        # Mark processed even when the tx carried no marketplace event so it is
        # never fetched again; only marketplace events mutate the read model.
        self._mark_processed(signature)
        return applied

    def poll(self, chain_service, program_id: str, limit: int = 50) -> dict:
        """Fetch recent program transactions and apply any new events."""
        signatures = (
            chain_service.get_signatures_for_address(program_id, limit=limit) or []
        )
        applied = skipped = fetched = 0
        # Oldest first so a listing exists before its sale is applied.
        for item in reversed(signatures):
            signature = item.get("signature")
            if not signature:
                continue
            if signature in self._processed():
                skipped += 1
                continue
            try:
                transaction = chain_service.get_transaction(signature)
            except Exception:
                # A single flaky RPC fetch must not abort the whole poll.
                continue
            if not transaction:
                continue
            fetched += 1
            meta = transaction.get("meta") or {}
            try:
                applied += self.apply_transaction(
                    signature,
                    transaction.get("slot"),
                    transaction.get("blockTime"),
                    meta.get("logMessages"),
                )
            except Exception:
                continue
        return {
            "scanned": len(signatures),
            "fetched": fetched,
            "applied": applied,
            "skipped": skipped,
        }
