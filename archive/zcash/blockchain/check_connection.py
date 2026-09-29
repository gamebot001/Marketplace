#!/usr/bin/env python3
"""Read-only connectivity check to the ZSA testnet node.

Safe: performs getblockchaininfo only. Touches no funds, sends nothing.

Usage: python blockchain/check_connection.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from blockchain.zsa_rpc import ReadOnlyNodeClient, ZsaRpcError  # noqa: E402

DEFAULT_URL = "https://dev.zebra.zsa-test.net"


def main() -> None:
    url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    client = ReadOnlyNodeClient(url)
    try:
        info = client.getblockchaininfo()
    except ZsaRpcError as exc:
        print("RPC reachable but returned an error:\n%s" % exc)
        sys.exit(2)
    except Exception as exc:  # noqa: BLE001
        print("UNREACHABLE: %s\n(The public ZSA testnet is community-run; try again later.)" % exc)
        sys.exit(1)
    print(json.dumps(info, indent=2)[:800])
    print("\nOK: node reachable (read-only).")


if __name__ == "__main__":
    main()
