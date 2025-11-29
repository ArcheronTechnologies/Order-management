"""Order event model for tracking status history."""

from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import String, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

from src.database import Base


class OrderEvent(Base):
    """Order event for tracking all status changes and actions."""

    __tablename__ = "order_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )

    # Event types: created, confirmed, shipped, partial_ship, delayed,
    #              delivered, cancelled, note_added, customer_notified
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # Flexible storage for event-specific data
    event_data: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict)

    # Source: manual, email, portal (future: automated)
    source: Mapped[str] = mapped_column(String(50), default="manual")

    # Links to email_id or other source record
    source_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    order: Mapped["Order"] = relationship("Order", back_populates="events")

    __table_args__ = (
        Index("idx_order_events_order", "order_id"),
        Index("idx_order_events_type", "event_type"),
    )
