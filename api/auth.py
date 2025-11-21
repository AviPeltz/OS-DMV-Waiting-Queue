"""
Authentication and authorization middleware

SECURITY NOTE: This is a basic implementation for v0.
In production, use:
- OAuth2/OpenID Connect
- JWT with proper key rotation
- Role-based access control (RBAC)
- Audit logging
- Rate limiting per user
"""

from fastapi import Header, HTTPException, status
from typing import Optional
import os

# Environment variable for staff API key
# In production: Use proper secrets management (AWS Secrets Manager, HashiCorp Vault, etc.)
STAFF_API_KEY = os.getenv("STAFF_API_KEY", "dmv_staff_dev_key_CHANGE_IN_PRODUCTION")

# Network allowlist (optional additional layer)
# Parse and filter empty strings to avoid [""] when env var is empty
_allowlist_raw = os.getenv("STAFF_IP_ALLOWLIST", "")
STAFF_IP_ALLOWLIST = [ip.strip() for ip in _allowlist_raw.split(",") if ip.strip()]


def verify_staff_token(x_api_key: Optional[str] = Header(None)) -> str:
    """
    Verify staff API key from request header

    Usage:
        @app.post("/staff-endpoint")
        def protected_endpoint(token: str = Depends(verify_staff_token)):
            # endpoint logic

    Header: X-API-Key: {token}

    TODO for production:
    - Implement JWT with expiration
    - Add user identity and roles
    - Implement token refresh
    - Add rate limiting per token
    - Audit log all staff actions
    """
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    if x_api_key != STAFF_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    return x_api_key


def verify_staff_with_ip(
    x_api_key: Optional[str] = Header(None),
    x_forwarded_for: Optional[str] = Header(None)
) -> str:
    """
    Enhanced staff verification with IP allowlist

    Use this if deploying with a known set of staff IPs
    """
    # First verify the API key
    verify_staff_token(x_api_key)

    # If allowlist is configured, check IP
    if STAFF_IP_ALLOWLIST and STAFF_IP_ALLOWLIST[0]:
        client_ip = x_forwarded_for.split(",")[0].strip() if x_forwarded_for else None

        if not client_ip or client_ip not in STAFF_IP_ALLOWLIST:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied from this network location"
            )

    return x_api_key


# TODO: Production authentication examples
"""
Production JWT implementation example:

from jose import JWTError, jwt
from datetime import datetime, timedelta

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_jwt_token(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception
"""
