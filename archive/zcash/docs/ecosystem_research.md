# ZECIANS — Ecosystem Research

**Research date:** 2026-09-19
**Researcher:** Project engineering (live web sources; see §12)

## How to read this document

Every claim is tagged with one of five tiers. Zecians development decisions
may only rely on **[V]** and **[P]** items. Anything tagged **[A]** or **[F]**
must be re-verified before we depend on it.

| Tag | Meaning |
| --- | --- |
| **[V] Verified fact** | Confirmed from an official/primary source during this research session |
| **[P] Protocol limitation** | A hard property of the Zcash protocol per its ZIPs/spec |
| **[X] Project-specific** | Something a specific project built (not protocol; not ours to copy) |
| **[A] Assumption** | Reasonable inference we have NOT yet verified ourselves |
| **[F] Future-dependent** | True only if/when a future network upgrade activates |

---

## 1. Zcash protocol status [V]

- Zcash is a proof-of-work blockchain with shielded (private) transfers.
  Its newest shielded pool is **Orchard** (activated NU5, 2022); addresses used
  today are **Unified Addresses** (ZIP 316) that can contain Orchard, Sapling
  and transparent receivers.
- **zcashd is deprecated.** The node ecosystem is moving to **Zebra**
  (Zcash Foundation's Rust node) and **Zallet**, an RPC wallet explicitly
  "designed to replace the deprecated `zcashd` embedded wallet".
  Zallet is currently in **beta** with breaking changes expected.
- The current user-facing flagship wallet is **Zashi** (ECC; recent 2.4.x
  releases; z.cash now also lists it as "Zodl (aka Zashi)"). Zashi ships
  swaps (NEAR Intents), CrossPay, Tor support.
- Current protocol spec version line: 2025.6.x [NU6.1] per ZIP 226 references.
- **Implication for Zecians:** any "run a node + wallet" plan must target
  Zebra + Zallet, not zcashd. Zallet beta status is a real constraint for
  server-side payment verification tooling.

## 2. Zcash Shielded Assets (ZSA) — ZIP 226 / 227 / 228 [V]

### ZIP 226 — Transfer and Burn of ZSAs (status: **Draft**)

- Defines **OrchardZSA**: custom assets transferred inside the Orchard
  shielded pool using **v6 transactions**, targeted at network upgrade
  **NU7**. **ZSAs are NOT live on mainnet today** [P].
- Per-asset value balancing: each asset balances against its own **Asset
  Base** point; the whole design keeps asset identity and amounts private
  inside the shielded pool [P].
- **Custom assets cannot be unshielded** to the transparent pool ("the
  transparent protocol will not be changed with this ZIP... unshielding will
  not be possible for Custom Assets") [P]. ZSAs live and die shielded, or are
  **burned** (publicly provable destruction) [P].
- An `enableZSA` consensus flag can pause ZSA functionality [V].

### ZIP 227 — Issuance of ZSAs (status: **Draft**)

- **Issuance is deliberately transparent**: the issuer identity (issuance
  validating key) is public; asset supply is publicly trackable; transfers
  thereafter are shielded [V].
- **Asset Identifier** = `(issuer, assetDescHash)` where
  `assetDescHash = BLAKE2b-256(person="ZSA-AssetDescCRH", asset_desc)`.
  The asset description is an issuer-chosen UTF-8 byte string. Canonical
  encoding: `0x00 || issuer || assetDescHash` [V].
- **NFT pattern is first-class in the ZIP**: "NFT issuance is enabled by
  issuing in a single bundle several issuance actions, where each AssetId
  corresponds to value = 1 ... make sure finalize = 1" [V]. `finalize=1`
  permanently caps supply of that asset id.
- Issuance keys derive from a ZIP 32 hardened path (purpose `227'`),
  signatures are **BIP-340 Schnorr over secp256k1** [V].
- Fees are paid in ZEC (conventional ZIP 317 fee, plus issuance actions
  surcharge) [V].
- Reference implementation status per the ZIP itself: QED-it forks of
  zcashd/orchard/librustzcash/halo2; test vectors and reference-implementation
  links are partly "TBD" — i.e., the specification ecosystem is still moving
  [V].

### ZIP 228 — Asset Swaps (status: **Draft**, "proposed to activate in a future Network Upgrade")

- Non-custodial P2P asset swaps: traders publish **off-chain Swap Orders**
  (signed Action Groups); a matcher combines matching orders into an on-chain
  **Swap Bundle**. The matcher never holds custody [V].
- Supports matcher fees in ZEC, order expiry heights, replay protection via
  binding signatures [V].
- **[F] This is the future trustless marketplace settlement mechanism Zecians
  should adopt when it activates.** Until then any marketplace we run is
  escrow/custodial in some part, and must be labeled as such.

## 3. ZSA testnet status

- **[V] A public ZSA testnet JSON-RPC node exists:**
  `https://dev.zebra.zsa-test.net`. This endpoint is published in ZecBit's
  public verification documentation together with an example issuance
  transaction id (`611dfd...26317`), indicating a running zebra-based ZSA
  testnet network with real ZSA issuance activity.
- **[A]** The network is operated by/with QED-it (the ZSA spec authors);
  exact operator, stability, and reset policy are **not yet verified by us**.
- **[A]** Wallet support on this testnet is currently limited to QED-it
  tooling builds (their zcashd fork / CLI flows); mainstream wallets (Zashi,
  Zallet) do **not** support v6/ZSA transactions yet. This is the single
  biggest practical constraint for the Zecians user experience.
- **Next verification step for us:** query `getblockchaininfo` and the
  example issuance tx via `blockchain/check_connection.py` and record results
  in `blockchain/networks.md`.

## 4. Existing Zcash NFT / asset projects (product research)

### 4.1 ZecBit — https://zecbit.net/ [V: public site + docs, 2026-09-19]

**Positioning:** "The private NFT market on Zcash." Header badges: "Live ·
ZSA". Two collections: **ZecBit Genesis — Shielded** (3,333 items, floor
0.359 ZEC, volume ≈ 345.86 ZEC) and **Zec Punks** (1,555 items).

**What they built (architecture signals from their own docs):**

- **[X] Asset identity via real ZIP 227 descriptions.** Their verify page
  publishes the exact scheme: `desc = "zmd1|zecbit-genesis|1"`,
  `blake2b(desc, digest_size=32, person=b"ZSA-AssetDescCRH")` — i.e., the
  standard `assetDescHash`. Buyers can recompute it and search for it inside
  the issuance transaction **on any node ZecBit does not operate**.
- **[X] "Committed on-chain":** every item's identity hash is committed in
  the issuance transaction before sale ("every seed committed before sale").
- **[X] Explicit privacy boundary (excellent practice):** "What this proves:
  the item exists and was issued by the key that signed that transaction.
  What it deliberately cannot show: who holds it. Ownership is a shielded
  note, invisible to this page and to us."
- **[X] Ownership certificates:** assignments are summarized into a hash
  written into a Zcash transaction; holders keep certificates; "No snapshot
  has been published yet" — i.e., the strong ownership-proof feature is
  designed but not yet live.
- **[X] Shielded checkout:** purchases settle in shielded ZEC; "Prices are
  known only to the parties involved." Public floors/volume are published
  selectively ("publish only what settled here").
- **[X] Curated drops:** one drop at a time; creators apply to launch;
  "a person reads it."
- **[X] Loyalty loop:** a "Points" system; activity feed is public but shows
  counterparty as "zecbit.net → shielded" (marketplace side public, buyer
  side shielded).

**Lessons for Zecians (take, don't copy):**

1. Publish a **self-serve verification page** — it converts skeptics.
2. Be **explicit about the privacy boundary** — it builds trust.
3. On-chain identity commitment **before** sale is the authenticity story.
4. Prices private, public stats curated — good UX for a privacy chain.
5. Their `zmd1|<collection>|<item>` desc format is *their* convention. We
   will define our own (see `docs/asset_design.md`), not reuse theirs.

**What we deliberately do NOT copy:** branding, art style, collection size
(3,333), floor/VOLUME figures, desc prefix `zmd1`, points mechanics details.

### 4.2 Zaddr — https://zaddr.net/ [V: public site, 2026-09-19]

**Positioning:** "Nice to not meet you. Every face is public. Every owner
isn't." Supply 2,800 · Zcash · Shielded · mainnet · Orchard pool.

**Community mechanics observed:**

- **[X] Application/allowlist flow:** X (Twitter) OAuth with read-only
  scopes ("we read your handle. we cannot post, dm, or follow"), no email /
  KYC / wallet to apply.
- **[X] Contribution-based eligibility:** "we watch who talks about zaddr on
  x. positive posts on your wall raise your chances"; tasks detected after
  applying.
- **[X] Public status checker** + shareable application card ("download
  card"), switchable account.
- **[X] Shielded allocation:** winners submit a **shielded address**
  (`u1...` unified or `zs1...` sapling); "paste — do not retype"; a
  "change address" flow exists (rotate to a fresh address).
- **[X] Voluntary map/spread visualization** (`/map`).
- **[X] Anti-fraud loop:** "your contribution wasn't enough this time. apply
  again as a true contributor" — rejection is a loop back into contribution.

**Disagreement found (documented, not silently resolved):** the homepage
shows `mint 21 sept · price 0.02 zec`, while the application page state
shows `mint: not scheduled · price: undecided`. The application page is the
dynamic source (it drives an API), so we treat **"not scheduled / undecided"
as authoritative** and the homepage banner as likely stale marketing.
Lesson: Zecians must keep one source of truth for mint state.

**Lessons for Zecians:** application + checker + shareable card + shielded
allocation is a strong, privacy-consistent funnel. We will build **original**
Zecians versions (different scoring signals, different card design, our own
lore), per §17 of the project brief.

## 5. Wallets [V/A]

- **[V] Zashi** — ECC's mobile wallet (iOS/Android), the de-facto consumer
  wallet; supports Orchard, UA, swaps. **[A] No ZSA/v6 support yet.**
- **[V] Zallet** — full-node RPC wallet, beta, replaces zcashd wallet;
  many RPC methods still being ported.
- **[V] Also listed on z.cash:** Zodl (aka Zashi), Edge, Ywallet, Nighthawk.
- **[P] Consequence:** today, ordinary users **cannot** hold a ZSA in a
  mainstream wallet. Any Zecians holder experience until ZSA wallets ship
  must either run testnet tooling or be represented by the project
  (clearly labeled). This drives our design: **testnet-first, custodial
  representation clearly disclosed, migration path designed.**

## 6. Marketplaces & payment infrastructure

- **[X] ZecBit** is currently the reference implementation of a Zcash NFT
  marketplace: shielded ZEC settlement, curated drops, private prices.
- **[V] Payment reachability for buyers is improving fast:** Gemini added
  shielded ZEC withdrawals; Zashi Swaps (NEAR Intents) and CrossPay give
  decentralized on/off-ramps; Maya integration adds cross-chain paths.
- **[F] ZIP 228 swaps** would remove the need for marketplace escrow —
  not available today.
- **[P] ZSAs cannot be unshielded**, and transparent-pool contracts don't
  exist on Zcash — so "smart-contract escrow" like Ethereum escrow is not a
  thing here. Escrow on Zcash = off-chain custody by an operator, or
  multisig-style conventions, or (future) ZIP 228. Our marketplace design
  (`docs/marketplace_flow.md`) states this plainly.

## 7. Indexing infrastructure

- **[A]** ZecBit self-operates its indexing/activity feed (their site shows
  curated activity with marketplace-side attribution).
- **[A]** Zcash Foundation's **Zaino** indexer exists for Zebra-based
  indexing of shielded data; its ZSA-readiness is unverified by us.
- **[P]** Shielded transfers are **not publicly attributable** — no indexer
  can produce a public "holder list" for shielded ZSA ownership. Any holder
  stats we show are either issuance-side facts or project-recorded facts
  (e.g., who we issued/minted to), and must be labeled as such.

## 8. Metadata conventions

- **[P]** There is **no official, activated Zcash NFT metadata standard**.
  ZIP 227 only standardizes the asset identifier; wallets are told NOT to
  display raw `asset_desc` as a name and are encouraged toward registry /
  petname systems.
- **[X]** ZecBit's convention: identity = hash of a desc string committed
  on-chain; metadata/artwork served off-chain from their API.
- **Zecians choice [X-ours]:** follow the same *shape* (ZIP 227 desc +
  content-addressed off-chain metadata), but with our own schema
  (`zecians.metadata.v1`), our own desc prefix, and hashes recorded in a
  signed manifest. Documented as **project-specific**, never as official.

## 9. Mainnet migration possibilities

- **[P]** ZSA assets do not exist on mainnet until NU7 (or a later upgrade)
  activates ZSA consensus. No "testnet token → mainnet token" bridge exists
  at the protocol level.
- **[P]** ZIP 227 asset identity is derived from `(issuer key, desc hash)` —
  deterministic and portable across shielded pools *by design* ("the same
  Asset description string can be carried on, potentially mapping into a
  different shielded pool"), which is exactly what makes a deterministic
  testnet→mainnet re-issuance plan *possible*: same issuer key material
  lineage + same desc strings ⇒ same asset identity semantics on mainnet,
  issued fresh at NU7 activation.
- **[A/F]** We must not promise byte-identical asset IDs across networks
  until we control the issuer key on both networks and NU7 is defined.
  Our migration design (`docs/migration_design.md`) treats mainnet issuance
  as a **fresh issuance event** bound to testnet ownership by our own
  claims system, with eligibility snapshots and duplicate-claim protection.

## 10. Disagreements & open questions

| Question | Source A | Source B | Resolution for Zecians |
| --- | --- | --- | --- |
| Zaddr mint date/price | Homepage: "21 sept, 0.02 ZEC" | Apply page: "not scheduled / undecided" | Apply page (dynamic state) wins; single-source-of-truth lesson learned |
| ZSA testnet operator/stability | ZecBit docs (endpoint) | No official z.cash page details yet | Treat as community testnet; verify ourselves; never promise uptime |
| "Live · ZSA" on ZecBit | Site badges ZSA live | ZIPs say ZSA = Draft/NU7 | ZSA exists on the **ZSA testnet**, not mainnet; label all Zecians chain work as testnet |
| Wallet ZSA support | — | — | [A] assume none in mainstream wallets until proven; design around it |

## 11. Zecians positioning (derived)

1. **Zecians = art + identity + privacy + community + Zcash**, testnet-first.
2. We **prove issuance publicly** (ZIP 227 desc hashes, verifiable by anyone)
   and we **never publish shielded ownership** we cannot know.
3. Payments (later phase) are **real ZEC**, verified by our own backend
   against a node we don't control the truth of — we verify, not trust.
4. Community mechanics (application, checker, card, map) are built
   original, privacy-consistent, and contribution-oriented.
5. Everything that depends on NU7/ZIP 228 is labeled **future-dependent**.

## 12. Sources consulted (2026-09-19)

- ZIP 226 — https://zips.z.cash/zip-0226
- ZIP 227 — https://zips.z.cash/zip-0227
- ZIP 228 — https://zips.z.cash/zip-0228
- ECC blog — https://electriccoin.co/blog/ (Zashi releases, roadmap Q4 2025,
  Gemini shielded withdrawals, Zashi Swaps/CrossPay posts)
- z.cash ZSA page — https://z.cash/zsa/ (QED-it monthly update index)
- z.cash ecosystem pages — https://z.cash/ecosystem/
- Zallet — https://github.com/zcash/Zallet (README: beta, replaces deprecated
  zcashd wallet)
- ZecBit — https://zecbit.net/ and https://zecbit.net/verify
- Zaddr — https://zaddr.net/ and https://zaddr.net/apply
