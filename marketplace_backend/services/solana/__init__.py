"""Solana-native service layer for the Zecians multi-collection marketplace.

Named services (see marketplace-documentation/architecture.md):
    SolanaChainService   — read-only RPC access to a Solana cluster
    NFTAssetService      — generic, standard-agnostic NFT asset model
    MarketplaceService   — listings + sale settlement over assets
    WalletService        — Solana address parsing/validation (never keys)
    TreasuryService      — Zecians platform fee + mint proceeds ledger
    IndexerService       — idempotent on-chain event ingestion

Supporting modules:
    fees                 — integer-lamport fee/royalty split
    collection_registry  — projects + collections + verification status
    accounting           — future-compatible participation records
    models               — shared constants / field definitions
"""
