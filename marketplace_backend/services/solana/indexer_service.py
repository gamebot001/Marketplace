"""IndexerService — idempotent ingestion of observed Solana events.

Feeds on real observations only (e.g. signatures returned by the read-only
SolanaChainService). Every event is deduplicated by transaction signature, so
re-processing a batch changes nothing. It never fabricates activity: with no
observed events, the activity feed is empty.
"""

import time


class IndexerError(ValueError):
    pass


class IndexerService:
    def __init__(self, store, chain_service=None) -> None:
        self.store = store
        self.chain_service = chain_service

    def ensure_state(self) -> dict:
        def mutate(data):
            data.setdefault("processed_signatures", [])
            data.setdefault("activity_events", [])
            data.setdefault("cursor", {"last_slot": 0})
            return data

        return self.store.update(mutate)

    def ingest(self, events: list) -> dict:
        """Ingest normalized events. Returns an applied/skipped summary."""
        applied = skipped = 0
        seen = []

        def mutate(data):
            nonlocal applied, skipped
            processed = set(data.get("processed_signatures", []))
            activity = data.setdefault("activity_events", [])
            cursor = data.setdefault("cursor", {"last_slot": 0})
            for event in events:
                signature = event.get("signature")
                if not signature:
                    raise IndexerError("indexed event requires a signature")
                if signature in processed:
                    skipped += 1
                    continue
                slot = int(event.get("slot") or 0)
                record = {
                    "signature": signature,
                    "slot": slot,
                    "block_time": event.get("block_time"),
                    "type": event.get("type", "unknown"),
                    "asset_address": event.get("asset_address"),
                    "collection_address": event.get("collection_address"),
                    "from_address": event.get("from_address"),
                    "to_address": event.get("to_address"),
                    "seller_address": event.get("seller_address"),
                    "buyer_address": event.get("buyer_address"),
                    "lamports": event.get("lamports"),
                    "now": event.get("now", int(time.time())),
                }
                activity.append(record)
                processed.add(signature)
                seen.append(signature)
                cursor["last_slot"] = max(cursor["last_slot"], slot)
                applied += 1
            data["processed_signatures"] = sorted(processed)
            return data

        self.store.update(mutate)
        return {"applied": applied, "skipped": skipped, "signatures": seen}

    def cursor(self) -> dict:
        return self.store.get("cursor", {"last_slot": 0})

    def activity(self, limit: int = 50) -> list:
        events = list(self.store.get("activity_events", []))
        events.sort(
            key=lambda e: (e.get("slot") or 0, e.get("signature") or ""),
            reverse=True,
        )
        return events[:limit]

    def fetch_from_chain(self, address: str, limit: int = 25) -> dict:
        """Observe recent signatures for an address via the read-only RPC and
        ingest them as generic activity events (type='observed_signature')."""
        if self.chain_service is None:
            raise IndexerError("no chain service configured")
        signatures = self.chain_service.get_signatures_for_address(address, limit=limit) or []
        events = [
            {
                "signature": item.get("signature"),
                "slot": item.get("slot"),
                "block_time": item.get("blockTime"),
                "type": "observed_signature",
                "from_address": address,
            }
            for item in signatures
            if item.get("signature")
        ]
        return self.ingest(events)
