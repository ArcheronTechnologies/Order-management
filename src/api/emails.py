"""Email API endpoints."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from src.database import get_db
from src.models.email import Email
from src.schemas.email import EmailResponse, EmailLink, EmailProcess, EmailList

router = APIRouter(prefix="/api/emails", tags=["emails"])


@router.get("", response_model=EmailList)
def list_emails(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    processed: Optional[bool] = None,
    supplier_id: Optional[UUID] = None,
    order_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
):
    """List emails with filters."""
    query = db.query(Email)

    if processed is not None:
        query = query.filter(Email.processed == processed)
    if supplier_id:
        query = query.filter(Email.supplier_id == supplier_id)
    if order_id:
        query = query.filter(Email.order_id == order_id)

    total = query.count()
    items = query.order_by(Email.received_at.desc()).offset(skip).limit(limit).all()

    return EmailList(items=items, total=total)


@router.get("/{email_id}", response_model=EmailResponse)
def get_email(email_id: UUID, db: Session = Depends(get_db)):
    """Get an email by ID."""
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    return email


@router.patch("/{email_id}/link", response_model=EmailResponse)
def link_email(
    email_id: UUID,
    link_data: EmailLink,
    db: Session = Depends(get_db),
):
    """Link an email to an order and/or supplier."""
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    if link_data.order_id is not None:
        email.order_id = link_data.order_id
    if link_data.supplier_id is not None:
        email.supplier_id = link_data.supplier_id
    if link_data.email_type is not None:
        email.email_type = link_data.email_type

    db.commit()
    db.refresh(email)
    return email


@router.patch("/{email_id}/process", response_model=EmailResponse)
def process_email(
    email_id: UUID,
    process_data: EmailProcess,
    db: Session = Depends(get_db),
):
    """Mark an email as processed."""
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    email.processed = process_data.processed
    if process_data.processed:
        email.processed_at = datetime.utcnow()
    else:
        email.processed_at = None

    if process_data.email_type is not None:
        email.email_type = process_data.email_type
    if process_data.order_id is not None:
        email.order_id = process_data.order_id
    if process_data.supplier_id is not None:
        email.supplier_id = process_data.supplier_id

    db.commit()
    db.refresh(email)
    return email


@router.delete("/{email_id}", status_code=204)
def delete_email(email_id: UUID, db: Session = Depends(get_db)):
    """Delete an email."""
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    db.delete(email)
    db.commit()
    return None
