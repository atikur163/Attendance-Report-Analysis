"""FastAPI Application Main Entrypoint."""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.core.logging import logger
from app.core.firebase import initialize_firebase

# Import API Routers
from app.api.auth import router as auth_router
from app.api.students import router as students_router
from app.api.teachers import router as teachers_router
from app.api.courses import router as courses_router
from app.api.attendance import router as attendance_router
from app.api.hardware import router as hardware_router
from app.api.enrollment import router as enrollment_router
from app.api.analytics import router as analytics_router
from app.api.reports import router as reports_router
from app.api.email import router as email_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup sequence
    logger.info("Initializing UniAttend FastAPI backend...")
    initialize_firebase()
    yield
    # Shutdown sequence
    logger.info("Shutting down UniAttend FastAPI backend...")


app = FastAPI(
    title="UniAttend Academic Attendance & Risk Analytics API",
    description="""
    Production-grade university student attendance management, timetable scheduling,
    dynamic QR & biometric verification, predictive 60% exam eligibility analytics,
    IoT hardware RFID terminal gateways, and statutory academic reporting engine.
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled API Exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "error": str(exc), "path": request.url.path}
    )


# Health Check & Root Endpoints
@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "database": settings.FIRESTORE_DATABASE_ID
    }


@app.get("/", tags=["System"])
async def root():
    return {
        "title": "UniAttend University Attendance API",
        "documentation": "/docs",
        "version": "1.0.0",
        "status": "operational"
    }


# Include Routers under standard /api namespace
app.include_router(auth_router, prefix="/api")
app.include_router(students_router, prefix="/api")
app.include_router(teachers_router, prefix="/api")
app.include_router(courses_router, prefix="/api")
app.include_router(attendance_router, prefix="/api")
app.include_router(hardware_router, prefix="/api")
app.include_router(enrollment_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(email_router, prefix="/api")
