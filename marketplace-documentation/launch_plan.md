# Zecians — Launch Plan

## Phase map

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| 1. Solana foundation | Chain abstraction, multi-collection model, fee/treasury architecture, frontend prep | This repository state (devnet-only, no fake data) |
| 2. Local setup | Python/Node/Docker env, skeletons | Setup doc verified on a clean Mac |
| 3. Collection | Zecians art/traits/metadata pipeline | Owned by the separate `zecians-nft-project`; manifest hashes + validation green |
| 4. Devnet program | Marketplace program on devnet + read-only indexer | Observed test sales settle correctly |
| 5. DB + indexer | PostgreSQL live, constraints, indexer on real devnet events | Indexer replays events deterministically |
| 6. Website | Collections + marketplace pages with real data | Playwright smoke suite green |
| 7. Mint | Metaplex Core mint flow on devnet | End-to-end: sign → observe → record |
| 8. Marketplace live | List/buy/cancel on devnet | Guard tests + manual ops runbook |
| 9. Community | Registry onboarding for verified projects | Verification process tested |
| 10. Security | Secret scan, race tests, authZ, external review | Checklist in `security.md` complete |
| 11. Mainnet prep | Copy, ToS, treasury setup, monitoring | Launch checklist below |
| 12. Git/GitHub | `git init`, clean history, **private** repo | Only after everything above |

## Sequencing rules we obey

1. No mainnet anything without explicit owner approval; code enforces
   (`settings.assert_not_mainnet()`).
2. No public announcement of dates before the devnet pipeline works end to end.
3. No token. No tokenomics. No allocations promised.

## The Zecians collection

The collection artwork/traits/metadata now live in the separate
`~/Desktop/zecians-nft-project`. The marketplace simply registers it as the
flagship collection.

- Planned supply: 5,555 total (5,000 public + 555 treasury reserve).
- The existing artwork/traits/metadata structure is preserved in the NFT project.
- Scaling decisions (mint schedule, allowlist) happen only after the devnet
  mint flow completes a full lifecycle.

## Launch checklist (pre-mainnet)

- [ ] Marketplace program reviewed and deployed on devnet
- [ ] Manifest + hashes published and independently verifiable
- [ ] Fee/royalty BPS finalised and published
- [ ] Treasury address public; movements reported
- [ ] ToS + privacy policy live
- [ ] Incident runbook + monitoring
- [ ] Community channels open with honest FAQ
- [ ] External review of marketplace settlement code

## Post-launch operations

- Weekly transparency notes (what shipped, what broke, what's next).
- Public stats limited to on-chain facts + clearly-labeled platform records.
- No fabricated volume, listings, or treasury income — ever.
