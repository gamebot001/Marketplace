"""Initialize ownership state for the demo Zecian #005.

Idempotent: safe to call on every backend startup.
"""

from backend.services.ownership import ownership_state
from backend.services.json_file_store import JsonFileStore


def ensure_demo_ownership(state_store: JsonFileStore, nft_numbers: list) -> dict:
    def mutate(data):
        if "ownership" not in data or not data["ownership"].get("assets"):
            data["ownership"] = ownership_state.create_initial_state(nft_numbers)
        else:
            existing = set(data["ownership"]["assets"].keys())
            missing = [str(n) for n in nft_numbers if str(n) not in existing]
            for key in missing:
                data["ownership"]["assets"][key] = {
                    "nft_number": int(key),
                    "custody": "project",
                    "known_holder": "project",
                    "knowledge_basis": "issuance_record",
                    "last_transfer": None,
                    "notes": [],
                }
        # Mark the seeded set as demo state so the API can state it plainly.
        for n in nft_numbers:
            asset = data["ownership"]["assets"].get(str(n))
            if asset is not None:
                notes = asset.setdefault("notes", [])
                if "demo_state" not in notes:
                    notes.append("demo_state")
        data.setdefault("processed_keys", [])
        data.setdefault("cursor", {"last_height": 0})
        return data

    return state_store.update(mutate)["ownership"]
