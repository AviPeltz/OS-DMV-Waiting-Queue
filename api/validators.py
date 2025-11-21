"""
Validation functions for business logic and state transitions

NOTE: Only validate_ticket_can_be_completed is currently wired up in main.py.
The general validate_status_transition function is provided for future use
but is not enforced across all state changes yet.

TODO for production:
- Wire up validate_status_transition to all status changes
- Add cancel endpoint with validation
- Add return-to-queue endpoint with validation
- Enforce state machine across all ticket mutations
"""

from fastapi import HTTPException, status
from models import Ticket


def validate_status_transition(ticket: Ticket, new_status: str) -> None:
    """
    Validate that a status transition is allowed

    Valid transitions:
    - waiting -> called (staff calls ticket)
    - waiting -> cancelled (visitor cancels)
    - called -> completed (service finished)
    - called -> waiting (staff error, return to queue)

    Invalid transitions:
    - completed -> any (final state)
    - cancelled -> any (final state)
    - waiting -> completed (must be called first)

    Args:
        ticket: Ticket object with current status
        new_status: Desired new status

    Raises:
        HTTPException: If transition is invalid
    """
    current = ticket.status
    valid_transitions = {
        "waiting": ["called", "cancelled"],
        "called": ["completed", "waiting"],
        "completed": [],  # Final state
        "cancelled": []   # Final state
    }

    # Check if current status exists in our valid transitions
    if current not in valid_transitions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid current status: {current}"
        )

    # Check if transition is allowed
    if new_status not in valid_transitions[current]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition: {current} -> {new_status}. "
                   f"Allowed transitions from {current}: {', '.join(valid_transitions[current]) or 'none (final state)'}"
        )


def validate_ticket_can_be_called(ticket: Ticket) -> None:
    """
    Validate that a ticket can be called

    A ticket can only be called if it's in waiting status
    """
    if ticket.status != "waiting":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot call ticket with status '{ticket.status}'. "
                   "Only tickets in 'waiting' status can be called."
        )


def validate_ticket_can_be_completed(ticket: Ticket) -> None:
    """
    Validate that a ticket can be marked as completed

    A ticket should only be completed if it's currently being served (called)
    """
    if ticket.status != "called":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot complete ticket with status '{ticket.status}'. "
                   "Only tickets in 'called' status can be completed. "
                   "Please call the ticket first."
        )
