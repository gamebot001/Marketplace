# marketplace-scripts/

Helper scripts for the marketplace project. Run from the repository root.

| Script | Purpose |
| --- | --- |
| `check_environment.py` | Verifies Python/Node/Docker/Postgres availability and prints versions |
| `setup_python.sh` | Creates `.venv` and installs marketplace backend requirements |
| `run_tests.sh` | Runs the marketplace pytest suite |
| `init_database.sh` | Starts PostgreSQL via docker compose and lists tables |

## Phase 2A Devnet pipeline (TypeScript)

The Phase 2A test collections are ingested from the artwork root
(`~/Desktop/collections` by default, override with `ZECIANS_ARTWORK_ROOT`) and
minted on Solana Devnet. The originals are never modified.

| Command | Purpose |
| --- | --- |
| `npm run phase2a:check` | Scan + validate artwork, print the manifest (no writes) |
| `npm run phase2a:artwork` | Copy artwork into the backend, generate metadata + manifest |
| `npm run phase2a:mint` | Create Core collections + assets, distribute owners, register in the backend |
| `npm run phase2a:market` | Real list / buy / cancel activity + indexer sync |
| `npm run typecheck` | Type-check the scripts |

Run the backend on port `8788` before `phase2a:mint` / `phase2a:market` so the
read model can be registered and synced. Outputs (including key material) are
written under `.keys/`, which is git-ignored.
