#!/usr/bin/env python3
"""Zecians issuance workflow — PLAN ONLY in this phase.

What this tool does today (safe):
  - builds the exact ZIP 227 issuance plan for Zecian #001–#010:
    asset descriptions, assetDescHashes, value=1, finalize=1
  - prints the plan as JSON (--dry-run, the default)

What it refuses to do (by design, with loud errors):
  - sign or broadcast anything (requires the ZSA node/wallet toolchain,
    which is set up in the testnet phase — see blockchain/README.md)
  - touch mainnet under ANY circumstances

Usage:
  python blockchain/issue_asset.py                     # plan for all 10
  python blockchain/issue_asset.py --nft 1             # plan for #001 only
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from blockchain.asset_identity import asset_desc_hash, zecians_asset_desc  # noqa: E402

CONFIG = json.loads((ROOT / "collection" / "traits" / "trait_config.json").read_text())


class IssuanceNotConfigured(RuntimeError):
    """Raised when someone asks to actually sign/broadcast."""


def build_issuance_plan(nft_numbers: list, network: str) -> dict:
    if network == "mainnet":
        raise IssuanceNotConfigured(
            "REFUSED: mainnet issuance is hard-disabled in this phase. "
            "If you are seeing this during the launch phase, use the "
            "approved launch tooling, not this prototype script."
        )
    items = []
    for n in nft_numbers:
        desc = zecians_asset_desc(CONFIG["asset_desc_prefix"], CONFIG["collection_id"], n)
        items.append({
            "nft_number": n,
            "asset_desc": desc,
            "asset_desc_hash": asset_desc_hash(desc),
            "value": 1,
            "finalize": True,
            "memo_note": "value=1 + finalize=1 ⇒ protocol-enforced NFT (ZIP 227)",
        })
    return {
        "plan_version": "zecians.issuance_plan.v1",
        "network": network,
        "issuer": "ZECIANS_TESTNET_ISSUER (key ceremony pending; never stored in repo)",
        "fee_asset": "ZEC (per ZIP 227/317)",
        "items": items,
    }


def sign_and_broadcast(plan: dict) -> None:  # pragma: no cover - safety stub
    raise IssuanceNotConfigured(
        "Signing/broadcasting is not implemented in this phase.\n"
        "Required first (testnet phase):\n"
        "  1. stand up a ZSA-enabled node (see blockchain/networks.md)\n"
        "  2. run the issuance key ceremony OFFLINE (docs/asset_design.md)\n"
        "  3. wire the wallet toolchain with testnet funds only\n"
        "Until then this tool only produces plans (--dry-run)."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--nft", type=int, action="append", help="specific nft number(s); default all")
    parser.add_argument("--network", default="zsa-testnet", choices=["local", "zsa-testnet"])
    parser.add_argument("--execute", action="store_true", help="attempt signing/broadcast (will refuse in this phase)")
    args = parser.parse_args()

    numbers = args.nft or list(range(1, CONFIG["supply"] + 1))
    plan = build_issuance_plan(numbers, args.network)
    print(json.dumps(plan, indent=2))

    if args.execute:
        sign_and_broadcast(plan)
    else:
        print("\n(dry-run plan only; nothing signed or broadcast)", file=sys.stderr)


if __name__ == "__main__":
    main()
