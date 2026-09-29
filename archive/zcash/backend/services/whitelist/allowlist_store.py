"""Whitelist/eligibility store. Infrastructure only; no criteria invented."""

from backend.services.json_file_store import JsonFileStore


def _empty() -> dict:
    return {"entries": {}, "phase": {"current": "closed", "opened_at": None, "closed_at": None}}


def ensure_initialized(store: JsonFileStore) -> dict:
    def mutate(data):
        if "entries" not in data:
            data["entries"] = {}
        if "phase" not in data:
            data["phase"] = {"current": "closed", "opened_at": None, "closed_at": None}
        return data
    return store.update(mutate)


def add_entry(store: JsonFileStore, address: str, notes: str = "",
              mint_limit: int = 1, now: int = 0) -> dict:
    address = (address or "").strip().lower()
    if not address:
        raise ValueError("address required")

    def mutate(data):
        data.setdefault("entries", {})
        data["entries"][address] = {
            "address": address,
            "status": "approved",
            "mint_limit": mint_limit,
            "mints_used": data["entries"].get(address, {}).get("mints_used", 0),
            "notes": notes,
            "added_at": now,
        }
        data.setdefault("events", []).append(
            {"event": "allowlist_entry_added", "address": address, "now": now}
        )
        return data
    return store.update(mutate)["entries"][address]


def remove_entry(store: JsonFileStore, address: str, now: int = 0) -> bool:
    address = (address or "").strip().lower()
    removed = {"v": False}

    def mutate(data):
        data.setdefault("entries", {})
        if address in data["entries"]:
            del data["entries"][address]
            removed["v"] = True
            data.setdefault("events", []).append(
                {"event": "allowlist_entry_removed", "address": address, "now": now}
            )
        return data
    store.update(mutate)
    return removed["v"]


def get_entry(store: JsonFileStore, address: str):
    address = (address or "").strip().lower()
    return store.get("entries", {}).get(address)


def list_entries(store: JsonFileStore) -> list:
    return list(store.get("entries", {}).values())


def set_phase(store: JsonFileStore, phase: str, now: int = 0) -> dict:
    if phase not in ("closed", "open", "paused"):
        raise ValueError("phase must be one of: closed, open, paused")

    def mutate(data):
        data.setdefault("phase", {})
        data["phase"]["current"] = phase
        if phase == "open":
            data["phase"]["opened_at"] = now
        if phase == "closed":
            data["phase"]["closed_at"] = now
        data.setdefault("events", []).append({"event": "allowlist_phase_changed", "phase": phase, "now": now})
        return data
    return store.update(mutate)["phase"]


def get_phase(store: JsonFileStore) -> dict:
    return store.get("phase", {"current": "closed"})


def increment_mints_used(store: JsonFileStore, address: str) -> dict:
    address = (address or "").strip().lower()

    def mutate(data):
        entry = data["entries"].get(address)
        if entry is None:
            raise KeyError("address not in allowlist")
        entry["mints_used"] = entry.get("mints_used", 0) + 1
        return data
    return store.update(mutate)["entries"][address]
