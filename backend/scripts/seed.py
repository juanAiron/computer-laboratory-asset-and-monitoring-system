import sys
from pathlib import Path

# Allow importing app.* when running `python scripts/seed.py`
sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from app.core.config import settings
from app.db.session import SessionLocal
from app.features.assets.models import Category
from app.features.labs.models import LabRoom, LabStation
from app.features.users.models import User, UserRole


def seed() -> None:
    db = SessionLocal()
    try:
        # 1. Seed TRIL Admin (matches .env SEED_ADMIN_EMAIL)
        admin_email = settings.SEED_ADMIN_EMAIL.lower()
        if not db.scalar(select(User).where(User.email == admin_email)):
            db.add(
                User(
                    id_number="TRIL-001",
                    email=admin_email,
                    full_name="TRIL Coordinator",
                    role=UserRole.TRIL_ADMIN,
                    is_active=True,
                )
            )

        # 2. Seed sample lab room & 5 workstations
        lab = db.scalar(select(LabRoom).where(LabRoom.code == "CIS-LAB-1"))
        if not lab:
            lab = LabRoom(
                code="CIS-LAB-1",
                name="CIS Computer Laboratory 1",
                building="Maryheights Campus - Silang Building",
                capacity=40,
            )
            db.add(lab)
            db.flush()

            for i in range(1, 6):
                station_num = f"PC-{i:02d}"
                db.add(
                    LabStation(
                        lab_room_id=lab.id,
                        station_number=station_num,
                        qr_code=f"CIS-LAB-1-{station_num}",
                        is_operational=True,
                    )
                )

        # 3. Seed default hardware categories
        for cat_name in ["System Unit", "Monitor", "Keyboard", "Mouse", "Networking", "Audio/Visual"]:
            if not db.scalar(select(Category).where(Category.name == cat_name)):
                db.add(Category(name=cat_name))

        db.commit()
        print("Database seeded successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    seed()