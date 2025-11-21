import random
import string
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import time

def generate_ticket_number(branch_code: str) -> str:
    """
    Generate a unique ticket number

    Format: {BRANCH_CODE}{TIMESTAMP}{RANDOM}
    Example: SF1732123456A42

    Note: This function generates a candidate number but does NOT check uniqueness.
    Use create_ticket_with_retry() to handle collisions.

    In production, consider:
    - Database sequences (PostgreSQL SERIAL)
    - Daily counter with format: {BRANCH}-{DATE}-{SEQUENCE} (e.g., SF-20240115-001)
    - Redis atomic counter
    """
    timestamp = int(datetime.utcnow().timestamp() * 1000)  # milliseconds for better uniqueness
    random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{branch_code}{timestamp}{random_suffix}"


def create_ticket_with_retry(
    db: Session,
    ticket_data: dict,
    branch_code: str,
    max_retries: int = 5
):
    """
    Create a ticket with automatic retry on unique constraint violations

    Args:
        db: SQLAlchemy session
        ticket_data: Dictionary of ticket fields (excluding ticket_number)
        branch_code: Branch code for ticket number generation
        max_retries: Maximum number of retry attempts

    Returns:
        Created ticket object

    Raises:
        IntegrityError: If max retries exceeded
    """
    from models import Ticket  # Import here to avoid circular dependency

    for attempt in range(max_retries):
        try:
            # Generate new ticket number
            ticket_number = generate_ticket_number(branch_code)

            # Create ticket with generated number
            ticket = Ticket(
                ticket_number=ticket_number,
                **ticket_data
            )

            db.add(ticket)
            db.flush()  # Flush to detect uniqueness violations before commit
            return ticket

        except IntegrityError as e:
            db.rollback()
            if attempt == max_retries - 1:
                # Last attempt failed
                raise IntegrityError(
                    f"Failed to generate unique ticket number after {max_retries} attempts",
                    params=None,
                    orig=e.orig
                )
            # Wait briefly before retry (exponential backoff)
            time.sleep(0.01 * (2 ** attempt))
            continue

    # Should never reach here, but just in case
    raise RuntimeError("Ticket creation failed unexpectedly")


def calculate_eta(position: int, avg_service_time_minutes: float) -> int:
    """
    Calculate estimated wait time in minutes

    Simple algorithm: position * average service time

    Future enhancements could include:
    - Time of day adjustments
    - Historical data analysis
    - Number of active service counters
    - Current queue velocity
    - Integration with Qmatic or other vendor APIs for more accurate predictions
    """
    if position <= 0:
        return 0

    # Basic calculation
    eta_minutes = int(position * avg_service_time_minutes)

    # Add a small buffer for realistic estimation
    buffer = int(avg_service_time_minutes * 0.2)
    eta_minutes += buffer

    return eta_minutes
