# ExcelAI

AI-powered Excel automation and analysis platform.

**Current status: Phase 1 (Python Excel Engine) complete. Phase 2 (Web Interface) complete — a real Excel-like
workspace (ribbon, formula bar, selectable grid, status bar, undo/redo, a keyword command bar) driving every
engine. Phase 3 (AI Assistant) underway: sheet summaries and a chat bar (Q&A + real actions) are live on Gemini;
insights/anomaly detection are still to come.**
`docs/architecture.md` has historical design notes for the first couple of milestones, but wasn't kept up to
date after that — this README's endpoint list and roadmap below are the accurate source for what's in place now.

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

To use the AI features (Summarize/Chat), get a free-tier key at https://aistudio.google.com/apikey and set
`GEMINI_API_KEY` in `backend/.env`. Everything else works fully without one.

Endpoints so far:
- `POST /api/v1/upload` — upload an `.xlsx` file, returns a `file_id`
- `GET /api/v1/workbook/{file_id}` — read the workbook's structure (sheets, dimensions, headers, all data rows)
- `GET /api/v1/workbook/{file_id}/analysis` — per-column stats (type, nulls, uniques, numeric min/max/mean/sum)
- `POST /api/v1/workbook/{file_id}/clean` — trim/dedupe/drop-empty/fill-nulls (preview by default, `?commit=true` writes a new file)
- `POST /api/v1/workbook/{file_id}/format` — font/fill/number format/alignment/borders (preview by default, `?commit=true` writes a new file)
- `POST /api/v1/workbook/{file_id}/formula` — formula templates or aggregate functions (preview by default, `?commit=true` writes a new file)
- `POST /api/v1/workbook/{file_id}/chart` — embed a native bar/line/pie/area/scatter chart (preview by default, `?commit=true` writes a new file)
- `POST /api/v1/workbook/{file_id}/rows-columns` — insert/delete whole rows or columns (preview by default, `?commit=true` writes a new file)
- `POST /api/v1/workbook/{file_id}/sort` — sort a sheet by one column, ascending/descending, optional header pin (preview by default, `?commit=true` writes a new file)
- `GET /api/v1/workbook/{file_id}/export/xlsx` — download the stored workbook as a real `.xlsx` file
- `GET /api/v1/workbook/{file_id}/export/csv?sheet_name=...` — download a single sheet's data as flat CSV
- `POST /api/v1/workbook/{file_id}/summarize` — AI-generated plain-English sheet summary (column stats only, never raw cell data)
- `POST /api/v1/workbook/{file_id}/chat` — conversational Q&A, or a proposed action executed through the engines above

**Frontend**
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```
App: http://localhost:3000

Upload an `.xlsx` file to get a real spreadsheet workspace: click/drag/keyboard-select cells in the grid, edit
a cell's formula directly in the formula bar, or use the ribbon's File/Home/Insert/Formulas/Data/AI tabs — each
ribbon action targets your current grid selection, previews against the real API before writing changes, and
committing chains onto the next action automatically. Undo/redo (buttons or Ctrl+Z/Ctrl+Y) walks back and forth
through those commits. A command bar above the grid also runs plain-text phrases like "bold the header" or
"sort by column B" via keyword matching — no AI, a faster shortcut into the same engines. The AI tab adds a
one-click sheet summary and a chat bar that can both answer questions and trigger real actions (validated against
the same request schemas the ribbon uses before anything runs). Known, deliberate limit: only formula-bar/chat
edits can write an arbitrary cell value — there's no general cell-editing endpoint yet.

**Tests**
```bash
cd backend
pytest
```

## Roadmap
- **Phase 1** (done): Python Excel engine — foundation, upload, reader,
  analyzer, cleaning, formatting, formulas, charts, export, insert/delete
  row/column, sort.
- **Phase 2** (done): Web interface — a real Excel-like workspace (ribbon,
  formula bar, selectable grid, undo/redo, a keyword command bar) driving
  every engine above.
- **Phase 3** (in progress): AI assistant — done: provider-agnostic
  `AIProvider` abstraction (Gemini by default), sheet summaries, and a chat
  bar (Q&A + AI-proposed actions, always executed through the same engines
  and schemas the ribbon uses). Still to come: deeper insights, anomaly
  detection.
- **Phase 4**: SaaS features (auth, database, payments, dashboard).
