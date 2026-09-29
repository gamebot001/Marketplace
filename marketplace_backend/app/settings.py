"""Environment-backed settings for the Zecians backend.

ZECIANS is Solana-native. All values come from environment variables (.env
supported). Defaults are safe for local/devnet development. No secrets, seed
phrases, or private keys are ever read or stored here.

Chain/network selection:
  * `solana-devnet`  (default, safe for development)
  * `solana-testnet`
  * `solana-mainnet-beta` — HARD-DISABLED until an explicit launch phase
"""

import os
from dataclasses import dataclass, field
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None

ROOT = Path(__file__).resolve().parent.parent.parent
if load_dotenv is not None:
    load_dotenv(ROOT / ".env")

# Public RPC endpoints. Read-only usage only. No credentials are stored.
DEFAULT_RPC_BY_NETWORK = {
    "solana-devnet": "https://api.devnet.solana.com",
    "solana-testnet": "https://api.testnet.solana.com",
    "solana-mainnet-beta": "",
}

# Networks that must never be used until an explicit, owner-approved launch.
DISABLED_NETWORKS = ("solana-mainnet-beta", "mainnet-beta", "mainnet")


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


@dataclass
class Settings:
    network: str = field(
        default_factory=lambda: os.environ.get("ZECIANS_SOLANA_NETWORK", "solana-devnet")
    )
    env: str = field(default_factory=lambda: os.environ.get("ZECIANS_ENV", "development"))
    server_secret: str = field(
        default_factory=lambda: os.environ.get("ZECIANS_SERVER_SECRET", "change_me_local_only")
    )

    # Chain configuration (public values only; never keys).
    solana_rpc_url: str = field(default_factory=lambda: os.environ.get("SOLANA_RPC_URL", ""))
    treasury_address: str = field(
        default_factory=lambda: os.environ.get("SOLANA_TREASURY_ADDRESS", "")
    )
    marketplace_program_id: str = field(
        default_factory=lambda: os.environ.get("ZECIANS_MARKETPLACE_PROGRAM_ID", "")
    )
    # Fee/royalty are configurable and default to 0 (disabled / not finalised).
    marketplace_fee_bps: int = field(
        default_factory=lambda: _env_int("ZECIANS_MARKETPLACE_FEE_BPS", 0)
    )
    royalty_bps_default: int = field(
        default_factory=lambda: _env_int("ZECIANS_ROYALTY_BPS", 0)
    )

    data_dir: Path = field(default_factory=lambda: ROOT / "marketplace_backend" / "data")
    app_config_path: Path = field(
        default_factory=lambda: Path(
            os.environ.get(
                "ZECIANS_APP_CONFIG",
                str(ROOT / "marketplace-configuration" / "app.json"),
            )
        )
    )
    networks_config_path: Path = field(
        default_factory=lambda: ROOT / "marketplace-configuration" / "networks.json"
    )

    # --- chain helpers -----------------------------------------------------

    @property
    def chain(self) -> str:
        return "solana"

    @property
    def nft_standard(self) -> str:
        return "metaplex-core"

    def resolved_rpc_url(self) -> str:
        """Env override wins; otherwise the public default for the network."""
        if self.solana_rpc_url:
            return self.solana_rpc_url
        return DEFAULT_RPC_BY_NETWORK.get(self.network, "")

    # --- configuration -----------------------------------------------------

    def load_app_config(self) -> dict:
        """Read marketplace-configuration/app.json, falling back to app.example.json, then
        to hardcoded safe defaults. Never enables a money-touching feature."""
        import json as _json

        candidates = [self.app_config_path, self.app_config_path.parent / "app.example.json"]
        for path in candidates:
            if path.exists():
                try:
                    return _json.loads(path.read_text())
                except Exception:
                    continue
        return {
            "features": {
                "mint_enabled": False,
                "marketplace_enabled": False,
                "allowlist_enabled": False,
            },
            "fees": {
                "marketplace_fee_bps": 0,
                "royalty_bps_default": 0,
                "currency": "SOL",
            },
            "limits": {"mint_limit_per_address": 1},
        }

    def assert_not_mainnet(self) -> None:
        """Safety interlock: mainnet is refused until the launch phase."""
        if self.network in DISABLED_NETWORKS:
            raise RuntimeError(
                "Refusing to run against Solana mainnet-beta. Mainnet is disabled "
                "until the explicit, owner-approved launch phase."
            )


def get_settings() -> Settings:
    settings = Settings()
    settings.assert_not_mainnet()
    return settings
