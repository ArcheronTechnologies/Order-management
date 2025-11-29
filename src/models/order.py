"""Order model."""

from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import String, Text, Date, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from src.database import Base


class Order(Base):
    """Order entity - central record for tracking orders."""

    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_number: Mapped[str] = mapped_column(String(100), nullable=False)
    customer_po: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Foreign keys
    supplier_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True
    )
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True
    )

    # Current state (denormalized for fast queries)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    expected_ship_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    actual_ship_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    expected_delivery_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    actual_delivery_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Metadata
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    supplier: Mapped[Optional["Supplier"]] = relationship(
        "Supplier", back_populates="orders"
    )
    customer: Mapped[Optional["Customer"]] = relationship(
        "Customer", back_populates="orders"
    )
    line_items: Mapped[List["LineItem"]] = relationship(
        "LineItem", back_populates="order", cascade="all, delete-orphan"
    )
    events: Mapped[List["OrderEvent"]] = relationship(
        "OrderEvent", back_populates="order", cascade="all, delete-orphan"
    )
    emails: Mapped[List["Email"]] = relationship(
        "Email", back_populates="order", lazy="dynamic"
    )
    communications: Mapped[List["CustomerCommunication"]] = relationship(
        "CustomerCommunication", back_populates="order", lazy="dynamic"
    )

    __table_args__ = (
        Index("idx_orders_status", "status"),
        Index("idx_orders_supplier", "supplier_id"),
        Index("idx_orders_customer", "customer_id"),
        Index("idx_orders_expected_ship", "expected_ship_date"),
    )
