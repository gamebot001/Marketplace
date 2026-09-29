# Zecians — Troubleshooting

Format: **Problem → Cause → Fix**.

## Python

**`command not found: python3`** → macOS needs developer tools or Homebrew
python → `xcode-select --install` or `brew install python`.

**`No module named fastapi` (or pytest)** → venv not active →
`source .venv/bin/activate` then
`pip install -r marketplace_backend/requirements.txt`.

**`Pillow` fails to install on Apple Silicon** → old pip →
`pip install --upgrade pip` (gets arm64 wheels) and retry.

## Tests

**`pytest` collects 0 tests** → run from the repo root:
`cd ~/Desktop/zecians && python -m pytest marketplace_tests/ -q`.

## Node / npm / frontend

**`npm ERR! network`** → proxy/VPN or DNS → retry; if behind a proxy set
`npm config set proxy …`. Verify with `npm ping`.

**`Port 3001 already in use`** → another dev server →
`kill $(lsof -ti :3001)`.

**`Module not found` in Next.js** → stale build →
`rm -rf marketplace-website/.next && npm run dev`.

## Docker / PostgreSQL

**`Cannot connect to the Docker daemon`** → Docker Desktop not running →
open Docker Desktop, wait for the whale icon, retry.

**`port is already allocated` (5433)** → another Postgres → stop it or
change `POSTGRES_PORT` in `.env` (and `DATABASE_URL`).

**psql: FATAL: password authentication failed** → stale volume from an old
password → `docker compose down -v` (deletes dev data!) then `up -d`.

**Tables missing** → initdb runs only on an empty volume →
`docker compose down -v && docker compose up -d`.

## Backend

**`Address already in use` (8788)** → old uvicorn →
`kill $(lsof -ti :8788)`.

**API returns empty collections** → the registry hasn't seeded yet → check
`GET /api/health`; the flagship collection is registered at startup.

## Solana / RPC / transactions

**RPC request times out** → public RPC endpoint down or your network blocks it
→ try again later or set `SOLANA_RPC_URL` to a different provider. Never use
this as an excuse to touch mainnet.

**Code refuses to start (mainnet)** → that's the safety interlock → use
`ZECIANS_SOLANA_NETWORK=solana-devnet`. Mainnet is disabled until the approved
launch phase.

**A transaction "disappears"** (rare) → chain reorg → events are re-observed
and re-confirmed by the indexer; check backend logs.

**Backend restarted mid-operation** → by design, nothing is lost → all events
are idempotent by signature; run the API and watch `/api/health`.

## Still stuck?

Run `python marketplace-scripts/check_environment.py` and include its output when
asking for help.
