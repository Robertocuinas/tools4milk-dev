# Tools4Milk migrations

This folder contains ordered SQL migrations for stable deployments.

Run them from `backend` with:

```powershell
python scripts/apply_migrations.py
```

The app still creates missing tables on startup for local development, but
production should apply these migrations against Postgres before starting the
API container.
