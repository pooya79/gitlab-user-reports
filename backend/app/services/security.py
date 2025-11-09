"""Security helpers for password hashing and JWT management."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

import jwt

from app.core.config import Settings
from app.services import NOW_UTC

_PBKDF2_ITERATIONS = 480_000
_SALT_BYTES = 16


def create_access_token(
    *,
    settings: Settings,
    subject: str,
    expires_delta: timedelta | None = None,
    jti: str | None = None,
) -> tuple[str, datetime, datetime, str]:
    """Create a signed JWT access token and return metadata alongside it."""

    expiry_delta = expires_delta or timedelta(
        minutes=settings.jwt_access_token_exp_minutes
    )
    issued_at = NOW_UTC()
    expires_at = issued_at + expiry_delta
    token_id = jti or str(uuid4())
    payload = {
        "sub": subject,
        "iat": issued_at,
        "exp": expires_at,
        "jti": token_id,
    }
    encoded_token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return encoded_token, issued_at, expires_at, token_id


def decode_token(token: str, settings: Settings) -> dict[str, Any]:
    """Decode a JWT token using the shared application settings."""

    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
