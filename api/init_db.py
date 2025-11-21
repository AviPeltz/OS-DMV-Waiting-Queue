"""
Database initialization script
Creates tables and seeds initial data from CSV
"""
from database import engine, SessionLocal, Base
from models import Branch, Service, Ticket
from sqlalchemy import text
import time
import sys
import csv
from pathlib import Path

def wait_for_db():
    """
    Wait for database to be ready with proper connection cleanup

    Uses context manager to ensure connections are always closed
    """
    max_retries = 30
    retry_count = 0

    while retry_count < max_retries:
        db = None
        try:
            db = SessionLocal()
            db.execute(text("SELECT 1"))
            print("Database is ready!")
            return
        except Exception as e:
            retry_count += 1
            print(f"Waiting for database... ({retry_count}/{max_retries})")
            print(f"  Error: {str(e)}")
            time.sleep(1)
        finally:
            # Always close connection, even on error
            if db:
                db.close()

    print("ERROR: Database did not become ready in time", file=sys.stderr)
    raise Exception("Database connection timeout after 30 retries")


def init_db():
    """
    Initialize database with tables and seed data

    Idempotent: Safe to run multiple times, only seeds if tables are empty
    """
    wait_for_db()

    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

    # Seed initial data using context manager
    db = SessionLocal()

    try:
        # Idempotent check: Only seed if branches table is empty
        existing_branches = db.query(Branch).count()
        if existing_branches > 0:
            print("Database already seeded, skipping...")
            return

        # Load branches from CSV
        DATA_FILE = Path(__file__).parent / "data" / "ca_dmv_branches.csv"

        if not DATA_FILE.exists():
            print(f"WARNING: CSV file not found at {DATA_FILE}")
            print("Using fallback sample data...")
            # Fallback to sample data if CSV doesn't exist
            branches = [
                Branch(name="San Francisco DMV", code="SF01", address="1377 Fell St",
                       city="San Francisco", state="CA", zip="94117"),
                Branch(name="Oakland DMV", code="OAK01", address="5300 Claremont Ave",
                       city="Oakland", state="CA", zip="94618"),
                Branch(name="San Jose DMV", code="SJ01", address="111 W Alma Ave",
                       city="San Jose", state="CA", zip="95110"),
            ]
        else:
            print(f"Loading branches from {DATA_FILE}")
            branches = []
            with DATA_FILE.open() as f:
                reader = csv.DictReader(f)
                for row in reader:
                    branches.append(Branch(
                        name=row["name"],
                        code=row["code"],
                        address=row["address"],
                        city=row.get("city", ""),
                        state=row.get("state", "CA"),
                        zip=row.get("zip", "")
                    ))
            print(f"Loaded {len(branches)} branches from CSV")

        # Add all branches to database
        db.add_all(branches)
        db.commit()
        db.flush()  # Ensure branches have IDs before adding services

        # Create services for each branch
        service_types = [
            {"code": "DL_RENEWAL", "name": "Driver License Renewal", "avg_time": 12.0},
            {"code": "DL_NEW", "name": "New Driver License", "avg_time": 25.0},
            {"code": "VR_RENEWAL", "name": "Vehicle Registration Renewal", "avg_time": 8.0},
            {"code": "VR_NEW", "name": "New Vehicle Registration", "avg_time": 15.0},
            {"code": "ID_CARD", "name": "ID Card", "avg_time": 10.0},
            {"code": "REAL_ID", "name": "Real ID", "avg_time": 20.0},
        ]

        for branch in branches:
            for svc in service_types:
                service = Service(
                    branch_id=branch.id,
                    code=svc["code"],
                    name=svc["name"],
                    avg_service_time_minutes=svc["avg_time"]
                )
                db.add(service)

        db.commit()
        print(f"Database seeded with {len(branches)} branches and {len(branches) * len(service_types)} services!")

    except Exception as e:
        print(f"ERROR during database seeding: {str(e)}", file=sys.stderr)
        db.rollback()
        raise
    finally:
        # Always close connection
        db.close()

if __name__ == "__main__":
    init_db()
