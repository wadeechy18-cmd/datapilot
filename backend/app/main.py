"""
ExcelAI backend entrypoint.

Wires together settings, CORS, and routers. Business logic never lives
here — each router delegates to a service, and this file only registers
routers as they're built out milestone by milestone.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import cleaning, health, upload, workbook
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


@app.get("/")
def read_root() -> dict:
    return {"message": f"{settings.APP_NAME} API is running"}
