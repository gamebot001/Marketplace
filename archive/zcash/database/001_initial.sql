-- ZECIANS initial schema (PostgreSQL 16)
-- Applied automatically on first `docker compose up` (empty volume).
--
-- Conventions:
--   * money is BIGINT zatoshi (1 ZEC = 100000000); never float
--   * timestamps are TIMESTAMPTZ
--   * network values: 'local' | 'zsa-testnet' | 'mainnet' (mainnet rows are
--     additionally blocked in application code until the launch phase)

CREATE TABLE collections (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    collection_id   TEXT NOT NULL UNIQUE,
    schema_version  TEXT NOT NULL,
    supply          INTEGER NOT NULL CHECK (supply > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE nfts (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    collection_id   TEXT NOT NULL REFERENCES collections(collection_id),
    nft_number      INTEGER NOT NULL CHECK (nft_number >= 1),
    name            TEXT NOT NULL,
    epithet         TEXT NOT NULL,
    traits          JSONB NOT NULL,
    rarity          JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (collection_id, nft_number)
);

CREATE TABLE metadata_records (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nft_id              BIGINT NOT NULL UNIQUE REFERENCES nfts(id),
    schema_version      TEXT NOT NULL,
    metadata_sha256     TEXT NOT NULL UNIQUE,
    artwork_file        TEXT NOT NULL,
    artwork_sha256      TEXT NOT NULL,
    asset_desc          TEXT NOT NULL,
    asset_desc_hash     TEXT NOT NULL UNIQUE,
    raw                 JSONB NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE asset_identifiers (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_desc_hash     TEXT NOT NULL UNIQUE,
    asset_desc          TEXT NOT NULL,
    issuer              TEXT,
    status              TEXT NOT NULL DEFAULT 'not_issued'
                        CHECK (status IN ('not_issued','issuance_planned','issued','burned')),
    network             TEXT NOT NULL CHECK (network IN ('local','zsa-testnet','mainnet')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE issuance_transactions (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_desc_hash     TEXT NOT NULL REFERENCES asset_identifiers(asset_desc_hash),
    txid                TEXT NOT NULL,
    height              BIGINT,
    network             TEXT NOT NULL CHECK (network IN ('zsa-testnet','mainnet')),
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (asset_desc_hash, txid, network)
);

-- One canonical ownership row per NFT per network.
CREATE TABLE ownership_state (
    nft_id              BIGINT NOT NULL UNIQUE REFERENCES nfts(id),
    network             TEXT NOT NULL DEFAULT 'local',
    custody             TEXT NOT NULL
                        CHECK (custody IN ('project','transparent_holder','shielded','unknown')),
    known_holder        TEXT,
    knowledge_basis     TEXT NOT NULL
                        CHECK (knowledge_basis IN ('issuance_record','transfer_event','escrow_state','none')),
    last_txid           TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transfers (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nft_id              BIGINT NOT NULL REFERENCES nfts(id),
    txid                TEXT NOT NULL,
    action_index        INTEGER NOT NULL DEFAULT 0,
    height              BIGINT,
    visibility          TEXT NOT NULL CHECK (visibility IN ('transparent','shielded','unknown')),
    from_ref            TEXT,
    to_ref              TEXT,
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (txid, action_index)          -- replay protection
);

CREATE TABLE mint_requests (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nft_id              BIGINT NOT NULL REFERENCES nfts(id),
    buyer_ref           TEXT NOT NULL,
    payment_request_id  BIGINT,
    idempotency_key     TEXT NOT NULL UNIQUE,
    state               TEXT NOT NULL
                        CHECK (state IN ('awaiting_payment','payment_confirmed','queued_for_issuance',
                                         'issuance_submitted','issued','failed')),
    issuance_payload_hash TEXT,
    issuance_txid       TEXT,
    failure_reason      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- at most one non-failed mint request per NFT
CREATE UNIQUE INDEX one_live_mint_per_nft
    ON mint_requests (nft_id) WHERE state <> 'failed';

CREATE TABLE payments (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_ref         TEXT NOT NULL UNIQUE,
    nft_id              BIGINT REFERENCES nfts(id),
    purpose             TEXT NOT NULL CHECK (purpose IN ('mint','purchase','other')),
    amount_zat          BIGINT NOT NULL CHECK (amount_zat > 0),
    recipient_address   TEXT NOT NULL,
    status              TEXT NOT NULL
                        CHECK (status IN ('pending','matched','confirmed','consumed',
                                          'underpaid','expired')),
    observed_txid       TEXT,
    observed_amount_zat BIGINT,
    observed_height     BIGINT,
    match_mode          TEXT CHECK (match_mode IN ('memo_ref','amount_fallback')),
    overpay_excess_zat  BIGINT NOT NULL DEFAULT 0 CHECK (overpay_excess_zat >= 0),
    shortfall_zat       BIGINT NOT NULL DEFAULT 0 CHECK (shortfall_zat >= 0),
    needs_review        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ,
    confirmed_at        TIMESTAMPTZ,
    consumed_by         TEXT
);

CREATE TABLE observed_transactions (
    txid            TEXT PRIMARY KEY,
    amount_zat      BIGINT NOT NULL,
    memo            TEXT,
    address         TEXT,
    height          BIGINT,
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_orphans (
    txid            TEXT PRIMARY KEY REFERENCES observed_transactions(txid),
    reason          TEXT NOT NULL,
    review          BOOLEAN NOT NULL DEFAULT FALSE,
    related_request BIGINT,
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE marketplace_listings (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nft_id          BIGINT NOT NULL REFERENCES nfts(id),
    seller_ref      TEXT NOT NULL,
    price_zat       BIGINT NOT NULL CHECK (price_zat > 0),
    status          TEXT NOT NULL
                    CHECK (status IN ('active','payment_pending','sold','cancelled','expired')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- at most one live listing per NFT
CREATE UNIQUE INDEX one_live_listing_per_nft
    ON marketplace_listings (nft_id) WHERE status IN ('active','payment_pending');

CREATE TABLE sales (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id          BIGINT NOT NULL UNIQUE REFERENCES marketplace_listings(id),
    buyer_ref           TEXT NOT NULL,
    price_zat           BIGINT NOT NULL CHECK (price_zat > 0),
    payment_id          BIGINT REFERENCES payments(id),
    state               TEXT NOT NULL
                        CHECK (state IN ('payment_pending','payment_received','transfer_pending',
                                         'transferred','completed','cancelled',
                                         'refund_pending','refunded')),
    transfer_txid       TEXT UNIQUE,          -- double-assignment protection
    transfer_payload_hash TEXT,
    refund_txid         TEXT,
    failure_reason      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE migration_snapshots (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    collection_id   TEXT NOT NULL REFERENCES collections(collection_id),
    height          BIGINT NOT NULL,
    snapshot_hash   TEXT NOT NULL UNIQUE,
    payload         JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE migration_claims (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nft_id              BIGINT NOT NULL REFERENCES nfts(id),
    requester_ref       TEXT NOT NULL,
    snapshot_hash       TEXT NOT NULL REFERENCES migration_snapshots(snapshot_hash),
    state               TEXT NOT NULL
                        CHECK (state IN ('draft','challenged','proof_submitted','validated',
                                         'rejected','approved','issued','completed','expired')),
    challenge           TEXT NOT NULL,
    recipient_address   TEXT,
    approved_by         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- at most one live/completed claim per NFT
CREATE UNIQUE INDEX one_live_claim_per_nft
    ON migration_claims (nft_id)
    WHERE state IN ('draft','challenged','proof_submitted','validated','approved','issued','completed');

CREATE TABLE audit_events (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event       TEXT NOT NULL,
    subject     TEXT,
    payload     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO collections (collection_id, schema_version, supply)
VALUES ('zecians-genesis', 'zecians.metadata.v1', 10)
ON CONFLICT (collection_id) DO NOTHING;
