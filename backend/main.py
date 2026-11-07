"""Viva quiz API.

Local:   cd backend && uvicorn main:app --reload --port 8000
Vercel:  api/index.py imports `app` from here (see vercel.json). The API is stateless, so it suits serverless.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import config
import demo_lab
import quiz
from llm import LLMError
from materials import MaterialsError
from models import Quiz, QuizRequest, Results, SubmitRequest

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Viva", version="3.1")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])

KEY_HEADER = "X-Anthropic-Api-Key"


def _err(status: int, detail: str, retryable: bool) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": detail, "retryable": retryable})


@app.exception_handler(LLMError)
async def _llm(_: Request, e: LLMError):
    return _err(502, str(e), e.retryable)


@app.exception_handler(quiz.Unavailable)
async def _unavailable(_: Request, e: quiz.Unavailable):
    return _err(503, str(e), False)


@app.exception_handler(MaterialsError)
async def _materials(_: Request, e: MaterialsError):
    return _err(422, str(e), False)


@app.exception_handler(quiz.QuizStateError)
async def _state(_: Request, e: quiz.QuizStateError):
    return _err(409, str(e), False)


@app.exception_handler(ValueError)
async def _value(_: Request, e: ValueError):
    return _err(422, str(e), False)


@app.get("/api/health")
def health():
    live = config.live_enabled()
    return {"ok": True, "live": live, "model": config.model(), "demo_forced": config.demo_forced(),
            "accepts_user_key": not config.demo_forced()}


@app.get("/api/example")
def example():
    return {"manual": {"filename": demo_lab.MANUAL_FILENAME, "text": demo_lab.MANUAL},
            "code_files": [{"filename": demo_lab.CODE_FILENAME, "text": demo_lab.CODE}]}


@app.post("/api/quizzes", response_model=Quiz)
def create_quiz(req: QuizRequest, x_anthropic_api_key: Optional[str] = Header(default=None)):
    return quiz.create(req, api_key=x_anthropic_api_key)


@app.post("/api/quizzes/submit", response_model=Results)
def submit(req: SubmitRequest):
    return quiz.submit(req.token, req.answers)


@app.post("/api/quizzes/retake", response_model=Quiz)
def retake(req: SubmitRequest):
    return quiz.retake(req.token, req.answers)


# Local one-port mode: serve the built frontend (npm run build). On Vercel the CDN serves it instead.
_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if (_DIST / "index.html").is_file():
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="frontend")
