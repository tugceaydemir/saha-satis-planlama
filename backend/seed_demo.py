"""
Demo hesaplari seed script'i.
Calistirma: cd backend && python seed_demo.py

Olusturulan hesaplar:
  - demo_admin@saha.com  / DemoAdmin2026!  (yonetici)
  - demo@saha.com        / Demo2026!       (satis temsilcisi, cluster 0)

Hesap zaten varsa sifresi sifirlanir (idempotent).
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# .env yukle
load_dotenv(Path(__file__).resolve().parent / ".env")

# app modulunu import edebilmek icin sys.path ayari
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import SessionLocal, engine, Base
from app.models import User
from app.auth import hash_password


DEMO_ACCOUNTS = [
    {
        "email": "demo_admin@saha.com",
        "password": "DemoAdmin2026!",
        "full_name": "Demo Yonetici",
        "company": "Demo A.S.",
        "role": "admin",
        "cluster_index": None,
    },
    {
        "email": "demo@saha.com",
        "password": "Demo2026!",
        "full_name": "Demo Temsilci",
        "company": "Demo A.S.",
        "role": "user",
        "cluster_index": 0,  # 1 numarali bolge (0-indexed)
    },
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for acc in DEMO_ACCOUNTS:
            existing = db.query(User).filter(User.email == acc["email"]).first()
            if existing:
                existing.hashed_password = hash_password(acc["password"])
                existing.full_name = acc["full_name"]
                existing.role = acc["role"]
                existing.cluster_index = acc["cluster_index"]
                existing.is_active = 1
                print(f"  [GUNCELLE] {acc['email']} - sifre sifirlandi")
            else:
                user = User(
                    email=acc["email"],
                    hashed_password=hash_password(acc["password"]),
                    full_name=acc["full_name"],
                    company=acc["company"],
                    role=acc["role"],
                    cluster_index=acc["cluster_index"],
                    is_active=1,
                )
                db.add(user)
                print(f"  [OLUSTUR] {acc['email']}")
        db.commit()
        print("\n[OK] Demo hesaplari hazir.")
        print("\nGiris bilgileri:")
        for acc in DEMO_ACCOUNTS:
            print(f"  {acc['role']:6} | {acc['email']:30} | {acc['password']}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
