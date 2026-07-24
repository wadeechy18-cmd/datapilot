"""
ExcelAI backend entrypoint.

Wires together settings, CORS, and routers. Business logic never lives
here — each router delegates to a service, and this file only registers
routers as they're built out milestone by milestone.
"""

import truststore

# Must run before anything else opens an SSL connection (e.g. the Gemini
# calls in app/ai/gemini_provider.py): makes Python's ssl module verify
# against the OS-native trust store instead of certifi's bundled list,
# needed when a corporate/security-software root CA is trusted by the OS
# but isn't in certifi's independent bundle.
truststore.inject_into_ssl()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import ai_summary, chart, cleaning, export, formatting, formula, health, rows_columns, sort, upload, workbook
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers are included here, one line per feature area, as they're added.
app.include_router(health.router, prefix=settings.API_V1_PREFIX)
app.include_router(upload.router, prefix=settings.API_V1_PREFIX)
app.include_router(workbook.router, prefix=settings.API_V1_PREFIX)
app.include_router(cleaning.router, prefix=settings.API_V1_PREFIX)
app.include_router(formatting.router, prefix=settings.API_V1_PREFIX)
app.include_router(formula.router, prefix=settings.API_V1_PREFIX)
app.include_router(chart.router, prefix=settings.API_V1_PREFIX)
app.include_router(export.router, prefix=settings.API_V1_PREFIX)
app.include_router(rows_columns.router, prefix=settings.API_V1_PREFIX)
app.include_router(sort.router, prefix=settings.API_V1_PREFIX)
app.include_router(ai_summary.router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def read_root() -> dict:
    return {"message": f"{settings.APP_NAME} API is running"}
