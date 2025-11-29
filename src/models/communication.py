"""Customer communication model."""

from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from src.database import Base


class CustomerCommunication(Base):
    """Customer communication log for tracking outbound messages."""

    __tablename__ = "customer_communications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True
    )
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True
    )

    # Communication types: status_update, delay_notice, ship_confirm, etc.
    communication_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Method: email, phone, portal
    method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    subject: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recipient_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    sent_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    # Relationships
    order: Mapped[Optional["Order"]] = relationship(
        "Order", back_populates="communications"
    )
    customer: Mapped[Optional["Customer"]] = relationship(
        "Customer", back_populates="communications"
    )
