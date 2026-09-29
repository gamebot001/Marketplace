"""Ownership indexer: ingest chain events, keep deterministic state.

Idempotent: feeding the same batch twice changes nothing (replay
protection via processed keys persisted alongside the state). The chain
source is an interface — plugging the real ZSA testnet source happens in
the testnet phase; the indexer logic is complete and tested.
"""

class OwnershipIndexer:
    def __init__(self, state_store, chain_source=None) -> None:
        self.state_store = state_store
        self.chain_source = chain_source

    def ensure_state(self, nft_numbers: list) -> dict:
        from backend.services.ownership import ownership_state

        def mutate(data):
            if "ownership" not in data:
                data["ownership"] = ownership_state.create_initial_state(nft_numbers)
            data.setdefault("processed_keys", [])
            data.setdefault("cursor", {"last_height": 0})
            return data

        return self.state_store.update(mutate)

    def ingest(self, raw_events: list) -> dict:
        """Apply a batch of raw events. Returns a summary."""
        from backend.services.ownership import transfer_processor

        summary = {}

        def mutate(data):
            state = data["ownership"]
            processed = set(data.get("processed_keys", []))
            result = transfer_processor.process_into(state, raw_events, processed)
            data["processed_keys"] = sorted(processed)
            heights = [e.get("height") or 0 for e in raw_events]
            if heights:
                data["cursor"]["last_height"] = max(data["cursor"]["last_height"], max(heights))
            summary.update(result)
            return data

        self.state_store.update(mutate)
        return summary

    def state(self) -> dict:
        return self.state_store.get("ownership", {})

    def public_view(self) -> list:
        from backend.services.ownership import ownership_state

        return ownership_state.public_view(self.state())
