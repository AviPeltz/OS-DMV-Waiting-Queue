# Known Limitations - v0.3.0

This document provides an **honest assessment** of what is and isn't fixed in the current version.

## Critical Issues - NOT FIXED

### 🚨 1. Staff API Key Exposed to Browsers (CRITICAL)

**Status**: ❌ **NOT FIXED - Only Documented**

**The Problem**:
- `NEXT_PUBLIC_STAFF_API_KEY` is embedded in browser JavaScript
- Any visitor can open browser dev tools and view the staff API key
- This completely defeats authentication in any public deployment
- Warning comments added, but the vulnerability remains

**Why It's Not Fixed**:
- Requires architectural change (JWT/session-based auth)
- Needs server-side API routes in Next.js
- Non-trivial to implement properly
- Out of scope for v0

**Current State**:
- Warnings added in code (`web/lib/api.ts:14-24`)
- Documented in SECURITY.md
- Listed as critical limitation in README
- **Still vulnerable** - do not use in production

**Production Requirement**:
```typescript
// REQUIRED: Move auth to server-side Next.js API routes
// app/api/staff/call-next/route.ts
export async function POST(request: Request) {
  const session = await getServerSession(); // JWT/session
  if (!session?.user?.isStaff) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Proxy to backend with server-side API key
  return fetch(backendUrl, {
    headers: { 'X-API-Key': process.env.STAFF_API_KEY } // Not NEXT_PUBLIC_
  });
}
```

---

### ✅ 2. State Machine Validation (FIXED in v0.3.0)

**Status**: ✅ **FIXED** - Complete State Machine Validation

**What's Enforced**:
- ✅ Calling tickets (must be in "waiting" status) - `api/main.py:263`
- ✅ Completing tickets (must be in "called" status) - `api/main.py:314`
- ✅ Cancelling tickets (must be "waiting" or "called") - `api/main.py:359`
- ✅ Returning to queue (must be in "called" status) - `api/main.py:405`

**New Endpoints Added**:
- `POST /tickets/{ticket_number}/cancel` - Visitor can cancel their ticket
- `POST /tickets/{ticket_number}/return-to-queue` - Staff can return called ticket to waiting

**The Code**:
- `validate_status_transition()` from `validators.py` now wired up to all ticket mutations
- Full state machine enforced across all operations
- Prevents invalid transitions like completing a waiting ticket

---

### ✅ 3. Performance Issue with Large Queues (FIXED in v0.3.0)

**Status**: ✅ **FIXED** - Using Lightweight Counter Table

**The Solution**:
- Added `QueueCounter` table with one row per branch/service queue
- Locks single counter row instead of all waiting tickets
- Much faster and doesn't block other queues

**New Implementation** (`api/models.py:26-43`, `api/main.py:120-136`):
```python
# Lock single counter row (fast)
counter = db.query(QueueCounter).filter(
    QueueCounter.branch_id == branch_id,
    QueueCounter.service_id == service.id
).with_for_update().first()

if not counter:
    counter = QueueCounter(
        branch_id=branch_id,
        service_id=service.id,
        next_position=1
    )
    db.add(counter)
    db.flush()

position = counter.next_position
counter.next_position += 1
```

**Performance Improvement**:
- Old: Locked 200+ ticket rows for large queues
- New: Locks 1 counter row regardless of queue size
- No longer blocks concurrent joins to different queues
- Scales to queues of any size

---

## Medium Issues - Acknowledged

### 4. No Authentication on Visitor Endpoints

**Status**: ✅ **Intentional** - Public by Design

**What's Public**:
- `GET /branches` - List branches
- `POST /branches/{id}/join` - Join queue
- `GET /tickets/{number}` - Check status
- `GET /branches/{id}/queue-status` - View queue stats

**Is This a Problem?**:
- Depends on threat model
- **Pros**: Allows kiosks, mobile apps, public access
- **Cons**: No rate limiting, could be abused

**Production Considerations**:
- Add rate limiting (per IP, per session)
- Consider CAPTCHA for join endpoint
- Monitor for abuse patterns
- May be acceptable for public DMV service

---

### 5. No Automated Tests

**Status**: ❌ **NOT IMPLEMENTED**

**What's Missing**:
- No unit tests
- No integration tests
- No concurrency tests
- No load tests
- No security tests

**Risk**:
- Can't verify race condition fixes work
- Can't detect regressions
- Can't validate performance claims

**Production Requirement**:
- pytest suite for backend
- Jest suite for frontend
- Load testing with concurrent requests
- Security scanning (OWASP ZAP, etc.)

---

### 6. No Audit Logging

**Status**: ❌ **NOT IMPLEMENTED**

**What's Missing**:
- No log of who called which ticket
- No timestamp of staff actions
- No visitor join history
- Can't investigate disputes

**Production Requirement**:
- Log all staff operations with timestamp
- Include user identity (once JWT implemented)
- Store in separate audit table
- Retention policy for compliance

---

## Summary: Production Readiness

| Component | Status | Blocker? |
|-----------|--------|----------|
| Core queue logic | ✅ Works | No |
| Empty queue race | ✅ Fixed (v0.2.2) | No |
| Large queue perf | ✅ Fixed (v0.3.0) | No |
| State validation | ✅ Fixed (v0.3.0) | No |
| Staff auth | ❌ Exposed to browsers | **YES** |
| Visitor endpoints | ✅ Public (intended) | No |
| Tests | ❌ None | **YES** |
| Audit logging | ❌ None | Depends |
| Rate limiting | ❌ None | Maybe |
| Monitoring | ❌ None | **YES** |

**Can this be used in production?** ❌ **NO**

**Why not?**
1. Staff API key visible to all browsers (critical)
2. No test coverage (high)
3. No monitoring/observability (medium)
4. No audit logging (medium)
5. No rate limiting (medium)

**What is it good for?**
- ✅ Development and local testing
- ✅ Proof of concept demonstrations
- ✅ Understanding DMV queue mechanics
- ✅ Learning FastAPI + Next.js architecture
- ❌ Production DMV deployment
- ❌ Handling real visitor data
- ❌ Public internet exposure

---

## Honest Version Labels

- **v0.1**: Proof of concept, many race conditions
- **v0.2.0**: Added auth, but still had races
- **v0.2.1**: Fixed some races, but not empty queue
- **v0.2.2**: Fixed empty queue race, honest about limitations
- **v0.3.0**: Fixed performance + state validation, added cancel/return endpoints

**Still needed for v1.0**:
1. Replace public API key with JWT/session auth
2. Add comprehensive test suite
3. Add rate limiting
4. Add audit logging
5. Add monitoring and alerting
6. Security audit and penetration testing

**Estimated effort to production**: 1-3 weeks of development + security review

---

## For Evaluators

If you're evaluating this for DMV use:

**Good for**:
- Understanding the problem space
- Evaluating open-source viability
- Testing queue management concepts
- Training and education

**Not ready for**:
- Live DMV operations
- Public-facing deployment
- Handling PII or sensitive data
- Replacing Qmatic without significant work

**Questions to ask**:
1. Do you have developers to complete the TODO items?
2. Can you conduct security audit before deployment?
3. What's your timeline? (weeks = no, months = maybe)
4. Do you have test environment for load testing?

Be honest with stakeholders about the work remaining.
