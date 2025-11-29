"""Pydantic schemas for API validation."""

from src.schemas.supplier import (
    SupplierCreate,
    SupplierUpdate,
    SupplierResponse,
    SupplierList,
)
from src.schemas.customer import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    CustomerList,
)
from src.schemas.order import (
    OrderCreate,
    OrderUpdate,
    OrderResponse,
    OrderList,
    OrderStatusUpdate,
)
from src.schemas.line_item import (
    LineItemCreate,
    LineItemUpdate,
    LineItemResponse,
)
from src.schemas.order_event import (
    OrderEventCreate,
    OrderEventResponse,
)
from src.schemas.email import (
    EmailResponse,
    EmailLink,
    EmailProcess,
)
from src.schemas.communication import (
    CommunicationCreate,
    CommunicationResponse,
)

__all__ = [
    "SupplierCreate",
    "SupplierUpdate",
    "SupplierResponse",
    "SupplierList",
    "CustomerCreate",
    "CustomerUpdate",
    "CustomerResponse",
    "CustomerList",
    "OrderCreate",
    "OrderUpdate",
    "OrderResponse",
    "OrderList",
    "OrderStatusUpdate",
    "LineItemCreate",
    "LineItemUpdate",
    "LineItemResponse",
    "OrderEventCreate",
    "OrderEventResponse",
    "EmailResponse",
    "EmailLink",
    "EmailProcess",
    "CommunicationCreate",
    "CommunicationResponse",
]
