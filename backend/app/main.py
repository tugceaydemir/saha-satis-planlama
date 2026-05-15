import os
from pathlib import Path
from dotenv import load_dotenv

# .env dosyasini yukle (yalnizca lokal gelistirmede gereklidir;
# Render'da env varlar otomatik olarak process'e enjekte edilir).
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .database import engine, Base, SessionLocal
from .models import Plan
from .routers import auth, customers, sales_reps, plans, settings, performance, announcements, visits

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Saha Satis Planlama API",
    description="Kumeleme, haftalik atama ve rota optimizasyonu",
    version="1.0.0",
)


@app.on_event("startup")
def cleanup_stuck_plans():
    """Sunucu yeniden başlatıldığında çalışır durumda kalmış planları iptal et."""
    db = SessionLocal()
    try:
        stuck = db.query(Plan).filter(
            Plan.status.in_(["clustering", "assignment", "routing"])
        ).all()
        for plan in stuck:
            plan.status = "interrupted"
        if stuck:
            db.commit()
            print(f"[startup] {len(stuck)} takılı plan iptal edildi")
    finally:
        db.close()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(sales_reps.router)
app.include_router(plans.router)
app.include_router(settings.router)
app.include_router(performance.router)
app.include_router(announcements.router)
app.include_router(visits.router)


# ── Frontend static dosyaları (deploy modunda) ──
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "build"

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR / "static")), name="static-files")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """API dışındaki tüm istekleri frontend'e yönlendir (SPA)."""
        file_path = FRONTEND_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))
else:
    @app.get("/")
    def root():
        return {"message": "Saha Satis Planlama API", "docs": "/docs"}
