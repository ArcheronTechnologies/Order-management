"""API endpoints."""

from src.api.suppliers import router as suppliers_router
from src.api.customers import router as customers_router
from src.api.orders import router as orders_router
from src.api.emails import router as emails_router

__all__ = [
    "suppliers_router",
    "customers_router",
    "orders_router",
    "emails_router",
]
