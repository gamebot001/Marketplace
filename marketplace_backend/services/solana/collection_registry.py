"""Collection registry — projects and collections, chain-agnostic.

Zecians is the flagship collection, but it is stored as one collection among
many. Other verified projects register here later. No fake collections are
created; the real Zecians flagship is registered here (its on-chain supply may
optionally be read from a supplied manifest directory owned by the separate
Zecians NFT project).
"""

import json
import re
import time
from pathlib import Path

from marketplace_backend.services.solana import models as m
from marketplace_backend.services.solana import wallet_service


class RegistryError(ValueError):
    pass


_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def normalize_slug(value: str) -> str:
    slug = (value or "").strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    if not _SLUG_RE.match(slug):
        raise RegistryError("invalid slug: %r" % value)
    return slug


def register_project(store, name: str, slug: str, creator_address: str = None, now: int = None) -> dict:
    slug = normalize_slug(slug)
    if not name:
        raise RegistryError("project name is required")
    if creator_address and not wallet_service.is_valid_address(creator_address):
        raise RegistryError("invalid creator_address: %r" % creator_address)
    now = int(now if now is not None else time.time())

    def mutate(data):
        projects = data.setdefault("projects", {})
        if slug in projects:
            return data
        projects[slug] = {
            "project_id": slug,
            "name": name,
            "slug": slug,
            "creator_address": creator_address,
            "verification_status": m.VERIFICATION_PENDING,
            "created_at": now,
        }
        return data

    return store.update(mutate)["projects"][slug]


def register_collection(store, name: str, slug: str, project_slug: str,
                        collection_address: str = None, description: str = "",
                        image: str = None, creator_address: str = None,
                        standard: str = m.STANDARD_METAPLEX_CORE,
                        website: str = None, socials: dict = None,
                        royalty_bps: int = 0, now: int = None) -> dict:
    slug = normalize_slug(slug)
    project_slug = normalize_slug(project_slug)
    if not name:
        raise RegistryError("collection name is required")
    if standard not in m.SUPPORTED_STANDARDS:
        raise RegistryError("unsupported NFT standard: %r" % standard)
    if collection_address and not wallet_service.is_valid_address(collection_address):
        raise RegistryError("invalid collection_address: %r" % collection_address)
    if creator_address and not wallet_service.is_valid_address(creator_address):
        raise RegistryError("invalid creator_address: %r" % creator_address)
    if not isinstance(royalty_bps, int) or not 0 <= royalty_bps <= 10_000:
        raise RegistryError("royalty_bps out of range: %r" % royalty_bps)
    now = int(now if now is not None else time.time())

    def mutate(data):
        collections = data.setdefault("collections", {})
        if slug in collections:
            return data
        collections[slug] = {
            "slug": slug,
            "project_slug": project_slug,
            "name": name,
            "collection_address": collection_address,
            "description": description,
            "image": image,
            "creator_address": creator_address,
            "verification_status": m.VERIFICATION_PENDING,
            "standard": standard,
            "website": website,
            "socials": socials or {},
            "royalty_bps": royalty_bps,
            "marketplace_status": m.MARKETPLACE_STATUS_PENDING,
            "chain_deployed": bool(collection_address),
            "created_at": now,
        }
        return data

    return store.update(mutate)["collections"][slug]


def set_verification_status(store, slug: str, status: str) -> dict:
    slug = normalize_slug(slug)
    if status not in m.VERIFICATION_STATUSES:
        raise RegistryError("invalid verification status: %r" % status)

    def mutate(data):
        collection = data.get("collections", {}).get(slug)
        if collection is None:
            raise KeyError("unknown collection %s" % slug)
        collection["verification_status"] = status
        return data

    return store.update(mutate)["collections"][slug]


def set_marketplace_status(store, slug: str, status: str) -> dict:
    slug = normalize_slug(slug)
    if status not in m.MARKETPLACE_STATUSES:
        raise RegistryError("invalid marketplace status: %r" % status)

    def mutate(data):
        collection = data.get("collections", {}).get(slug)
        if collection is None:
            raise KeyError("unknown collection %s" % slug)
        collection["marketplace_status"] = status
        return data

    return store.update(mutate)["collections"][slug]


def get_collection(store, slug: str):
    return store.get("collections", {}).get(normalize_slug(slug))


def list_collections(store) -> list:
    collections = list(store.get("collections", {}).values())
    return sorted(collections, key=lambda c: (c.get("created_at") or 0, c["slug"]))


def seed_flagship_collection(store, collection_dir=None, now: int = None) -> dict:
    """Idempotently register the real Zecians flagship collection.

    The collection's on-chain supply/manifest is owned by the separate Zecians
    NFT project. When a `collection_dir` is supplied, its `manifest.json` is
    read for `collection_id`/`supply`; otherwise the flagship is registered
    without on-chain metadata. No Solana collection address is invented:
    `collection_address` stays null (with `chain_deployed=false`) until the
    collection is actually deployed.
    """
    now = int(now if now is not None else time.time())
    collection_id = "zecians-genesis"
    supply = None
    if collection_dir is not None:
        manifest_path = Path(collection_dir) / "manifest.json"
        try:
            manifest = json.loads(manifest_path.read_text())
            collection_id = manifest.get("collection", collection_id)
            supply = manifest.get("count")
        except Exception:
            pass

    register_project(store, name="Zecians", slug="zecians", now=now)
    existing = get_collection(store, "zecians")
    if existing:
        return existing

    collection = register_collection(
        store,
        name="Zecians",
        slug="zecians",
        project_slug="zecians",
        collection_address=None,
        description="The flagship Zecians collection.",
        image=None,
        standard=m.STANDARD_METAPLEX_CORE,
        royalty_bps=0,
        now=now,
    )
    collection["collection_id"] = collection_id
    collection["supply"] = supply
    set_verification_status(store, "zecians", m.VERIFICATION_VERIFIED)

    def mutate(data):
        data["collections"]["zecians"].update(
            {"collection_id": collection_id, "supply": supply, "flagship": True}
        )
        return data

    return store.update(mutate)["collections"]["zecians"]
