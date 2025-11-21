# Security & Reliability Fixes Applied - v0.2

This document summarizes all critical issues identified and fixed in v0.2.

## Critical Issues Fixed

### 1. ✅ Unauthenticated Staff Endpoints (CRITICAL)

**Issue**: Staff operations were completely open to anyone with the URL.

**Impact**: Anyone could manipulate queues, call tickets, mark them complete.

**Fix Applied**:
- Added `auth.py` with API key authentication middleware
- Protected all staff endpoints with `Depends(verify_staff_token)`
- Environment variable configuration: `STAFF_API_KEY`

**Files Changed**:
- `api/auth.py` (NEW)
- `api/main.py` (UPDATED - added auth to staff endpoints)
- `web/lib/api.ts` (UPDATED - added X-API-Key header)

**Testing**:
```bash
# This now returns 401 Unauthorized without the key
curl -X POST http://localhost:8000/branches/1/call-next?service=DL_RENEWAL

# This works with proper authentication
curl -X POST http://localhost:8000/branches/1/call-next?service=DL_RENEWAL \
  -H "X-API-Key: dmv_staff_dev_key_CHANGE_IN_PRODUCTION"
```

---

### 2. ✅ Race Conditions in Queue Mutations (CRITICAL)

**Issue**: Concurrent requests could:
- Assign the same ticket position to multiple visitors
- Allow multiple staff to call the same ticket
- Create duplicate ticket numbers

**Impact**: Data corruption, broken queue ordering, visitor confusion.

**Fix Applied (v0.2.1 - corrected implementation)**:
- Row-level locking using `with_for_update().all()` (fetches rows to acquire locks)
- **IMPORTANT**: `.count()` doesn't lock in PostgreSQL - must fetch actual rows
- Wrapped operations in proper transactions
- Added exception handling with rollback and meaningful error messages

**Files Changed**:
- `api/main.py:118-124` - Join queue: fetch and lock waiting tickets
- `api/main.py:230-234` - Call next: lock next ticket before updating
- `api/main.py:295-297` - Complete ticket: lock before validating

**Code Example**:
```python
# v0.2.0 (STILL UNSAFE - count doesn't lock!)
current_waiting = db.query(Ticket).filter(...).with_for_update().count()
position = current_waiting + 1

# v0.2.1 (SAFE - fetches and locks rows)
waiting_tickets = db.query(Ticket).filter(...).with_for_update().all()
position = len(waiting_tickets) + 1
```

**Testing**:
```python
# Simulate concurrent requests
import concurrent.futures
import requests

def join_queue():
    return requests.post("http://localhost:8000/branches/1/join",
                        json={"service_code": "DL_RENEWAL"})

with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
    futures = [executor.submit(join_queue) for _ in range(10)]
    results = [f.result() for f in futures]

# Verify all tickets have unique positions
positions = [r.json()['position'] for r in results]
assert len(positions) == len(set(positions))  # No duplicates
```

---

### 3. ✅ Ticket Number Collision Handling (HIGH)

**Issue**: No retry logic for unique constraint violations. Server returned 500 error on collision.

**Impact**: Failed ticket creation during high traffic, poor user experience.

**Fix Applied**:
- Created `create_ticket_with_retry()` function in `utils.py`
- Exponential backoff retry logic (up to 5 attempts)
- Better timestamp granularity (milliseconds instead of seconds)
- Increased random suffix length (4 chars instead of 3)

**Files Changed**:
- `api/utils.py` (UPDATED - new retry function)
- `api/main.py:133` (UPDATED - uses retry function)

**Code Example**:
```python
def create_ticket_with_retry(db, ticket_data, branch_code, max_retries=5):
    for attempt in range(max_retries):
        try:
            ticket_number = generate_ticket_number(branch_code)
            ticket = Ticket(ticket_number=ticket_number, **ticket_data)
            db.add(ticket)
            db.flush()  # Detect violations before commit
            return ticket
        except IntegrityError:
            db.rollback()
            time.sleep(0.01 * (2 ** attempt))  # Exponential backoff
```

---

### 4. ✅ Database Connection Leaks (MEDIUM)

**Issue**: `init_db.py` leaked connections on errors and didn't log failure details.

**Impact**: Connection pool exhaustion over time, difficult debugging.

**Fix Applied**:
- Added try-finally blocks to ensure cleanup
- Proper error logging with details
- Connection cleanup even on exceptions

**Files Changed**:
- `api/init_db.py:19-34` (UPDATED - wait_for_db function)
- `api/init_db.py:55-104` (UPDATED - init_db function)

**Code Example**:
```python
# Before
def wait_for_db():
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()  # Only called on success!
    except:
        pass

# After
def wait_for_db():
    db = None
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        if db:
            db.close()  # Always called
```

---

### 5. ⚠️ Status Transition Validation (MEDIUM - PARTIALLY FIXED)

**Issue**: Could complete tickets without calling them first, no validation of state machine.

**Impact**: Invalid state transitions, data integrity issues.

**Fix Applied**:
- Created `validators.py` with full state machine definition
- **Currently enforced**: Only ticket completion (must be in "called" status first)
- **Not enforced**: Cancel operations, return-to-queue, general transitions
- Clear error messages for violations

**Files Changed**:
- `api/validators.py` (NEW - includes TODO note about partial implementation)
- `api/main.py:302` (UPDATED - validates before completing)

**State Machine Defined (in validators.py)**:
```
waiting → called (staff calls ticket)
waiting → cancelled (visitor cancels) [NOT YET IMPLEMENTED]
called → completed (service finished) [ENFORCED]
called → waiting (staff error, return to queue) [NOT YET IMPLEMENTED]
completed → ∅ (final state)
cancelled → ∅ (final state)
```

**What's Working**:
- Cannot complete a ticket unless it's in "called" status
- Returns 400 error with explanation if validation fails

**TODO for Full Implementation**:
- Wire `validate_status_transition()` to all status changes
- Add cancel endpoint
- Add return-to-queue endpoint

---

### 6. ✅ Missing Request Timeouts (LOW)

**Issue**: Frontend requests could hang indefinitely, no structured error handling.

**Impact**: Poor UX, loading spinners that never stop.

**Fix Applied**:
- Created `fetchWithTimeout()` wrapper with AbortController
- 30-second timeout on all requests
- Custom `APIError` class for structured errors
- Proper error display in UI

**Files Changed**:
- `web/lib/api.ts:32-54` (NEW - timeout wrapper)
- `web/lib/api.ts:18-27` (NEW - APIError class)
- `web/app/staff/page.tsx:75-83` (UPDATED - better error handling)

---

### 7. ✅ PostgreSQL Healthcheck Bug (CRITICAL)

**Issue**: Healthcheck tried to connect to database "dmv" instead of "dmv_queue", causing constant FATAL errors.

**Impact**: API container wouldn't start, Postgres logs filled with errors.

**Fix Applied**:
- Updated healthcheck command to specify correct database

**Files Changed**:
- `docker-compose.yml:16` (UPDATED)

**Before**:
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U dmv"]
```

**After**:
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U dmv -d dmv_queue"]
```

---

### 8. ✅ IP Allowlist Parsing Bug (LOW - FIXED)

**Issue**: Empty `STAFF_IP_ALLOWLIST` environment variable resulted in `[""]`, causing allowlist check to always be truthy and fail everyone.

**Fix Applied**:
- Filter empty strings when parsing allowlist
- Only creates non-empty list if IPs are actually provided

**Files Changed**:
- `api/auth.py:22-24` (UPDATED)

**Code**:
```python
# Before: [""] if empty
STAFF_IP_ALLOWLIST = os.getenv("STAFF_IP_ALLOWLIST", "").split(",")

# After: [] if empty
_allowlist_raw = os.getenv("STAFF_IP_ALLOWLIST", "")
STAFF_IP_ALLOWLIST = [ip.strip() for ip in _allowlist_raw.split(",") if ip.strip()]
```

---

## Additional Improvements (v0.2.1)

### Error Handling
- All database operations wrapped in try-except with proper rollback
- HTTPException re-raised to preserve 4xx validation errors
- Generic exceptions logged and return meaningful 500 errors (not empty)
- Structured error responses via `APIError` class in frontend

### Code Quality
- Added comprehensive comments explaining locking behavior
- TODOs for production enhancements with context
- Consistent error handling patterns
- Explicit warnings about partial implementations

### Documentation
- Created `SECURITY.md` with full security analysis
- **CRITICAL warnings** about `NEXT_PUBLIC_STAFF_API_KEY` being browser-visible
- Updated README with accurate security status
- Added detailed changelog
- Security warnings prominently displayed in code and docs

### Security Warnings Added
- `web/lib/api.ts:14-24` - Warning about public API key exposure
- `SECURITY.md:99-103` - Explicit warning about browser exposure
- `web/app/staff/page.tsx:130-131` - UI note about authentication model

---

## Testing Recommendations

### Manual Testing Checklist

**Authentication**:
- [ ] Staff endpoints reject requests without API key
- [ ] Staff endpoints accept valid API key
- [ ] Error message doesn't reveal system internals

**Race Conditions**:
- [ ] 10 concurrent join requests create 10 unique positions
- [ ] 2 staff calling next ticket for same service don't get same ticket
- [ ] High concurrency doesn't create duplicate ticket numbers

**Status Transitions**:
- [ ] Cannot complete a waiting ticket (must call first)
- [ ] Cannot call a completed ticket
- [ ] Error messages explain valid transitions

**Error Handling**:
- [ ] Request timeout shows appropriate error
- [ ] Network error shows retry option
- [ ] 500 errors don't crash the UI

**Database**:
- [ ] Healthcheck passes (check `docker compose ps`)
- [ ] No connection leaks after 100 operations
- [ ] Init script is idempotent (can run multiple times)

### Load Testing

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test join queue endpoint (100 requests, 10 concurrent)
ab -n 100 -c 10 -p join.json -T application/json \
   http://localhost:8000/branches/1/join

# join.json:
{"service_code": "DL_RENEWAL"}

# Verify no duplicate positions in database
docker exec dmv-postgres psql -U dmv -d dmv_queue \
  -c "SELECT position, COUNT(*) FROM tickets
      WHERE branch_id=1 AND service_id=1
      GROUP BY position HAVING COUNT(*) > 1;"
# Should return 0 rows
```

---

## Migration Guide (v0.1 → v0.2)

### Breaking Changes

1. **Staff endpoints now require authentication**
   - Update all API clients to include `X-API-Key` header
   - Set environment variables for API key

2. **Docker volume cleanup required**
   - Old database used wrong healthcheck
   - Must run `docker compose down -v` before upgrading

### Migration Steps

```bash
# 1. Stop old version and clean up
docker compose down -v

# 2. Set API key (optional, uses default if skipped)
export STAFF_API_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
export NEXT_PUBLIC_STAFF_API_KEY=$STAFF_API_KEY

# 3. Pull new code
git pull

# 4. Rebuild and start
docker compose up --build

# 5. Verify staff portal requires authentication
curl -X POST http://localhost:8000/branches/1/call-next?service=DL_RENEWAL
# Should return 401

curl -X POST http://localhost:8000/branches/1/call-next?service=DL_RENEWAL \
  -H "X-API-Key: $STAFF_API_KEY"
# Should work
```

---

## Known Limitations (Still TODO)

These issues remain and should be addressed before production:

1. **No rate limiting** - Can be DoS'd
2. **No audit logging** - Can't track who did what
3. **API key in plaintext** - Should use JWT instead
4. **No HTTPS** - Credentials sent in clear text
5. **No input sanitization** - Relies on ORM only
6. **Database password in docker-compose.yml** - Should use secrets
7. **No tests** - Manual testing only
8. **Public staff portal route** - No client-side guard

See [SECURITY.md](SECURITY.md) for full production requirements.

---

**Summary**: All critical and high-priority issues from the security audit have been fixed. The system is now suitable for development and internal testing, but requires additional hardening for production deployment.
