"""Dashboard API endpoints."""

from datetime import datetime, date, timedelta
from typing import List
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from src.database import get_db
from src.models.order import Order
from src.models.email import Email
from src.models.order_event import OrderEvent
from src.models.communication import CustomerCommunication

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class AttentionItem(BaseModel):
    """Item requiring attention."""

    type: str
    id: str
    title: str
    detail: str
    urgency: str  # high, medium, low


class StatusCount(BaseModel):
    """Order count by status."""

    status: str
    count: int


class DashboardStats(BaseModel):
    """Dashboard statistics."""

    total_open_orders: int
    orders_updated_today: int
    emails_processed_today: int
    communications_today: int
    orders_by_status: List[StatusCount]
    shipping_this_week: int
    delivering_this_week: int


class DashboardResponse(BaseModel):
    """Full dashboard response."""

    attention_items: List[AttentionItem]
    stats: DashboardStats


@router.get("", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)):
    """Get dashboard data with attention items and stats."""
    today = date.today()
    week_end = today + timedelta(days=7)
    today_start = datetime.combine(today, datetime.min.time())

    attention_items = []

    # Orders with past expected ship date and not shipped/delivered
    overdue_ship = (
        db.query(Order)
        .filter(
            Order.expected_ship_date < today,
            Order.status.notin_(["shipped", "delivered", "cancelled"]),
        )
        .all()
    )
    for order in overdue_ship:
        attention_items.append(
            AttentionItem(
                type="overdue_ship",
                id=str(order.id),
                title=f"Order {order.order_number} overdue for shipping",
                detail=f"Expected: {order.expected_ship_date}",
                urgency="high",
            )
        )

    # Orders with delivery approaching (< 3 days) and not delivered
    delivery_soon = (
        db.query(Order)
        .filter(
            Order.expected_delivery_date <= today + timedelta(days=3),
            Order.expected_delivery_date >= today,
            Order.status != "delivered",
            Order.status != "cancelled",
        )
        .all()
    )
    for order in delivery_soon:
        days_until = (order.expected_delivery_date - today).days
        attention_items.append(
            AttentionItem(
                type="delivery_approaching",
                id=str(order.id),
                title=f"Order {order.order_number} delivery in {days_until} days",
                detail=f"Expected: {order.expected_delivery_date}",
                urgency="medium" if days_until > 1 else "high",
            )
        )

    # Unprocessed emails
    unprocessed_emails = (
        db.query(Email)
        .filter(Email.processed == False)
        .order_by(Email.received_at.desc())
        .limit(10)
        .all()
    )
    for email in unprocessed_emails:
        attention_items.append(
            AttentionItem(
                type="unprocessed_email",
                id=str(email.id),
                title=f"Unprocessed: {email.subject or 'No subject'}",
                detail=f"From: {email.sender_email or 'Unknown'}",
                urgency="medium",
            )
        )

    # Orders with no update in > 7 days
    week_ago = datetime.utcnow() - timedelta(days=7)
    stale_orders = (
        db.query(Order)
        .filter(
            Order.updated_at < week_ago,
            Order.status.notin_(["delivered", "cancelled"]),
        )
        .limit(10)
        .all()
    )
    for order in stale_orders:
        days_stale = (datetime.utcnow() - order.updated_at).days
        attention_items.append(
            AttentionItem(
                type="stale_order",
                id=str(order.id),
                title=f"Order {order.order_number} no update in {days_stale} days",
                detail=f"Status: {order.status}",
                urgency="low",
            )
        )

    # Calculate stats
    total_open = (
        db.query(Order)
        .filter(Order.status.notin_(["delivered", "cancelled"]))
        .count()
    )

    orders_updated_today = (
        db.query(Order).filter(Order.updated_at >= today_start).count()
    )

    emails_processed_today = (
        db.query(Email)
        .filter(Email.processed == True, Email.processed_at >= today_start)
        .count()
    )

    communications_today = (
        db.query(CustomerCommunication)
        .filter(CustomerCommunication.created_at >= today_start)
        .count()
    )

    # Orders by status
    status_counts = (
        db.query(Order.status, func.count(Order.id))
        .filter(Order.status.notin_(["delivered", "cancelled"]))
        .group_by(Order.status)
        .all()
    )
    orders_by_status = [
        StatusCount(status=status, count=count) for status, count in status_counts
    ]

    # Shipping this week
    shipping_this_week = (
        db.query(Order)
        .filter(
            Order.expected_ship_date >= today,
            Order.expected_ship_date <= week_end,
            Order.status.notin_(["shipped", "delivered", "cancelled"]),
        )
        .count()
    )

    # Delivering this week
    delivering_this_week = (
        db.query(Order)
        .filter(
            Order.expected_delivery_date >= today,
            Order.expected_delivery_date <= week_end,
            Order.status != "delivered",
            Order.status != "cancelled",
        )
        .count()
    )

    stats = DashboardStats(
        total_open_orders=total_open,
        orders_updated_today=orders_updated_today,
        emails_processed_today=emails_processed_today,
        communications_today=communications_today,
        orders_by_status=orders_by_status,
        shipping_this_week=shipping_this_week,
        delivering_this_week=delivering_this_week,
    )

    return DashboardResponse(attention_items=attention_items, stats=stats)
