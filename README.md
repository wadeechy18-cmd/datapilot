# ExcelAI

AI-powered Excel automation and analysis platform.

**Current milestone: Phase 1 / Milestone 1 — Project Foundation.**
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
