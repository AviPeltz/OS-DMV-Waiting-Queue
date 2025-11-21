# Changelog

## v0.3.0 - Performance & State Validation (2025-11-21)

### Major Improvements

#### 🚀 Performance Fix: Queue Counter Table
- **Problem**: Previous version locked all waiting tickets to assign positions, causing performance issues with large queues
- **Solution**: Added `QueueCounter` table with one row per branch/service queue
- **Impact**: Now locks single counter row instead of 200+ ticket rows, scales to any queue size
- **Files**: `api/models.py:26-43`, `api/main.py:120-136`

#### ✅ Complete State Machine Validation
- **Problem**: Only 1 out of 6 state transitions were validated in v0.2.2
- **Solution**: Wired `validate_status_transition()` to all ticket mutations
- **Impact**: Prevents invalid operations like completing a waiting ticket or calling an already-called ticket
- **Files**: `api/main.py:263, 314, 359, 405`

### New Endpoints

#### `POST /tickets/{ticket_number}/cancel`
- Visitor endpoint to cancel their own ticket
- Validates ticket is in cancellable state (waiting or called)
- Public endpoint (no auth required)

#### `POST /tickets/{ticket_number}/return-to-queue`
- Staff endpoint to return called ticket back to waiting
- Use case: Staff called wrong ticket or visitor not ready
- Requires staff authentication via X-API-Key
- Validates ticket is in "called" status

### Bug Fixes
- Fixed empty queue race condition (v0.2.2)
- Fixed PostgreSQL healthcheck pointing to wrong database
- Fixed SQLAlchemy 2.x compatibility with text() wrapper
- Fixed IP allowlist parsing bug

### Database Changes
- Added `QueueCounter` table
- Added `city`, `state`, `zip` fields to `Branch` model
- Updated schemas to include new branch fields

### Data
- Added 30 real California DMV office locations via CSV
- All branches now include full addresses with city, state, zip

### Documentation
- Updated `KNOWN_LIMITATIONS.md` to reflect fixes
- Created `CHANGELOG.md` for version tracking
- Updated production readiness assessment

### Breaking Changes
- Database schema changed - requires `docker compose down -v && docker compose up --build` to recreate

---

## v0.2.2 - Empty Queue Race Fix (Earlier)

### Bug Fixes
- Fixed race condition when multiple visitors join empty queue simultaneously
- Changed from `.count()` to `MAX(position)` with proper locking

### Known Issues
- Performance issue with large queues (locking all tickets)
- State validation only partial (1/6 transitions)

---

## v0.2.1 - Race Condition Improvements (Earlier)

### Bug Fixes
- Attempted fix for position assignment races
- Added `with_for_update()` to ticket queries

### Known Issues
- Empty queue race still present
- `.count()` doesn't actually lock rows in PostgreSQL

---

## v0.2.0 - Security Hardening (Earlier)

### Security Improvements
- Added API key authentication for staff endpoints
- Added request timeouts to prevent hanging requests
- Added transaction management with proper rollback
- Added status transition validation framework

### Bug Fixes
- Fixed database connection leaks
- Fixed collision handling for ticket numbers

### Documentation
- Created `SECURITY.md`
- Created `KNOWN_LIMITATIONS.md` with honest assessment

### Known Issues
- Race conditions not fully fixed
- API key exposed to browsers (architectural issue)

---

## v0.1.0 - Initial Release (Earlier)

### Features
- FastAPI backend with PostgreSQL
- Next.js frontend with TypeScript
- Docker Compose orchestration
- Core endpoints: join queue, check status, call next
- WebSocket stubs for future real-time updates

### Known Issues
- Multiple race conditions
- No authentication
- No state validation
- Performance issues
- Proof of concept only
