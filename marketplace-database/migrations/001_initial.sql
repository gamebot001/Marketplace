-- ZECIANS Solana multi-collection marketplace schema (PostgreSQL 16)
-- Applied automatically on first `docker compose up` (empty volume).
--
-- Conventions:
--   * money is BIGINT lamports (1 SOL = 1000000000); never float
--   * addresses are base58 TEXT
--   * signatures are base58 TEXT, unique, used for idempotency/replay protection
--   * timestamps are TIMESTAMPTZ
--   * network values: 'solana-devnet' | 'solana-testnet' | 'solana-mainnet-beta'
--     (mainnet rows are additionally blocked in application code until launch)
--
-- The schema is generic: a marketplace listing references an asset_address and
-- a collection_address, never "Zecians". Zecians is one collection among many.

-- ---------------------------------------------------------------------------
-- Projects / collections
-- ---------------------------------------------------------------------------
CREATE TABLE projects (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id          TEXT NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    slug                TEXT NOT NULL UNIQUE,
    creator_address     TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending'
                        CHECK (verification_status IN ('pending','verified','rejected','suspended')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE collections (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug                TEXT NOT NULL UNIQUE,
    project_slug        TEXT NOT NULL REFERENCES projects(slug),
    name                TEXT NOT NULL,
    collection_address  TEXT UNIQUE,               -- null until actually deployed
    description         TEXT,
    image               TEXT,
    creator_address     TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending'
                        CHECK (verification_status IN ('pending','verified','rejected','suspended')),
    standard            TEXT NOT NULL DEFAULT 'metaplex-core',
    website             TEXT,
    socials             JSONB NOT NULL DEFAULT '{}'::jsonb,
    royalty_bps         INTEGER NOT NULL DEFAULT 0 CHECK (royalty_bps BETWEEN 0 AND 10000),
    marketplace_status  TEXT NOT NULL DEFAULT 'pending'
                        CHECK (marketplace_status IN ('pending','active','suspended')),
    chain_deployed      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Generic NFT assets
-- ---------------------------------------------------------------------------
CREATE TABLE assets (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_address       TEXT NOT NULL UNIQUE,
    collection_slug     TEXT NOT NULL REFERENCES collections(slug),
    collection_address  TEXT NOT NULL,
    owner_address       TEXT NOT NULL,
    standard            TEXT NOT NULL DEFAULT 'metaplex-core',
    metadata_uri        TEXT NOT NULL,
    creator_address     TEXT,
    royalty_bps         INTEGER NOT NULL DEFAULT 0 CHECK (royalty_bps BETWEEN 0 AND 10000),
    verified_collection BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX assets_collection_idx ON assets(collection_address);
CREATE INDEX assets_owner_idx ON assets(owner_address);

-- Ownership history; exactly one current owner row per asset.
CREATE TABLE owners (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_address   TEXT NOT NULL REFERENCES assets(asset_address),
    owner_address   TEXT NOT NULL,
    from_address    TEXT,
    signature       TEXT,
    slot            BIGINT,
    block_time      TIMESTAMPTZ,
    is_current      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_current_owner_per_asset
    ON owners(asset_address) WHERE is_current;
CREATE UNIQUE INDEX owners_signature_unique
    ON owners(signature) WHERE signature IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Marketplace: listings / sales / royalties / fees
-- ---------------------------------------------------------------------------
CREATE TABLE listings (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id          TEXT NOT NULL UNIQUE,
    asset_address       TEXT NOT NULL REFERENCES assets(asset_address),
    collection_address  TEXT NOT NULL,
    seller_address      TEXT NOT NULL,
    price_lamports      BIGINT NOT NULL CHECK (price_lamports > 0),
    currency            TEXT NOT NULL DEFAULT 'SOL',
    marketplace         TEXT NOT NULL DEFAULT 'zecians',
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','sold','cancelled','expired')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- at most one live listing per asset
CREATE UNIQUE INDEX one_live_listing_per_asset
    ON listings(asset_address) WHERE status = 'active';

CREATE TABLE sales (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_id                     TEXT NOT NULL UNIQUE,
    listing_id                  TEXT NOT NULL REFERENCES listings(listing_id),
    asset_address               TEXT NOT NULL,
    collection_address          TEXT NOT NULL,
    seller_address              TEXT NOT NULL,
    buyer_address               TEXT NOT NULL,
    price_lamports              BIGINT NOT NULL CHECK (price_lamports > 0),
    fee_bps                     INTEGER NOT NULL DEFAULT 0 CHECK (fee_bps BETWEEN 0 AND 10000),
    royalty_bps                 INTEGER NOT NULL DEFAULT 0 CHECK (royalty_bps BETWEEN 0 AND 10000),
    fee_lamports                BIGINT NOT NULL DEFAULT 0 CHECK (fee_lamports >= 0),
    royalty_lamports            BIGINT NOT NULL DEFAULT 0 CHECK (royalty_lamports >= 0),
    seller_proceeds_lamports    BIGINT NOT NULL CHECK (seller_proceeds_lamports >= 0),
    currency                    TEXT NOT NULL DEFAULT 'SOL',
    signature                   TEXT NOT NULL UNIQUE,   -- replay protection
    slot                        BIGINT,
    block_time                  TIMESTAMPTZ,
    status                      TEXT NOT NULL DEFAULT 'confirmed',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- integer conservation: deductions + proceeds == price
    CONSTRAINT sale_split_conserved
        CHECK (fee_lamports + royalty_lamports + seller_proceeds_lamports = price_lamports)
);

CREATE TABLE royalties (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_id         TEXT NOT NULL REFERENCES sales(sale_id),
    asset_address   TEXT NOT NULL,
    creator_address TEXT,
    lamports        BIGINT NOT NULL CHECK (lamports >= 0),
    signature       TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE marketplace_fees (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_id     TEXT REFERENCES sales(sale_id),
    fee_bps     INTEGER NOT NULL CHECK (fee_bps BETWEEN 0 AND 10000),
    lamports    BIGINT NOT NULL CHECK (lamports >= 0),
    signature   TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Treasury ledger
-- ---------------------------------------------------------------------------
CREATE TABLE treasury_events (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id    TEXT NOT NULL UNIQUE,
    kind        TEXT NOT NULL CHECK (kind IN ('marketplace_fee','mint_proceeds')),
    lamports    BIGINT NOT NULL CHECK (lamports >= 0),
    signature   TEXT,
    slot        BIGINT,
    block_time  TIMESTAMPTZ,
    ref         TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX treasury_idempotency
    ON treasury_events(kind, signature) WHERE signature IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Indexed on-chain activity / mint events
-- ---------------------------------------------------------------------------
CREATE TABLE activity_events (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    signature           TEXT NOT NULL UNIQUE,
    slot                BIGINT,
    block_time          TIMESTAMPTZ,
    type                TEXT NOT NULL,
    asset_address       TEXT,
    collection_address  TEXT,
    from_address        TEXT,
    to_address          TEXT,
    seller_address      TEXT,
    buyer_address       TEXT,
    lamports            BIGINT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_slot_idx ON activity_events(slot DESC);

CREATE TABLE mint_events (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_address       TEXT NOT NULL UNIQUE,
    collection_address  TEXT NOT NULL,
    recipient_address   TEXT NOT NULL,
    lamports            BIGINT NOT NULL DEFAULT 0 CHECK (lamports >= 0),
    signature           TEXT NOT NULL UNIQUE,
    slot                BIGINT,
    block_time          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Future-compatible participation accounting (no token, no allocations)
-- ---------------------------------------------------------------------------
CREATE TABLE participation (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    address     TEXT NOT NULL,
    kind        TEXT NOT NULL
                CHECK (kind IN ('marketplace_buy','marketplace_sell','mint','creator',
                                'verified_activity','treasury_fee')),
    weight      BIGINT NOT NULL DEFAULT 0 CHECK (weight >= 0),
    ref         TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (address, kind, ref)
);

-- ---------------------------------------------------------------------------
-- Indexer cursor
-- ---------------------------------------------------------------------------
CREATE TABLE indexer_cursor (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    last_slot   BIGINT NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Seed: the real Zecians flagship (no chain address is invented).
-- ---------------------------------------------------------------------------
INSERT INTO projects (project_id, name, slug, verification_status)
VALUES ('zecians', 'Zecians', 'zecians', 'verified')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO collections (slug, project_slug, name, collection_address, description,
                         verification_status, standard, marketplace_status, chain_deployed)
VALUES ('zecians', 'zecians', 'Zecians', NULL, 'The flagship Zecians collection.',
        'verified', 'metaplex-core', 'pending', FALSE)
ON CONFLICT (slug) DO NOTHING;
