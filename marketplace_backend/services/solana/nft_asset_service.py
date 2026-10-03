"""NFTAssetService — a generic, standard-agnostic NFT asset model.

The marketplace must never assume "all NFTs are Zecians". Assets are addressed
by `asset_address` and carry an explicit `standard`. Support for a new Solana
NFT standard is added by registering another adapter, without rewriting
marketplace logic.

Generic asset model:

    asset_address        Solana address of the asset account
    collection_address   Solana collection this asset belongs to
    owner_address        current on-chain owner (from the indexer)
    standard             NFT standard key (e.g. "metaplex-core")
    metadata_uri         off-chain metadata URI
    creator_address      creator/project address (royalty recipient)
    royalty_bps          creator royalty in basis points
    verified_collection  whether the collection is verified by the platform

Metaplex Core is the primary supported standard. Metaplex is infrastructure;
it is NOT the Zecians marketplace.
"""

from marketplace_backend.services.solana import models as m
from marketplace_backend.services.solana import wallet_service


class AssetError(ValueError):
    pass


class UnknownStandard(AssetError):
    pass


class NotOwner(AssetError):
    pass


class AssetAdapter:
    """Base class for NFT standard adapters."""

    standard = None

    def normalize(self, raw: dict) -> dict:  # pragma: no cover - interface
        raise NotImplementedError

    def supports(self, raw: dict) -> bool:
        return raw.get("standard") == self.standard


class MetaplexCoreAdapter(AssetAdapter):
    """Adapter for the Metaplex Core standard (primary standard)."""

    standard = m.STANDARD_METAPLEX_CORE

    def normalize(self, raw: dict) -> dict:
        return {
            "asset_address": raw.get("asset_address"),
            "collection_address": raw.get("collection_address"),
            "owner_address": raw.get("owner_address"),
            "standard": self.standard,
            "metadata_uri": raw.get("metadata_uri"),
            "creator_address": raw.get("creator_address"),
            "royalty_bps": int(raw.get("royalty_bps") or 0),
            "verified_collection": bool(raw.get("verified_collection", False)),
        }


_ADAPTERS: dict = {}


def register_adapter(adapter: AssetAdapter) -> None:
    if not adapter.standard:
        raise AssetError("adapter must declare a standard")
    _ADAPTERS[adapter.standard] = adapter


def get_adapter(standard: str) -> AssetAdapter:
    try:
        return _ADAPTERS[standard]
    except KeyError:
        raise UnknownStandard(
            "unsupported NFT standard %r (supported: %s)"
            % (standard, ", ".join(sorted(_ADAPTERS)))
        )


register_adapter(MetaplexCoreAdapter())


def _validate(normalized: dict) -> dict:
    m.require_fields(
        normalized,
        ["asset_address", "collection_address", "owner_address", "standard", "metadata_uri"],
        "asset",
    )
    for field in ("asset_address", "collection_address", "owner_address", "creator_address"):
        value = normalized.get(field)
        if value and not wallet_service.is_valid_address(value):
            raise AssetError("invalid Solana address in %s: %r" % (field, value))
    if normalized["standard"] not in m.SUPPORTED_STANDARDS:
        get_adapter(normalized["standard"])  # raises UnknownStandard
    royalty = normalized.get("royalty_bps", 0)
    if royalty < 0 or royalty > 10_000:
        raise AssetError("royalty_bps out of range: %r" % royalty)
    return normalized


_DISPLAY_FIELDS = (
    "name",
    "image",
    "description",
    "attributes",
    "artwork_path",
    "mime_type",
    "collection_slug",
)


def register_asset(store, raw: dict, now: int) -> dict:
    """Normalize + store an asset. Standard-agnostic. Idempotent on address."""
    standard = raw.get("standard") or m.STANDARD_METAPLEX_CORE
    adapter = get_adapter(standard)
    normalized = _validate(adapter.normalize({**raw, "standard": standard}))
    # Display metadata is additive presentation data (not on-chain facts); it is
    # merged verbatim so the artwork/metadata serving layer can resolve it.
    for field in _DISPLAY_FIELDS:
        if field in raw and raw.get(field) is not None:
            normalized[field] = raw[field]
    normalized["created_at"] = now
    normalized["updated_at"] = now

    def mutate(data):
        assets = data.setdefault("assets", {})
        existing = assets.get(normalized["asset_address"])
        if existing:
            normalized["created_at"] = existing.get("created_at", now)
            for field in _DISPLAY_FIELDS:
                if field not in normalized and existing.get(field) is not None:
                    normalized[field] = existing[field]
            if existing.get("owner_address") != normalized["owner_address"]:
                data.setdefault("asset_ownership_events", []).append({
                    "asset_address": normalized["asset_address"],
                    "from_address": existing.get("owner_address"),
                    "to_address": normalized["owner_address"],
                    "now": now,
                })
        assets[normalized["asset_address"]] = normalized
        return data

    store.update(mutate)
    return normalized


def get_asset(store, asset_address: str):
    return store.get("assets", {}).get(asset_address)


def list_assets(store, collection_address: str = None, owner_address: str = None) -> list:
    assets = list(store.get("assets", {}).values())
    if collection_address is not None:
        assets = [a for a in assets if a.get("collection_address") == collection_address]
    if owner_address is not None:
        assets = [a for a in assets if a.get("owner_address") == owner_address]
    return sorted(assets, key=lambda a: a.get("asset_address", ""))


def set_owner(store, asset_address: str, owner_address: str, now: int,
              signature: str = None, slot: int = None) -> dict:
    """Apply an ownership change observed on-chain. Idempotent per signature."""
    if not wallet_service.is_valid_address(owner_address):
        raise AssetError("invalid owner address: %r" % owner_address)

    result = {}

    def mutate(data):
        asset = data.get("assets", {}).get(asset_address)
        if asset is None:
            raise AssetError("unknown asset %s" % asset_address)
        processed = data.setdefault("processed_signatures", [])
        if signature and signature in processed:
            result["asset"] = asset
            return data
        if asset.get("owner_address") != owner_address:
            data.setdefault("asset_ownership_events", []).append({
                "asset_address": asset_address,
                "from_address": asset.get("owner_address"),
                "to_address": owner_address,
                "signature": signature,
                "slot": slot,
                "now": now,
            })
            asset["owner_address"] = owner_address
            asset["updated_at"] = now
        if signature:
            processed.append(signature)
        result["asset"] = asset
        return data

    store.update(mutate)
    return result["asset"]


def is_owned_by(store, asset_address: str, owner_address: str) -> bool:
    asset = get_asset(store, asset_address)
    return bool(asset) and asset.get("owner_address") == owner_address


def assert_owned_by(store, asset_address: str, owner_address: str) -> dict:
    asset = get_asset(store, asset_address)
    if asset is None:
        raise AssetError("unknown asset %s" % asset_address)
    if asset.get("owner_address") != owner_address:
        raise NotOwner(
            "%s does not own asset %s (owner=%s)"
            % (owner_address, asset_address, asset.get("owner_address"))
        )
    return asset


def set_metadata(store, asset_address: str, now: int, name: str = None,
                 image: str = None, description: str = None,
                 attributes: list = None) -> dict:
    """Attach display metadata to an already-registered asset.

    On-chain Core stores only a name/uri prefix; richer presentation fields
    (image path, description, traits) come from the collection bootstrap and
    are merged here without changing the validated on-chain fields.
    """
    result = {}

    def mutate(data):
        asset = data.get("assets", {}).get(asset_address)
        if asset is None:
            raise AssetError("unknown asset %s" % asset_address)
        if name is not None:
            asset["name"] = name
        if image is not None:
            asset["image"] = image
        if description is not None:
            asset["description"] = description
        if attributes is not None:
            asset["attributes"] = attributes
        asset["updated_at"] = now
        result["asset"] = asset
        return data

    store.update(mutate)
    return result["asset"]


def register_discovered_asset(store, record: dict, now: int) -> dict:
    """Store an asset discovered directly from the chain (no metadata adapter).

    Used by the direct Core ownership read: it accepts a collection-less asset
    and whatever metadata the chain exposes, and never invents values.
    """
    asset_address = wallet_service.validate(record["asset_address"])
    owner_address = wallet_service.validate(record["owner_address"])
    collection_address = record.get("collection_address")
    if collection_address:
        collection_address = wallet_service.validate(collection_address)
    else:
        collection_address = None

    stored = {
        "asset_address": asset_address,
        "collection_address": collection_address,
        "owner_address": owner_address,
        "standard": record.get("standard", m.STANDARD_METAPLEX_CORE),
        "metadata_uri": record.get("metadata_uri"),
        "creator_address": record.get("creator_address"),
        "royalty_bps": int(record.get("royalty_bps") or 0),
        "verified_collection": bool(record.get("verified_collection", False)),
        "name": record.get("name"),
        "image": record.get("image"),
        "description": record.get("description"),
        "attributes": record.get("attributes"),
        "artwork_path": record.get("artwork_path"),
        "mime_type": record.get("mime_type"),
        "collection_slug": record.get("collection_slug"),
        "created_at": now,
        "updated_at": now,
    }

    def mutate(data):
        assets = data.setdefault("assets", {})
        existing = assets.get(asset_address)
        if existing:
            stored["created_at"] = existing.get("created_at", now)
            # Never lose display metadata the indexer already knows about.
            for field in _DISPLAY_FIELDS:
                if stored.get(field) is None and existing.get(field) is not None:
                    stored[field] = existing[field]
        assets[asset_address] = stored
        return data

    store.update(mutate)
    return stored
