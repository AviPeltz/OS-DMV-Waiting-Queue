from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Branch(Base):
    """DMV branch/office location"""
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False, index=True)  # e.g., "SF01"
    address = Column(String)
    city = Column(String)
    state = Column(String)
    zip = Column(String)

    # TODO: Future integration point - store Qmatic branch ID or display URL
    # qmatic_branch_id = Column(String, nullable=True)
    # display_url = Column(String, nullable=True)  # e.g., https://mt-cadmvoas.us.qmatic.cloud/branch-path

    tickets = relationship("Ticket", back_populates="branch")
    services = relationship("Service", back_populates="branch")


class Service(Base):
    """Service types offered at branches (e.g., Driver License Renewal, Vehicle Registration)"""
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    code = Column(String, nullable=False, index=True)  # e.g., "DL_RENEWAL"
    name = Column(String, nullable=False)
    avg_service_time_minutes = Column(Float, default=15.0)  # Used for ETA calculation

    branch = relationship("Branch", back_populates="services")
    tickets = relationship("Ticket", back_populates="service")


class Ticket(Base):
    """Individual queue ticket for a visitor"""
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String, unique=True, nullable=False, index=True)  # e.g., "B042"
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)

    # Status: waiting, called, completed, cancelled
    status = Column(String, default="waiting", nullable=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    called_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Queue position tracking
    position = Column(Integer, nullable=False)  # Position when ticket was created

    branch = relationship("Branch", back_populates="tickets")
    service = relationship("Service", back_populates="tickets")

    def __repr__(self):
        return f"<Ticket {self.ticket_number} - {self.status}>"
