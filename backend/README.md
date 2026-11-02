# UniAttend Python FastAPI Authoritative Backend Service

Production-grade Python 3.12+ backend service powered by **FastAPI**, **Google Cloud Firestore**, **Firebase Authentication**, **Pandas**, and **NumPy**.

---

## 1. Architecture & Design Principles

- **Framework**: FastAPI with asynchronous endpoints (`async def`) and Uvicorn ASGI server.
- **Data Layer**: Google Cloud Firestore (Enterprise Database ID: `ai-studio-uniattendunivers-c5e1918d-4a9e-4935-a356-3195f6c33ea5`).
- **Identity & RBAC**: Firebase Admin SDK JWT ID Token verification with strict role enforcement (`ADMIN`, `TEACHER`, `STUDENT`).
- **Analytics Engine**: Vectorized Pandas & NumPy calculations for attendance aggregates, 3-consecutive-late penalty processing, 50% milestone surveillance, and exam recoverability projections.
- **Reporting Engine**: OpenPyXL for styled `.xlsx` spreadsheets, Pandas for `.csv`, and ReportLab for formal `.pdf` examination clearance registers.
- **IoT Hardware Gateways**: Authenticated REST endpoint `/api/hardware/scan` accepting payloads from classroom microcontrollers (ESP32/RFID/Fingerprint units).

---

## 2. Directory Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI entry point, CORS, routers & exception handlers
│   ├── config.py                # Pydantic Settings configuration from .env
│   ├── dependencies.py          # Shared dependency injection helpers
│   ├── core/
│   │   ├── firebase.py          # Firebase Admin SDK & Firestore client initialization
│   │   ├── security.py          # JWT Bearer token decoder, RoleChecker, and AuthUser
│   │   └── logging.py           # Structured logging configuration
│   ├── schemas/
│   │   ├── student.py           # Student request & response Pydantic models
│   │   ├── teacher.py           # Teacher profile models
│   │   ├── course.py            # Department, Course, Offering, and Routine models
│   │   ├── attendance.py        # Session, check-in, and manual correction models
│   │   ├── enrollment.py        # Window, self-enrollment, and course drop models
│   │   ├── analytics.py         # Summary analytics, recoverability, and risk tier models
│   │   ├── hardware.py          # IoT device registration and scan models
│   │   └── email.py             # SMTP outbound dispatch models
│   ├── services/
│   │   ├── attendance_service.py# Session lifecycle, check-ins, and hardware scan matching
│   │   ├── analytics_service.py # Pandas & NumPy vectorized aggregation
│   │   ├── report_service.py    # OpenPyXL, Pandas CSV, and ReportLab PDF exporters
│   │   └── notification_service.py # Outbound SMTP email dispatcher
│   └── utils/
│       └── calculations.py      # University statutory bylaws (20-min late, 3-late, 60% exam)
├── tests/
│   ├── conftest.py              # TestClient fixtures and mock payloads
│   ├── test_attendance.py       # Unit tests for statutory attendance rules
│   ├── test_analytics.py        # Unit tests for 50% midpoint and risk classifications
│   └── test_api.py              # HTTP endpoint integration tests
├── Dockerfile                   # Production container image for Google Cloud Run
├── requirements.txt             # Python package dependencies
├── .env.example                 # Environment configuration template
└── README.md                    # Technical documentation & deployment manual
```

---

## 3. Local Development Setup

### Prerequisites
- Python 3.10+ (Python 3.12 recommended)
- `pip` package manager
- Firebase service account credentials JSON (or Application Default Credentials)

### Installation
```bash
# 1. Navigate to backend directory
cd backend

# 2. Create and activate a Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy environment template and configure secrets
cp .env.example .env

# 5. Start development server with auto-reload
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive OpenAPI Swagger UI is available at:
`http://localhost:8000/docs`

---

## 4. Running Backend Tests

```bash
cd backend
pytest -v
```

---

## 5. Google Cloud Run Deployment

Deploy as a serverless container with continuous scaling and automatic HTTPS:

```bash
# 1. Build and push container to Google Artifact Registry / Cloud Build
gcloud builds submit --tag gcr.io/gen-lang-client-0312401566/uniattend-backend

# 2. Deploy to Cloud Run
gcloud run deploy uniattend-backend \
    --image gcr.io/gen-lang-client-0312401566/uniattend-backend \
    --platform managed \
    --region asia-east1 \
    --allow-unauthenticated \
    --set-env-vars FIREBASE_PROJECT_ID=gen-lang-client-0312401566,FIRESTORE_DATABASE_ID=ai-studio-uniattendunivers-c5e1918d-4a9e-4935-a356-3195f6c33ea5,CORS_ORIGINS=*
```
