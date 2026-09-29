# Zecians — Development Setup (macOS, Apple M2, beginner-friendly)

Every command below is copy-pasteable. Each says **why** it exists.

## 0. What you need installed

| Tool | Check | Why Zecians needs it |
| --- | --- | --- |
| Python 3.9+ | `python3 --version` | Backend services, tests |
| Node.js 18+ | `node --version` | The website (Next.js) |
| Docker Desktop | `docker --version` | PostgreSQL without manual install |
| Git | `git --version` | (Later — repo stays local for now) |

If any are missing: install [Homebrew](https://brew.sh) then
`brew install python node git` and install Docker Desktop from
https://www.docker.com/products/docker-desktop/.

> Verified with system Python 3.9 on macOS. A newer Python is fine too.

## 1. Python environment

```bash
cd ~/Desktop/zecians
python3 -m venv .venv          # isolated Python sandbox
source .venv/bin/activate      # use it in every new terminal
pip install --upgrade pip
pip install -r marketplace_backend/requirements.txt
```

## 2. Collection data (separate NFT project)

The Zecians collection artwork, traits, metadata and manifest now live in the
separate **Zecians NFT project** at `~/Desktop/zecians-nft-project`. This
repository is the marketplace platform and does not depend on those files.

## 3. Run the test suite

```bash
python -m pytest marketplace_tests/ -q
```

Tests are the definition of "working". Everything green = the core logic is
verified.

## 4. Run the backend API

```bash
uvicorn marketplace_backend.app.main:app --reload --port 8788
# open http://127.0.0.1:8788/api/health
#      http://127.0.0.1:8788/api/collections
```

## 5. Marketplace website

```bash
cd marketplace-website
npm install        # one-time
npm run dev        # http://localhost:3001
```

## 6. PostgreSQL (optional today, required before the DB phase)

```bash
docker compose up -d postgres
docker compose exec postgres psql -U zecians -d zecians -c "\dt"
```

The schema in `marketplace-database/migrations/001_initial.sql` is applied
automatically on first start (docker-entrypoint-initdb.d).

## 7. Environment variables

```bash
cp .env.example .env
# Edit .env: generate real values for the two "change_me" secrets:
python -c "import secrets; print(secrets.token_hex(32))"
```

Configuration lives outside code; secrets never enter git.

## 8. Solana (read-only in this phase)

- Development network is `solana-devnet` (set in `.env`).
- The backend exposes a read-only JSON-RPC client
  (`marketplace_backend/services/solana/solana_chain_service.py`). No signing
  or broadcasting.
- Set `SOLANA_TREASURY_ADDRESS` (public) and `ZECIANS_MARKETPLACE_PROGRAM_ID`
  once available. Leave them blank until then — never invent values.
- **Mainnet is refused by all code** until the explicit launch phase.

## 9. Daily workflow

```bash
source .venv/bin/activate        # 1) python sandbox
python -m pytest marketplace_tests/ -q   # 2) are we green?
uvicorn marketplace_backend.app.main:app --reload --port 8788   # 3) backend (terminal A)
cd marketplace-website && npm run dev    # 4) marketplace website :3001 (terminal B)
```
