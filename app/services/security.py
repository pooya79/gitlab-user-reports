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


def hash_password(password: str) -> str:
    """Hash the provided password using PBKDF2-SHA256."""

    if not password:
        raise ValueError("password must not be empty")

    salt = secrets.token_bytes(_SALT_BYTES)
    derived_key = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    encoded_salt = base64.urlsafe_b64encode(salt).decode("ascii")
    encoded_key = base64.urlsafe_b64encode(derived_key).decode("ascii")
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${encoded_salt}${encoded_key}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Check whether the supplied password matches the stored hash."""

    try:
        algorithm, iterations, encoded_salt, encoded_key = stored_hash.split("$")
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    try:
        iteration_count = int(iterations)
    except ValueError:
        return False

    salt = base64.urlsafe_b64decode(encoded_salt.encode("ascii"))
    expected_key = base64.urlsafe_b64decode(encoded_key.encode("ascii"))
    derived_key = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, iteration_count
    )
    return hmac.compare_digest(derived_key, expected_key)


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
