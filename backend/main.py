"""Viva quiz API. Run from backend/:  uvicorn main:app --reload --port 8000"""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
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
app = FastAPI(title="Viva", version="3.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])


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


def _get(quiz_id: str):
    try:
        return quiz.get(quiz_id)
    except KeyError:
        raise HTTPException(404, "Quiz not found. The server may have restarted; please generate it again.")


@app.get("/api/health")
def health():
    live = config.live_enabled()
    return {"ok": True, "live": live, "model": config.model() if live else None, "demo_forced": config.demo_forced()}


@app.get("/api/example")
def example():
    return {"manual": {"filename": demo_lab.MANUAL_FILENAME, "text": demo_lab.MANUAL},
            "code_files": [{"filename": demo_lab.CODE_FILENAME, "text": demo_lab.CODE}]}


@app.post("/api/quizzes", response_model=Quiz)
def create_quiz(req: QuizRequest):
    return quiz.create(req)


@app.get("/api/quizzes/{quiz_id}", response_model=Quiz)
def get_quiz(quiz_id: str):
    return quiz.public(_get(quiz_id))


@app.post("/api/quizzes/{quiz_id}/submit", response_model=Results)
def submit(quiz_id: str, req: SubmitRequest):
    _get(quiz_id)
    return quiz.submit(quiz_id, req.answers)


@app.post("/api/quizzes/{quiz_id}/retake", response_model=Quiz)
def retake(quiz_id: str):
    _get(quiz_id)
    return quiz.retake(quiz_id)


# Serve the built frontend (npm run build) so the app can run from one port.
_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if (_DIST / "index.html").is_file():
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="frontend")
