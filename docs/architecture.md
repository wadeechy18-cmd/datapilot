> **Coverage note:** this file only has entries for Milestone 1 (Project
> Foundation) and Milestone 3 (Workbook Reader) — it was never kept up to
> date through the rest of Phase 1, Phase 2, or Phase 3. For what's
> actually built today, see the README's roadmap/endpoint list instead;
> treat everything below as historical design reasoning for those two
> milestones specifically, not a current architecture map.

# Architecture Notes — Milestone 1: Project Foundation

## Scope of this milestone
Wiring only: a runnable FastAPI backend, a runnable Next.js frontend, and
confirmation the two can talk to each other via a health check. No Excel
logic, no database, no auth. Those are explicitly out of scope until their
own milestones.

## Backend package layout
Each folder under `backend/app/` maps to one responsibility, matching the
milestones ahead of us:

- `api/` — HTTP routers only. Thin: parses requests, calls a service,
  returns a schema. No business logic lives here.
- `core/` — cross-cutting concerns: settings, (later) logging, security.
- `schemas/` — Pydantic request/response models (the API's public contract).
- `models/` — internal data structures (later: DB models, workbook
  metadata) — kept separate from `schemas/` so the API contract can evolve
  independently of internal representations.
- `workbook/` — will hold the core engine: reading/representing an Excel
  file in memory (Milestone: Workbook Reader).
- `operations/` — will hold cleaning, formatting, formula, and chart
  operations that act on a workbook (Milestones: Cleaning/Formatting/
  Formula/Chart Engines). Kept separate from `workbook/` so the in-memory
  representation stays independent of the operations performed on it.
- `services/` — orchestration layer that will coordinate `workbook/` +
  `operations/` for a given API request (e.g. "upload", "export"). Empty
  for now — introduced when there's an actual multi-step flow to
  orchestrate, not before.
- `utils/` — small stateless helpers shared across the app.
- `tests/` — mirrors the app structure as it grows.

Nothing beyond `core/config.py`, `api/health.py`, `schemas/health.py`, and
`main.py` has real content yet — the rest are empty packages, present so
the next milestones have an obvious, agreed-upon home rather than us
re-negotiating structure each time.

## Key decisions

**Settings via `pydantic-settings`, accessed through `get_settings()`.**
One object, cached with `lru_cache`, is the single source of truth for
config. Nothing else reads `os.environ` directly. This makes settings
easy to override in tests and keeps environment-coupling in one file.

**CORS is explicit and environment-driven** (`CORS_ORIGINS`), not
wildcarded, since the frontend and backend run on different origins in
dev (`:3000` vs `:8000`) and this will matter more once auth exists.

**`STORAGE_DIR` points at a local folder for now.** Milestone 1 needs
*a* place for files to eventually land, but implementing upload/storage
itself is a later milestone. The setting exists now so later code has a
single place to read it from; introducing it later would mean touching
config again for no reason.

**No database, no Docker, no auth yet**, per the stated roadmap — adding
any of them now would be scope creep this milestone doesn't need.

**Frontend is a minimal Next.js App Router + TypeScript + Tailwind
scaffold** with one page that calls the backend's `/health` endpoint.
This isn't a UI milestone — it exists to prove frontend → backend
connectivity end-to-end before we build real screens in Milestone
(Phase 2: Web Interface).

## Running it locally

Backend:
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```
Visit `http://localhost:8000/api/v1/health`.

Frontend:
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```
Visit `http://localhost:3000` — it should show backend status: `ok`.

## Milestone 3 — Workbook Reader

**`workbook/reader.py` knows nothing about file_ids or HTTP.** It takes a
`Path` and returns a `WorkbookInfo`. `services/workbook_service.py` is the
only place that translates a `file_id` into a path (via
`storage_service.get_path`) — so the reader stays reusable by the
Cleaning/Formatting/Formula/Chart engines later without any HTTP or
storage coupling baked in.

**Internal model vs. API schema stay separate**, continuing the
Milestone 1 decision: `models/workbook.py` (`WorkbookInfo`, `SheetInfo`)
is what the engine passes around internally; `schemas/workbook.py`
(`WorkbookSummaryResponse`, `SheetSummary`) is what the HTTP layer
returns. They currently look similar, but this lets the API response
evolve (pagination, field renaming, etc.) without touching the engine.

**Read-only, stateless, no caching.** Each request re-opens the file
from disk via `openpyxl.load_workbook(..., read_only=True)`. We're not
introducing an in-memory session/cache of "the currently loaded
workbook" yet — that's a meaningful design decision (in-process cache?
per-user? TTL?) that belongs with whichever later milestone first needs
to mutate and re-save a workbook across multiple requests, not here.

**Only structure + a preview, not full data.** The reader returns sheet
names, dimensions, headers, and up to 10 preview rows — enough for a UI
to show "here's what you uploaded." Full-data loading, statistics, and
anomaly detection are the Data Analyzer milestone's job, not this one's.

*Superseded later (Phase 2 grid-cap removal milestone): the 10-row cap was
removed from `preview_rows` once the frontend grid needed to show a whole
sheet, not just a preview — the field name is unchanged, but it's no
longer capped. `PREVIEW_ROW_COUNT` still exists, now used only by the
Cleaning engine's own pending-change preview response.*

**Cell values are normalized for JSON**, since openpyxl can return
`datetime`/`Decimal` values that aren't directly serializable. This
normalization lives in the reader (the one place that touches raw
openpyxl cell values), not duplicated in the schema or API layer.

