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
├── backend/            # FastAPI application, SQLAlchemy models, Alembic migrations, pytest suite[cite: 1]
├── frontend/           # React + Vite PWA source code and Vitest suite[cite: 1]
├── deploy/             # Docker Compose files, Caddyfile, and backup scripts[cite: 1]
├── docs/               # ERD diagrams, admin runbook, and user manuals[cite: 1]
├── .github/workflows/  # CI/CD pipelines (lint, test, build, deploy)[cite: 1]
└── .env.example        # Template for required environment variables[cite: 1]
