"""Order schemas."""

from datetime import datetime, date
from typing import Optional, List
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, ConfigDict

from src.schemas.line_item import LineItemCreate, LineItemResponse
from src.schemas.order_event import OrderEventResponse


class OrderBase(BaseModel):
    """Base order schema."""

    order_number: str
    customer_po: Optional[str] = None
    supplier_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    status: str = "pending"
    expected_ship_date: Optional[date] = None
    actual_ship_date: Optional[date] = None
    expected_delivery_date: Optional[date] = None
    actual_delivery_date: Optional[date] = None
    notes: Optional[str] = None


class OrderCreate(OrderBase):
    """Schema for creating an order."""

    line_items: Optional[List[LineItemCreate]] = None


class OrderUpdate(BaseModel):
    """Schema for updating an order."""

    order_number: Optional[str] = None
    customer_po: Optional[str] = None
    supplier_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    expected_ship_date: Optional[date] = None
    actual_ship_date: Optional[date] = None
    expected_delivery_date: Optional[date] = None
    actual_delivery_date: Optional[date] = None
    notes: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    """Schema for updating order status."""

    status: str
    notes: Optional[str] = None
    event_data: Optional[dict] = None


class SupplierSummary(BaseModel):
    """Minimal supplier info for order response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class CustomerSummary(BaseModel):
    """Minimal customer info for order response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class OrderResponse(OrderBase):
    """Schema for order response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
    supplier: Optional[SupplierSummary] = None
    customer: Optional[CustomerSummary] = None


class OrderDetailResponse(OrderResponse):
    """Schema for detailed order response with line items and events."""

    line_items: List[LineItemResponse] = []
    events: List[OrderEventResponse] = []


class OrderList(BaseModel):
    """Schema for list of orders."""

    items: List[OrderResponse]
    total: int
