# Networks Zecians touches

## `local` (current phase)
Everything in-process; no chain. Collection + logic only.

## `zsa-testnet`
- Public JSON-RPC node: `https://dev.zebra.zsa-test.net`
  - **Verified by us 2026-09-19 (read-only `getblockchaininfo`):**
    reachable, `chain: "test"`, height **2,831**, chain supply ≈ 3,583 ZEC
    (testnet coin), full verification progress. A real zebra-based chain.
  - The young height indicates a **fresh/reseeded chain**: ZecBit's
    publicly-documented example issuance txid
    (`611dfd…26317`, desc `zmd1|zecbit-genesis|1`) is **no longer present**
    (`getrawtransaction` → -5). Conclusion: the public testnet has been
    reset since that documentation was published. Our own issuance tests
    will therefore verify OUR txids on OUR schedule — never assume
    third-party examples persist.
  - Community-run: no SLA. Never build user-facing guarantees on it.
- ZSA consensus (ZIP 226/227) is **Draft**; targeted at NU7; testnet only.

## `mainnet`
- **Refused by all Zecians code** until the owner-approved launch phase.
- Mainnet ZEC payments (later phase) use read-only verification against a
  node/viewing key backend; no spending keys live on servers.
