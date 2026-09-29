# Zecians — Revenue Model (Architecture, Not Promises)

> Nothing here is a forecast, promise, or entitlement. Fee percentages are
> **not finalised**. No Zecians communication may present these as expected
> returns.

## Revenue sources

| Source | Mechanism | Honest constraints |
| --- | --- | --- |
| Primary mint | Fixed-price Solana mint (planned) | Supply is real and fixed by the manifest; demand unknown |
| Marketplace fee | Basis-point fee on settled sales | Only on sales the platform settles; configurable |
| Creator royalties | Basis points from on-chain metadata | Paid to creators; cannot exceed 100% combined with fee |
| Limited editions | Artist-led sub-issues post-mint | Only after the core pipeline is proven |
| Collaborations | Joint drops with verified projects | Real partnerships only, disclosed |

## Fee flow (integer lamports)

```
Buyer
  ↓
Marketplace
  ├── seller proceeds
  ├── creator royalty
  └── Zecians marketplace fee
                ↓
          Zecians Treasury
```

All Zecians marketplace fees go to the **Zecians Treasury**. Primary Zecians
mint proceeds also go to the Treasury.

- Percentages live in `marketplace-configuration/app.json` (`marketplace_fee_bps`,
  `royalty_bps_default`) and are configurable without code changes.
- Defaults are **0 bps (disabled)**. Final values are set before launch.
- Fee math is integer-only and conserves value exactly.

## Where money goes (categories, not promises)

```
Gross platform revenue
 ├── Artist/creator payments   (agreed %, paid first)
 ├── Infrastructure           (hosting, RPC, monitoring)
 ├── Security & review        (review budget before real money)
 └── Treasury                 (ops runway, future ecosystem work)
```

## Rules

1. Costs before revenue claims: publish the real cost stack as it becomes real.
2. Creator payments are contractual and first-priority.
3. The Treasury address is public; movements are reported.
4. No buybacks, no floor-support pledges, no yield promises.
5. No token exists and none is planned as a promise.
6. If a feature can't be delivered, the FAQ says so before launch, not after.
