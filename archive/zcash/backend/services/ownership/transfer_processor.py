"""Normalize raw chain events into deterministic, deduplicated stream.

Rules:
  - ordering: by (height, txid, action_index) — deterministic
  - dedup:    by (txid, action_index) — first occurrence wins
  - conflict: same key with different payload → recorded as conflict, skipped

Event keys are strings "txid|action_index" so they serialize safely.
"""

def _key(event: dict) -> str:
    return "%s|%s" % (event["txid"], event["action_index"])


def normalize(raw_events: list) -> dict:
    ordered = sorted(raw_events, key=lambda e: (e.get("height") or 0, e["txid"], e["action_index"]))
    seen = {}
    events = []
    conflicts = []
    for event in ordered:
        key = _key(event)
        if key in seen:
            if seen[key] != event:
                conflicts.append({"key": list(key), "kept": seen[key], "dropped": event})
            continue
        seen[key] = event
        events.append(event)
    return {"events": events, "conflicts": conflicts}


def process_into(state: dict, raw_events: list, processed_keys: set) -> dict:
    """Apply new events to `state` in order; skip already-processed keys.

    Returns {"applied": n, "skipped": n, "conflicts": [...]}.
    `processed_keys` is mutated (replay protection).
    """
    from backend.services.ownership import ownership_state

    stream = normalize(raw_events)
    applied = skipped = 0
    for event in stream["events"]:
        key = _key(event)
        if key in processed_keys:
            skipped += 1
            continue
        ownership_state.apply_event(state, event)
        processed_keys.add(key)
        applied += 1
    return {"applied": applied, "skipped": skipped, "conflicts": stream["conflicts"]}