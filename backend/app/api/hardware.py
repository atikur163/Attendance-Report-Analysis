"""IoT Hardware Terminal API Endpoints (RFID Card Taps and Fingerprint Scanners)."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from app.core.security import verify_hardware_api_key, require_admin, require_teacher, AuthUser
from app.core.firebase import get_firestore_db
from app.services.attendance_service import attendance_service
from app.schemas.hardware import (
    HardwareScanRequest, HardwareScanResultOut,
    HardwareDeviceCreate, HardwareDeviceOut
)

router = APIRouter(prefix="/hardware", tags=["IoT Hardware Attendance Gateways"])


@router.post("/scan", response_model=HardwareScanResultOut)
async def hardware_scan(
    payload: HardwareScanRequest,
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """
    Core hardware card tap & fingerprint terminal scan endpoint.
    Compatible with existing microcontroller HTTP POST payloads.
    """
    device_id = payload.get_device_id()
    credential_id = payload.get_credential_id()
    credential_type = payload.get_credential_type()

    api_key = payload.apiKey or payload.api_key or x_api_key
    if not api_key and authorization:
        api_key = authorization.replace("Bearer ", "").strip()

    if not device_id or not credential_id:
        raise HTTPException(
            status_code=400,
            detail="device_id and credential_id are mandatory parameters."
        )

    result = attendance_service.process_hardware_scan(
        device_id=device_id,
        credential_id=credential_id,
        credential_type=credential_type,
        api_key=api_key,
        timestamp=payload.timestamp
    )

    status_str = result.get("status")
    if status_str == "UNAUTHORIZED":
        raise HTTPException(status_code=401, detail=result.get("message"))
    elif status_str == "UNKNOWN_CREDENTIAL":
        raise HTTPException(status_code=404, detail=result.get("message"))
    elif status_str in ("OUT_OF_WINDOW", "NOT_ENROLLED"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    elif status_str == "DUPLICATE":
        raise HTTPException(status_code=409, detail=result.get("message"))

    return result


@router.get("/devices", response_model=List[HardwareDeviceOut])
async def list_hardware_devices(user: AuthUser = Depends(require_teacher)):
    db = get_firestore_db()
    if not db:
        return []
    return [{**d.to_dict(), "id": d.id} for d in db.collection("hardware_devices").stream()]


@router.post("/devices", response_model=HardwareDeviceOut, status_code=201)
async def register_hardware_device(data: HardwareDeviceCreate, user: AuthUser = Depends(require_admin)):
    db = get_firestore_db()
    if not db:
        raise HTTPException(status_code=503, detail="Database unavailable")

    new_id = f"dev-{uuid.uuid4().hex[:6]}"
    doc_data = {
        "id": new_id,
        **data.model_dump(),
        "status": "ACTIVE",
        "registeredAt": datetime.now(timezone.utc).isoformat()
    }
    db.collection("hardware_devices").document(new_id).set(doc_data)
    return doc_data


@router.get("/logs")
async def get_hardware_logs(limit: int = 100, user: AuthUser = Depends(require_teacher)):
    db = get_firestore_db()
    if not db:
        return {"success": True, "logs": []}
    logs = [
        {**d.to_dict(), "id": d.id}
        for d in db.collection("hardware_scan_logs").order_by("timestamp", direction="DESCENDING").limit(limit).stream()
    ]
    return {"success": True, "logs": logs}
