"""Integration Tests for FastAPI HTTP Endpoints."""
import pytest
from fastapi.testclient import TestClient


def test_health_check(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "UniAttend" in data["service"]


def test_root_endpoint(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["documentation"] == "/docs"


def test_email_status_endpoint(client: TestClient):
    response = client.get("/api/email/status")
    assert response.status_code == 200
    data = response.json()
    assert "configured" in data
    assert "totalSent" in data


def test_unauthenticated_protected_route_rejection(client: TestClient):
    # Protected endpoint without Bearer token must return 401
    response = client.get("/api/auth/me")
    assert response.status_code == 401
