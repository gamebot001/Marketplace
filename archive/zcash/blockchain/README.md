# blockchain/

Everything that talks to Zcash / the ZSA testnet.

```
asset_identity.py     ZIP 227 assetDescHash math (implemented + tested)
zsa_rpc.py            read-only JSON-RPC client (stdlib only)
check_connection.py   safe, read-only connectivity check to the public
                      ZSA testnet node
issue_asset.py        issuance plan builder + guarded CLI
verify_issuance.py    verify an issuance tx contains our desc hash (best-effort)
networks.md           recorded status of the networks we touch
```

**Safety interlocks**

- Read-only RPC only in this phase.
- `issue_asset.py` refuses to sign/issue (tooling not wired yet) and
  **hard-refuses mainnet** under all conditions.
- No keys, seeds, or wallet files live in this folder — ever.

Status and research notes: `docs/asset_design.md`,
`docs/ecosystem_research.md`.
