"""Email model for storing synced emails from Graph API."""

from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import String, Text, Boolean, Float, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

from src.database import Base


class Email(Base):
    """Email entity for storing synced supplier emails."""

    __tablename__ = "emails"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    graph_message_id: Mapped[Optional[str]] = mapped_column(
        String(255), unique=True, nullable=True
    )

    # Raw email data
    subject: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sender_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sender_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    received_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    body_preview: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body_full: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    has_attachments: Mapped[bool] = mapped_column(Boolean, default=False)

    # Classification (manual in Phase 1)
    supplier_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True
    )
    order_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True
    )

    # Email types: order_confirmation, ship_notification, delay_notice,
    #              delivery_confirmation, inquiry, other
    email_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Processing state
    processed: Mapped[bool] = mapped_column(Boolean, default=False)
    processed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    # Future automation fields (populated in Phase 2+)
    auto_extracted_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True
    )
    extraction_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    human_corrected_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    # Relationships
    supplier: Mapped[Optional["Supplier"]] = relationship(
        "Supplier", back_populates="emails"
    )
    order: Mapped[Optional["Order"]] = relationship("Order", back_populates="emails")

    __table_args__ = (
        Index("idx_emails_processed", "processed"),
        Index("idx_emails_supplier", "supplier_id"),
        Index("idx_emails_order", "order_id"),
        Index("idx_emails_received", "received_at"),
    )
