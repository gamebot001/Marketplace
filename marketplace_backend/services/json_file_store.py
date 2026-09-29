"""Tiny JSON-file store used while the project runs without PostgreSQL.

WHY: every service is a pure state machine over a *store interface*. This
file-backed dict is that interface for the prototype; the database phase
replaces it with PostgreSQL while the state machines stay untouched.

Not for production: no real transactions, single-process locking only.
"""

import json
import os
import threading
from pathlib import Path


class JsonFileStore:
    def __init__(self, path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        if not self.path.exists():
            self._atomic_write({})

    def _atomic_write(self, data: dict) -> None:
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(data, indent=1, sort_keys=True))
        os.replace(tmp, self.path)

    def _load(self) -> dict:
        return json.loads(self.path.read_text())

    def all(self) -> dict:
        with self._lock:
            return self._load()

    def get(self, key: str, default=None):
        with self._lock:
            return self._load().get(key, default)

    def put(self, key: str, value) -> None:
        with self._lock:
            data = self._load()
            data[key] = value
            self._atomic_write(data)

    def update(self, fn) -> dict:
        """Atomic read-modify-write: fn(data_dict) -> data_dict."""
        with self._lock:
            data = self._load()
            data = fn(data)
            self._atomic_write(data)
            return data
