"""IoT Hardware Terminal Schemas."""
from typing import Optional
from pydantic import BaseModel, Field


class HardwareScanRequest(BaseModel):
    deviceId: Optional[str] = None
    device_id: Optional[str] = None
    credentialId: Optional[str] = None
    credential_id: Optional[str] = None
    credentialType: Optional[str] = "RFID"
    credential_type: Optional[str] = None
    timestamp: Optional[str] = None
    apiKey: Optional[str] = None
    api_key: Optional[str] = None

    def get_device_id(self) -> str:
        return (self.deviceId or self.device_id or "").strip()

    def get_credential_id(self) -> str:
        return (self.credentialId or self.credential_id or "").strip()

    def get_credential_type(self) -> str:
        val = (self.credentialType or self.credential_type or "RFID").upper()
        return "FINGERPRINT" if "FINGER" in val else "RFID"


class HardwareDeviceCreate(BaseModel):
    deviceId: str = Field(..., description="e.g. DEV-R304-RFID")
    name: str
    room: str
    building: str = "Academic Complex 2"
    deviceType: str = Field(default="RFID", description="RFID, FINGERPRINT, DUAL")
    apiKey: str


class HardwareDeviceOut(BaseModel):
    id: str
    deviceId: str
    name: str
    room: str
    building: str
    deviceType: str
    apiKey: str
    status: str = "ACTIVE"
    lastHeartbeat: Optional[str] = None
    registeredAt: str


class HardwareScanResultOut(BaseModel):
    success: bool
    status: str
    message: str
    record: Optional[dict] = None
    scanLog: Optional[dict] = None
