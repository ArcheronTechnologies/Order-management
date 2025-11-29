"""Supplier model."""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Integer, Text, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from src.database import Base


class Supplier(Base):
    """Supplier entity for tracking vendor information."""

    __tablename__ = "suppliers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email_domains: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(Text), nullable=True
    )
    default_lead_time_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    # Relationships
    orders: Mapped[List["Order"]] = relationship(
        "Order", back_populates="supplier", lazy="dynamic"
    )
    emails: Mapped[List["Email"]] = relationship(
        "Email", back_populates="supplier", lazy="dynamic"
    )
