#!/usr/bin/env python3
"""Check the local development environment and print versions."""

import shutil
import subprocess
import sys

CHECKS = [
    ("python3", ["python3", "--version"]),
    ("node", ["node", "--version"]),
    ("npm", ["npm", "--version"]),
    ("docker", ["docker", "--version"]),
    ("git", ["git", "--version"]),
]


def main() -> int:
    print("Zecians environment check\n" + "=" * 40)
    ok = True
    for name, cmd in CHECKS:
        path = shutil.which(cmd[0])
        if path is None:
            print("%-10s MISSING (install hint in marketplace-documentation/development_setup.md)" % name)
            if name in ("python3", "node"):
                ok = False
            continue
        try:
            version = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True).strip().splitlines()[0]
            print("%-10s %s" % (name, version))
        except Exception as exc:  # noqa: BLE001
            print("%-10s present but failed to run: %s" % (name, exc))
    try:
        import fastapi, PIL, pytest, httpx  # noqa: F401,E401

        print("%-10s installed (venv active)" % "python deps")
    except ImportError as exc:
        print("%-10s missing (%s) → source .venv/bin/activate && pip install -r marketplace_backend/requirements.txt" % ("python deps", exc.name))
        ok = False
    print("=" * 40)
    print("READY" if ok else "INCOMPLETE — fix the items above")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
