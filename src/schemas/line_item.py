"""Line item schemas."""

from typing import Optional
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class LineItemBase(BaseModel):
    """Base line item schema."""

    part_number: Optional[str] = None
    manufacturer: Optional[str] = None
    description: Optional[str] = None
    quantity_ordered: int
    quantity_shipped: int = 0
    quantity_delivered: int = 0
    unit_price: Optional[Decimal] = None
    notes: Optional[str] = None


class LineItemCreate(LineItemBase):
    """Schema for creating a line item."""

    pass


class LineItemUpdate(BaseModel):
    """Schema for updating a line item."""

    part_number: Optional[str] = None
    manufacturer: Optional[str] = None
    description: Optional[str] = None
    quantity_ordered: Optional[int] = None
    quantity_shipped: Optional[int] = None
    quantity_delivered: Optional[int] = None
    unit_price: Optional[Decimal] = None
    notes: Optional[str] = None


class LineItemResponse(LineItemBase):
    """Schema for line item response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_id: UUID
