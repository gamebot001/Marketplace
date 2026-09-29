# Zecians — Security

## Prime directives

1. **Never lose user money or data.**
2. **Never hold secrets in the repository.** No seed phrase, no private key,
   ever, in code, docs, or git history.
3. **Never claim a security property we don't have.**

## Threat model (Phase 1, local/devnet)

| Threat | Mitigation (status) |
| --- | --- |
| Secrets committed to git | `.gitignore` blocks `.env`, wallets, `*seed*`; `.env.example` documents only non-secret defaults; secret scan before any push |
| Frontend lies about a sale | Backend-only settlement from an observed on-chain `signature` — implemented |
| Double-sale / double-listing / double-assignment | Marketplace state guards + idempotency — implemented + tested |
| Replay of chain events | Dedup by transaction `signature` (indexer + sales + treasury) — implemented + tested |
| Fabricated data | Read APIs return real stores or empty states; no mock balances/volume/income — by construction |
| Database races | Prototype uses guarded JSON stores; PostgreSQL constraints + transactions land in the DB phase; **known gap** until then |
| API abuse (prototype) | API is read-only today; auth/rate limiting before any public deployment |
| Metadata attacks (huge/dupe/malformed) | The pipeline is the only writer; validator enforces schema + hashes; no user uploads exist yet |
| Marketplace manipulation (self-dealing, wash trading) | Buyer and seller must differ; wash-trading patterns monitored; no fake volume, ever |
| Mainnet accident | `settings.assert_not_mainnet()` refuses `solana-mainnet-beta`; no mint/broadcast path exists |
| Server compromise | Secrets live only in env/secret store; least-privilege DB user; no signing keys on the server at all |
| Supply chain | Pin dependency versions; reproducible installs; review before upgrade |

## Key handling rules

- **Zecians never holds keys.** Wallet signing happens entirely in the user's
  own Solana wallet. The backend stores no private keys or seed phrases.
- **Treasury address** is a public address in configuration. It is never a
  private key.
- **Marketplace program id** is public configuration; the program is not
  deployed in this phase.
- **Server secret (`ZECIANS_SERVER_SECRET`):** random at install, stored in
  `.env` (git-ignored), rotated on any suspicion.
- **We never ask users for seed phrases.** Any UI that does is a bug. The demo
  wallet adapter accepts a public address only.

## Money-handling invariants (all code-tested)

1. Money is **integer lamports** only (1 SOL = 1,000,000,000).
2. Sale settlement conserves value exactly:
   `fee + royalty + seller proceeds == price`.
3. A listing is consumed by exactly one settled sale.
4. `confirmed` requires a real on-chain signature observed by the backend.
5. Refunds/failures are recorded and never silent.
6. Every state change is recorded with enough data to audit it later.
7. Treasury events are idempotent by `(kind, signature)`.

## Before any real-money launch (checklist)

- [ ] Secret scan on full history (gitleaks or equivalent)
- [ ] PostgreSQL constraints live + race-condition tests
- [ ] Marketplace program deployed + reviewed
- [ ] API authN/authZ + rate limiting
- [ ] Chain observation source trust model documented (RPC provider)
- [ ] Treasury custody policy + ops runbook
- [ ] Incident response plan (contact, freeze procedure, disclosure)
- [ ] External review of marketplace settlement code by a second engineer
- [ ] Legal/ToS/privacy policy reviewed for the target jurisdiction
