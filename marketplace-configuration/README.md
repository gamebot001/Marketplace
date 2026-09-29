# marketplace-configuration/

Non-secret configuration. Secrets live only in `.env` (git-ignored).

```
networks.json      known Solana networks (devnet/testnet; mainnet-beta disabled)
app.json           active feature flags / fees / limits
app.example.json   template
```

- `networks.json` records the public Solana RPC endpoints. Backend code treats
  `solana-mainnet-beta` as refused until the explicit launch phase (see
  `marketplace-documentation/security.md`).
- `app.json` holds feature flags and fee configuration. `marketplace_fee_bps`
  and `royalty_bps_default` are placeholders (`0` = disabled) and must be set
  to final values before launch. Copy `app.example.json` to `app.json` if you
  need to tweak flags.
