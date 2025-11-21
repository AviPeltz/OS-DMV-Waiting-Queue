# Security Documentation

## Overview

This document outlines the security measures implemented in the DMV Queue System and critical considerations for production deployment.

## v0 Security Status

### ✅ Implemented (v0.2)

1. **Staff Authentication**
   - API key authentication for all staff endpoints
   - Header-based authentication: `X-API-Key`
   - Configurable via environment variable
   - **CRITICAL**: Change default key in production!

2. **Database Transaction Safety**
   - Row-level locking with `SELECT FOR UPDATE`
   - Prevents race conditions in queue operations
   - Atomic ticket creation with collision handling
   - Retry logic with exponential backoff

3. **Input Validation**
   - Status transition validation
   - Pydantic schema validation
   - Database constraint enforcement

4. **Error Handling**
   - Proper exception handling with rollback
   - No sensitive data in error messages
   - Structured error responses

5. **Connection Management**
   - Proper database connection cleanup
   - Try-finally blocks for resource management
   - Connection pool limits via SQLAlchemy

### ⚠️ Not Implemented (Production Required)

1. **Authentication & Authorization**
   - No JWT/OAuth2 implementation
   - No user identity tracking
   - No role-based access control (RBAC)
   - No session management
   - No password policies or 2FA

2. **Rate Limiting**
   - No request throttling
   - No DDoS protection
   - No per-user/IP rate limits

3. **Encryption**
   - No TLS/HTTPS enforcement
   - No at-rest encryption
   - Passwords in docker-compose are plaintext

4. **Audit Logging**
   - No audit trail for staff actions
   - No security event logging
   - No compliance logging

5. **Input Sanitization**
   - No XSS protection beyond basic framework defaults
   - No SQL injection testing (relies on ORM)
   - No CSRF tokens

6. **Infrastructure Security**
   - No network segmentation
   - No firewall rules
   - No VPN/private network requirements
   - Database exposed on 0.0.0.0

## Critical Security Fixes Applied

### Issue 1: Unauthenticated Staff Endpoints (CRITICAL - FIXED)

**Problem**: All staff operations (call-next, complete) were unauthenticated.

**Fix**: Added API key authentication middleware
```python
from auth import verify_staff_token

@app.post("/branches/{branch_id}/call-next")
def call_next_ticket(
    ...,
    _token: str = Depends(verify_staff_token)  # ← Authentication required
):
```

**Configuration**:
```bash
# Backend
export STAFF_API_KEY="your-secure-random-key-here"

# Frontend (DEV ONLY - key exposed to browsers!)
export NEXT_PUBLIC_STAFF_API_KEY="same-key-as-backend"
```

**⚠️ CRITICAL SECURITY WARNING**:
- `NEXT_PUBLIC_*` environment variables are embedded in browser JavaScript
- Any visitor can view the staff API key in browser dev tools
- This is ONLY acceptable for development/testing
- Production MUST use server-side authentication (JWT/session) instead

**Generate secure key**:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Issue 2: Race Conditions in Queue Operations (CRITICAL - FIXED)

**Problem**: Concurrent requests could:
- Assign duplicate ticket positions
- Call the same ticket twice
- Generate duplicate ticket numbers

**Fix Applied**:

1. **Join Queue Position Assignment**: Lock all waiting tickets before counting
```python
# Before (UNSAFE - count doesn't lock)
current_waiting = db.query(Ticket).filter(...).with_for_update().count()
position = current_waiting + 1

# After (SAFE - fetch locks the rows)
waiting_tickets = db.query(Ticket).filter(...).with_for_update().all()
position = len(waiting_tickets) + 1
```

2. **Call Next Ticket**: Row-level locking prevents duplicate calls
```python
next_ticket = db.query(Ticket).filter(...).with_for_update().first()
next_ticket.status = "called"
db.commit()
```

**Note**: `with_for_update()` must fetch actual rows to acquire locks in PostgreSQL. Using `.count()` doesn't lock anything.

### Issue 3: Ticket Number Collisions (HIGH - FIXED)

**Problem**: No collision handling for unique constraint violations.

**Fix**: Retry logic with exponential backoff
```python
def create_ticket_with_retry(db, ticket_data, branch_code, max_retries=5):
    for attempt in range(max_retries):
        try:
            ticket_number = generate_ticket_number(branch_code)
            ticket = Ticket(ticket_number=ticket_number, **ticket_data)
            db.add(ticket)
            db.flush()
            return ticket
        except IntegrityError:
            db.rollback()
            time.sleep(0.01 * (2 ** attempt))
```

### Issue 4: Database Connection Leaks (MEDIUM - FIXED)

**Problem**: Failed database connections weren't cleaned up properly.

**Fix**: Try-finally blocks ensure cleanup
```python
db = None
try:
    db = SessionLocal()
    # operations
finally:
    if db:
        db.close()
```

### Issue 5: Status Transition Validation (MEDIUM - PARTIALLY FIXED)

**Problem**: Could complete tickets without calling them first.

**Fix Applied**:
- Added `validators.py` with full state machine definition
- **Currently enforced**: Only completing tickets (must be in "called" status)
- **Not yet enforced**: Cancel operations, return-to-queue, general state transitions

**What's working**:
```python
# Complete ticket validates status
validate_ticket_can_be_completed(ticket)  # Enforced in main.py:302
```

**TODO for production**:
- Wire up `validate_status_transition()` to all status changes
- Add cancel endpoint with validation
- Add return-to-queue endpoint
```python
def validate_ticket_can_be_completed(ticket):
    if ticket.status != "called":
        raise HTTPException(400, "Only called tickets can be completed")
```

### Issue 6: Missing Request Timeouts (LOW - FIXED)

**Problem**: Frontend requests could hang indefinitely.

**Fix**: AbortController with timeout
```typescript
async function fetchWithTimeout(url, options, timeout = 30000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    // ...
}
```

## Production Deployment Checklist

### Pre-Deployment (MUST DO)

- [ ] Generate and set secure `STAFF_API_KEY`
- [ ] Change all default passwords
- [ ] Review and restrict CORS origins
- [ ] Set up HTTPS/TLS certificates
- [ ] Configure production database with:
  - [ ] Strong password
  - [ ] Network isolation (VPC/private subnet)
  - [ ] Backup strategy
  - [ ] Connection pooling limits
- [ ] Set up secrets management (AWS Secrets Manager, Vault, etc.)
- [ ] Review and harden Docker security:
  - [ ] Non-root user
  - [ ] Read-only filesystems where possible
  - [ ] Resource limits
- [ ] Set up monitoring and alerting
- [ ] Configure logging (centralized, structured)
- [ ] Implement rate limiting (nginx, CloudFlare, API Gateway)

### Authentication Upgrade (REQUIRED for Production)

Replace API key with JWT:

```python
# Example JWT implementation
from jose import JWTError, jwt
from datetime import datetime, timedelta

def create_access_token(username: str, role: str):
    expire = datetime.utcnow() + timedelta(hours=8)
    return jwt.encode({
        "sub": username,
        "role": role,
        "exp": expire
    }, SECRET_KEY, algorithm="HS256")

def verify_jwt_token(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError:
        raise HTTPException(401, "Invalid token")
```

### Network Security

```yaml
# Example production network setup
services:
  postgres:
    networks:
      - backend  # Not exposed to internet
    # Remove: ports: - "5432:5432"

  api:
    networks:
      - backend
      - frontend
    environment:
      - ALLOWED_HOSTS=dmv.example.com

  nginx:  # Add reverse proxy
    image: nginx:alpine
    ports:
      - "443:443"
    networks:
      - frontend
```

### Monitoring & Logging

```python
# Add to main.py
import logging
from prometheus_fastapi_instrumentator import Instrumentator

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Audit log for staff actions
def audit_log(action: str, user: str, ticket_number: str):
    logging.info(
        "AUDIT",
        extra={
            "action": action,
            "user": user,
            "ticket": ticket_number,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
```

## Penetration Testing Notes

Before production deployment, test for:

1. **Authentication Bypass**: Attempt to access staff endpoints without credentials
2. **SQL Injection**: Test all input fields (use SQLMap)
3. **XSS**: Test ticket number inputs and error messages
4. **CSRF**: Test state-changing operations without CSRF tokens
5. **Race Conditions**: Concurrent requests to join queue, call tickets
6. **DoS**: High-volume requests to API endpoints
7. **Information Disclosure**: Check error messages for sensitive data
8. **Session Management**: Token expiration, logout functionality

## Compliance Considerations

### CCPA/Privacy

- Ticket numbers could be considered personal identifiers
- Need privacy policy for data collection
- Right to deletion mechanisms
- Data retention policies

### Accessibility

- WCAG 2.1 AA compliance for public interfaces
- Screen reader testing
- Keyboard navigation

### Government Standards

- NIST Cybersecurity Framework alignment
- State-specific security requirements
- FedRAMP considerations if federal integration

## Incident Response Plan

### Security Incident Procedure

1. **Detection**: Monitor logs for unusual patterns
2. **Containment**: Ability to quickly disable compromised API keys
3. **Investigation**: Audit logs for forensic analysis
4. **Remediation**: Patch deployment process
5. **Communication**: Stakeholder notification plan

### Emergency Contacts

- [ ] Define security team contacts
- [ ] Escalation procedures
- [ ] Vendor contacts (if using cloud services)

## References

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- FastAPI Security: https://fastapi.tiangolo.com/tutorial/security/
- PostgreSQL Security: https://www.postgresql.org/docs/current/security.html

---

**Last Updated**: 2024 (with security fixes)
**Security Level**: Development (NOT production-ready without additional hardening)
