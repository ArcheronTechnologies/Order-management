"""Email schemas."""

from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class EmailResponse(BaseModel):
    """Schema for email response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    graph_message_id: Optional[str] = None
    subject: Optional[str] = None
    sender_email: Optional[str] = None
    sender_name: Optional[str] = None
    received_at: Optional[datetime] = None
    body_preview: Optional[str] = None
    body_full: Optional[str] = None
    has_attachments: bool = False

    supplier_id: Optional[UUID] = None
    order_id: Optional[UUID] = None
    email_type: Optional[str] = None

    processed: bool = False
    processed_at: Optional[datetime] = None

    created_at: datetime


class EmailLink(BaseModel):
    """Schema for linking email to order/supplier."""

    order_id: Optional[UUID] = None
    supplier_id: Optional[UUID] = None
    email_type: Optional[str] = None


class EmailProcess(BaseModel):
    """Schema for marking email as processed."""

    processed: bool = True
    email_type: Optional[str] = None
    order_id: Optional[UUID] = None
    supplier_id: Optional[UUID] = None


class EmailList(BaseModel):
    """Schema for list of emails."""

    items: List[EmailResponse]
    total: int
