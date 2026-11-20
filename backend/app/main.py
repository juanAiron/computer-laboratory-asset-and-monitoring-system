from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.features.assets.router import router as assets_router
from app.features.auth.router import router as auth_router
from app.features.borrow.router import router as borrow_router
from app.features.consumables.router import router as consumables_router
from app.features.counts.router import router as counts_router
from app.features.dashboard.router import router as dashboard_router
from app.features.labs.router import router as labs_router
from app.features.repairs.router import router as repairs_router
from app.features.sessions.router import router as sessions_router
from app.features.users.router import router as users_router

Path("uploads/assets").mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="SLU Computer Laboratory Asset & Monitoring System",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serves uploaded asset photos at /uploads/assets/<filename>
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/api/v1/health", tags=["System"])
def health_check():
    return {"status": "ok"}


app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(labs_router, prefix="/api/v1")
app.include_router(sessions_router, prefix="/api/v1")
app.include_router(assets_router, prefix="/api/v1")
app.include_router(borrow_router, prefix="/api/v1")
app.include_router(consumables_router, prefix="/api/v1")
app.include_router(repairs_router, prefix="/api/v1")
app.include_router(counts_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")