# Zecians — Architecture (Solana)

## The big picture

```
                    ┌────────────────────────────────────────┐
                    │   marketplace-website/ (Next.js)       │
                    │  / /explore /collections /nft /activity │
                    │  /create /profile /settings            │
                    └───────────────┬────────────────────────┘
                                    │ HTTP (read-only today)
                    ┌───────────────▼────────────────────────┐
                    │   marketplace_backend/ (FastAPI)       │
                    │  services/solana/:                     │
                    │   SolanaChainService   (RPC read)      │
                    │   NFTAssetService      (standard)      │
                    │   MarketplaceService   (list/sale)     │
                    │   WalletService        (addresses)     │
                    │   TreasuryService      (fees)          │
                    │   IndexerService       (events)        │
                    │   collection_registry  (projects)      │
                    │   accounting           (future)        │
                    │   fees                 (lamports)      │
                    └───┬───────────────────────┬────────────┘
                        │                       │
             ┌──────────▼──┐        ┌───────────▼──────────┐
             │ PostgreSQL  │        │ Solana RPC           │
             │ (docker)    │        │ (devnet, read-only)  │
             │ state+audit │        └──────────────────────┘
             └─────────────┘
```

The flagship Zecians collection's artwork, traits, metadata and pipeline are
owned by the separate **Zecians NFT project** (`~/Desktop/zecians-nft-project`),
not by this marketplace repository.

## Vocabulary (locked)

| Term | Meaning |
| --- | --- |
| **Zecians NFT** | The flagship collection |
| **Zecians Marketplace** | A multi-project Solana NFT marketplace (our product) |
| **Solana** | Blockchain infrastructure |
| **Metaplex Core** | Primary NFT standard/infrastructure. **Not** our marketplace |
| **Treasury** | Recipient of Zecians platform fees + primary mint proceeds |

## Components and why they exist

| Component | What it does | Why it exists |
| --- | --- | --- |
| `services/solana/solana_chain_service.py` | Read-only Solana JSON-RPC client | Observe the chain without ever holding keys or broadcasting |
| `services/solana/nft_asset_service.py` | Generic asset model + standard adapters | Marketplace must not assume "all NFTs are Zecians"; new standards are pluggable |
| `services/solana/marketplace_service.py` | Listings + sale settlement | Prevents double-sale and double-assignment by construction; splits fees |
| `services/solana/wallet_service.py` | Solana address parsing/validation | Public addresses only; **never** keys or seed phrases |
| `services/solana/treasury_service.py` | Zecians fee + mint proceeds ledger | All platform revenue lands in the Treasury, idempotently |
| `services/solana/indexer_service.py` | Idempotent event ingestion | One deterministic activity feed, no fabricated events |
| `services/solana/collection_registry.py` | Projects, collections, verification statuses | Multi-collection platform, not a single-collection store |
| `services/solana/accounting.py` | Neutral participation records | Future-compatible; grants and promises nothing |
| `services/solana/fees.py` | Integer-lamport fee/royalty math | Configurable percentages; money never uses floats |
| `marketplace-database/` | PostgreSQL schema/migrations | Durable, constrained state (one active listing, unique signatures) |
| `marketplace-website/` | The public face | A real platform page, not a dev dashboard |

## Key architecture decisions

### 1. Logic first, infrastructure second
Every service is a **pure state machine + thin store interface**. For the
prototype the store is a deterministic JSON file; the same logic later runs on
PostgreSQL. This lets us test money safety and duplicate protection with no
infrastructure.

### 2. Amounts are always integers (lamports)
1 SOL = 1,000,000,000 lamports. All money math is integer-only. The fee model
guarantees conservation: `fee + royalty + seller proceeds == price`.

### 3. The chain is a source of truth we verify, not trust
The backend observes transactions (signatures, slots) and records them through
the indexer. It never fabricates an address, a balance, a sale, or income.

### 4. The asset layer is standard-agnostic
Assets carry an explicit `standard`. Metaplex Core is the primary adapter;
marketplace code queries the generic model and never branches on collection.

### 5. Multi-collection by construction
Listings reference `asset_address` and `collection_address`, never
`nft_number`. The collection registry stores projects and collections with a
verification status (`pending` / `verified` / `rejected` / `suspended`).

### 6. Fee architecture is configurable
`marketplace_fee_bps` and `royalty_bps` live in configuration and on-chain
metadata. Changing a fee never requires rewriting marketplace logic. All
Zecians marketplace fees flow to the Treasury.

### 7. Safety interlocks
- All code refuses `solana-mainnet-beta` until an explicit, owner-approved
  launch phase.
- No seed phrase or private key ever enters this repository.
- Double-spend/double-assign transitions are guarded by uniqueness and
  idempotency (in tests now; in PostgreSQL later).

## What is intentionally NOT built yet

- No deployed marketplace program (devnet or mainnet).
- No mint flow, no offers/auctions, no complex creator onboarding.
- No token, no tokenomics, no allocations.
- No live chain writes in the request path (read-only RPC only).
- No authentication beyond prototype needs.
