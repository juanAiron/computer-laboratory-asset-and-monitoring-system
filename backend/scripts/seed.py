import sys
from pathlib import Path

# Ensure backend/ is on sys.path when running `python scripts/seed.py`
sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.features.assets.models import Category
from app.features.labs.models import LabRoom, LabStation
from app.features.users.models import User, UserRole


SAMPLE_USERS = [
    {
        "id_number": "SUPER-001",
        "email": settings.SUPER_ADMIN_EMAIL.lower().strip(),
        "full_name": "System Super Administrator",
        "role": UserRole.SUPER_ADMIN,
        "password": settings.SUPER_ADMIN_PASSWORD,
    },
    {
        "id_number": "EMP-001",
        "email": settings.SEED_ADMIN_EMAIL.lower().strip(),
        "full_name": "TRIL Coordinator",
        "role": UserRole.TRIL_ADMIN,
        "password": settings.SEED_ADMIN_PASSWORD,
    },
    {
        "id_number": "EMP-002",
        "email": "tril.advisor@tril-slu.local",
        "full_name": "TRIL Lab Advisor",
        "role": UserRole.TRIL_ADMIN,
        "password": "ChangeMe123!",
    },
    {
        "id_number": "EMP-003",
        "email": "dept.head@slu.edu.ph",
        "full_name": "CIS Department Head",
        "role": UserRole.DEPT_HEAD,
        "password": "ChangeMe123!",
    },
    {
        "id_number": "EMP-101",
        "email": "custodian1@tril-slu.local",
        "full_name": "Lab Custodian 1",
        "role": UserRole.CUSTODIAN,
        "password": "ChangeMe123!",
    },
    {
        "id_number": "EMP-102",
        "email": "custodian2@tril-slu.local",
        "full_name": "Lab Custodian 2",
        "role": UserRole.CUSTODIAN,
        "password": "ChangeMe123!",
    },
    {
        "id_number": "EMP-103",
        "email": "custodian3@tril-slu.local",
        "full_name": "Lab Custodian 3",
        "role": UserRole.CUSTODIAN,
        "password": "ChangeMe123!",
    },
    {
        "id_number": "FAC-201",
        "email": "instructor1@slu.edu.ph",
        "full_name": "Prof. Juan Dela Cruz",
        "role": UserRole.INSTRUCTOR,
        "password": "ChangeMe123!",
    },
    {
        "id_number": "2230001",
        "email": "2230001@slu.edu.ph",
        "full_name": "SANTOS, MARIA CLARA",
        "course_year": "BSIT 2",
        "role": UserRole.STUDENT,
        "password": "ChangeMe123!",
    },
]

DEFAULT_CATEGORIES = [
    ("Desktop Computer", "Complete workstation tower / All-in-One PC"),
    ("Monitor", "LCD/LED display monitors"),
    ("Laptop", "Portable laptops for faculty and lab borrowing"),
    ("Networking Equipment", "Routers, switches, access points, crimpers"),
    ("Peripherals", "Webcams, headsets, drawing tablets, projectors"),
]


def seed():
    db = SessionLocal()
    try:
        # 1. Seed Users
        for u in SAMPLE_USERS:
            existing = db.scalar(select(User).where(User.email == u["email"]))
            if not existing:
                db.add(
                    User(
                        id_number=u["id_number"],
                        email=u["email"],
                        full_name=u["full_name"],
                        course_year=u.get("course_year"),
                        role=u["role"],
                        password_hash=hash_password(u["password"]),
                        is_active=True,
                    )
                )
            elif not existing.password_hash:
                existing.password_hash = hash_password(u["password"])

        # 2. Seed Asset Categories
        for name, desc in DEFAULT_CATEGORIES:
            if not db.scalar(select(Category).where(Category.name == name)):
                db.add(Category(name=name, description=desc))

        # 3. Seed Sample Lab Room & 5 PC Stations
        lab = db.scalar(select(LabRoom).where(LabRoom.code == "CIS-LAB-1"))
        if not lab:
            lab = LabRoom(
                code="CIS-LAB-1",
                name="CIS Computer Laboratory 1",
                building="Maryheights Campus",
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

        db.commit()
        print("Database seeded successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    seed()