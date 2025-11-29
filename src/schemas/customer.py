"""Customer schemas."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr


class CustomerBase(BaseModel):
    """Base customer schema."""

    name: str
    contact_email: Optional[EmailStr] = None
    contact_name: Optional[str] = None
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    """Schema for creating a customer."""

    pass


class CustomerUpdate(BaseModel):
    """Schema for updating a customer."""

    name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_name: Optional[str] = None
    notes: Optional[str] = None


class CustomerResponse(CustomerBase):
    """Schema for customer response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime


class CustomerList(BaseModel):
    """Schema for list of customers."""

    items: List[CustomerResponse]
    total: int
