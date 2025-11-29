"""Order event schemas."""

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class OrderEventBase(BaseModel):
    """Base order event schema."""

    event_type: str
    event_data: Dict[str, Any] = Field(default_factory=dict)
    source: str = "manual"
    source_reference: Optional[str] = None
    created_by: Optional[str] = None


class OrderEventCreate(OrderEventBase):
    """Schema for creating an order event."""

    pass


class OrderEventResponse(OrderEventBase):
    """Schema for order event response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_id: UUID
    created_at: datetime
