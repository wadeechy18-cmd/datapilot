# ExcelAI

AI-powered Excel automation and analysis platform.

**Current milestone: Phase 1 / Milestone 9 — Export Engine (last of Phase 1).**
See `docs/architecture.md` for what's in place and why.

## Structure

```
ExcelAI/
├── frontend/    Next.js + TypeScript + Tailwind
├── backend/     FastAPI (Python)
├── storage/     Local file storage for development
└── docs/        Architecture notes
```

## Quickstart

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```
API: http://localhost:8000 · Health check: http://localhost:8000/api/v1/health

Endpoints so far:
- `POST /api/v1/upload` — upload an `.xlsx` file, returns a `file_id`
- `GET /api/v1/workbook/{file_id}` — read the workbook's structure (sheets, dimensions, headers, a data preview)
- `GET /api/v1/workbook/{file_id}/analysis` — per-column stats (type, nulls, uniques, numeric min/max/mean/sum)
- `POST /api/v1/workbook/{file_id}/clean` — trim/dedupe/drop-empty/fill-nulls (preview by default, `?commit=true` writes a new file)
- `POST /api/v1/workbook/{file_id}/format` — font/fill/number format/alignment/borders (preview by default, `?commit=true` writes a new file)
- `POST /api/v1/workbook/{file_id}/formula` — formula templates or aggregate functions (preview by default, `?commit=true` writes a new file)
- `POST /api/v1/workbook/{file_id}/chart` — embed a native bar/line/pie/area/scatter chart (preview by default, `?commit=true` writes a new file)
- `GET /api/v1/workbook/{file_id}/export/xlsx` — download the stored workbook as a real `.xlsx` file
- `GET /api/v1/workbook/{file_id}/export/csv?sheet_name=...` — download a single sheet's data as flat CSV

**Frontend**
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```
App: http://localhost:3000

**Tests**
```bash
cd backend
pytest
```

## Roadmap
- **Phase 1** (current): Python Excel engine — foundation, upload, reader,
  analyzer, cleaning, formatting, formulas, charts, export.
- **Phase 2**: Web interface.
- **Phase 3**: AI assistant (chat, summaries, insights, anomaly detection).
- **Phase 4**: SaaS features (auth, database, payments, dashboard).
