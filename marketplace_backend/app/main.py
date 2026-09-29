"""Zecians backend API — multi-collection Solana marketplace foundation.

Collection-agnostic read APIs:

  GET /api/health
  GET /api/config
  GET /api/collections
  GET /api/collections/{slug}
  GET /api/nft/{asset_address}
  GET /api/marketplace/listings
  GET /api/marketplace/listings/{listing_id}
  GET /api/activity
  GET /api/treasury

No fabricated blockchain data: every row originates from the indexer, the
collection registry, or a real service store. Empty states are returned as
empty lists, never mock data.

Safety: settings.get_settings() refuses mainnet configuration at startup.
"""

import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from marketplace_backend.app.settings import get_settings
from marketplace_backend.services.json_file_store import JsonFileStore
from marketplace_backend.services.solana import collection_registry
from marketplace_backend.services.solana import marketplace_service
from marketplace_backend.services.solana import models as solana_models
from marketplace_backend.services.solana import nft_asset_service
from marketplace_backend.services.solana import treasury_service
from marketplace_backend.services.solana.indexer_service import IndexerService

app = FastAPI(title="Zecians", version="0.2.0", docs_url="/api/docs")

_CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ZECIANS_CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:3001,http://127.0.0.1:3001",
    ).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- store accessors (bound lazily so tests can redirect data_dir) ---------

_STORES: dict = {}


def _store(name: str) -> JsonFileStore:
    if name not in _STORES:
        _STORES[name] = JsonFileStore(get_settings().data_dir / ("%s.json" % name))
    return _STORES[name]


def _registry_store():
    return _store("registry")


def _asset_store():
    return _store("assets")


def _marketplace_store():
    return _store("marketplace")


def _treasury_store():
    return _store("treasury")


def _indexer_store():
    return _store("indexer")


def _indexer() -> IndexerService:
    return IndexerService(_indexer_store())


@app.on_event("startup")
def _seed_registry():
    """Idempotently register the real Zecians flagship collection. No fakes."""
    get_settings()
    collection_registry.seed_flagship_collection(_registry_store())
    _indexer().ensure_state()


# --- API -------------------------------------------------------------------

@app.get("/api/health")
def health():
    settings = get_settings()
    return {
        "status": "ok",
        "chain": "solana",
        "network": settings.network,
        "env": settings.env,
        "nft_standard": settings.nft_standard,
        "rpc_configured": bool(settings.resolved_rpc_url()),
        "treasury_configured": bool(settings.treasury_address),
    }


@app.get("/api/config")
def config():
    """Public feature flags + fees the frontend needs to render honest UI."""
    settings = get_settings()
    cfg = settings.load_app_config()
    features = cfg.get("features", {})
    fees = cfg.get("fees", {})
    return {
        "chain": "solana",
        "network": settings.network,
        "nft_standard": settings.nft_standard,
        "mint_enabled": bool(features.get("mint_enabled", False)),
        "marketplace_enabled": bool(features.get("marketplace_enabled", False)),
        "allowlist_enabled": bool(features.get("allowlist_enabled", False)),
        "fees": {
            "marketplace_fee_bps": int(
                fees.get("marketplace_fee_bps", settings.marketplace_fee_bps)
            ),
            "royalty_bps_default": int(
                fees.get("royalty_bps_default", settings.royalty_bps_default)
            ),
            "currency": fees.get("currency", solana_models.CURRENCY_SOL),
        },
    }


@app.get("/api/collections")
def collections():
    return {"collections": collection_registry.list_collections(_registry_store())}


@app.get("/api/collections/{slug}")
def collection_detail(slug: str):
    collection = collection_registry.get_collection(_registry_store(), slug)
    if collection is None:
        raise HTTPException(status_code=404, detail="collection not found")
    assets = nft_asset_service.list_assets(
        _asset_store(), collection_address=collection.get("collection_address")
    ) if collection.get("collection_address") else []
    return {
        "collection": collection,
        "asset_count": len(assets),
    }


@app.get("/api/nft/{asset_address}")
def nft(asset_address: str):
    asset = nft_asset_service.get_asset(_asset_store(), asset_address)
    if asset is None:
        raise HTTPException(status_code=404, detail="asset not found")
    return {"asset": asset}


@app.get("/api/marketplace/listings")
def listings(
    status: str = Query(default=solana_models.LISTING_ACTIVE),
    collection_address: str = Query(default=None),
):
    items = marketplace_service.list_listings(_marketplace_store(), status=status) if status else \
        marketplace_service.list_listings(_marketplace_store())
    if collection_address:
        items = [l for l in items if l.get("collection_address") == collection_address]
    return {"listings": items}


@app.get("/api/marketplace/listings/{listing_id}")
def listing_detail(listing_id: str):
    listing = marketplace_service.get_listing(_marketplace_store(), listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="listing not found")
    sale = None
    if listing.get("sale_id"):
        sale = marketplace_service.get_sale(_marketplace_store(), listing["sale_id"])
    return {"listing": listing, "sale": sale}


@app.get("/api/activity")
def activity(limit: int = Query(default=50, ge=1, le=500)):
    return {"events": _indexer().activity(limit=limit)}


@app.get("/api/treasury")
def treasury(limit: int = Query(default=100, ge=1, le=500)):
    settings = get_settings()
    return {
        "treasury_address": settings.treasury_address or None,
        "summary": treasury_service.summary(_treasury_store()),
        "events": treasury_service.list_events(_treasury_store(), limit=limit),
    }
