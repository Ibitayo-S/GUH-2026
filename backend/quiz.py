"""Quiz generation, validation, storage, marking and retakes.

Correct answers stay on the server until the quiz is submitted, so the client can't reveal them early.
"""
from __future__ import annotations

import random
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Optional

import config
import demo_lab
import llm
import prompts
from materials import Materials, clean_ranges, excerpt, load, numbered
from models import (CodeExcerpt, Quiz, QuizOut, QuizQuestion, QuizQuestionOut, QuizRequest, QuestionResult, Results,
                    TopicResult)

N_QUESTIONS = 10
OFFLINE_MESSAGE = ("No AI model is in use on the server (no ANTHROPIC_API_KEY, or VIVA_DEMO=1), so Viva can't write "
                   "a quiz for these materials. Set the key for live mode, or try the example lab in demo mode.")


class Unavailable(RuntimeError):
    pass


class QuizStateError(RuntimeError):
    pass


@dataclass
class StoredQuiz:
    id: str
    title: str
    source: str
    model: Optional[str]
    questions: list[QuizQuestionOut]
    materials: Materials
    is_retake: bool = False
    results: Optional[Results] = None
    extra: dict = field(default_factory=dict)


_QUIZZES: "OrderedDict[str, StoredQuiz]" = OrderedDict()


def _norm(text: str) -> str:
    return "\n".join(l.rstrip() for l in text.replace("\r\n", "\n").strip().split("\n"))


def is_demo_lab(m: Materials) -> bool:
    return (_norm(m.manual_text) == _norm(demo_lab.MANUAL) and len(m.code_files) == 1
            and _norm(m.code_files[0].text) == _norm(demo_lab.CODE))


# ---------------------------------------------------------------- validation

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


def _shuffled(q: QuizQuestionOut, rng: random.Random) -> QuizQuestionOut:
    order = list(range(len(q.choices)))
    rng.shuffle(order)
    return q.model_copy(update={"choices": [q.choices[i] for i in order], "correct_index": order.index(q.correct_index)})


# ---------------------------------------------------------------- generation

def _generate_live(m: Materials) -> QuizOut:
    files = [(f.filename, numbered(f.text)) for f in m.code_files]
    user = prompts.USER.format(manual_block=prompts.manual_block(m.manual_name, m.manual_text),
                               code_block=prompts.code_block(files))
    out = llm.structured(QuizOut, prompts.SYSTEM, [{"role": "user", "content": user}])
    questions, problems = validate(out, m)
    if len(questions) == N_QUESTIONS:
        return QuizOut(title=out.title, questions=questions)
    # One retry, telling the model what was wrong.
    out = llm.structured(QuizOut, prompts.SYSTEM, [{"role": "user", "content": user + prompts.RETRY_NOTE.format(problems="; ".join(problems))}])
    questions, problems = validate(out, m)
    if len(questions) < N_QUESTIONS:
        raise llm.LLMError("Viva couldn't generate a complete 10-question quiz from these materials. Try again.")
    return QuizOut(title=out.title, questions=questions)


def create(req: QuizRequest) -> Quiz:
    m = load(req)
    if config.live_enabled():
        out, source, model = _generate_live(m), "live", config.model()
    elif is_demo_lab(m):
        out, source, model = QuizOut.model_validate(demo_lab.QUIZ), "demo", None
        out = QuizOut(title=out.title, questions=validate(out, m)[0])
    else:
        raise Unavailable(OFFLINE_MESSAGE)
    rng = random.Random()
    stored = StoredQuiz(id=str(uuid.uuid4()), title=out.title.strip() or "Lab quiz", source=source, model=model,
                        questions=[_shuffled(q, rng) for q in out.questions], materials=m)
    return _store(stored)


def _store(s: StoredQuiz) -> Quiz:
    _QUIZZES[s.id] = s
    while len(_QUIZZES) > 200:
        _QUIZZES.popitem(last=False)
    return public(s)


def get(quiz_id: str) -> StoredQuiz:
    return _QUIZZES[quiz_id]


# ---------------------------------------------------------------- views

def _code(s: StoredQuiz, q: QuizQuestionOut) -> Optional[CodeExcerpt]:
    f = s.materials.file(q.code_file)
    if not f or not q.code_lines:
        return None
    return CodeExcerpt(file=f.filename, lines=q.code_lines, text=excerpt(f.text, q.code_lines))


def public(s: StoredQuiz) -> Quiz:
    """The quiz as the student sees it before submitting: no correct answers, no explanations."""
    return Quiz(
        quiz_id=s.id, title=s.title, source=s.source, model=s.model, is_retake=s.is_retake,
        materials=s.materials.describe(),
        questions=[QuizQuestion(number=i, type=q.type, topic=q.topic, question=q.question, choices=q.choices,
                                code=_code(s, q)) for i, q in enumerate(s.questions, start=1)],
    )


# ---------------------------------------------------------------- marking

def submit(quiz_id: str, answers: list[Optional[int]]) -> Results:
    s = get(quiz_id)
    if s.results is not None:
        return s.results  # already marked: submitting again returns the same results
    if len(answers) != len(s.questions):
        raise ValueError(f"Expected {len(s.questions)} answers, got {len(answers)}.")
    rows: list[QuestionResult] = []
    for i, (q, a) in enumerate(zip(s.questions, answers), start=1):
        if a is not None and not 0 <= a < len(q.choices):
            raise ValueError(f"Answer for question {i} is out of range.")
        rows.append(QuestionResult(
            number=i, type=q.type, topic=q.topic, question=q.question, choices=q.choices, chosen_index=a,
            correct_index=q.correct_index, correct=a == q.correct_index, explanation=q.explanation,
            source_kind=q.source_kind, source_ref=q.source_ref, code=_code(s, q)))
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
    s.results = Results(quiz_id=s.id, title=s.title, source=s.source, score=score, total=len(rows),
                        unanswered=sum(a is None for a in answers), by_type=by_type, review_topics=review,
                        questions=rows, can_retake=score < len(rows))
    return s.results


def retake(quiz_id: str) -> Quiz:
    """A new quiz with only the missed questions, options reshuffled (active recall: try them again)."""
    s = get(quiz_id)
    if s.results is None:
        raise QuizStateError("Submit the quiz before retaking the questions you missed.")
    missed = [q for q, r in zip(s.questions, s.results.questions) if not r.correct]
    if not missed:
        raise QuizStateError("You got every question right, so there's nothing to retake.")
    rng = random.Random()
    title = s.title if s.title.startswith("Retake: ") else f"Retake: {s.title}"
    return _store(StoredQuiz(id=str(uuid.uuid4()), title=title, source=s.source, model=s.model,
                             questions=[_shuffled(q, rng) for q in missed], materials=s.materials, is_retake=True))
