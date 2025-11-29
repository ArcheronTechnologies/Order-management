"""Customer communication API endpoints."""

from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.communication import CustomerCommunication
from src.schemas.communication import (
    CommunicationCreate,
    CommunicationResponse,
    CommunicationList,
)

router = APIRouter(prefix="/api/communications", tags=["communications"])


@router.get("", response_model=CommunicationList)
def list_communications(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    order_id: Optional[UUID] = None,
    customer_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
):
    """List communications with filters."""
    query = db.query(CustomerCommunication)

    if order_id:
        query = query.filter(CustomerCommunication.order_id == order_id)
    if customer_id:
        query = query.filter(CustomerCommunication.customer_id == customer_id)

    total = query.count()
    items = (
        query.order_by(CustomerCommunication.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return CommunicationList(items=items, total=total)


@router.get("/{comm_id}", response_model=CommunicationResponse)
def get_communication(comm_id: UUID, db: Session = Depends(get_db)):
    """Get a communication by ID."""
    comm = (
        db.query(CustomerCommunication)
        .filter(CustomerCommunication.id == comm_id)
        .first()
    )
    if not comm:
        raise HTTPException(status_code=404, detail="Communication not found")
    return comm


@router.post("", response_model=CommunicationResponse, status_code=201)
def create_communication(
    comm_data: CommunicationCreate,
    db: Session = Depends(get_db),
):
    """Create a new communication record."""
    comm = CustomerCommunication(**comm_data.model_dump())
    db.add(comm)
    db.commit()
    db.refresh(comm)
    return comm


@router.delete("/{comm_id}", status_code=204)
def delete_communication(comm_id: UUID, db: Session = Depends(get_db)):
    """Delete a communication."""
    comm = (
        db.query(CustomerCommunication)
        .filter(CustomerCommunication.id == comm_id)
        .first()
    )
    if not comm:
        raise HTTPException(status_code=404, detail="Communication not found")

    db.delete(comm)
    db.commit()
    return None


# Communication templates
TEMPLATES = {
    "status_update": {
        "subject": "Order Status Update - {order_number}",
        "body": """Dear {customer_name},

This is an update regarding your order {order_number}.

Current Status: {status}
Expected Ship Date: {expected_ship_date}
Expected Delivery Date: {expected_delivery_date}

If you have any questions, please don't hesitate to reach out.

Best regards,
J2 Team""",
    },
    "delay_notice": {
        "subject": "Important: Order Delay Notice - {order_number}",
        "body": """Dear {customer_name},

We regret to inform you that there has been a delay with your order {order_number}.

Original Expected Date: {original_date}
New Expected Date: {new_date}

We apologize for any inconvenience this may cause. We are working diligently to fulfill your order as quickly as possible.

If you have any questions or concerns, please contact us.

Best regards,
J2 Team""",
    },
    "ship_confirmation": {
        "subject": "Your Order Has Shipped - {order_number}",
        "body": """Dear {customer_name},

Great news! Your order {order_number} has shipped.

Tracking Number: {tracking_number}
Carrier: {carrier}
Expected Delivery: {expected_delivery_date}

You can track your shipment using the tracking number above.

Best regards,
J2 Team""",
    },
    "delivery_confirmation": {
        "subject": "Order Delivered - {order_number}",
        "body": """Dear {customer_name},

Your order {order_number} has been delivered.

If you have any questions about your order, please don't hesitate to contact us.

Thank you for your business!

Best regards,
J2 Team""",
    },
}


@router.get("/templates/list")
def list_templates():
    """List available communication templates."""
    return {
        name: {"subject": template["subject"]}
        for name, template in TEMPLATES.items()
    }


@router.get("/templates/{template_name}")
def get_template(template_name: str):
    """Get a specific template."""
    if template_name not in TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")
    return TEMPLATES[template_name]
