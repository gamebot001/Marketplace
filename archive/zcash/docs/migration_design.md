# Zecians — Migration Design (Testnet → Mainnet)

## The rule

> **Testnet ownership never silently becomes mainnet ownership.**

There is no protocol bridge. The mainnet Zecians will be **freshly issued
assets** (ZIP 227, mainnet issuer key) whose allocation is bound to the
testnet collection by our own claims system. This document defines that
system. It is a major architectural requirement, so it is built and tested
from day one — even though execution is far in the future.

## Why deterministic asset identity carries over

ZIP 227 derives `AssetId = (issuer, BLAKE2b-256("ZSA-AssetDescCRH", desc))`.
The derivation is **the same on any network** that adopts ZIP 226/227 — the
ZIP even discusses carrying the same desc string into future pools. So:
same desc strings (`zsc1|zecians-genesis|001`…) + documented mainnet issuer key
lineage ⇒ **same identity semantics** on mainnet. What we do NOT promise:
byte-identical on-chain objects before NU7 exists, or any migration at all
if ZSA never activates on mainnet. The claims system makes the *allocation*
transferable regardless.

## The migration lifecycle

```
snapshot  →  eligibility  →  claim  →  validate proof  →  approve
  →  (mainnet issuance, approved phase only)  →  recipient confirmed  →  completed
```

### 1. Snapshot (`migration_state.py`)
At a published height H: for every Zecian, record `{custody, known_holder,
escrow_state, last_transfer_id}` deterministically (ordered by nft_number;
re-running produces byte-identical snapshots — tested). The snapshot is
hashed and published.

### 2. Eligibility (`eligibility_service.py`)
An asset is eligible iff, in the snapshot:
- it exists in the collection manifest, and
- it is **not** inside an unsettled marketplace escrow, and
- it has **not** already been migrated/claimed-to-issued.

Holders are eligible iff they can prove control (next step). Lost wallet
access → documented recovery path: proof of original purchase record +
manual review (log + two-person rule later). No silent defaults.

### 3. Claim (`claim_service.py`)
- Holder requests a claim → server issues a **challenge**
  (server-secret-derived nonce bound to asset + claim id).
- **Control proof, v1 (implemented & tested):** holder presents the
  `claim_code` issued at purchase/mint (stored only as a hash).
- **Control proof, v2 (production target, interface stubbed):** a wallet
  signature over the challenge from the key controlling the asset. This
  needs ZSA wallet tooling that does not exist yet — honestly stubbed, not
  faked.
- States: `draft → challenged → proof_submitted → validated → approved →
  issued → completed`, plus `rejected / expired`.

### 4. Duplicate-claim protection (`claim_validator.py` + DB constraint)
- At most one active claim per asset (unique partial index in PostgreSQL;
  store-level guard + tests now).
- A second claim attempt on the same asset returns the *existing* claim's
  reference instead of creating a new one.
- Claim approvals are idempotent: approving twice changes nothing.

### 5. Marketplace escrow interplay
If the testnet asset is sold before migration, the *buyer* inherits
eligibility (snapshot/eligibility consult live escrow state). If it sits in
escrow at snapshot time, the claim is blocked until the sale completes or
cancels. Covered by tests.

### 6. Recipient & issuance
Approved claims specify a mainnet **shielded recipient address** (unified
or orchard). Mainnet issuance happens only in the approved launch phase,
per `asset_design.md`. Until then `issue_mainnet()` raises
`MainnetNotEnabled` — in code, not just in docs.

## What could go wrong (and the answer)

| Risk | Answer |
| --- | --- |
| NFT sold before migration | Buyer inherits eligibility via escrow-aware snapshot |
| NFT transferred before migration | Control proof (v2) is against the *current* holder; project-recorded claims re-verified |
| Lost wallet access | Manual recovery path with logged review |
| Multiple claim attempts | Unique-claim constraint + idempotent approvals |
| ZSA never activates on mainnet | Claims + snapshot remain a valid registry; nothing promised beyond that |
