"""Viva API. Run from backend/:  uvicorn main:app --reload --port 8000"""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import llm
import session as sessions
from lab import load_lab
from lessons import LessonError
from models import AnswerRequest, LabView, LearnRequest, Report, SessionView, StartRequest

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Viva", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(sessions.PhaseError)
async def _phase_error(_: Request, exc: sessions.PhaseError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(LessonError)
async def _lesson_error(_: Request, exc: LessonError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


def _session(session_id: str) -> sessions.Session:
    try:
        return sessions.get(session_id)
    except KeyError:
        raise HTTPException(404, "Session not found. It may have expired when the server restarted.")


@app.get("/api/health")
def health():
    return {"ok": True, "mode": "live" if llm.available() else "mock"}


@app.get("/api/labs/{lab_id}", response_model=LabView)
def get_lab(lab_id: str):
    try:
        lab = load_lab(lab_id)
    except KeyError:
        raise HTTPException(404, f"Unknown lab {lab_id!r}")
    return LabView(id=lab.meta.id, title=lab.meta.title, summary=lab.meta.summary,
                   concepts=lab.meta.concepts, sample_code=lab.sample_code, demo_answers=lab.demo_answers)


@app.post("/api/sessions", response_model=SessionView)
def start(req: StartRequest):
    try:
        s = sessions.create(req.lab_id, req.code)
    except KeyError:
        raise HTTPException(404, f"Unknown lab {req.lab_id!r}")
    return s.view()


@app.post("/api/sessions/{session_id}/answer", response_model=SessionView)
def answer(session_id: str, req: AnswerRequest):
    s = _session(session_id)
    s.answer(req.answer)
    return s.view()


@app.post("/api/sessions/{session_id}/confused", response_model=SessionView)
def confused(session_id: str):
    s = _session(session_id)
    s.confused()
    return s.view()


@app.post("/api/sessions/{session_id}/learn", response_model=SessionView)
def learn(session_id: str, req: LearnRequest):
    s = _session(session_id)
    s.learn(req.action, req.check_choice)
    return s.view()


@app.post("/api/sessions/{session_id}/retry", response_model=SessionView)
def retry(session_id: str):
    s = _session(session_id)
    s.retry()
    return s.view()


@app.post("/api/sessions/{session_id}/continue", response_model=SessionView)
def cont(session_id: str):
    s = _session(session_id)
    s.continue_()
    return s.view()


@app.get("/api/sessions/{session_id}", response_model=SessionView)
def get_session(session_id: str):
    return _session(session_id).view()


@app.get("/api/sessions/{session_id}/report", response_model=Report)
def report(session_id: str):
    return _session(session_id).report()


# Serve the built frontend (npm run build) so the whole demo can run from one port.
_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _DIST.is_dir():
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="frontend")
