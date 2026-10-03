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

import mimetypes
import os
import time
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from marketplace_backend.app.settings import get_settings
from marketplace_backend.services.json_file_store import JsonFileStore
from marketplace_backend.services.solana import catalog_service
from marketplace_backend.services.solana import collection_registry
from marketplace_backend.services.solana import core_asset_service
from marketplace_backend.services.solana import marketplace_service
from marketplace_backend.services.solana import models as solana_models
from marketplace_backend.services.solana import nft_asset_service
from marketplace_backend.services.solana import treasury_service
from marketplace_backend.services.solana.indexer_service import IndexerService
from marketplace_backend.services.solana.marketplace_event_indexer import (
    MarketplaceEventIndexer,
)
from marketplace_backend.services.solana.solana_chain_service import SolanaChainService

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


def _chain_service() -> SolanaChainService:
    settings = get_settings()
    return SolanaChainService(settings.resolved_rpc_url(), settings.network)


def _event_indexer() -> MarketplaceEventIndexer:
    return MarketplaceEventIndexer(
        _marketplace_store(),
        _asset_store(),
        _treasury_store(),
        _indexer_store(),
    )


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
    """The PUBLIC collection directory.

    Legacy/placeholder collections are classified out here (backend visibility
    rule) but remain reachable through /api/collections/{slug} by direct id.
    """
    registry = collection_registry.list_collections(_registry_store())
    public = [c for c in registry if collection_registry.is_publicly_visible(c)]
    return {
        "collections": [
            catalog_service.collection_view(c, _asset_store(), _marketplace_store())
            for c in public
        ]
    }


@app.get("/api/collections/{slug}")
def collection_detail(slug: str):
    collection = collection_registry.get_collection(_registry_store(), slug)
    if collection is None:
        raise HTTPException(status_code=404, detail="collection not found")
    address = collection.get("collection_address")
    assets = (
        nft_asset_service.list_assets(_asset_store(), collection_address=address)
        if address
        else []
    )
    listings = (
        [
            l
            for l in marketplace_service.list_listings(_marketplace_store())
            if l.get("collection_address") == address
        ]
        if address
        else []
    )
    view = catalog_service.collection_view(
        collection, _asset_store(), _marketplace_store()
    )
    return {
        "collection": view,
        "asset_count": len(assets),
        "assets": assets,
        "listings": listings,
    }


@app.get("/api/assets")
def assets(
    owner_address: str = Query(default=None),
    collection_address: str = Query(default=None),
):
    """Read-model asset query (used by the wallet profile). Real records only."""
    return {
        "assets": nft_asset_service.list_assets(
            _asset_store(),
            collection_address=collection_address,
            owner_address=owner_address,
        )
    }


@app.get("/api/nft/{asset_address}")
def nft(asset_address: str):
    asset = nft_asset_service.get_asset(_asset_store(), asset_address)
    if asset is None:
        # Direct Core ownership read: ask the chain who owns the asset right now
        # and store what the chain actually reports. No values are invented.
        asset = _read_and_register_core_asset(asset_address)
    if asset is None:
        raise HTTPException(status_code=404, detail="asset not found")
    return {"asset": asset}


def _read_and_register_core_asset(asset_address: str):
    try:
        decoded = core_asset_service.read_core_asset(_chain_service(), asset_address)
        return nft_asset_service.register_discovered_asset(
            _asset_store(), decoded, now=int(time.time())
        )
    except Exception:
        return None


# --- Off-chain metadata + artwork serving ----------------------------------
#
# On-chain Core accounts only store a URI. These endpoints make the read model
# itself the metadata/artwork host so wallets and explorers can resolve an
# asset address to real JSON + real bytes. The image URL is absolute so external
# clients can fetch it; when the backend is localhost that URL is only
# renderable locally (documented limitation, never claimed otherwise).


def _website_public_dir() -> Path:
    return get_settings().data_dir.parent.parent / "marketplace-website" / "public"


def _resolve_artwork(path_value: str):
    """Resolve a stored artwork reference to a readable file + content type.

    Accepts an absolute local path, a backend-copied file, or a
    `/demo-marketplace/...` path served by the website's public directory
    (Phase 1 assets). Returns (Path, mime) or None.
    """
    if not path_value:
        return None
    candidate = Path(path_value)
    if candidate.is_absolute() and candidate.is_file():
        mime = mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
        return candidate, mime
    if path_value.startswith("/"):
        public_candidate = _website_public_dir() / path_value.lstrip("/")
        if public_candidate.is_file():
            mime = (
                mimetypes.guess_type(str(public_candidate))[0]
                or "application/octet-stream"
            )
            return public_candidate, mime
    return None


def _artwork_for(address: str):
    asset = nft_asset_service.get_asset(_asset_store(), address)
    if asset is not None:
        resolved = _resolve_artwork(asset.get("artwork_path"))
        if resolved is None:
            resolved = _resolve_artwork(asset.get("image"))
        if resolved is not None:
            return resolved
    collection = collection_registry.get_collection_by_address(
        _registry_store(), address
    )
    if collection is not None:
        resolved = _resolve_artwork(collection.get("artwork_path"))
        if resolved is None:
            resolved = _resolve_artwork(collection.get("image"))
        if resolved is not None:
            return resolved
    return None


@app.get("/api/metadata/collection/{slug}")
def collection_metadata(slug: str, request: Request):
    collection = collection_registry.get_collection(_registry_store(), slug)
    if collection is None:
        raise HTTPException(status_code=404, detail="collection not found")
    base = str(request.base_url).rstrip("/")
    address = collection.get("collection_address")
    return JSONResponse(
        {
            "name": collection.get("name") or "Untitled",
            "description": collection.get("description") or "",
            "image": "%s/api/artwork/%s" % (base, address) if address else "",
            "symbol": collection.get("symbol") or "",
            "external_url": collection.get("website") or "",
            "attributes": [],
        }
    )


@app.get("/api/metadata/{asset_address}")
def asset_metadata(asset_address: str, request: Request):
    asset = nft_asset_service.get_asset(_asset_store(), asset_address)
    if asset is None:
        raise HTTPException(status_code=404, detail="asset not found")
    base = str(request.base_url).rstrip("/")
    name = asset.get("name") or "Untitled"
    attributes = asset.get("attributes") or []
    return JSONResponse(
        {
            "name": name,
            "description": asset.get("description") or "",
            "image": "%s/api/artwork/%s" % (base, asset_address),
            "attributes": attributes,
        }
    )


@app.get("/api/artwork/{address}")
def artwork(address: str):
    resolved = _artwork_for(address)
    if resolved is None:
        raise HTTPException(status_code=404, detail="artwork not found")
    path, mime = resolved
    return FileResponse(path, media_type=mime)


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
    events = _indexer().activity(limit=limit)
    return {"events": [catalog_service.activity_view(e) for e in events]}


@app.get("/api/treasury")
def treasury(limit: int = Query(default=100, ge=1, le=500)):
    settings = get_settings()
    return {
        "treasury_address": settings.treasury_address or None,
        "summary": treasury_service.summary(_treasury_store()),
        "events": treasury_service.list_events(_treasury_store(), limit=limit),
    }


# --- Phase 1 on-chain indexer + test bootstrap -----------------------------


class RegisterAssetPayload(BaseModel):
    asset_address: str
    collection_address: str
    owner_address: str
    metadata_uri: Optional[str] = ""
    creator_address: Optional[str] = None
    royalty_bps: int = 0
    name: Optional[str] = None
    image: Optional[str] = None
    description: Optional[str] = None
    attributes: Optional[List[dict]] = None
    artwork_path: Optional[str] = None
    mime_type: Optional[str] = None
    collection_slug: Optional[str] = None


class RegisterCollectionPayload(BaseModel):
    name: str
    slug: str
    collection_address: str
    description: Optional[str] = None
    image: Optional[str] = None
    creator_address: Optional[str] = None
    royalty_bps: int = 0
    # Phase 2A test collections are UNVERIFIED by default. Only `true` here
    # (used by the existing Phase 1 bootstrap) sets a verified badge.
    verified: bool = False
    artwork_path: Optional[str] = None
    project_slug: Optional[str] = None
    socials: Optional[dict] = None
    website: Optional[str] = None


class RegisterRequest(BaseModel):
    collection: Optional[RegisterCollectionPayload] = None
    assets: List[RegisterAssetPayload] = []


@app.post("/api/indexer/poll")
def indexer_poll(limit: int = Query(default=50, ge=1, le=200)):
    """Fetch recent marketplace-program transactions and apply new events."""
    settings = get_settings()
    if not settings.marketplace_program_id:
        raise HTTPException(
            status_code=400, detail="marketplace program id is not configured"
        )
    try:
        return _event_indexer().poll(
            _chain_service(), settings.marketplace_program_id, limit=limit
        )
    except Exception as exc:  # noqa: BLE001 - surfaced to the caller honestly
        raise HTTPException(status_code=502, detail="indexer poll failed: %s" % exc)


@app.get("/api/indexer/status")
def indexer_status():
    settings = get_settings()
    return {
        "program_id": settings.marketplace_program_id or None,
        "rpc_configured": bool(settings.resolved_rpc_url()),
        "processed_signatures": len(
            _indexer_store().get("processed_marketplace_signatures", [])
        ),
        "activity_events": len(_indexer_store().get("activity_events", [])),
    }


@app.post("/api/indexer/register")
def indexer_register(payload: RegisterRequest):
    """Development bootstrap: register the real Devnet test collection + assets
    into the read model. Idempotent. Test tooling only, not a public mint/admin
    surface."""
    now = int(time.time())

    if payload.collection is not None:
        collection = payload.collection
        project_slug = collection.project_slug or collection.slug
        collection_registry.register_project(
            _registry_store(), name=collection.name, slug=project_slug, now=now
        )
        if collection_registry.get_collection(_registry_store(), collection.slug) is None:
            collection_registry.register_collection(
                _registry_store(),
                name=collection.name,
                slug=collection.slug,
                project_slug=project_slug,
                collection_address=collection.collection_address,
                description=collection.description or "",
                image=collection.image,
                creator_address=collection.creator_address,
                royalty_bps=collection.royalty_bps,
                now=now,
                artwork_path=collection.artwork_path,
            )
        else:
            collection_registry.set_collection_media(
                _registry_store(),
                collection.slug,
                image=collection.image,
                artwork_path=collection.artwork_path,
            )
        collection_registry.set_verification_status(
            _registry_store(),
            collection.slug,
            solana_models.VERIFICATION_VERIFIED
            if collection.verified
            else solana_models.VERIFICATION_UNVERIFIED,
        )
        collection_registry.set_marketplace_status(
            _registry_store(), collection.slug, solana_models.MARKETPLACE_STATUS_ACTIVE
        )

    registered = []
    for item in payload.assets:
        nft_asset_service.register_asset(
            _asset_store(),
            {
                "asset_address": item.asset_address,
                "collection_address": item.collection_address,
                "owner_address": item.owner_address,
                "standard": solana_models.STANDARD_METAPLEX_CORE,
                "metadata_uri": item.metadata_uri
                or item.image
                or "onchain://%s" % item.asset_address,
                "creator_address": item.creator_address,
                "royalty_bps": item.royalty_bps,
                # The platform does not silently claim verification for test data.
                "verified_collection": False,
                "name": item.name,
                "image": item.image,
                "description": item.description,
                "attributes": item.attributes,
                "artwork_path": item.artwork_path,
                "mime_type": item.mime_type,
                "collection_slug": item.collection_slug,
            },
            now=now,
        )
        nft_asset_service.set_metadata(
            _asset_store(),
            item.asset_address,
            now=now,
            name=item.name,
            image=item.image,
            description=item.description,
            attributes=item.attributes,
        )
        registered.append(item.asset_address)

    return {
        "collection": payload.collection.slug if payload.collection else None,
        "assets": registered,
    }
