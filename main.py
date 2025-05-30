from fastapi import FastAPI, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
import pdfplumber
import os
from dotenv import load_dotenv
import requests
from openai import OpenAI

# Load environment variables (make sure you have a .env with GROQ_API_KEY)
load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Groq / LLaMA3 client
client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY") or "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",
    base_url="https://api.groq.com/openai/v1"
)

@app.get("/")
def root():
    return {"message": "Backend is running"}

# 1) File upload & summarization
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        text = ""
        if file.filename.lower().endswith(".pdf"):
            with pdfplumber.open(file.file) as pdf:
                for page in pdf.pages:
                    p = page.extract_text()
                    if p:
                        text += p + "\n"
        else:
            content = await file.read()
            text = content.decode("utf-8", errors="ignore")

        snippet = text[:6000]
        resp = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[
                {"role": "system", "content": "You are an expert research assistant. Summarize this text."},
                {"role": "user",   "content": snippet}
            ],
            temperature=0.3
        )
        summary = resp.choices[0].message.content
        return {"summary": summary}

    except Exception as e:
        return {"summary": f"❌ Error: {str(e)}"}

# 2) Chat with memory
class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]   # expects [{role: "user"/"assistant"/"system", content: "..."}]

@app.post("/ask")
def ask_question(req: ChatRequest):
    try:
        resp = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=req.messages,
            temperature=0.5
        )
        return {"answer": resp.choices[0].message.content}
    except Exception as e:
        return {"answer": f"❌ Error: {str(e)}"}

# 3) DuckDuckGo web search
@app.get("/search")
def web_search(q: str = Query(..., description="Search query")):
    try:
        r = requests.get(
            "https://api.duckduckgo.com/",
            params={"q": q, "format": "json", "no_html": 1}
        )
        data = r.json()
        results = []

        if data.get("AbstractText"):
            results.append({
                "title":   "Summary",
                "snippet": data["AbstractText"],
                "url":     data.get("AbstractURL", "")
            })

        for topic in data.get("RelatedTopics", [])[:5]:
            if isinstance(topic, dict) and topic.get("Text") and topic.get("FirstURL"):
                results.append({
                    "title":   topic["Text"],
                    "snippet": topic["Text"],
                    "url":     topic["FirstURL"]
                })

        return {"results": results}

    except Exception as e:
        return {"results": [], "error": str(e)}
