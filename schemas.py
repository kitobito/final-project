# backend/schemas.py

from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional

# ---------- User-related schemas ----------

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True  # was orm_mode in v1, renamed in v2


class Token(BaseModel):
    access_token: str
    token_type: str  # e.g. "bearer"

class TokenData(BaseModel):
    user_id: int = None


# ---------- Conversation-related schemas ----------

class ConversationCreate(BaseModel):
    title: Optional[str] = "New Chat"

class ConversationOut(BaseModel):
    id: int
    title: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Chat message schemas ----------

class MessageCreate(BaseModel):
    role: str  # "user" or "assistant"
    text: str

class MessageOut(BaseModel):
    id: int
    role: str
    text: str
    timestamp: datetime

    class Config:
        from_attributes = True

class ChatHistory(BaseModel):
    messages: List[MessageOut]
