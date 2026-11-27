# Computer Laboratory Asset and Monitoring System

A Progressive Web Application (PWA) built for **Saint Louis University (SLU)** to track, monitor, and manage computer laboratory equipment, peripherals, and consumables. Designed for lab custodians, department heads, and borrowers to streamline daily check-outs, repair logging, and physical inventory counts.

---

## Core Features

* **Asset Management & QR Tagging:** Track PCs, monitors, and lab devices by serial number, condition, status, and exact lab/rack location, with batch-printable QR code labels.
* **Hardware Inventory Register:** View tag and serial numbers, item descriptions, optional computer specifications, acquisition date and cost, deployed department, last physical check, condition, status, and remarks in a searchable table.
* **Software & Subscription Inventory:** Track software vendors, versions, license types and seats, deployed devices/users, renewal and expiry dates, and annual costs alongside hardware in the Inventory section.
* **Inventory Permissions:** Super Admins and custodians can create, edit, and archive hardware, software, and subscriptions; Department Heads and TRIL Advisors have view-only access.
* **Centralized Lab Room Management:** Super Admins add schedule rooms, which are shared by Lab Schedules and the hardware inventory room dropdown.
* **Mobile Camera Scanning:** Scan asset QR tags directly from a smartphone browser to view equipment history, check items out, or log issues on the spot.
* **Check-Out & Return Workflow:** Manage borrowed equipment with due dates, overdue alerts, and database-enforced single-loan rules.
* **Consumables & Stock Alerts:** Monitor cables, keyboards, mice, and spare parts with movement logs and low-stock thresholds.
* **Repair & Maintenance Tickets:** Record hardware faults, track repair status, and maintain a full service history per asset.
* **Inventory Count Mode:** Conduct lab-by-lab physical audits by scanning tags, flagging missing or misplaced items, and recording the latest physical-check date on each scanned asset.
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
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md                 # Standardized bug report template
│   │   └── feature_request.md            # Feature / custodian requirement template
│   ├── pull_request_template.md          # PR checklist (tests pass, migrations included, Closes #issue)
│   └── workflows/
│       ├── ci.yml                        # Runs on every PR: ruff, pytest, eslint, vitest, vite build
│       ├── publish.yml                   # Builds & pushes Docker images to GHCR on merge to main
│       └── deploy.yml                    # Deploys to campus server via self-hosted runner (manual approval)
│
├── backend/                              # FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL 18
│   ├── alembic/                          # Database schema migrations
│   │   ├── versions/                     # Auto-generated migration scripts
│   │   ├── env.py                        # Connects Alembic to app/core/config.py & app/db/base.py
│   │   └── script.py.mako                # Migration file template
│   │
│   ├── scripts/                          # One-off administrative & dev scripts
│   │   └── seed.py                       # Seeds initial TRIL Admin, sample labs, PCs, and categories
│   │
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                       # FastAPI app initialization, CORS, middleware & router mounting
│   │   │
│   │   ├── core/                         # App-wide configuration, security & error handling
│   │   │   ├── __init__.py
│   │   │   ├── config.py                 # Pydantic BaseSettings (.env variables)
│   │   │   ├── security.py               # Google @slu.edu.ph ID token verification, JWT & bcrypt helpers
│   │   │   ├── permissions.py            # get_current_user, token_version check & require_role() guards
│   │   │   └── exceptions.py             # Standardized JSON exception handlers (403, 404, 409, 422)
│   │   │
│   │   ├── db/                           # Database engine & base metadata
│   │   │   ├── __init__.py
│   │   │   ├── base.py                   # DeclarativeBase, Timestamp/SoftDelete mixins, imports all models
│   │   │   └── session.py                # PostgreSQL 18 SQLAlchemy engine & get_db() dependency
│   │   │
│   │   ├── features/                     # Domain Vertical Slices (1 slice per feature/teammate)
│   │   │   ├── __init__.py
│   │   │   │
│   │   │   ├── auth/                     # Google OAuth login, token refresh, logout, break-glass admin
│   │   │   │   ├── __init__.py
│   │   │   │   ├── schemas.py            # GoogleTokenRequest, TokenResponse, BreakGlassLoginRequest
│   │   │   │   ├── service.py            # Token verification, user lookup, token_version increment
│   │   │   │   └── router.py             # POST /auth/google, /auth/refresh, /auth/logout, /auth/local
│   │   │   │
│   │   │   ├── users/                    # Account management for all 5 SLU roles
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py             # User (id_number, email, full_name, role, is_active, token_version)
│   │   │   │   ├── schemas.py            # UserCreate, UserUpdate, UserResponse, CSVImportResult
│   │   │   │   ├── service.py            # CRUD, role updates, bulk CSV import, force-logout trigger
│   │   │   │   └── router.py             # GET/POST/PATCH /users, POST /users/import-csv
│   │   │   │
│   │   │   ├── labs/                     # Computer labs & physical workstation/PC seat mapping
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py             # LabRoom, LabStation (seat_no, qr_code, linked_asset_id)
│   │   │   │   ├── schemas.py            # LabRoomCreate/Response, LabStationCreate/Response
│   │   │   │   ├── service.py            # Lab & station management, live station occupancy status
│   │   │   │   └── router.py             # GET/POST/PATCH /labs, /labs/{id}/stations
│   │   │   │
│   │   │   ├── sessions/                 # Student laboratory monitoring & PC check-ins
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py             # LabSession (class_code, instructor_id), StationLog (student_id, time_in/out)
│   │   │   │   ├── schemas.py            # SessionStart, StationCheckIn, StationCheckOut, OccupancyResponse
│   │   │   │   ├── service.py            # Start/end class sessions, 1-student-per-PC check-in rule, attendance logs
│   │   │   │   └── router.py             # POST/PATCH /sessions, POST /sessions/check-in, /check-out, GET /sessions/live
│   │   │   │
│   │   │   ├── assets/                   # Tracked hardware (PCs, monitors, peripherals) & QR tags
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py             # Category, Asset (asset_tag, serial_no, status, condition, station_id)
│   │   │   │   ├── schemas.py            # AssetCreate, AssetUpdate, AssetResponse, CategoryCreate/Response
│   │   │   │   ├── service.py            # Asset CRUD, QR tag lookup, status transitions, soft-archive
│   │   │   │   └── router.py             # GET/POST/PATCH /assets, GET /assets/by-tag/{tag}, POST /assets/{id}/archive
│   │   │   │
│   │   │   ├── software_assets/          # Software licenses and subscriptions with edit approvals
│   │   │   │   ├── models.py             # SoftwareAsset and SoftwareEditRequest
│   │   │   │   ├── schemas.py            # Software inventory and approval request schemas
│   │   │   │   ├── service.py            # Software CRUD and request review workflow
│   │   │   │   └── router.py             # /software-assets API
│   │   │   │
│   │   │   ├── consumables/              # Non-serialized items (cables, mice, keyboards) & stock log
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py             # Consumable (quantity >= 0, reorder_level), StockMovement
│   │   │   │   ├── schemas.py            # ConsumableCreate/Response, StockMovementCreate/Response
│   │   │   │   ├── service.py            # Stock in/out math, non-negative check, low-stock threshold queries
│   │   │   │   └── router.py             # GET/POST/PATCH /consumables, POST /consumables/{id}/movements, GET /low-stock
│   │   │   │
│   │   │   ├── borrow/                    # Equipment borrowing & return workflow
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py             # Borrow (asset_id, borrower_id, issued_by, due_at, returned_at)
│   │   │   │   ├── schemas.py            # BorrowCreate, BorrowReturn, BorrowResponse
│   │   │   │   ├── service.py            # Enforces 1 active borrow per asset, blocks borrowed/broken assets, overdue check
│   │   │   │   └── router.py             # GET/POST /borrow, POST /borrow/{id}/return, GET /borrow/my
│   │   │   │
│   │   │   ├── repairs/                  # Maintenance & hardware fault tickets
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py             # RepairTicket (asset_id, station_id, reported_by, status, resolution_notes)
│   │   │   │   ├── schemas.py            # RepairCreate, RepairUpdate, RepairResponse
│   │   │   │   ├── service.py            # Ticket lifecycle, auto-flags asset/station status when broken/resolved
│   │   │   │   └── router.py             # GET/POST/PATCH /repairs
│   │   │   │
│   │   │   ├── counts/                   # Physical QR inventory audit sessions, shown under Inventory
│   │   │   │   ├── __init__.py
│   │   │   │   ├── models.py             # InventoryCount, CountItem (expected vs. scanned/misplaced/missing)
│   │   │   │   ├── schemas.py            # CountStart, CountScanRequest, CountSummaryResponse
│   │   │   │   ├── service.py            # Initializes lab asset snapshot, records QR scans, reconciles discrepancies
│   │   │   │   └── router.py             # GET/POST /counts, POST /counts/{id}/scan, POST /counts/{id}/close
│   │   │   │
│   │   │   └── dashboard/                # Aggregated stats & report downloads
│   │   │       ├── __init__.py
│   │   │       ├── schemas.py            # DashboardStatsResponse (role-tailored KPIs)
│   │   │       ├── service.py            # Queries active students, available/broken assets, overdue loans, low stock
│   │   │       └── router.py             # GET /dashboard, GET /reports/assets.xlsx, /reports/sessions.pdf, /qr-sheet.pdf
│   │   │
│   │   └── shared/                       # Cross-cutting utilities used by multiple features
│   │       ├── __init__.py
│   │       ├── audit.py                  # AuditLog model & log_action() helper called by all services
│   │       ├── qr_generator.py           # Generates single QR PNGs & printable batch QR label sheets
│   │       └── exporters.py              # openpyxl (.xlsx) and reportlab (.pdf) builders
│   │
│   ├── tests/                            # Automated pytest suite mirroring app/features/
│   │   ├── conftest.py                   # Test PostgreSQL DB fixture, TestClient, mock role user tokens
│   │   ├── test_auth.py                  # @slu.edu.ph validation, unapproved user 403, token_version logout
│   │   ├── test_permissions.py           # Verifies access boundaries across all 5 roles
│   │   ├── test_sessions.py              # Student check-in/out, double-seat prevention, fault reporting
│   │   ├── test_assets.py                # CRUD, QR tag lookup, soft-delete
│   │   ├── test_loans.py                 # Concurrent loan block, repair-status block, overdue filtering
│   │   └── test_consumables.py           # Stock deduction, negative stock rejection, low-stock triggers
│   │
│   ├── alembic.ini                       # Alembic configuration file
│   ├── Dockerfile                        # Python 3.13-slim production container definition
│   ├── pyproject.toml                    # Ruff linter/formatter & pytest configuration
│   └── requirements.txt                  # Pinned Python 3.13 dependencies
│
├── frontend/                             # React + Vite PWA (Feature-Based Architecture)
│   ├── public/
│   │   ├── icons/
│   │   │   ├── icon-192.png              # PWA home screen icon (192x192)
│   │   │   └── icon-512.png              # PWA splash/install icon (512x512)
│   │   └── favicon.ico
│   │
│   ├── src/
│   │   ├── api/                          # HTTP client & token refresh interceptors
│   │   │   ├── client.js                 # Axios instance (/api/v1), attaches JWT, retries 401 via /auth/refresh
│   │   │   └── queryClient.js            # TanStack Query global cache & polling configuration
│   │   │
│   │   ├── components/                   # Reusable, domain-agnostic UI primitives
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.jsx          # Responsive wrapper (desktop sidebar + mobile bottom nav)
│   │   │   │   ├── Sidebar.jsx           # Desktop role-filtered navigation menu
│   │   │   │   └── MobileNav.jsx         # Bottom navigation bar for phone screens (360px+)
│   │   │   ├── ui/
│   │   │   │   ├── DataTable.jsx         # Sortable/paginated desktop table
│   │   │   │   ├── MobileCardList.jsx    # Card-based list alternative on narrow screens
│   │   │   │   ├── Modal.jsx             # Confirmation & form modal dialog
│   │   │   │   ├── PageHeader.jsx        # Consistent title, subtitle & primary action button
│   │   │   │   ├── Pagination.jsx        # Page controls
│   │   │   │   ├── SearchBar.jsx         # Debounced search & filter bar
│   │   │   │   ├── StatusBadge.jsx       # Color-coded pills (Available, In Use, Under Repair, Overdue)
│   │   │   │   └── Loader.jsx            # Loading spinner & skeleton states
│   │   │   └── scanner/
│   │   │       └── QrScanner.jsx         # html5-qrcode camera wrapper (handles mount/unmount & errors)
│   │   │
│   │   ├── context/
│   │   │   └── AuthContext.jsx           # Stores current user, role, JWT in memory, login/logout helpers
│   │   │
│   │   ├── features/                     # Feature slices matching backend/app/features/
│   │   │   ├── auth/
│   │   │   │   ├── LoginPage.jsx         # Google Sign-In (@slu.edu.ph), break-glass toggle, PWA install tip
│   │   │   │   └── ProtectedRoute.jsx    # Blocks unauthenticated users & checks allowed roles
│   │   │   ├── dashboard/
│   │   │   │   └── DashboardPage.jsx     # Role-aware KPIs (live lab occupancy, overdue loans, low stock)
│   │   │   ├── labs/
│   │   │   │   ├── LabsListPage.jsx      # Computer lab rooms overview
│   │   │   │   └── LabSeatMapPage.jsx    # Visual PC workstation grid (live student occupancy & PC health)
│   │   │   ├── sessions/
│   │   │   │   ├── StudentCheckInPage.jsx # Student QR/seat check-in & "Report PC Fault" screen
│   │   │   │   └── ClassSessionsPage.jsx  # Instructor session starter, live roster & attendance export
│   │   │   ├── assets/
│   │   │   │   ├── AssetsListPage.jsx    # Searchable/filterable equipment registry
│   │   │   │   ├── AssetDetailPage.jsx   # Specs, QR tag preview, loan history, repair logs, archive
│   │   │   │   ├── AssetFormModal.jsx    # Edit hardware asset / request approval
│   │   │   │   ├── SoftwareAssetsTab.jsx # Software and subscription inventory
│   │   │   │   ├── SoftwareAssetFormModal.jsx # Add/edit software / request approval
│   │   │   ├── counts/
│   │   │   │   └── InventoryAuditTab.jsx # Physical inventory audits within Inventory
│   │   │   ├── scan/
│   │   │   │   └── QuickScanPage.jsx     # Custodian camera scan -> instant check-out, return, or ticket
│   │   │   ├── loans/
│   │   │   │   ├── LoansManagePage.jsx   # Custodian check-out/return & overdue tracker
│   │   │   │   └── MyLoansPage.jsx       # Borrower view of active & past borrowed equipment
│   │   │   ├── consumables/
│   │   │   │   └── ConsumablesPage.jsx   # Stock levels, in/out movements & low-stock alerts
│   │   │   ├── repairs/
│   │   │   │   └── RepairsPage.jsx       # Open fault tickets, status updates & resolution notes
│   │   │   ├── counts/
│   │   │   │   └── InventoryCountPage.jsx # Lab QR audit mode (scanned vs. missing/misplaced report)
│   │   │   ├── reports/
│   │   │   │   └── ReportsPage.jsx       # Download Excel/PDF reports & print batch QR label sheets
│   │   │   └── users/
│   │   │       └── UsersManagePage.jsx   # TRIL Admin user directory, 5-role assignment & CSV import
│   │   │
│   │   ├── hooks/                        # Shared custom hooks
│   │   │   ├── useAuth.js                # Shortcut hook for AuthContext
│   │   │   └── useDebounce.js            # Debounces search input queries
│   │   │
│   │   ├── utils/                        # Pure formatting & validation helpers
│   │   │   ├── formatDate.js             # Local Philippine time (PHT) date/time formatting
│   │   │   └── roles.js                  # Role labels & permission check helpers
│   │   │
│   │   ├── App.jsx                       # Route definitions wrapped in AuthProvider & QueryClientProvider
│   │   ├── main.jsx                      # React DOM entry point & PWA service worker registration
│   │   └── index.css                     # Global styles, CSS variables & responsive breakpoints
│   │
│   ├── tests/                            # Vitest + React Testing Library suite
│   │   ├── setup.js                      # jsdom & matchMedia mocks
│   │   ├── ProtectedRoute.test.jsx       # Verifies role access across all 5 roles
│   │   └── QrScanner.test.jsx            # Tests scan callback & error fallback
│   │
│   ├── .eslintrc.cjs                     # ESLint rules
│   ├── .prettierrc                       # Prettier code formatting config
│   ├── Dockerfile                        # Multi-stage build: Node 26 -> Caddy 2 static server
│   ├── index.html                        # Loads Google Identity Services script & PWA meta tags
│   ├── package.json                      # Dependencies & scripts (dev, build, lint, test)
│   └── vite.config.js                    # Vite proxy (/api -> localhost:8000) & vite-plugin-pwa config
│
├── deploy/                               # Docker Compose, Reverse Proxy & Server Scripts
│   ├── Caddyfile                         # HTTPS config, serves React /srv & proxies /api/* to backend
│   ├── docker-compose.dev.yml            # Local PostgreSQL 18 container for development
│   ├── docker-compose.yml                # Production stack (db, backend, web/caddy) using GHCR images
│   ├── docker-compose.override.example.yml # Template for local full-stack Docker builds
│   └── backup.sh                         # Nightly pg_dump + 30-day rotation + rsync/rclone hooks
│
├── docs/                                 # Project Documentation & Handover Guides
│   ├── erd.drawio                        # Editable Entity Relationship Diagram (draw.io)
│   ├── architecture.md                   # System & data flow documentation
│   ├── admin-runbook.md                  # Server restart, backup restore, JWT rotation, GHCR renewal
│   ├── user-manual-custodian.md          # Guide for TRIL Admin, Dept Head & Lab Custodians
│   └── user-manual-student-faculty.md    # Guide for Instructors & Students (PC check-in & borrowing)
│
├── .env.example                          # Template for required environment variables
├── .gitignore                            # Ignores .venv, node_modules, .env, dist, backups
└── README.md                             # Project overview, tech stack & 4-step local setup