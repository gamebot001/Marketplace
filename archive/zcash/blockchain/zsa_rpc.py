"""Read-only JSON-RPC client for Zcash/ZSA nodes (stdlib only).

Used only for *read* methods (getblockchaininfo, getrawtransaction, …).
Signing/issuing is NOT done here and never will be from this client.
"""

import json
import urllib.request


class ZsaRpcError(RuntimeError):
    pass


class ReadOnlyNodeClient:
    def __init__(self, url: str, timeout: int = 15) -> None:
        self.url = url
        self.timeout = timeout

    def call(self, method: str, params: list = None):
        payload = json.dumps({"jsonrpc": "2.0", "id": "zecians", "method": method, "params": params or []}).encode()
        request = urllib.request.Request(
            self.url, data=payload, headers={"Content-Type": "application/json"}, method="POST"
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            body = json.loads(response.read().decode())
        if body.get("error"):
            raise ZsaRpcError("%s failed: %s" % (method, body["error"]))
        return body.get("result")

    def getblockchaininfo(self) -> dict:
        return self.call("getblockchaininfo")

    def getrawtransaction(self, txid: str, verbose: bool = False):
        return self.call("getrawtransaction", [txid, 1 if verbose else 0])
