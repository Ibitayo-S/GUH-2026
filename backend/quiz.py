"""Quiz generation, validation, marking and retakes.

Stateless, so it runs on serverless platforms (Vercel): the server keeps nothing between requests.
Each quiz's answer key travels with the student as an encrypted, authenticated token (Fernet, keyed by
VIVA_SECRET). The browser can't read the answers before submitting, and can't forge a different key.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import random
import uuid
import zlib
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

import config
import demo_lab
import llm
import prompts
from materials import Materials, clean_ranges, excerpt, load, numbered
from models import (CodeExcerpt, Quiz, QuizOut, QuizQuestion, QuizQuestionOut, QuizRequest, QuestionResult, Results,
                    TopicResult)

log = logging.getLogger("viva.quiz")
N_QUESTIONS = 10
TOKEN_TTL_SECONDS = 7 * 24 * 3600
OFFLINE_MESSAGE = ("Generating a quiz for your own materials needs an Anthropic API key. Add yours above (it's only "
                   "used for this request), or try the example lab, which works without one.")
_DEV_SECRET = "viva-local-development-secret"


class Unavailable(RuntimeError):
    pass


class QuizStateError(RuntimeError):
    pass


# ---------------------------------------------------------------- tokens

def _fernet() -> Fernet:
    secret = os.getenv("VIVA_SECRET", "").strip()
    if not secret:
        log.warning("VIVA_SECRET is not set; using the development secret (set it in production)")
        secret = _DEV_SECRET
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest()))


def _seal(payload: dict) -> str:
    return _fernet().encrypt(zlib.compress(json.dumps(payload, separators=(",", ":")).encode())).decode()


def _open(token: str) -> dict:
    try:
        return json.loads(zlib.decompress(_fernet().decrypt(token.encode(), ttl=TOKEN_TTL_SECONDS)))
    except (InvalidToken, ValueError, zlib.error):
        raise QuizStateError("This quiz has expired or couldn't be read. Generate a new one.")


# ---------------------------------------------------------------- validation

def _norm(text: str) -> str:
    return "\n".join(l.rstrip() for l in text.replace("\r\n", "\n").strip().split("\n"))


def is_demo_lab(m: Materials) -> bool:
    return (_norm(m.manual_text) == _norm(demo_lab.MANUAL) and len(m.code_files) == 1
            and _norm(m.code_files[0].text) == _norm(demo_lab.CODE))


def validate(out: QuizOut, m: Materials) -> tuple[list[QuizQuestionOut], list[str]]:
    """Return (usable questions, problems). Fixes what it safely can; drops what it can't."""
    good: list[QuizQuestionOut] = []
    problems: list[str] = []
    for i, q in enumerate(out.questions, start=1):
        choices = [c.strip() for c in q.choices]
        # Exact comparison: in code, 'sat' and 'Sat' are different answers.
        if len(choices) != 4 or len(set(choices)) != 4 or not all(choices):
            problems.append(f"question {i} doesn't have exactly 4 distinct options")
            continue
        if not 0 <= q.correct_index < 4:
            problems.append(f"question {i} has an invalid correct_index")
            continue
        q.choices = choices
        if q.source_kind == "manual" and not m.manual_text:
            q.source_kind = "code"
        if q.source_kind == "code" and not m.code_files:
            q.source_kind = "manual"
        f = m.file(q.code_file) if q.code_file else None
        if f is None and q.code_lines and len(m.code_files) == 1:
            f = m.code_files[0]
        if f is not None:
            q.code_file = f.filename
            q.code_lines = clean_ranges(q.code_lines, len(f.text.splitlines()))
        else:
            q.code_file, q.code_lines = None, []
        if not q.code_lines:
            q.code_file = None
        good.append(q)
    if len(good) < N_QUESTIONS:
        problems.append(f"only {len(good)} usable questions; {N_QUESTIONS} are needed")
    return good[:N_QUESTIONS], problems


def _shuffled(q: dict, rng: random.Random) -> dict:
    order = list(range(len(q["choices"])))
    rng.shuffle(order)
    return {**q, "choices": [q["choices"][i] for i in order], "correct_index": order.index(q["correct_index"])}


# ---------------------------------------------------------------- generation

def _generate_live(m: Materials, api_key: Optional[str]) -> QuizOut:
    files = [(f.filename, numbered(f.text)) for f in m.code_files]
    user = prompts.USER.format(manual_block=prompts.manual_block(m.manual_name, m.manual_text),
                               code_block=prompts.code_block(files))
    out = llm.structured(QuizOut, prompts.SYSTEM, [{"role": "user", "content": user}], api_key=api_key)
    questions, problems = validate(out, m)
    if len(questions) == N_QUESTIONS:
        return QuizOut(title=out.title, questions=questions)
    # One retry, telling the model what was wrong.
    out = llm.structured(QuizOut, prompts.SYSTEM,
                         [{"role": "user", "content": user + prompts.RETRY_NOTE.format(problems="; ".join(problems))}],
                         api_key=api_key)
    questions, problems = validate(out, m)
    if len(questions) < N_QUESTIONS:
        raise llm.LLMError("Viva couldn't generate a complete 10-question quiz from these materials. Try again.")
    return QuizOut(title=out.title, questions=questions)


def _question_payload(q: QuizQuestionOut, m: Materials) -> dict:
    """Everything needed later to show and mark the question, including its code excerpt."""
    d = q.model_dump()
    f = m.file(q.code_file)
    d["code"] = (CodeExcerpt(file=f.filename, lines=q.code_lines, text=excerpt(f.text, q.code_lines)).model_dump()
                 if f and q.code_lines else None)
    return d


def create(req: QuizRequest, api_key: Optional[str] = None) -> Quiz:
    m = load(req)
    api_key = (api_key or "").strip() or None
    if config.demo_forced():
        api_key = None
    if config.live_enabled():
        out, source, model = _generate_live(m, None), "live", config.model()
    elif is_demo_lab(m):
        # The example lab always gets its free, instant prewritten quiz, even if a visitor pasted a key.
        out = QuizOut.model_validate(demo_lab.QUIZ)
        out, source, model = QuizOut(title=out.title, questions=validate(out, m)[0]), "demo", None
    elif api_key:
        out, source, model = _generate_live(m, api_key), "live", config.model()
    else:
        raise Unavailable(OFFLINE_MESSAGE)
    rng = random.Random()
    payload = {
        "v": 1, "id": str(uuid.uuid4()), "title": out.title.strip() or "Lab quiz", "source": source, "model": model,
        "is_retake": False, "materials": m.describe(),
        "questions": [_shuffled(_question_payload(q, m), rng) for q in out.questions],
    }
    return _public(payload)


# ---------------------------------------------------------------- views

def _public(p: dict) -> Quiz:
    """The quiz as the student sees it before submitting: no correct answers, no explanations."""
    return Quiz(
        quiz_id=p["id"], token=_seal(p), title=p["title"], source=p["source"], model=p["model"],
        is_retake=p["is_retake"], materials=p["materials"],
        questions=[QuizQuestion(number=i, type=q["type"], topic=q["topic"], question=q["question"],
                                choices=q["choices"], code=q["code"])
                   for i, q in enumerate(p["questions"], start=1)],
    )


# ---------------------------------------------------------------- marking

def _mark(p: dict, answers: list[Optional[int]]) -> list[QuestionResult]:
    qs = p["questions"]
    if len(answers) != len(qs):
        raise ValueError(f"Expected {len(qs)} answers, got {len(answers)}.")
    rows = []
    for i, (q, a) in enumerate(zip(qs, answers), start=1):
        if a is not None and not 0 <= a < len(q["choices"]):
            raise ValueError(f"Answer for question {i} is out of range.")
        rows.append(QuestionResult(
            number=i, type=q["type"], topic=q["topic"], question=q["question"], choices=q["choices"], chosen_index=a,
            correct_index=q["correct_index"], correct=a == q["correct_index"], explanation=q["explanation"],
            source_kind=q["source_kind"], source_ref=q["source_ref"], code=q["code"]))
    return rows


def submit(token: str, answers: list[Optional[int]]) -> Results:
    p = _open(token)
    rows = _mark(p, answers)
    by_type: dict[str, list[int]] = {}
    topics: dict[str, list[int]] = {}
    for r in rows:
        by_type.setdefault(r.type, [0, 0])
        topics.setdefault(r.topic, [0, 0])
        for d in (by_type[r.type], topics[r.topic]):
            d[0] += int(r.correct)
            d[1] += 1
    review = sorted((TopicResult(topic=t, correct=c, total=n) for t, (c, n) in topics.items() if c < n),
                    key=lambda t: (t.correct / t.total, -t.total))
    score = sum(r.correct for r in rows)
    return Results(quiz_id=p["id"], title=p["title"], source=p["source"], score=score, total=len(rows),
                   unanswered=sum(a is None for a in answers), by_type=by_type, review_topics=review,
                   questions=rows, can_retake=score < len(rows))


def retake(token: str, answers: list[Optional[int]]) -> Quiz:
    """A new quiz with only the missed questions, options reshuffled (active recall: try them again)."""
    p = _open(token)
    rows = _mark(p, answers)
    missed = [q for q, r in zip(p["questions"], rows) if not r.correct]
    if not missed:
        raise QuizStateError("You got every question right, so there's nothing to retake.")
    rng = random.Random()
    title = p["title"] if p["title"].startswith("Retake: ") else f"Retake: {p['title']}"
    return _public({**p, "id": str(uuid.uuid4()), "title": title, "is_retake": True,
                    "questions": [_shuffled(q, rng) for q in missed]})
