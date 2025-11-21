from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from typing import List
import os
from datetime import datetime

from database import get_db
from models import Branch, Service, Ticket
from schemas import (
    Branch as BranchSchema,
    Service as ServiceSchema,
    TicketJoinRequest,
    TicketResponse,
    TicketStatusResponse,
    CallNextResponse
)
from utils import calculate_eta, create_ticket_with_retry
from auth import verify_staff_token
from validators import validate_status_transition, validate_ticket_can_be_completed

app = FastAPI(
    title="Open DMV Queue System",
    description="Open-source replacement for DMV queue management (v0)",
    version="0.1.0"
)

# CORS configuration
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TODO: WebSocket endpoint for real-time display updates
# This will broadcast ticket status changes to connected displays (monitors in DMV offices)
# Example integration points:
# - When ticket status changes, broadcast to WebSocket clients
# - Display monitors connect to ws://api:8000/ws/display/{branch_id}
# - Staff calling system connects to receive updates
# - Can bridge to Qmatic or other vendor APIs for legacy display compatibility


@app.get("/")
def read_root():
    return {
        "message": "Open DMV Queue System API",
        "version": "0.1.0",
        "docs": "/docs"
    }


@app.get("/branches", response_model=List[BranchSchema])
def list_branches(db: Session = Depends(get_db)):
    """List all DMV branches"""
    branches = db.query(Branch).all()
    return branches


@app.get("/branches/{branch_id}", response_model=BranchSchema)
def get_branch(branch_id: int, db: Session = Depends(get_db)):
    """Get specific branch details"""
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


@app.get("/branches/{branch_id}/services", response_model=List[ServiceSchema])
def list_branch_services(branch_id: int, db: Session = Depends(get_db)):
    """List all services available at a specific branch"""
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    services = db.query(Service).filter(Service.branch_id == branch_id).all()
    return services


@app.post("/branches/{branch_id}/join", response_model=TicketResponse)
def join_queue(
    branch_id: int,
    request: TicketJoinRequest,
    db: Session = Depends(get_db)
):
    """
    Visitor joins the queue for a specific branch and service

    Returns a ticket with a unique ticket number (e.g., B042)

    Thread-safe: Uses atomic transaction with SELECT FOR UPDATE to prevent race conditions
    """
    try:
        # Validate branch exists
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")

        # Validate service exists for this branch
        service = db.query(Service).filter(
            Service.branch_id == branch_id,
            Service.code == request.service_code
        ).first()

        if not service:
            raise HTTPException(
                status_code=404,
                detail=f"Service {request.service_code} not found at this branch"
            )

        # ATOMIC OPERATION: Get next position with proper locking
        #
        # LIMITATION: This approach locks ALL waiting tickets for this queue,
        # which blocks concurrent joins and doesn't scale well.
        #
        # For production, use one of these alternatives:
        # 1. Dedicated sequence table per branch/service with SELECT...FOR UPDATE
        # 2. PostgreSQL SEQUENCE objects
        # 3. Advisory locks with pg_advisory_lock()
        # 4. Redis atomic counters
        #
        # Current approach: Lock all waiting tickets to find MAX position
        # This ensures correctness even for empty queues, but has performance cost.
        waiting_tickets_subq = db.query(Ticket).filter(
            Ticket.branch_id == branch_id,
            Ticket.service_id == service.id,
            Ticket.status == "waiting"
        ).with_for_update().subquery()

        max_position = db.query(func.coalesce(func.max(waiting_tickets_subq.c.position), 0)).scalar()
        position = max_position + 1

        # Create ticket with retry logic for unique constraint violations
        ticket_data = {
            "branch_id": branch_id,
            "service_id": service.id,
            "status": "waiting",
            "position": position
        }

        ticket = create_ticket_with_retry(db, ticket_data, branch.code)

        # Commit transaction
        db.commit()
        db.refresh(ticket)

        # TODO: Broadcast new ticket to WebSocket clients
        # broadcast_ticket_update(ticket.id, "created")

        return ticket

    except HTTPException:
        # Re-raise HTTP exceptions (404s, validation errors, etc.)
        db.rollback()
        raise
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create ticket due to database constraint. Please try again."
        )
    except Exception as e:
        db.rollback()
        # Log the actual error for debugging
        import logging
        logging.error(f"Unexpected error in join_queue: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while joining the queue. Please try again."
        )


@app.get("/tickets/{ticket_number}", response_model=TicketStatusResponse)
def get_ticket_status(ticket_number: str, db: Session = Depends(get_db)):
    """
    Check ticket status, current position in queue, and estimated wait time

    Visitors can poll this endpoint or it can be used for real-time updates
    """
    ticket = db.query(Ticket).filter(
        Ticket.ticket_number == ticket_number
    ).first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Calculate current position (count tickets ahead in the queue)
    if ticket.status == "waiting":
        tickets_ahead = db.query(Ticket).filter(
            Ticket.branch_id == ticket.branch_id,
            Ticket.service_id == ticket.service_id,
            Ticket.status == "waiting",
            Ticket.id < ticket.id
        ).count()
        current_position = tickets_ahead + 1
    elif ticket.status == "called":
        current_position = 0  # Being served
    else:
        current_position = 0  # Completed or cancelled

    # Calculate estimated wait time
    service = db.query(Service).filter(Service.id == ticket.service_id).first()
    estimated_wait = calculate_eta(current_position, service.avg_service_time_minutes)

    return TicketStatusResponse(
        ticket_number=ticket.ticket_number,
        status=ticket.status,
        current_position=current_position,
        estimated_wait_minutes=estimated_wait,
        created_at=ticket.created_at,
        called_at=ticket.called_at,
        branch_name=ticket.branch.name,
        service_name=service.name
    )


@app.post("/branches/{branch_id}/call-next", response_model=CallNextResponse)
def call_next_ticket(
    branch_id: int,
    service: str,
    db: Session = Depends(get_db),
    _token: str = Depends(verify_staff_token)
):
    """
    PROTECTED: Staff endpoint to call the next ticket in queue for a specific service

    Requires authentication via X-API-Key header

    Thread-safe: Uses SELECT FOR UPDATE to prevent multiple staff from calling the same ticket
    """
    try:
        # Validate branch
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")

        # Find service
        service_obj = db.query(Service).filter(
            Service.branch_id == branch_id,
            Service.code == service
        ).first()

        if not service_obj:
            raise HTTPException(status_code=404, detail="Service not found")

        # ATOMIC OPERATION: Find and lock next waiting ticket
        # with_for_update() prevents race condition where multiple staff call same ticket
        next_ticket = db.query(Ticket).filter(
            Ticket.branch_id == branch_id,
            Ticket.service_id == service_obj.id,
            Ticket.status == "waiting"
        ).order_by(Ticket.created_at).with_for_update().first()

        if not next_ticket:
            raise HTTPException(status_code=404, detail="No tickets waiting in queue")

        # Update ticket status
        next_ticket.status = "called"
        next_ticket.called_at = datetime.utcnow()

        db.commit()
        db.refresh(next_ticket)

        # TODO: Broadcast to WebSocket clients and display monitors
        # This is where integration with Qmatic displays or custom display URLs would happen
        # broadcast_ticket_call(next_ticket.ticket_number, branch_id)
        # update_qmatic_display(branch_id, next_ticket.ticket_number)

        return CallNextResponse(
            ticket_number=next_ticket.ticket_number,
            message=f"Now serving ticket {next_ticket.ticket_number}"
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import logging
        logging.error(f"Unexpected error in call_next_ticket: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while calling the next ticket. Please try again."
        )


@app.post("/tickets/{ticket_number}/complete")
def complete_ticket(
    ticket_number: str,
    db: Session = Depends(get_db),
    _token: str = Depends(verify_staff_token)
):
    """
    PROTECTED: Mark a ticket as completed (staff endpoint)

    Requires authentication via X-API-Key header

    Called when service is finished. Validates that ticket was in 'called' status.
    """
    try:
        ticket = db.query(Ticket).filter(
            Ticket.ticket_number == ticket_number
        ).with_for_update().first()

        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        # Validate status transition
        validate_ticket_can_be_completed(ticket)

        ticket.status = "completed"
        ticket.completed_at = datetime.utcnow()

        db.commit()

        # TODO: Broadcast completion to monitoring systems
        # broadcast_ticket_update(ticket.id, "completed")

        return {"message": f"Ticket {ticket_number} marked as completed"}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        import logging
        logging.error(f"Unexpected error in complete_ticket: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while completing the ticket. Please try again."
        )


@app.get("/branches/{branch_id}/queue-status")
def get_queue_status(branch_id: int, db: Session = Depends(get_db)):
    """
    Get current queue statistics for a branch

    Useful for display monitors and staff dashboards
    """
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    services = db.query(Service).filter(Service.branch_id == branch_id).all()

    queue_data = []
    for service in services:
        waiting_count = db.query(Ticket).filter(
            Ticket.branch_id == branch_id,
            Ticket.service_id == service.id,
            Ticket.status == "waiting"
        ).count()

        currently_serving = db.query(Ticket).filter(
            Ticket.branch_id == branch_id,
            Ticket.service_id == service.id,
            Ticket.status == "called"
        ).order_by(Ticket.called_at.desc()).first()

        queue_data.append({
            "service_code": service.code,
            "service_name": service.name,
            "waiting_count": waiting_count,
            "currently_serving": currently_serving.ticket_number if currently_serving else None
        })

    return {
        "branch_id": branch_id,
        "branch_name": branch.name,
        "queues": queue_data
    }
