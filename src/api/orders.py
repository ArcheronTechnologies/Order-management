"""Order API endpoints."""

from datetime import datetime, date
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, exists

from src.database import get_db
from src.models.order import Order
from src.models.line_item import LineItem
from src.models.order_event import OrderEvent
from src.schemas.order import (
    OrderCreate,
    OrderUpdate,
    OrderResponse,
    OrderDetailResponse,
    OrderList,
    OrderStatusUpdate,
)
from src.schemas.line_item import LineItemCreate, LineItemUpdate, LineItemResponse
from src.schemas.order_event import OrderEventCreate, OrderEventResponse

router = APIRouter(prefix="/api/orders", tags=["orders"])

# Valid order statuses
ORDER_STATUSES = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "partial_ship",
    "delivered",
    "cancelled",
    "on_hold",
]


@router.get("", response_model=OrderList)
def list_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: Optional[str] = None,
    supplier_id: Optional[UUID] = None,
    customer_id: Optional[UUID] = None,
    search: Optional[str] = None,
    ship_date_from: Optional[date] = None,
    ship_date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """List orders with filters."""
    query = db.query(Order).options(
        joinedload(Order.supplier),
        joinedload(Order.customer),
    )

    if status:
        query = query.filter(Order.status == status)
    if supplier_id:
        query = query.filter(Order.supplier_id == supplier_id)
    if customer_id:
        query = query.filter(Order.customer_id == customer_id)
    if search:
        # Search in order number, customer PO, and line item part numbers
        part_number_match = exists().where(
            (LineItem.order_id == Order.id) &
            (LineItem.part_number.ilike(f"%{search}%"))
        )
        query = query.filter(
            or_(
                Order.order_number.ilike(f"%{search}%"),
                Order.customer_po.ilike(f"%{search}%"),
                part_number_match,
            )
        )
    if ship_date_from:
        query = query.filter(Order.expected_ship_date >= ship_date_from)
    if ship_date_to:
        query = query.filter(Order.expected_ship_date <= ship_date_to)

    total = query.count()
    items = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()

    return OrderList(items=items, total=total)


@router.get("/{order_id}", response_model=OrderDetailResponse)
def get_order(order_id: UUID, db: Session = Depends(get_db)):
    """Get an order by ID with full details."""
    order = (
        db.query(Order)
        .options(
            joinedload(Order.supplier),
            joinedload(Order.customer),
            joinedload(Order.line_items),
            joinedload(Order.events),
        )
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("", response_model=OrderDetailResponse, status_code=201)
def create_order(order_data: OrderCreate, db: Session = Depends(get_db)):
    """Create a new order."""
    # Validate status
    if order_data.status not in ORDER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {ORDER_STATUSES}",
        )

    # Extract line items before creating order
    line_items_data = order_data.line_items or []
    order_dict = order_data.model_dump(exclude={"line_items"})

    order = Order(**order_dict)
    db.add(order)
    db.flush()  # Get order ID

    # Create line items
    for item_data in line_items_data:
        line_item = LineItem(order_id=order.id, **item_data.model_dump())
        db.add(line_item)

    # Create initial event
    event = OrderEvent(
        order_id=order.id,
        event_type="created",
        event_data={"initial_status": order.status},
        source="manual",
    )
    db.add(event)

    db.commit()
    db.refresh(order)
    return order


@router.patch("/{order_id}", response_model=OrderDetailResponse)
def update_order(
    order_id: UUID,
    order_data: OrderUpdate,
    db: Session = Depends(get_db),
):
    """Update an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    update_data = order_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(order, field, value)

    order.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order


@router.post("/{order_id}/status", response_model=OrderDetailResponse)
def update_order_status(
    order_id: UUID,
    status_data: OrderStatusUpdate,
    db: Session = Depends(get_db),
):
    """Update order status and create event."""
    if status_data.status not in ORDER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {ORDER_STATUSES}",
        )

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.status
    order.status = status_data.status
    order.updated_at = datetime.utcnow()

    # Create status change event
    event_data = {
        "old_status": old_status,
        "new_status": status_data.status,
    }
    if status_data.notes:
        event_data["notes"] = status_data.notes
    if status_data.event_data:
        event_data.update(status_data.event_data)

    event = OrderEvent(
        order_id=order.id,
        event_type=status_data.status,
        event_data=event_data,
        source="manual",
    )
    db.add(event)

    db.commit()
    db.refresh(order)
    return order


@router.delete("/{order_id}", status_code=204)
def delete_order(order_id: UUID, db: Session = Depends(get_db)):
    """Delete an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    db.delete(order)
    db.commit()
    return None


# Line Item endpoints
@router.post("/{order_id}/line-items", response_model=LineItemResponse, status_code=201)
def add_line_item(
    order_id: UUID,
    item_data: LineItemCreate,
    db: Session = Depends(get_db),
):
    """Add a line item to an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    line_item = LineItem(order_id=order_id, **item_data.model_dump())
    db.add(line_item)
    db.commit()
    db.refresh(line_item)
    return line_item


@router.patch("/{order_id}/line-items/{item_id}", response_model=LineItemResponse)
def update_line_item(
    order_id: UUID,
    item_id: UUID,
    item_data: LineItemUpdate,
    db: Session = Depends(get_db),
):
    """Update a line item."""
    line_item = (
        db.query(LineItem)
        .filter(LineItem.id == item_id, LineItem.order_id == order_id)
        .first()
    )
    if not line_item:
        raise HTTPException(status_code=404, detail="Line item not found")

    update_data = item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(line_item, field, value)

    db.commit()
    db.refresh(line_item)
    return line_item


@router.delete("/{order_id}/line-items/{item_id}", status_code=204)
def delete_line_item(
    order_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
):
    """Delete a line item."""
    line_item = (
        db.query(LineItem)
        .filter(LineItem.id == item_id, LineItem.order_id == order_id)
        .first()
    )
    if not line_item:
        raise HTTPException(status_code=404, detail="Line item not found")

    db.delete(line_item)
    db.commit()
    return None


# Event endpoints
@router.post("/{order_id}/events", response_model=OrderEventResponse, status_code=201)
def add_event(
    order_id: UUID,
    event_data: OrderEventCreate,
    db: Session = Depends(get_db),
):
    """Add an event to an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    event = OrderEvent(order_id=order_id, **event_data.model_dump())
    db.add(event)

    # Update order timestamp
    order.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(event)
    return event


@router.get("/{order_id}/events", response_model=List[OrderEventResponse])
def list_order_events(order_id: UUID, db: Session = Depends(get_db)):
    """List all events for an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    events = (
        db.query(OrderEvent)
        .filter(OrderEvent.order_id == order_id)
        .order_by(OrderEvent.created_at.desc())
        .all()
    )
    return events
