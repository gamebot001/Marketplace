#!/usr/bin/env python3
"""Verify a ZSA issuance transaction contains our assetDescHash.

Best-effort, experimental: fetches the raw transaction from the configured
(read-only) node and searches its hex for the 32-byte asset description
hash. Works regardless of whether the node decodes v6 issuance fields.

Usage:
  python blockchain/verify_issuance.py --txid <hex> --desc "zsc1|zecians-genesis|001"
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from blockchain.asset_identity import asset_desc_hash  # noqa: E402
from blockchain.zsa_rpc import ReadOnlyNodeClient  # noqa: E402

DEFAULT_URL = "https://dev.zebra.zsa-test.net"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--txid", required=True)
    parser.add_argument("--desc", required=True, help="asset description, e.g. zsc1|zecians-genesis|001")
    parser.add_argument("--url", default=DEFAULT_URL)
    args = parser.parse_args()

    expected = bytes.fromhex(asset_desc_hash(args.desc))
    client = ReadOnlyNodeClient(args.url)
    try:
        raw = client.getrawtransaction(args.txid)
    except Exception as exc:  # noqa: BLE001
        print("could not fetch transaction: %s" % exc)
        sys.exit(2)

    tx_hex = raw["hex"] if isinstance(raw, dict) else raw
    found = expected.hex() in tx_hex.lower()
    print("asset_desc     : %s" % args.desc)
    print("assetDescHash  : %s" % expected.hex())
    print("txid           : %s" % args.txid)
    print("hash present   : %s" % found)
    sys.exit(0 if found else 1)


if __name__ == "__main__":
    main()
