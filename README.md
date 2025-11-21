# Open DMV Queue System

An open-source replacement for the California DMV's queue management system, currently powered by Qmatic's cloud-based solution.

## ⚠️ CRITICAL: NOT PRODUCTION READY

**This is v0.3.0 - Development/Demo Version**

### What Works
- ✅ Queue management (join, check status, call next, cancel, return-to-queue)
- ✅ Race condition handling with QueueCounter table
- ✅ Complete state machine validation
- ✅ Modern UI with Tailwind CSS + shadcn/ui
- ✅ Scalable position assignment

### What Doesn't Work for Production
- ❌ **Staff API key exposed to browsers** (critical security flaw)
- ❌ **No automated tests** (can't verify correctness)
- ❌ **No audit logging, rate limiting, or monitoring**

**📖 Read [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) and [CHANGELOG.md](CHANGELOG.md)**

**Suitable for**: Development, learning, proof-of-concept
**NOT suitable for**: Production DMV operations, public deployment

## Overview

This system provides a fully functional, deployable queue management solution for DMV offices with:

- **Visitor Queue Management**: Join virtual queues, receive ticket numbers, check position and wait times
- **Staff Portal**: Authenticated staff endpoints to call next tickets and view queue status
- **RESTful API**: Clean FastAPI backend with PostgreSQL storage and transaction safety
- **Modern Web UI**: Next.js/TypeScript frontend with timeout handling
- **Future-Ready**: WebSocket stubs and integration points for real-time displays and vendor bridging

## Current System (Qmatic)

The California DMV currently uses Qmatic's cloud platform:
- Display URLs: `https://mt-cadmvoas.us.qmatic.cloud/...` (branch-specific)
- Cloud-based queue management
- Proprietary display integration
- Mobile ticketing capabilities

This open-source system provides a **drop-in replacement** with integration points for gradual migration.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Frontend                          │
│                    (Next.js + TypeScript)                    │
│                                                              │
│  - Join Queue Page    - Ticket Status    - Staff Portal     │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        │ REST API
                        │
┌───────────────────────▼──────────────────────────────────────┐
│                      FastAPI Backend                         │
│                                                              │
│  - Queue Management   - ETA Calculation   - WebSocket Stub   │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        │ SQLAlchemy
                        │
┌───────────────────────▼──────────────────────────────────────┐
│                    PostgreSQL Database                       │
│                                                              │
│  - Branches           - Services          - Tickets          │
└──────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd DMV
```

2. **IMPORTANT**: If you had a previous version running, clean up old volumes:
```bash
docker compose down -v
```

3. (Optional) Set custom staff API key:
```bash
# Generate a secure key
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Set environment variables
export STAFF_API_KEY="your-generated-key-here"
export NEXT_PUBLIC_STAFF_API_KEY="your-generated-key-here"
```

If you skip this step, the system will use a default development key (insecure for production).

4. Build and start all services:
```bash
docker compose up --build
```

5. Access the application:
   - **Web UI**: http://localhost:3000
   - **API Docs**: http://localhost:8000/docs (includes auth documentation)
   - **Database**: localhost:5432 (user: `dmv`, password: `dmv_password`, db: `dmv_queue`)

The system will automatically:
- Create database tables
- Seed sample DMV branches (San Francisco, Oakland, San Jose)
- Seed service types (Driver License, Vehicle Registration, Real ID, etc.)

### First Test

**Visitor Flow:**
1. Visit http://localhost:3000
2. Click "Join Queue"
3. Select a branch and service
4. Receive your ticket number
5. Check your status and position (auto-refreshes)

**Staff Flow:**
1. Click "Staff Portal"
2. Select a branch
3. Click "Call Next" for any service with waiting tickets
4. Ticket status updates immediately

**Note**: Staff operations now require authentication. The frontend includes the API key automatically for development.

## Project Structure

```
DMV/
├── api/                        # FastAPI backend
│   ├── main.py                 # API endpoints with auth & transactions
│   ├── models.py               # SQLAlchemy database models
│   ├── schemas.py              # Pydantic request/response schemas
│   ├── database.py             # Database connection setup
│   ├── auth.py                 # Authentication middleware (NEW)
│   ├── validators.py           # Status transition validation (NEW)
│   ├── utils.py                # Ticket generation with retry logic (UPDATED)
│   ├── websocket.py            # WebSocket stub (TODO)
│   ├── init_db.py              # Database init with proper cleanup (UPDATED)
│   ├── requirements.txt        # Python dependencies
│   └── Dockerfile              # Backend container config
│
├── web/                        # Next.js frontend
│   ├── app/
│   │   ├── page.tsx            # Home page
│   │   ├── join/page.tsx       # Join queue page
│   │   ├── status/page.tsx     # Check ticket status with auto-refresh
│   │   ├── staff/page.tsx      # Authenticated staff portal (UPDATED)
│   │   ├── layout.tsx          # Root layout
│   │   └── globals.css         # Global styles
│   ├── lib/
│   │   └── api.ts              # API client with timeouts & errors (UPDATED)
│   ├── package.json            # Node dependencies
│   ├── tsconfig.json           # TypeScript config
│   ├── next.config.js          # Next.js config
│   └── Dockerfile              # Frontend container config
│
├── docker-compose.yml          # Multi-container orchestration (FIXED)
├── SECURITY.md                 # Security documentation (NEW)
├── .gitignore                  # Git ignore rules
└── README.md                   # This file
```

## API Endpoints

### Public Endpoints (Visitors)

- `GET /branches` - List all DMV branches
- `GET /branches/{branchId}` - Get specific branch details
- `GET /branches/{branchId}/services` - List services at a branch
- `POST /branches/{branchId}/join` - Join queue for a service
- `GET /tickets/{ticketNumber}` - Check ticket status and position

### Staff Endpoints (🔒 Requires Authentication)

**All staff endpoints require `X-API-Key` header**

- `POST /branches/{branchId}/call-next?service={serviceCode}` - Call next ticket
- `POST /tickets/{ticketNumber}/complete` - Mark ticket as completed
- `GET /branches/{branchId}/queue-status` - Get queue statistics

**Testing with curl:**
```bash
# Call next ticket
curl -X POST "http://localhost:8000/branches/1/call-next?service=DL_RENEWAL" \
  -H "X-API-Key: dmv_staff_dev_key_CHANGE_IN_PRODUCTION"

# Complete ticket
curl -X POST "http://localhost:8000/tickets/SF1732123456ABC/complete" \
  -H "X-API-Key: dmv_staff_dev_key_CHANGE_IN_PRODUCTION"
```

### Interactive API Documentation

Visit http://localhost:8000/docs for full Swagger documentation with try-it-out functionality. Click "Authorize" to add your API key for testing staff endpoints.

## Features

### v0 (Current)

✅ **Core Queue Management**
- Visitors join queues by branch and service type
- Unique ticket number generation (e.g., `SF1732123456A42`)
- Position tracking and ETA calculation
- Staff can call next ticket for each service queue

✅ **Web Interface**
- Visitor: Join queue, check status
- Staff: Call next ticket, view queue dashboard
- Basic responsive design

✅ **Data Persistence**
- PostgreSQL database
- SQLAlchemy ORM
- Sample data seeding

✅ **API-First Design**
- RESTful API with OpenAPI/Swagger docs
- CORS enabled for frontend integration

### Future Enhancements (TODO)

🔲 **Real-Time Updates**
- WebSocket implementation (stub in `api/websocket.py`)
- Live display monitor updates
- Push notifications to visitor devices

🔲 **Display Integration**
- Integration with existing Qmatic displays
- Custom display monitor endpoints
- Bridge API for vendor compatibility

🔲 **Authentication & Security**
- Staff authentication (OAuth2/JWT)
- Role-based access control
- Visitor session management

🔲 **Advanced Features**
- Multi-counter support per service
- Service pause/resume controls
- Priority queue handling
- Appointment integration
- SMS/email notifications
- Mobile app (React Native)
- Analytics and reporting
- Historical data analysis for better ETA

🔲 **Operations**
- Admin dashboard
- System monitoring and health checks
- Audit logging
- Backup and recovery procedures

## Integration Points for Qmatic Migration

The codebase includes marked integration points for bridging to Qmatic or other vendor systems:

### 1. Database Model (`api/models.py`)
```python
class Branch:
    # TODO: Store Qmatic branch/display IDs
    # qmatic_branch_id = Column(String, nullable=True)
    # display_url = Column(String, nullable=True)
```

### 2. WebSocket Broadcasting (`api/websocket.py`)
```python
# TODO: Bridge function to update Qmatic cloud displays
async def update_qmatic_display(branch_id: int, ticket_number: str):
    # Forward ticket calls to Qmatic API
    # Handle auth, error logging, etc.
```

### 3. Display Monitor Endpoints
```python
# TODO: WebSocket endpoint for display monitors
# @app.websocket("/ws/display/{branch_id}")
# Broadcasts ticket calls to in-office displays
# Can also forward to Qmatic URLs
```

### Migration Strategy

1. **Parallel Operation**: Run both systems simultaneously
2. **Data Sync**: Store Qmatic IDs in our database
3. **Dual Broadcasting**: Send ticket updates to both systems
4. **Gradual Cutover**: Migrate branches one at a time
5. **Monitor Replacement**: Replace Qmatic displays with custom displays

## Configuration

### Environment Variables

**Backend (`api/`)**
- `DATABASE_URL`: PostgreSQL connection string (default: `postgresql://dmv:dmv_password@postgres:5432/dmv_queue`)
- `CORS_ORIGINS`: Allowed CORS origins (default: `http://localhost:3000`)

**Frontend (`web/`)**
- `NEXT_PUBLIC_API_URL`: API base URL (default: `http://localhost:8000`)

### Customization

**Add New Branches**: Edit `api/init_db.py` to add more branches
**Add New Services**: Edit `api/init_db.py` service_types list
**Change Styling**: Edit `web/app/globals.css`
**Adjust ETA Algorithm**: Edit `api/utils.py` calculate_eta function

## Development

### Running Locally Without Docker

**Backend:**
```bash
cd api
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
export DATABASE_URL="postgresql://dmv:dmv_password@localhost:5432/dmv_queue"
python init_db.py
uvicorn main:app --reload
```

**Frontend:**
```bash
cd web
npm install
export NEXT_PUBLIC_API_URL="http://localhost:8000"
npm run dev
```

### Database Migrations

For schema changes, you'll want to add Alembic:
```bash
pip install alembic
alembic init migrations
# Edit alembic.ini and migrations/env.py
alembic revision --autogenerate -m "description"
alembic upgrade head
```

### Testing

**Backend Tests** (TODO):
```bash
pip install pytest pytest-asyncio httpx
pytest
```

**Frontend Tests** (TODO):
```bash
npm install --save-dev jest @testing-library/react
npm test
```

## Production Deployment

### Recommended Setup

1. **Use managed PostgreSQL** (AWS RDS, Google Cloud SQL, etc.)
2. **Deploy backend** on a container platform (ECS, Cloud Run, Kubernetes)
3. **Deploy frontend** on Vercel, Netlify, or static hosting
4. **Set up HTTPS** with valid SSL certificates
5. **Enable authentication** for staff endpoints
6. **Configure backups** and monitoring
7. **Set up logging** (CloudWatch, Datadog, etc.)

### Security Checklist

- [ ] Enable HTTPS everywhere
- [ ] Implement staff authentication
- [ ] Add rate limiting
- [ ] Validate all inputs
- [ ] Enable database backups
- [ ] Set up monitoring and alerts
- [ ] Configure firewall rules
- [ ] Use secrets management (not .env files)
- [ ] Enable audit logging
- [ ] Regular security updates

## Contributing

This is an open-source project designed for DMV agencies and community adoption. Contributions welcome!

### Priority Areas

1. WebSocket real-time updates
2. Authentication system
3. Qmatic API bridge implementation
4. Display monitor UI
5. Mobile app
6. Test coverage
7. Documentation improvements

## License

This project is open-source and available for use by government agencies and public organizations.

## Support

For questions or issues:
1. Check the API docs: http://localhost:8000/docs
2. Review [SECURITY.md](SECURITY.md) for security-related questions
3. Review the code comments and TODO markers
4. File an issue on the repository

## Alignment with DMV Initiatives

This project aligns with the California DMV's modernization efforts, including:
- **Open-source first**: Similar to the mDL/OpenCred initiative
- **Cloud-native architecture**: Modern, scalable design
- **API-driven**: Enables future integrations
- **Cost-effective**: Eliminates vendor lock-in
- **Transparent**: Full visibility into the codebase
- **Security-focused**: Following best practices for government systems

---

**Version**: 0.3.0
**Status**: Development/Demo Version - **NOT PRODUCTION READY**

See [CHANGELOG.md](CHANGELOG.md) for version history and [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) for production readiness assessment.
