"""ZIP 227 asset identity math (blockchain/asset_identity.py)."""

import hashlib

from blockchain.asset_identity import (
    ASSET_DESC_PERSON,
    asset_desc_hash,
    canonical_asset_id,
    zecians_asset_desc,
)


def test_matches_raw_blake2b_definition():
    desc = "zsc1|zecians-genesis|001"
    expected = hashlib.blake2b(desc.encode(), digest_size=32, person=ASSET_DESC_PERSON).hexdigest()
    assert asset_desc_hash(desc) == expected


def test_person_constant_matches_zip_227():
    assert ASSET_DESC_PERSON == b"ZSA-AssetDescCRH"


def test_known_shape_properties():
    digest = asset_desc_hash("anything")
    assert len(digest) == 64
    int(digest, 16)  # valid hex


def test_unique_per_description():
    hashes = {asset_desc_hash(zecians_asset_desc("zsc1", "zecians", n)) for n in range(1, 11)}
    assert len(hashes) == 10


def test_canonical_asset_id_encoding():
    desc_hash = asset_desc_hash("zsc1|zecians-genesis|001")
    issuer = "ab" * 32
    encoded = canonical_asset_id(desc_hash, issuer)
    assert encoded == "00" + issuer + desc_hash
