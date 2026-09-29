# Zecians — Marketplace Flow

The marketplace is a **generic, multi-collection Solana marketplace**. A
listing references an `asset_address` and a `collection_address`, never a
hardcoded Zecians id.

## Data model

```
collection (registry) ─ owns ─▶ asset (generic) ─ listed as ─▶ listing
                                     │                            │
                                     └──────── sold via ─────────▶ sale
                                                                  ├─ royalty
                                                                  ├─ marketplace fee → Treasury
                                                                  └─ seller proceeds
```

Listing fields: `asset_address`, `collection_address`, `seller_address`,
`price_lamports`, `currency`, `marketplace`, `created_at`, `status`.

## State machine (`marketplace_backend/services/solana/marketplace_service.py`)

```
listing:  active ──sale──▶ sold
             └──cancel──▶ cancelled

sale:     on-chain signature observed ──▶ confirmed (settled)
```

Phase 1 records a sale only from an **observed on-chain signature**. There is
no fabricated "payment pending" state: settlement is atomic with the signature.

## Guards (tested in `marketplace_tests/test_solana_marketplace.py`)

| Attack / failure | Guard |
| --- | --- |
| Sell what you don't own | `create_listing` requires the asset store to show the seller as owner |
| Double listing | At most one `active` listing per asset |
| Double sale | A settled listing leaves `active`; a second sale raises `ListingNotAvailable` |
| Replay | Sales are idempotent by transaction `signature`; a repeat returns the same sale |
| Fake confirmation | A sale requires a real, non-empty Solana signature |
| Price tampering | Observed price must equal the listing price |
| Self-dealing | Buyer and seller must differ |
| Double asset assignment | Ownership is set once per signature; `processed_signatures` dedupes |

## Fees & settlement

All amounts are **integer lamports** (`fees.split_sale`):

```
price
 ├── creator royalty   (royalty_bps)  → creator
 ├── Zecians fee       (fee_bps)      → Treasury
 └── seller proceeds   (remainder)
```

- The split is conserved exactly: `fee + royalty + seller == price`.
- Percentages are configurable (`marketplace-configuration/app.json` + on-chain
  metadata); changing them never requires rewriting marketplace logic.
- Royalties and platform fees are recorded per sale; the platform fee is also
  written to the treasury ledger (idempotently).

## Treasury

All Zecians marketplace fees go to the **Zecians Treasury**, alongside primary
mint proceeds. `GET /api/treasury` reports the configured address and the real
event ledger — an empty ledger until real events exist.

## Prototype status

- ✅ Generic asset model, listing/sale settlement, fee split, treasury ledger,
  and all guards above — implemented + tested.
- ❌ On-chain marketplace program (devnet/mainnet), offers/auctions, creator
  onboarding. Not built in this phase.

## Future

When the marketplace program is deployed, the same service functions settle
observed on-chain sales. New settlement modes are additive
(`settlement_mode: "direct" | "program"`), not a rewrite.
