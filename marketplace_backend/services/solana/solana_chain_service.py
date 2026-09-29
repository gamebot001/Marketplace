"""SolanaChainService — read-only access to a Solana cluster.

Read-only by construction: this client exposes only JSON-RPC *read* methods.
It never signs, never holds keys, and never broadcasts a transaction. Refuses
mainnet networks at the settings layer.

The chain is a source of truth we verify, not trust: anything this service
returns is treated as an observation to be recorded through the indexer, never
fabricated.
"""

import json
import urllib.request

from marketplace_backend.services.solana import wallet_service


class SolanaRpcError(RuntimeError):
    pass


class SolanaChainService:
    def __init__(self, rpc_url: str, network: str = "solana-devnet", timeout: int = 15) -> None:
        self.rpc_url = rpc_url
        self.network = network
        self.timeout = timeout

    @property
    def chain(self) -> str:
        return "solana"

    def is_configured(self) -> bool:
        return bool(self.rpc_url)

    def _call(self, method: str, params=None):
        if not self.rpc_url:
            raise SolanaRpcError("no Solana RPC URL configured for network %s" % self.network)
        payload = json.dumps(
            {"jsonrpc": "2.0", "id": "zecians", "method": method, "params": params or []}
        ).encode()
        request = urllib.request.Request(
            self.rpc_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            body = json.loads(response.read().decode())
        if body.get("error"):
            raise SolanaRpcError("%s failed: %s" % (method, body["error"]))
        return body.get("result")

    def get_health(self) -> str:
        return self._call("getHealth")

    def get_slot(self) -> int:
        return int(self._call("getSlot"))

    def get_account_info(self, address: str, encoding: str = "base64"):
        pubkey = wallet_service.validate(address)
        return self._call("getAccountInfo", [pubkey, {"encoding": encoding}])

    def get_signatures_for_address(self, address: str, limit: int = 25):
        """Recent signatures for an address (read-only observation feed)."""
        pubkey = wallet_service.validate(address)
        return self._call(
            "getSignaturesForAddress", [pubkey, {"limit": int(limit)}]
        )
