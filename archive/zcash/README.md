# archive/zcash (historical reference only)

This directory contains the original Zcash / ZSA implementation that was
removed from the active runtime during the Phase 1 Solana migration.

**Nothing under `archive/` is imported by the active application, tests, or
frontend.** It is kept only as historical reference. Do not wire it back in.

Contents:

| Path | What it was |
| --- | --- |
| `blockchain/` | ZSA testnet RPC client, ZIP 227 asset identity math, issuance plan/verify scripts |
| `backend/services/minting/` | Zcash mint lifecycle + ZIP 227 attested issuance bridge |
| `backend/services/payments/` | ZEC/zatoshi payment request, matching, confirmation, reconciliation |
| `backend/services/migration/` | Zcash testnet → mainnet migration claims |
| `backend/services/whitelist/` | Zcash shielded-address (`u1...`/`zs1...`) allowlist |
| `backend/services/ownership/` | transparent/shielded ownership knowledge model |
| `backend/services/marketplace/` | zatoshi listing/sale escrow state machines |
| `tests/` | tests for the above |
| `database/001_initial.sql` | original Zcash/zatoshi PostgreSQL schema |
| `docs/` | Zcash-era design docs (asset, payment, migration, privacy, research) |

The active architecture is Solana-native: see `backend/services/solana/`,
`database/migrations/`, and `docs/architecture.md`.
