from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# Branch schemas
class BranchBase(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None

class Branch(BranchBase):
    id: int

    class Config:
        from_attributes = True

# Service schemas
class ServiceBase(BaseModel):
    code: str
    name: str
    avg_service_time_minutes: float = 15.0

class Service(ServiceBase):
    id: int
    branch_id: int

    class Config:
        from_attributes = True

# Ticket schemas
class TicketJoinRequest(BaseModel):
    service_code: str

class TicketResponse(BaseModel):
    id: int
    ticket_number: str
    branch_id: int
    service_id: int
    status: str
    created_at: datetime
    position: int

    class Config:
        from_attributes = True

class TicketStatusResponse(BaseModel):
    ticket_number: str
    status: str
    current_position: int
    estimated_wait_minutes: int
    created_at: datetime
    called_at: Optional[datetime] = None
    branch_name: str
    service_name: str

    class Config:
        from_attributes = True

class CallNextResponse(BaseModel):
    ticket_number: str
    message: str
