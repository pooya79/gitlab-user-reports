"""Pydantic schemas for user resources."""

from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    """Shared properties across user schemas."""

    email: EmailStr
    full_name: str
    is_active: bool = True


class UserCreate(UserBase):
    """Payload for creating a new user."""

    password: str


class UserUpdate(BaseModel):
    """Payload for updating existing users."""

    full_name: Optional[str] = None
    is_active: Optional[bool] = None


class UserRead(UserBase):
    """Response schema for user resources."""

    id: int

    model_config = ConfigDict(from_attributes=True)
