"""Customer model."""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from src.database import Base


class Customer(Base):
    """Customer entity for tracking customer information."""

    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    # Relationships
    orders: Mapped[List["Order"]] = relationship(
        "Order", back_populates="customer", lazy="dynamic"
    )
    communications: Mapped[List["CustomerCommunication"]] = relationship(
        "CustomerCommunication", back_populates="customer", lazy="dynamic"
    )
