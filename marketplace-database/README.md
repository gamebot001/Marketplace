# marketplace-database/

PostgreSQL schema and migrations for the Zecians Solana marketplace.

```
migrations/001_initial.sql   full initial schema (applied automatically by
                             docker-compose on first start)
```

Start the database:

```bash
docker compose up -d postgres
docker compose exec postgres psql -U zecians -d zecians -c "\dt"
```

Design notes:

- Money columns are `BIGINT` lamports (never float). 1 SOL = 1,000,000,000.
- The schema is generic and multi-collection: listings/sales reference
  `asset_address` + `collection_address`, never a hardcoded Zecians id.
- Solana-native columns: `signature`, `slot`, `block_time`, `asset_address`,
  `collection_address`, `owner_address`, `seller_address`, `buyer_address`,
  `lamports`.
- Idempotency/replay protection is enforced by uniqueness:
  - `assets.asset_address` unique
  - `sales.signature` unique, `activity_events.signature` unique
  - partial unique index: one active listing per asset
  - partial unique index: one current owner per asset
  - partial unique index: `(kind, signature)` on treasury events
  - `sale_split_conserved` CHECK: fee + royalty + seller proceeds = price
- Mainnet networks are blocked in application code at the settings layer.

The services currently use deterministic JSON stores so logic is testable
without infra; wiring PostgreSQL uses these same constraints. The old Zcash
schema is archived at `archive/zcash/database/001_initial.sql`.
