# Zecians — Asset Design (ZSA Layer)

## What we are building on

Zecians are designed for **Zcash Shielded Assets (ZSA)** — the multi-asset
extension of the Orchard shielded pool defined by ZIP 226/227, scheduled for
the **NU7** network upgrade and available today **only on the ZSA testnet**.

## Asset identity (exact ZIP 227 math)

ZIP 227 defines an asset's global identity as:

```
assetDescHash = BLAKE2b-256( key: "ZSA-AssetDescCRH", data: asset_desc )
AssetId       = ( issuer_key, assetDescHash )
```

- `asset_desc` is a UTF-8 string **we choose**.
- `issuer` is derived from our issuance key (BIP-340/secp256k1 public key,
  derived via ZIP 32 hardened path purpose 227').

**Zecians desc convention (project-specific):**

```
zsc1|zecians-genesis|001     ← Zecian #001
zsc1|zecians-genesis|010     ← Zecian #010
```

(`zsc1` = "Zecians collection 1". This mirrors the *shape* other projects
use, with our own namespace. The string is arbitrary; the hash is what
matters and is what appears in the issuance transaction.)

## NFT pattern per ZIP 227

The ZIP explicitly enables NFTs: issue an issuance action whose notes carry
**value = 1** and set **finalize = 1**. `finalize` is permanent — supply of
that asset id can never increase. This gives us protocol-level guarantee:

- supply of each Zecian = exactly 1, enforced by consensus, not by us.
- issuance is **transparent** (publicly verifiable) while all later
  transfers are **shielded** — exactly the "public authenticity, private
  ownership" combination Zecians wants.

## Hard protocol constraints we respect

- **ZSAs cannot be unshielded** to the transparent pool (ZIP 226).
- **Fees are paid in ZEC**, even for asset operations.
- **Issuance keys cannot be rotated**; compromise response = finalize all
  assets and re-issue under a new key. Our key plan (below) accounts for it.
- Wallet support for v6/ZSA is **not** in mainstream wallets yet; issuance
  and transfers initially run through ZSA testnet tooling.

## Issuance plan (testnet → mainnet)

1. **Key ceremony (local, later phase):** generate the issuance key from a
   dedicated seed **offline**, store encrypted, never in this repository.
   Two keys are planned: `ZECIANS_TESTNET_ISSUER` and
   `ZECIANS_MAINNET_ISSUER` (derived from distinct seeds; documented
   derivation path). The mainnet key never touches a networked machine
   until the approved mainnet phase.
2. **Testnet issuance:** one issuance transaction per Zecian (or small
   bundles), each `value=1, finalize=1`, recipient = our testnet Orchard
   address. Result recorded: `txid`, `height`, `assetDescHash`.
3. **Verification:** `blockchain/verify_issuance.py` fetches the tx from a
   node we don't operate and checks the desc hash is present.
4. **Mainnet (only after explicit owner approval AND NU7/eq. activation):**
   fresh issuance with the mainnet issuer, bound to testnet ownership via
   the claims system (`docs/migration_design.md`).

## Current implementation status (honest)

- ✅ Desc-hash math implemented and unit-tested (`blockchain/asset_identity.py`).
- ✅ Public testnet endpoint configuration + read-only RPC client.
- ✅ Issuance *plan* builder (`blockchain/issue_asset.py --dry-run`).
- ❌ **Actual signing/issuing is NOT implemented** — it requires a
  ZSA-enabled node/wallet toolchain (QED-it builds or equivalent) which we
  will set up and verify in the testnet phase. The code stops with a clear
  error instead of pretending.
- ❌ Mainnet issuance is **hard-disabled** in code.
