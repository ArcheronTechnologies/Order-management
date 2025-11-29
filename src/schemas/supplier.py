"""Supplier schemas."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class SupplierBase(BaseModel):
    """Base supplier schema."""

    name: str
    email_domains: Optional[List[str]] = None
    default_lead_time_days: Optional[int] = None
    notes: Optional[str] = None


class SupplierCreate(SupplierBase):
    """Schema for creating a supplier."""

    pass


class SupplierUpdate(BaseModel):
    """Schema for updating a supplier."""

    name: Optional[str] = None
    email_domains: Optional[List[str]] = None
    default_lead_time_days: Optional[int] = None
    notes: Optional[str] = None


class SupplierResponse(SupplierBase):
    """Schema for supplier response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


class SupplierList(BaseModel):
    """Schema for list of suppliers."""

    items: List[SupplierResponse]
    total: int
