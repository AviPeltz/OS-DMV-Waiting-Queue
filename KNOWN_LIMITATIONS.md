# Known Limitations - v0.2.2

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

### ⚠️ 2. State Machine Validation Incomplete (HIGH)

**Status**: ⚠️ **PARTIALLY FIXED** - Only One Transition Enforced

**What's Enforced**:
- ✅ Completing tickets (must be in "called" status)
- File: `api/main.py:302`

**What's NOT Enforced**:
- ❌ Calling a ticket that's already called
- ❌ Completing a waiting ticket directly
- ❌ Returning ticket to queue
- ❌ Cancelling tickets
- ❌ Any other state transitions

**The Code**:
- `validate_status_transition()` exists in `validators.py`
- Defines full state machine
- **Not wired up** to most operations

**Production Requirement**:
- Wire up validation to all status changes
- Add cancel endpoint with validation
- Add return-to-queue endpoint
- Apply state machine across all mutations

---

### ⚠️ 3. Performance Issue with Large Queues (MEDIUM)

**Status**: ⚠️ **Known Issue - Documented**

**The Problem**:
- Position calculation locks ALL waiting tickets
- Blocks all concurrent joins while one runs
- Doesn't scale to large queues (100+ waiting)

**Current Code** (`api/main.py:129-136`):
```python
# Locks every waiting ticket in the queue
waiting_tickets_subq = db.query(Ticket).filter(
    Ticket.branch_id == branch_id,
    Ticket.service_id == service.id,
    Ticket.status == "waiting"
).with_for_update().subquery()

max_position = db.query(func.coalesce(
    func.max(waiting_tickets_subq.c.position), 0
)).scalar()
```

**Why It's a Problem**:
- Queue with 200 people: every join locks all 200 tickets
- Serializes all concurrent joins
- High contention under load

**Production Solutions** (not implemented):
1. **Sequence Table**: Dedicated counter per branch/service
2. **PostgreSQL SEQUENCE**: Native database sequences
3. **Advisory Locks**: `pg_advisory_lock()` with lighter weight
4. **Redis Counter**: Atomic increment for position assignment

**Trade-off**:
- Current approach is **correct** but **slow**
- Better than v0.2.1 (handles empty queue)
- Good enough for small-medium queues (<50 people)

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
| Empty queue race | ✅ Fixed | No |
| Large queue perf | ⚠️ Documented | Maybe |
| Staff auth | ❌ Exposed to browsers | **YES** |
| State validation | ⚠️ Partial (1/6 transitions) | **YES** |
| Visitor endpoints | ✅ Public (intended) | No |
| Tests | ❌ None | **YES** |
| Audit logging | ❌ None | Depends |
| Rate limiting | ❌ None | Maybe |
| Monitoring | ❌ None | **YES** |

**Can this be used in production?** ❌ **NO**

**Why not?**
1. Staff API key visible to all browsers (critical)
2. Incomplete state validation (high)
3. No test coverage (high)
4. Performance doesn't scale (medium)
5. No monitoring/observability (medium)

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

**Still needed for v1.0**:
1. Replace public API key with JWT/session auth
2. Complete state machine validation
3. Add comprehensive test suite
4. Implement production-grade position counter (sequence table)
5. Add rate limiting
6. Add audit logging
7. Add monitoring and alerting
8. Security audit and penetration testing

**Estimated effort to production**: 2-4 weeks of development + security review

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
