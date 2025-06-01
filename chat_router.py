# backend/chat_router.py

import os
import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import models
from schemas import ChatHistory, MessageOut
from db import get_db
from auth import get_current_user

router = APIRouter(
    prefix="/chat",
    tags=["chat"]
)

# ─── GET /chat/{conv_id} ───────────────────────────────────────────────────────
@router.get("/{conv_id}", response_model=ChatHistory)
def get_history_for_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1) Verify this conversation exists and belongs to the user
    conv = (
        db.query(models.Conversation)
          .filter(
            models.Conversation.id == conv_id,
            models.Conversation.user_id == current_user.id
          )
          .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 2) Fetch all messages in that conversation, ordered by timestamp
    msgs = (
        db.query(models.ChatMessage)
          .filter(models.ChatMessage.conversation_id == conv_id)
          .order_by(models.ChatMessage.timestamp.asc())
          .all()
    )

    # 3) Return them in an object with a "messages" key, so the frontend can do data.messages
    return { "messages": msgs }


# ─── POST /chat/{conv_id}/ask ─────────────────────────────────────────────────
@router.post("/{conv_id}/ask", response_model=MessageOut)
def ask_and_store(
    conv_id: int,
    body: dict,  # We accept a plain dict: { "messages": [ { role, content }, … ] }
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1) Verify this conversation exists and belongs to the user
    conv = (
        db.query(models.Conversation)
          .filter(
            models.Conversation.id == conv_id,
            models.Conversation.user_id == current_user.id
          )
          .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 2) Extract the "messages" array from the request body
    messages = body.get("messages")
    if not isinstance(messages, list):
        raise HTTPException(status_code=400, detail="Invalid payload: 'messages' must be a list")

    # 3) Make sure the last message is from the user
    last = messages[-1]
    if last.get("role") != "user":
        raise HTTPException(status_code=400, detail="Last message must have role='user'")

    user_text = last.get("content") or last.get("text")
    if not user_text:
        raise HTTPException(status_code=400, detail="User message missing 'content' or 'text' field")

    # 4) Save the user’s message into our DB
    new_msg = models.ChatMessage(
        conversation_id=conv_id,
        role="user",
        text=user_text
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    # 5) Build the payload we’ll forward to Groq
    groq_messages = []
    for m in messages:
        groq_messages.append({
            "role": m.get("role"),
            "content": m.get("content") or m.get("text")
        })

    groq_payload = {
        "model": "llama3-70b-8192",
        "messages": groq_messages,
        "temperature": 0.5
    }

    # 6) Hit the Groq endpoint
    GROQ_KEY = os.getenv("GROQ_API_KEY")
    if not GROQ_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set")
    GROQ_URL = "https://api.groq.com/openai/v1"
    GROQ_HEADERS = {
        "Authorization": f"Bearer {GROQ_KEY}",
        "Content-Type": "application/json"
    }
    r = requests.post(
        f"{GROQ_URL}/chat/completions",
        headers=GROQ_HEADERS,
        json=groq_payload
    )
    try:
        r.raise_for_status()
    except requests.exceptions.HTTPError as e:
        detail = r.text or str(e)
        raise HTTPException(status_code=500, detail=f"Groq error: {detail}")

    data = r.json()
    bot_text = data["choices"][0]["message"]["content"]

    # 7) Save the assistant’s reply in our DB
    bot_msg = models.ChatMessage(
        conversation_id=conv_id,
        role="assistant",
        text=bot_text
    )
    db.add(bot_msg)
    db.commit()
    db.refresh(bot_msg)

    # 8) Return that assistant message
    return bot_msg
