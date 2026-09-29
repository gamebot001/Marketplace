# marketplace_backend/

FastAPI application + the core business-logic services for the marketplace.

```
app/main.py            FastAPI app (collection-agnostic read endpoints)
app/settings.py        environment configuration loader (Solana-native)
services/
  solana/
    solana_chain_service.py   read-only Solana RPC access
    nft_asset_service.py      generic NFT asset model + standard adapters
    marketplace_service.py    listings + sale settlement (fee/royalty split)
    wallet_service.py         Solana address validation (never keys)
    treasury_service.py       Zecians platform fee + mint proceeds ledger
    indexer_service.py        idempotent on-chain event ingestion
    collection_registry.py    projects + collections + verification
    accounting.py             future-compatible participation records
    fees.py                   integer-lamport fee/royalty math
    models.py                 shared constants + validation
data/                  runtime JSON stores (git-ignored) — replaced by
                       PostgreSQL in the database phase
```

Run:

```bash
uvicorn marketplace_backend.app.main:app --reload --port 8788
```

Services are written as pure state machines over a store interface so the
important safety properties are testable without infrastructure
(`marketplace_tests/`). See `marketplace-documentation/architecture.md`.
