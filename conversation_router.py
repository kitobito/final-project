# backend/conversation_router.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from db import get_db
from auth import get_current_user

router = APIRouter(
    prefix="/conversations",
    tags=["conversations"]
)

# GET /conversations → list all conversations for the current user
@router.get("/", response_model=List[schemas.ConversationOut])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    convs = (
        db.query(models.Conversation)
          .filter(models.Conversation.user_id == current_user.id)
          .order_by(models.Conversation.created_at.desc())
          .all()
    )
    return convs

# POST /conversations → create a new conversation for the current user
@router.post("/", response_model=schemas.ConversationOut, status_code=201)
def create_conversation(
    conv: schemas.ConversationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    new_conv = models.Conversation(
        user_id=current_user.id,
        title=conv.title or "New Chat"
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    return new_conv

# DELETE /conversations/{conv_id} → delete a conversation (and its messages)
@router.delete("/{conv_id}", status_code=204)
def delete_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conv_id,
        models.Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return
