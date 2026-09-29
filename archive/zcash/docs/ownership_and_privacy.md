# Zecians — Ownership & Privacy

## The honest model

Zcash gives us a unique property: after issuance (which is public and
verifiable), **transfers of a ZSA are shielded** — the chain does not
publish who owns what. This document states exactly what each actor can
know. If we ever can't know something, we say so in the product UI too.

## Who knows what

| Fact | Public chain | Zecians backend | Holder |
| --- | --- | --- | --- |
| Zecian #003 exists (desc hash in issuance tx) | ✅ | ✅ | ✅ |
| Issuance tx + issuer key | ✅ | ✅ | ✅ |
| Metadata/artwork content | ✅ (via manifest) | ✅ | ✅ |
| Who holds #003 **right now** | ❌ | "project_recorded" only (see below) | ✅ |
| Price paid in a private sale | ❌ | only if settled via us | ✅ |

## The three knowledge states in our ownership store

`backend/services/ownership/ownership_state.py` models every Zecian with:

- `custody`:
  - `project` — held by the project (pre-mint, escrow, treasury).
  - `transparent_holder` — held at a known (testnet-transparent or
    project-recorded) holder.
  - `shielded` — transferred into the shielded pool; **the public cannot
    know the holder; the backend does not claim to**.
  - `unknown` — evidence exhausted (e.g., wallet lost, off-project transfer
    we can't attribute).
- `known_holder`: set only when knowledge is real (`project`,
  `transparent_holder`, or `project_recorded`).
- `knowledge_basis`: `issuance_record` | `transfer_event` | `escrow_state` |
  `none` — every claim in our UI must be traceable to one of these.

## What the indexer is and is not

`ownership_indexer.py`:

- Consumes **ordered, deduplicated transfer events** (by `(txid, index)`),
  applies them to state deterministically, and is idempotent (replay-safe,
  cursor-based).
- **Cannot** discover shielded recipients it has no viewing information
  for. When a Zecian moves into an unknown shielded note, the state becomes
  `shielded` and public-facing stats stop naming a holder.
- Does **not** produce "holder counts" from shielded data. Any "X of 10
  minted" stats come from issuance-side facts only.

## Consequences we accept (and communicate)

1. **No public holder leaderboard** for shielded holders. Ever.
2. **"Prove you own a Zecian without revealing which"** — a real future
   feature: the holder knows their note; a proof requires wallet/protocol
   support that does **not** exist today for ZSAs (documented in
   `ecosystem_research.md` §5). Until then, any ownership check is either
   (a) against project records (labeled as such), or (b) impossible. We do
   not fake it.
3. **Transfer UX**: when a holder transfers to another party, the project
   record may go stale (we may see an outgoing event but not the new
   holder). Our records say exactly that rather than guessing.

## Why this is actually a feature

Ethereum NFTs publish a global ownership graph: your wallet's entire
history is public. Zecians' default is: **provenance public, possession
private**. That difference is the product.
