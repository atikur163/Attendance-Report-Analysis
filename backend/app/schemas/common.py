"""Common Pydantic Schemas."""
from typing import Generic, TypeVar, Optional, List, Any
from pydantic import BaseModel, Field

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "Operation completed successfully"
    data: Optional[T] = None


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class AuditLogEntry(BaseModel):
    id: str
    userId: str
    userName: str
    action: str
    entity: str
    entityId: str
    details: str
    timestamp: str
