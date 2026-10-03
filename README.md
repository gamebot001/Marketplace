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
| Network for development | **solana-devnet** (mainnet-beta hard-disabled) |
| NFT standard (primary) | **Metaplex Core** (infrastructure — not our marketplace) |
| Our marketplace | **Our own Anchor program** (not Metaplex) |
| Marketplace program | `zecians_marketplace` — Devnet `5E5HHbGwZbhmEcoRwBXArzoGqxX6Yh9ACPHET6EwnAwJ` |
| Backend | **FastAPI** + Solana read services |
| Frontend | **Next.js** marketplace website (+ a separate main brand site) |
| Persistence today | **JsonFileStore** (`marketplace_backend/data/`) |
| Treasury | Recipient of Zecians platform fees + primary mint proceeds |
| Token | **None.** No tokenomics, no allocations, no promises |

## Project status

**Phase 1 + Phase 2A are complete; real Solana Devnet trades with real
Metaplex Core test collections.**

- **Phase 1 — first real Devnet trade.** The Zecians Anchor marketplace program
  is deployed to Solana Devnet and performs real escrow listings, atomic
  purchases and cancellations with Metaplex Core assets.
- **Phase 2A — real test collections + data.** Seven real Devnet test
  collections (Cats, Dogs, Horses, Lions, Mice, Squirrels, Turtles) were minted
  as Metaplex Core collections with five assets each, owners distributed across
  test wallets, registered in the backend read model, and traded (list / buy /
  cancel) on Devnet. The backend now serves collection + asset metadata and
  artwork so wallets and explorers can resolve real records.
- **Phase 2A.1 / 2A.2 — catalog + profile/wallet UX.** Public collection
  visibility rules, honest price / role / activity semantics, and a reworked
  profile portfolio (Summary, Owned, Listed, Activity, Watchlist, Collections).

What works today:

- `programs/zecians_marketplace/` — Anchor 0.32.2 escrow marketplace program
  (`initialize_marketplace`, `create_listing`, `buy_nft`, `cancel_listing`)
  deployed to Devnet at `5E5HHbGwZbhmEcoRwBXArzoGqxX6Yh9ACPHET6EwnAwJ`
- Frontend Solana client (`marketplace-website/lib/solana/`) wiring the
  List / Buy / Cancel flows through `@anchor-lang/core` 0.32.2 + web3.js v1
- Idempotent on-chain event processor → `JsonFileStore` read model
- Direct Metaplex Core ownership reads (`core_asset_service.py`)
- Collection-agnostic catalog API, including per-asset metadata + artwork
  serving (`/api/metadata/...`, `/api/artwork/...`)
- Generic Solana service layer (registry, fees, treasury, indexer)
- `marketplace-scripts/` Phase 1 bootstrap + Phase 2A Devnet pipeline
- Next.js marketplace website (`marketplace-website/`, port 3001) and a
  separate main brand website (`main-website/`, port 3002)

Not implemented yet (do **not** assume it works):

- **Offers** — no offers, auctions or bid UI (planned for a later phase)
- **Admin** — no admin/back-office surface
- **PostgreSQL** — schema/migrations exist in `marketplace-database/`, but the
  backend still uses the JSON read model; database wiring is a later phase
- **Kit / Codama** — no Metaplex "Core Kit"-style product integration and no
  Codama client/codegen pipeline
- No enforced creator royalties (Phase 2A test collections use `royalty_bps: 0`),
  no mint UI, no mainnet (mainnet-beta is hard-disabled)
- Anchor `anchor test` local-validator run is blocked in this environment (see
  the Phase 1 report); the same flows are verified end-to-end on Devnet

## Layout

```
zecians/
├── main-website/               Next.js main brand site (:3002)
├── marketplace-website/        Next.js marketplace (/, /explore, /collections, /nft, /profile, ...)
├── marketplace_backend/        FastAPI + Solana services (catalog, marketplace, treasury, indexer)
├── marketplace-database/       PostgreSQL schema + migrations (not wired yet)
├── marketplace-configuration/  Network + app configuration (no secrets)
├── marketplace-documentation/  Project documentation (start with architecture.md)
├── marketplace-scripts/        Devnet bootstrap + Phase 2A artwork/mint/market pipeline
├── marketplace_tests/          Pytest suite (Solana-native)
├── programs/zecians_marketplace/  Anchor escrow marketplace program
└── tests/                      Anchor/TypeScript program tests
```

> `marketplace_backend/` and `marketplace_tests/` use an underscore because
> Python package names cannot contain hyphens.

## Quickstart (macOS, Apple Silicon)

```bash
# 1. Python environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r marketplace_backend/requirements.txt

# 2. Backend configuration (public Devnet values; no secrets)
cp .env.example .env

# 3. Run backend tests
python -m pytest marketplace_tests/ -q

# 4. Run the API
uvicorn marketplace_backend.app.main:app --reload --port 8788

# 5. Marketplace website (separate terminal; first run installs packages)
cd marketplace-website
cp .env.local.example .env.local
npm install && npm run dev          # http://localhost:3001
```

Development ports:

| Service | URL |
| --- | --- |
| Main brand website | `http://localhost:3002` |
| Marketplace website | `http://localhost:3001` |
| Marketplace backend API | `http://127.0.0.1:8788` |
| FastAPI docs | `http://127.0.0.1:8788/api/docs` |

## Environment configuration

Two public, non-secret configuration files are used. Never commit `.env` or
`.env.local`.

**Backend — `.env`** (copy from `.env.example`):

| Variable | Purpose |
| --- | --- |
| `ZECIANS_SOLANA_NETWORK` | `solana-devnet` (default); testnet supported; mainnet-beta refused |
| `ZECIANS_ENV` | `development` |
| `ZECIANS_SERVER_SECRET` | local-only placeholder; no real secret required |
| `SOLANA_RPC_URL` | Solana JSON-RPC endpoint (read-only). Defaults to the public Devnet RPC |
| `SOLANA_TREASURY_ADDRESS` | public fee/treasury address (public key only) |
| `ZECIANS_MARKETPLACE_PROGRAM_ID` | deployed program id (Devnet) |
| `ZECIANS_MARKETPLACE_FEE_BPS` | marketplace fee in bps (250 = 2.5%) |
| `ZECIANS_ROYALTY_BPS` | creator royalty in bps (0 for the test collections) |
| `ZECIANS_CORS_ORIGINS` | optional comma-separated CORS allowlist (defaults to :3000/:3001) |
| `ALLOW_MAINNET` | must stay `no` |

**Frontend — `marketplace-website/.env.local`** (copy from
`.env.local.example`; all values are public build-time flags):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_BACKEND_URL` | backend base URL, e.g. `http://127.0.0.1:8788` |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` (only supported value today) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Devnet RPC URL |
| `NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID` | deployed marketplace program id |
| `NEXT_PUBLIC_DEMO_MARKETPLACE` | `0` to read real backend data (Phase 1+ requires `0`) |

Runtime read-model files live in `marketplace_backend/data/` and are populated
by the indexer / Phase 2A scripts. Feature flags and fees live in
`marketplace-configuration/app.json`.

## Phase 2A test collections & data

Phase 2A minted **real** Metaplex Core test collections on Solana Devnet and
drove **real** list / buy / cancel activity through the marketplace program.
The read model currently holds:

- 7 publicly visible collections: **Cats, Dogs, Horses, Lions, Mice, Squirrels,
  Turtles** (5 Core assets each)
- ~40 assets total, including the legacy Phase 1 test assets
- ~22 listings (active / sold / cancelled) and ~45 indexed activity events

The pipeline is idempotent and resumable. From `marketplace-scripts/`:

| Command | Purpose |
| --- | --- |
| `npm run phase2a:check` | Scan + validate artwork, print the manifest (no writes) |
| `npm run phase2a:artwork` | Copy artwork into the backend; generate metadata + manifest |
| `npm run phase2a:mint` | Create Core collections + assets; distribute owners; register in backend |
| `npm run phase2a:market` | Real list / buy / cancel activity + indexer sync |

Run the backend on port `8788` before `phase2a:mint` / `phase2a:market`. The
artwork source defaults to `~/Desktop/collections` (override with
`ZECIANS_ARTWORK_ROOT`); key material is read from `~/.config/solana/`
(overridable via `ZECIANS_DEPLOYER_KEYPAIR`, `ZECIANS_WALLET_A_KEYPAIR`,
`ZECIANS_WALLET_B_KEYPAIR`) and outputs go under the git-ignored
`marketplace-scripts/.keys/`. Originals are never modified.

## API (collection-agnostic)

```
GET  /api/health
GET  /api/config
GET  /api/collections
GET  /api/collections/{slug}
GET  /api/assets?owner_address=&collection_address=
GET  /api/nft/{asset_address}
GET  /api/metadata/collection/{slug}
GET  /api/metadata/{asset_address}
GET  /api/artwork/{address}
GET  /api/marketplace/listings
GET  /api/marketplace/listings/{listing_id}
GET  /api/activity
GET  /api/treasury

POST /api/indexer/poll        # fetch + apply new on-chain events (dev tooling)
GET  /api/indexer/status
POST /api/indexer/register    # dev bootstrap: register a collection + assets
```

Empty states are returned as empty lists — the API never fabricates blockchain
data. Activity events carry a backend-owned semantic `label`
(`Listed` / `Sold` / `Cancelled` / `Transferred`); the frontend displays it
verbatim and never re-derives meaning from raw event types.

## Testing & verification

```bash
# Backend test suite (definition of "working")
python -m pytest marketplace_tests/ -q

# Marketplace frontend
cd marketplace-website
npm run typecheck      # tsc --noEmit
npm run lint           # next lint
npm run build          # production build

# Phase 2A scripts
cd ../marketplace-scripts
npm run typecheck
npm run phase2a:check
```

## Phase 2A limitations

- Phase 2A test collections are **unverified** — they carry no verification
  badge. Verification status is backend-owned.
- Creator royalties are **not enforced** (`royalty_bps: 0` for test data), and
  creator metadata is often `null` for the test collections.
- Artwork is served by the backend as absolute URLs, so images render only
  where the backend URL is reachable (e.g. `localhost` in local development).
- The placeholder `zecians` collection (not yet deployed) and the legacy
  `zecians-devnet-test` collection are hidden from public surfaces
  (directory, activity, owned/listed groupings); their direct
  `/api/collections/{slug}` routes still resolve. Underlying records and chain
  history are untouched.
- Persistence is the JSON read model (`JsonFileStore`); PostgreSQL is designed
  but not wired.
- Offers, Admin, mint UI, royalties and mainnet are out of scope for Phase 2A.

## Safety

- **Solana devnet only** until the owner explicitly approves mainnet steps
  (`settings.assert_not_mainnet()`).
- No seed phrases, private keys, or real funds anywhere in this repo.
- No fake balances, ownership, sales, volume, or treasury income.
- All money math is integer lamports; never floating point.
- Every state transition that could double-sell or double-assign is guarded
  by uniqueness/idempotency (in tests now; in PostgreSQL later).

## Documentation map

| Document | Purpose |
| --- | --- |
| `marketplace-documentation/project_overview.md` | What Zecians is, in plain language |
| `marketplace-documentation/architecture.md` | How the Solana services fit together |
| `marketplace-documentation/marketplace_flow.md` | Listings, sale settlement, fees, guards |
| `marketplace-documentation/security.md` | Threat model + rules we enforce |
| `marketplace-documentation/revenue_model.md` | Revenue architecture (not promises) |
| `marketplace-documentation/launch_plan.md` | Phase plan + launch checklist |
| `marketplace-documentation/development_setup.md` | Beginner setup |
| `marketplace-documentation/troubleshooting.md` | Problem → cause → fix |
| `marketplace-scripts/README.md` | Devnet bootstrap + Phase 2A pipeline |
