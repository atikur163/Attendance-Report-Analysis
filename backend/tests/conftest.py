"""Pytest Configuration and Fixtures."""
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sample_attendance_records():
    return [
        {"id": "rec-1", "timestamp": "2026-09-01T10:00:00Z", "status": "PRESENT", "minutesLate": 5},
        {"id": "rec-2", "timestamp": "2026-09-02T10:00:00Z", "status": "LATE", "minutesLate": 22},
        {"id": "rec-3", "timestamp": "2026-09-03T10:00:00Z", "status": "LATE", "minutesLate": 25},
        {"id": "rec-4", "timestamp": "2026-09-04T10:00:00Z", "status": "LATE", "minutesLate": 30},
        {"id": "rec-5", "timestamp": "2026-09-05T10:00:00Z", "status": "PRESENT", "minutesLate": 10},
    ]
