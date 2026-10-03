# ZECIANS MARKETPLACE

**A Solana-native, multi-collection NFT marketplace.**

This repository is the **marketplace platform**. The flagship **Zecians NFT
collection** (artwork, traits, metadata, pipeline and website) lives in a
separate project:

```
~/Desktop/zecians-nft-project
```

> **Platform, not a single collection.** The marketplace never assumes
> "all NFTs are Zecians". Zecians can be registered as the flagship collection,
> but any verified Solana project can register and list its own assets.

## Core facts

| Thing | Decision |
| --- | --- |
| Blockchain | **Solana** |
| NFT standard (primary) | **Metaplex Core** (infrastructure — not our marketplace) |
| Our marketplace | **Our own product/program** (not Metaplex) |
| Treasury | Recipient of Zecians platform fees + primary mint proceeds |
| Network for development | **solana-devnet** (mainnet-beta hard-disabled) |
| Token | **None.** No tokenomics, no allocations, no promises |

## Project status

**Phase 1 — first real Devnet trade.** The Zecians Anchor marketplace program
is deployed to Solana Devnet and performs real escrow listings, atomic
purchases and cancellations with Metaplex Core assets.

What works today:

- `programs/zecians_marketplace/` — Anchor 0.32 escrow marketplace program
  (`initialize_marketplace`, `create_listing`, `buy_nft`, `cancel_listing`)
  deployed to Devnet at `5E5HHbGwZbhmEcoRwBXArzoGqxX6Yh9ACPHET6EwnAwJ`
- Frontend Solana client (`marketplace-website/lib/solana/`) wiring the existing
  List / Buy / Cancel flows through `@anchor-lang/core` 0.32.2 + web3.js v1
- Minimal, idempotent on-chain event processor → JsonFileStore read model
- Direct Metaplex Core ownership reads (`core_asset_service.py`)
- `marketplace-scripts/` bootstrap + headless Devnet E2E tooling
- Generic Solana service layer (registry, fees, treasury, indexer)
- Next.js marketplace website with a Solana wallet adapter

Not done yet (do not assume it works):

- No PostgreSQL wiring (JsonFileStore remains the Phase 1 persistence layer)
- No creator royalties, offers, admin, search rewrite or mainnet (later phases)
- Anchor `anchor test` local-validator run is blocked in this environment (see
  the Phase 1 report); the same flows are verified end-to-end on Devnet.

## Layout

```
zecians/
├── marketplace-website/        Next.js marketplace (/, /explore, /collections, /nft, ...)
├── marketplace_backend/        FastAPI + Solana services (asset, marketplace, treasury, indexer)
├── marketplace-database/       PostgreSQL schema + migrations (Solana marketplace model)
├── marketplace-configuration/  Network + app configuration (no secrets)
├── marketplace-documentation/  Project documentation (start with architecture.md)
├── marketplace-scripts/        Setup / test / database helper scripts
├── marketplace_tests/          Pytest suite (Solana-native)
└── archive/zcash/              Historical Zcash/ZSA implementation (not active)
```

> `marketplace_backend/` and `marketplace_tests/` use an underscore because
> Python package names cannot contain hyphens.

## Quickstart (macOS, Apple Silicon)

```bash
# 1. Python environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r marketplace_backend/requirements.txt

# 2. Run backend tests
python -m pytest marketplace_tests/ -q

# 3. Run the API
uvicorn marketplace_backend.app.main:app --reload --port 8788

# 4. Marketplace website (separate terminal; first run installs packages)
cd marketplace-website && npm install && npm run dev   # http://localhost:3001
```

Development ports:

| Service | URL |
| --- | --- |
| Zecians NFT website (separate project) | `http://localhost:3000` |
| Marketplace website | `http://localhost:3001` |
| Marketplace backend | `http://127.0.0.1:8788` |

## API (collection-agnostic)

```
GET /api/health
GET /api/config
GET /api/collections
GET /api/collections/{slug}
GET /api/nft/{asset_address}
GET /api/marketplace/listings
GET /api/marketplace/listings/{listing_id}
GET /api/activity
GET /api/treasury
```

## Safety

- **Solana devnet only** until the owner explicitly approves mainnet steps.
- No seed phrases, private keys, or real funds anywhere in this repo.
- No fake balances, ownership, sales, volume, or treasury income.
- All money math is integer lamports; never floating point.
- Every state transition that could double-sell or double-assign is guarded
  by uniqueness/idempotency (in tests now; in PostgreSQL later).

See `marketplace-documentation/architecture.md`,
`marketplace-documentation/security.md`, and
`marketplace-documentation/marketplace_flow.md`.

## Documentation map

| Document | Purpose |
| --- | --- |
| `project_overview.md` | What Zecians is, in plain language |
| `architecture.md` | How the Solana services fit together |
| `marketplace_flow.md` | Listings, sale settlement, fees, guards |
| `security.md` | Threat model + rules we enforce |
| `revenue_model.md` | Revenue architecture (not promises) |
| `launch_plan.md` | Phase plan + launch checklist |

Historical Zcash-era design docs are archived in `archive/zcash/docs/`.
