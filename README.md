# Computer Laboratory Asset and Monitoring System

A Progressive Web Application (PWA) built for **Saint Louis University (SLU)** to track, monitor, and manage computer laboratory equipment, peripherals, and consumables. Designed for lab custodians, department heads, and borrowers to streamline daily check-outs, repair logging, and physical inventory counts.

---

## Core Features

* **Asset Management & QR Tagging:** Track PCs, monitors, and lab devices by serial number, condition, status, and exact lab/rack location, with batch-printable QR code labels.
* **Mobile Camera Scanning:** Scan asset QR tags directly from a smartphone browser to view equipment history, check items out, or log issues on the spot.
* **Check-Out & Return Workflow:** Manage borrowed equipment with due dates, overdue alerts, and database-enforced single-loan rules.
* **Consumables & Stock Alerts:** Monitor cables, keyboards, mice, and spare parts with movement logs and low-stock thresholds.
* **Repair & Maintenance Tickets:** Record hardware faults, track repair status, and maintain a full service history per asset.
* **Inventory Count Mode:** Conduct lab-by-lab physical audits by scanning tags and flagging missing or misplaced items.
* **Role-Based Access Control & SLU Google Sign-In:** Restricts access to pre-registered `@slu.edu.ph` Google Workspace accounts across three roles: **Admin / Department Head**, **Custodian**, and **Borrower**.
* **Reports & Audit Trail:** Export inventory summaries to Excel (`.xlsx`) and PDF, and record every create, update, and archive action in an audit log.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React, Vite (PWA), TanStack Query, React Router, `html5-qrcode`, Recharts |
| **Backend** | Python 3.13, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic, `google-auth`, `openpyxl`, `reportlab`, `qrcode` |
| **Database** | PostgreSQL 18 |
| **Infrastructure** | Docker, Docker Compose, Caddy (Reverse Proxy & Automatic HTTPS), GitHub Actions CI/CD |

---

## Project Structure

```text
computer-laboratory-asset-and-monitoring-system/
backend/            # FastAPI application, SQLAlchemy models, Alembic migrations, pytest suite
├── alembic/                              # Database schema migrations
│   ├── versions/                         # Auto-generated migration scripts
│   ├── env.py                            # Connects Alembic to app/core/config.py & app/db/base.py
│   └── script.py.mako                    # Migration file template
│
├── scripts/                              # One-off administrative & dev scripts
│   └── seed.py                           # Seeds initial TRIL Admin, sample labs, PCs, and categories
│
├── app/
│   ├── __init__.py
│   ├── main.py                           # FastAPI app initialization, CORS, middleware & router mounting
│   │
│   ├── core/                             # App-wide configuration, security & error handling
│   │   ├── __init__.py
│   │   ├── config.py                     # Pydantic BaseSettings (.env variables)
│   │   ├── security.py                   # Google @slu.edu.ph ID token verification, JWT & bcrypt helpers
│   │   ├── permissions.py                # get_current_user, token_version check & require_role() guards
│   │   └── exceptions.py                 # Standardized JSON exception handlers (403, 404, 409, 422)
│   │
│   ├── db/                               # Database engine & base metadata
│   │   ├── __init__.py
│   │   ├── base.py                       # DeclarativeBase, Timestamp/SoftDelete mixins, imports all models
│   │   └── session.py                    # PostgreSQL 18 SQLAlchemy engine & get_db() dependency
│   │
│   ├── features/                         # Domain Vertical Slices (1 slice per feature/teammate)
│   │   ├── __init__.py
│   │   │
│   │   ├── auth/                         # Google OAuth login, token refresh, logout, break-glass admin
│   │   │   ├── __init__.py
│   │   │   ├── schemas.py                # GoogleTokenRequest, TokenResponse, BreakGlassLoginRequest
│   │   │   ├── service.py                # Token verification, user lookup, token_version increment
│   │   │   └── router.py                 # POST /auth/google, /auth/refresh, /auth/logout, /auth/local
│   │   │
│   │   ├── users/                        # Account management for all 5 SLU roles
│   │   │   ├── __init__.py
│   │   │   ├── models.py                 # User (id_number, email, full_name, role, is_active, token_version)
│   │   │   ├── schemas.py                # UserCreate, UserUpdate, UserResponse, CSVImportResult
│   │   │   ├── service.py                # CRUD, role updates, bulk CSV import, force-logout trigger
│   │   │   └── router.py                 # GET/POST/PATCH /users, POST /users/import-csv
│   │   │
│   │   ├── labs/                         # Computer labs & physical workstation/PC seat mapping
│   │   │   ├── __init__.py
│   │   │   ├── models.py                 # LabRoom, LabStation (seat_no, qr_code, linked_asset_id)
│   │   │   ├── schemas.py                # LabRoomCreate/Response, LabStationCreate/Response
│   │   │   ├── service.py                # Lab & station management, live station occupancy status
│   │   │   └── router.py                 # GET/POST/PATCH /labs, /labs/{id}/stations
│   │   │
│   │   ├── sessions/                     # Student laboratory monitoring & PC check-ins
│   │   │   ├── __init__.py
│   │   │   ├── models.py                 # LabSession (class_code, instructor_id), StationLog (student_id, time_in/out)
│   │   │   ├── schemas.py                # SessionStart, StationCheckIn, StationCheckOut, OccupancyResponse
│   │   │   ├── service.py                # Start/end class sessions, 1-student-per-PC check-in rule, attendance logs
│   │   │   └── router.py                 # POST/PATCH /sessions, POST /sessions/check-in, /check-out, GET /sessions/live
│   │   │
│   │   ├── assets/                       # Tracked hardware (PCs, monitors, peripherals) & QR tags
│   │   │   ├── __init__.py
│   │   │   ├── models.py                 # Category, Asset (asset_tag, serial_no, status, condition, station_id)
│   │   │   ├── schemas.py                # AssetCreate, AssetUpdate, AssetResponse, CategoryCreate/Response
│   │   │   ├── service.py                # Asset CRUD, QR tag lookup, status transitions, soft-archive
│   │   │   └── router.py                 # GET/POST/PATCH /assets, GET /assets/by-tag/{tag}, POST /assets/{id}/archive
│   │   │
│   │   ├── consumables/                  # Non-serialized items (cables, mice, keyboards) & stock logs
│   │   │   ├── __init__.py
│   │   │   ├── models.py                 # Consumable (quantity >= 0, reorder_level), StockMovement
│   │   │   ├── schemas.py                # ConsumableCreate/Response, StockMovementCreate/Response
│   │   │   ├── service.py                # Stock in/out math, non-negative check, low-stock threshold queries
│   │   │   └── router.py                 # GET/POST/PATCH /consumables, POST /consumables/{id}/movements, GET /low-stock
│   │   │
│   │   ├── loans/                        # Equipment borrowing & return workflow
│   │   │   ├── __init__.py
│   │   │   ├── models.py                 # Loan (asset_id, borrower_id, issued_by, due_at, returned_at)
│   │   │   ├── schemas.py                # LoanCreate, LoanReturn, LoanResponse
│   │   │   ├── service.py                # Enforces 1 active loan per asset, blocks loaned/broken assets, overdue check
│   │   │   └── router.py                 # GET/POST /loans, POST /loans/{id}/return, GET /loans/my
│   │   │
│   │   ├── repairs/                      # Maintenance & hardware fault tickets
│   │   │   ├── __init__.py
│   │   │   ├── models.py                 # RepairTicket (asset_id, station_id, reported_by, status, resolution_notes)
│   │   │   ├── schemas.py                # RepairCreate, RepairUpdate, RepairResponse
│   │   │   ├── service.py                # Ticket lifecycle, auto-flags asset/station status when broken/resolved
│   │   │   └── router.py                 # GET/POST/PATCH /repairs
│   │   │
│   │   ├── counts/                       # Physical QR inventory audit sessions
│   │   │   ├── __init__.py
│   │   │   ├── models.py                 # InventoryCount, CountItem (expected vs. scanned/misplaced/missing)
│   │   │   ├── schemas.py                # CountStart, CountScanRequest, CountSummaryResponse
│   │   │   ├── service.py                # Initializes lab asset snapshot, records QR scans, reconciles discrepancies
│   │   │   └── router.py                 # POST /counts, POST /counts/{id}/scan, POST /counts/{id}/close
│   │   │
│   │   └── dashboard/                    # Aggregated stats & report downloads
│   │       ├── __init__.py
│   │       ├── schemas.py                # DashboardStatsResponse (role-tailored KPIs)
│   │       ├── service.py                # Queries active students, available/broken assets, overdue loans, low stock
│   │       └── router.py                 # GET /dashboard, GET /reports/assets.xlsx, /reports/sessions.pdf, /qr-sheet.pdf
│   │
│   └── shared/                           # Cross-cutting utilities used by multiple features
│       ├── __init__.py
│       ├── audit.py                      # AuditLog model & log_action() helper called by all services
│       ├── qr_generator.py               # Generates single QR PNGs & printable batch QR label sheets
│       └── exporters.py                  # openpyxl (.xlsx) and reportlab (.pdf) builders
│
├── tests/                                # Automated pytest suite mirroring app/features/
│   ├── conftest.py                       # Test PostgreSQL DB fixture, TestClient, mock role user tokens
│   ├── test_auth.py                      # @slu.edu.ph validation, unapproved user 403, token_version logout
│   ├── test_permissions.py               # Verifies access boundaries across all 5 roles
│   ├── test_sessions.py                  # Student check-in/out, double-seat prevention, fault reporting
│   ├── test_assets.py                    # CRUD, QR tag lookup, soft-delete
│   ├── test_loans.py                     # Concurrent loan block, repair-status block, overdue filtering
│   └── test_consumables.py               # Stock deduction, negative stock rejection, low-stock triggers
│
├── alembic.ini                           # Alembic configuration file
├── Dockerfile                            # Python 3.13-slim production container definition
├── pyproject.toml                        # Ruff linter/formatter & pytest configuration
└── requirements.txt                      # Pinned Python 3.13 dependencies
frontend/           # React + Vite PWA source code and Vitest suite[cite: 1]
deploy/             # Docker Compose files, Caddyfile, and backup scripts[cite: 1]
docs/               # ERD diagrams, admin runbook, and user manuals[cite: 1]
.github/workflows/  # CI/CD pipelines (lint, test, build, deploy)[cite: 1]
.env.example        # Template for required environment variables[cite: 1]
