"""Phase 4: the live-model path, exercised with a stubbed model (no network, no key needed).

Checks that model output is used and labelled when valid, and that every failure falls back.
"""
import pytest

import llm
from assessor import assess
from lab import load_lab


@pytest.fixture()
def fake_model(monkeypatch):
    """Pretend a key is set and route call_json to a stub the test controls."""
    replies = {}

    def call_json(schema, system, user, temperature=0.2):
        r = replies.get(schema.__name__)
        if isinstance(r, Exception):
            return None  # llm.call_json swallows errors and returns None
        return schema.model_validate(r) if r is not None else None

    monkeypatch.setattr(llm, "available", lambda: True)
    monkeypatch.setattr(llm, "call_json", call_json)
    return replies


ANSWER = "Each cell X can be added twice because it's only marked when popped. That wastes work."


def test_live_assessment_is_used_and_labelled(fake_model):
    fake_model["_LiveAssessment"] = {
        "score": 2, "evidence": "Each cell X can be added twice", "misconception": None,
        "message": "Clear and correct.", "missing": [],
    }
    r = assess(load_lab("bfs-grid"), "visited_set", "q", ANSWER)
    assert r.source == "model" and r.score == 2 and r.evidence == "Each cell X can be added twice"


def test_live_evidence_must_quote_the_student(fake_model):
    fake_model["_LiveAssessment"] = {
        "score": 1, "evidence": "The student understands duplicates", "misconception": None,
        "message": "Partly.", "missing": ["Say when to mark."],
    }
    r = assess(load_lab("bfs-grid"), "visited_set", "q", ANSWER)
    assert r.source == "model"
    assert r.evidence.lower() in ANSWER.lower()  # replaced with a real quote


def test_live_failure_falls_back(fake_model):
    fake_model["_LiveAssessment"] = RuntimeError("timeout")
    r = assess(load_lab("bfs-grid"), "visited_set", "q", ANSWER)
    assert r.source == "fallback"


def test_live_out_of_range_score_falls_back(fake_model):
    fake_model["_LiveAssessment"] = {"score": 7, "evidence": "x", "misconception": None, "message": "m", "missing": []}
    assert assess(load_lab("bfs-grid"), "visited_set", "q", ANSWER).source == "fallback"


def _reach_your_code(client, code):
    sid = client.post("/api/sessions", json={"lab_id": "bfs-grid", "code": code}).json()["session_id"]
    client.post(f"/api/sessions/{sid}/confused")
    for _ in range(4):
        v = client.post(f"/api/sessions/{sid}/learn", json={"action": "next"}).json()
    return v


def test_your_code_step_personalised_when_valid(client, sample_code, fake_model):
    fake_model["_YourCode"] = {"body": "On line 17 you mark the cell after popping it, so line 25 can queue it twice."}
    v = _reach_your_code(client, sample_code)
    assert v["mode"] == "live"
    assert v["lesson"]["source"] == "model" and "line 17" in v["lesson"]["body"]


def test_your_code_step_rejects_output_without_line_refs(client, sample_code, fake_model):
    fake_model["_YourCode"] = {"body": "Great job, keep going!"}
    v = _reach_your_code(client, sample_code)
    assert v["lesson"]["source"] == "authored"


def test_real_call_json_returns_none_without_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    from pydantic import BaseModel

    class S(BaseModel):
        x: int

    assert llm.available() is False
    assert llm.call_json(S, "sys", "user") is None
