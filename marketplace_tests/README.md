# marketplace_tests/

Marketplace pytest suite. Run from the repo root:

```bash
python -m pytest marketplace_tests/ -q
```

| File | Covers |
| --- | --- |
| `test_fees.py` | Integer-lamport fee/royalty split + conservation |
| `test_wallet_service.py` | Solana address validation (never keys) |
| `test_solana_marketplace.py` | Generic asset model, listings, sale settlement, treasury, accounting |
| `test_collection_registry.py` | Projects, collections, verification statuses, flagship seed |
| `test_indexer_service.py` | Idempotent ingestion, empty-by-default activity |
| `test_solana_api.py` | Collection-agnostic FastAPI endpoints, no fabricated data |

Collection-pipeline tests (metadata, manifest, asset import) now live with the
NFT project in `zecians-nft-project/tests/`.
Zcash-era tests are archived (not run) under `archive/zcash/tests/`.
