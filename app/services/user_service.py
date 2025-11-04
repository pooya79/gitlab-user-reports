"""Domain services related to user management."""

from __future__ import annotations

from collections.abc import Iterable
import hashlib

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas


def list_users(db: Session) -> list[models.User]:
    """Return all users ordered by creation."""

    result = db.scalars(select(models.User).order_by(models.User.id))
    return list(result)


def get_user(db: Session, user_id: int) -> models.User | None:
    """Fetch a user by primary key."""

    return db.get(models.User, user_id)


def get_user_by_email(db: Session, email: str) -> models.User | None:
    """Fetch a user by email address."""

    return db.scalars(select(models.User).where(models.User.email == email)).first()


def create_user(db: Session, user_in: schemas.UserCreate) -> models.User:
    """Persist a newly created user."""

    hashed_password = _hash_password(user_in.password)
    user = models.User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hashed_password,
        is_active=user_in.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(
    db: Session, user: models.User, user_in: schemas.UserUpdate
) -> models.User:
    """Apply updates to an existing user."""

    data = user_in.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(user, field, value)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user: models.User) -> None:
    """Remove a user from the database."""

    db.delete(user)
    db.commit()


def seed_users(db: Session, users: Iterable[schemas.UserCreate]) -> list[models.User]:
    """Utility to bulk create users, handy for demos and tests."""

    created: list[models.User] = []
    for user_in in users:
        created.append(create_user(db, user_in))
    return created


def _hash_password(password: str) -> str:
    """Insecure demo hash; replace with a proper password hasher in production."""

    return hashlib.sha256(password.encode("utf-8")).hexdigest()
