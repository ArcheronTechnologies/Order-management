"""Customer communication schemas."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr


class CommunicationBase(BaseModel):
    """Base communication schema."""

    order_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    communication_type: Optional[str] = None
    method: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    recipient_email: Optional[EmailStr] = None
    sent_at: Optional[datetime] = None
    created_by: Optional[str] = None


class CommunicationCreate(CommunicationBase):
    """Schema for creating a communication."""

    pass


class CommunicationResponse(CommunicationBase):
    """Schema for communication response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


class CommunicationList(BaseModel):
    """Schema for list of communications."""

    items: List[CommunicationResponse]
    total: int
