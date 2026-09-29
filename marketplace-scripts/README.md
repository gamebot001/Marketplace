# marketplace-scripts/

Helper scripts for the marketplace project. Run from the repository root.

| Script | Purpose |
| --- | --- |
| `check_environment.py` | Verifies Python/Node/Docker/Postgres availability and prints versions |
| `setup_python.sh` | Creates `.venv` and installs marketplace backend requirements |
| `run_tests.sh` | Runs the marketplace pytest suite |
| `init_database.sh` | Starts PostgreSQL via docker compose and lists tables |
