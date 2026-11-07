"""Viva session state machine.

    asking --answer--> feedback --retry--> asking
       |                  |--continue--> asking (next concept) / done
       |--confused--+     |--confused--+
                    v                  v
                 learning --(lesson actions)--> learning --return--> asking (retry)

"I don't understand" (button or typed) enters learning and is never scored.
"""
from __future__ import annotations

import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Optional

import lessons
import llm
from analyzer import Analysis, analyze, format_lines
from assessor import assess, is_confused
from lab import Lab, load_lab
from models import (Attempt, ConceptReport, Feedback, ProgressItem, Question, Report, SessionView)


class PhaseError(RuntimeError):
    """Action not allowed in the current phase (HTTP 409)."""


class _Default(dict):
    def __missing__(self, key):
        return "the highlighted line"


@dataclass
class Session:
    id: str
    lab: Lab
    code: str
    analysis: Analysis
    order: list[str]
    mode: str
    idx: int = 0
    phase: str = "asking"
    q_counter: int = 0
    question: Optional[Question] = None
    feedback: Optional[Feedback] = None
    lesson: Optional[lessons.LessonState] = None
    attempts: dict[str, list[Attempt]] = field(default_factory=dict)
    learned: set[str] = field(default_factory=set)
    checks: dict[str, list[int]] = field(default_factory=dict)
    skipped: set[str] = field(default_factory=set)
    notice: Optional[str] = None

    # ------------------------------------------------------------ helpers
    @property
    def concept_id(self) -> str:
        return self.order[self.idx]

    def _ask(self, cid: str) -> None:
        self.q_counter += 1
        templates = self.lab.questions[cid]
        variant = next((f for f in self.analysis.flags if f in templates), "default")
        text = templates[variant].format_map(_Default(self.analysis.role_text()))
        self.question = Question(
            id=self.q_counter, concept_id=cid, text=text,
            code_lines=self.analysis.lines_for(cid, templates[variant]),
            attempt=len(self.attempts.get(cid, [])) + 1, source="authored",
        )
        self.feedback = None
        self.phase = "asking"

    def _enter_learning(self, notice: Optional[str] = None) -> None:
        cid = self.question.concept_id
        self.lesson = lessons.LessonState(concept_id=cid)
        self.learned.add(cid)
        self.phase = "learning"
        self.notice = notice

    def _best(self, cid: str) -> Optional[int]:
        a = self.attempts.get(cid)
        return max(x.score for x in a) if a else None

    # ------------------------------------------------------------ actions
    def answer(self, text: str) -> None:
        if self.phase != "asking":
            raise PhaseError("Answers are only accepted while a question is open.")
        cid = self.question.concept_id
        if is_confused(self.lab, cid, text):
            self._enter_learning("No problem, that isn't counted as an answer. Let's build it up step by step.")
            return
        r = assess(self.lab, cid, self.question.text, text)
        self.attempts.setdefault(cid, []).append(
            Attempt(attempt=self.question.attempt, score=r.score, evidence=r.evidence, source=r.source))
        self.feedback = Feedback(
            question_id=self.question.id, concept_id=cid, score=r.score, verdict=r.verdict,
            evidence=r.evidence, misconception=r.misconception, message=r.message,
            missing=r.missing, source=r.source,
        )
        self.phase = "feedback"
        self.notice = None

    def confused(self) -> None:
        if self.phase not in ("asking", "feedback"):
            raise PhaseError("Learning mode can start from a question or its feedback.")
        self._enter_learning()

    def learn(self, action: str, choice: Optional[str]) -> None:
        if self.phase != "learning" or self.lesson is None:
            raise PhaseError("Not in learning mode.")
        if action == "return":
            cid = self.question.concept_id
            self.lesson = None
            self._ask(cid)
            self.notice = ("Welcome back. Have another go; your best attempt is the one that counts."
                           if self.attempts.get(cid) else "Welcome back. Have a go at your question.")
            return
        self.lesson = lessons.apply(self.lesson, self.lab, action, choice, self.checks)
        if self.lesson.kind == "your_code" and self.lesson.your_code_text is None and llm.available():
            self.lesson.your_code_text = lessons.personalise_your_code(self.lesson, self.lab, self.analysis, self.code)
        self.notice = None

    def retry(self) -> None:
        if self.phase != "feedback":
            raise PhaseError("Retry is available after feedback.")
        self._ask(self.question.concept_id)
        self.notice = "Have another go; your best attempt is the one that counts."

    def continue_(self) -> None:
        if self.phase not in ("asking", "feedback"):
            raise PhaseError("Finish or leave learning mode first.")
        if self.phase == "asking" and not self.attempts.get(self.concept_id):
            self.skipped.add(self.concept_id)
        self.idx += 1
        self.notice = None
        if self.idx >= len(self.order):
            self.phase, self.question, self.feedback = "done", None, None
        else:
            self._ask(self.concept_id)

    # ------------------------------------------------------------ views
    def _status(self, cid: str) -> str:
        best = self._best(cid)
        if best is None:
            return "skipped"
        return {2: "strong", 1: "developing", 0: "revisit"}[best]

    def view(self) -> SessionView:
        progress = []
        for i, cid in enumerate(self.order):
            if self.phase == "done" or i < self.idx or (i == self.idx and self.phase == "feedback"):
                status = self._status(cid)
            elif i == self.idx:
                status = "learning" if self.phase == "learning" else "current"
            else:
                status = "upcoming"
            progress.append(ProgressItem(concept_id=cid, label=self.lab.concept(cid).label, status=status))
        return SessionView(
            session_id=self.id, mode=self.mode, phase=self.phase,
            code_links=self.analysis.lines, findings=self.analysis.findings, progress=progress,
            question=self.question, feedback=self.feedback if self.phase == "feedback" else None,
            offer_learning=self.phase == "feedback" and self.feedback is not None and self.feedback.score < 2,
            can_retry=self.phase == "feedback" and self.feedback is not None and self.feedback.score < 2,
            lesson=lessons.render(self.lesson, self.lab, self.analysis) if self.phase == "learning" else None,
            notice=self.notice,
        )

    def report(self) -> Report:
        concepts: list[ConceptReport] = []
        strengths, revisit = [], []
        for cid in self.order:
            rubric = self.lab.rubric[cid]
            atts = self.attempts.get(cid, [])
            best = self._best(cid)
            best_att = max(atts, key=lambda a: (a.score, a.attempt)) if atts else None
            finding = next((f for f in self.analysis.findings if f.concept_id == cid), None)
            status = {2: "strong", 1: "developing", 0: "revisit", None: "not_assessed"}[best]
            if status == "strong":
                strengths.append(rubric.strength)
                next_step = finding.fix if finding else None
            else:
                revisit.append(self.lab.concept(cid).label)
                next_step = finding.fix if finding else rubric.next_step
            c = self.checks.get(cid, [0, 0])
            concepts.append(ConceptReport(
                concept_id=cid, label=self.lab.concept(cid).label, status=status, best_score=best,
                attempts=atts, evidence=best_att.evidence if best_att else None,
                code_lines=sorted(set(self.analysis.lines.get(cid, [])) | set(finding.lines if finding else [])),
                used_learning=cid in self.learned,
                checks_correct=c[0], checks_total=c[1],
                finding=finding.message if finding else None, next_step=next_step,
            ))
        improved = [c.label for c in concepts if len(c.attempts) > 1 and c.attempts[-1].score > c.attempts[0].score]
        parts = []
        if strengths:
            parts.append(f"You showed solid understanding of {format_lines([c.label for c in concepts if c.status == 'strong'])}.")
        if improved:
            parts.append(f"You improved on {format_lines(improved)} after working through it.")
        if revisit:
            parts.append(f"Worth revisiting: {format_lines(revisit)}.")
        any_fallback = self.mode == "mock" or any(a.source != "model" for c in concepts for a in c.attempts)
        return Report(session_id=self.id, mode=self.mode, lab_title=self.lab.meta.title, concepts=concepts,
                      strengths=strengths, revisit=revisit, summary=" ".join(parts) or "No answers yet.",
                      any_fallback=any_fallback)


# ---------------------------------------------------------------- store

_SESSIONS: "OrderedDict[str, Session]" = OrderedDict()
_MAX_SESSIONS = 500


def concept_order(lab: Lab, analysis: Analysis) -> list[str]:
    """Start where the code suggests understanding may break; otherwise prerequisites first."""
    order = list(lab.concept_ids)
    first = None
    if "visited_on_dequeue" in analysis.flags or "no_visited" in analysis.flags:
        first = "visited_set"
    elif "uses_pop" in analysis.flags:
        first = "queue_fifo"
    if first:
        order.remove(first)
        order.insert(0, first)
    return order


def create(lab_id: str, code: str) -> Session:
    lab = load_lab(lab_id)
    analysis = analyze(code)
    s = Session(id=str(uuid.uuid4()), lab=lab, code=code, analysis=analysis,
                order=concept_order(lab, analysis), mode="live" if llm.available() else "mock")
    s._ask(s.concept_id)
    if not analysis.looks_like_bfs:
        s.notice = ("Viva couldn't find a BFS queue in this code, so questions will refer to the general approach. "
                    "Try the sample solution to see line-by-line questions.")
    elif not analysis.parsed:
        s.notice = "This code doesn't fully parse, so line links are a best guess."
    _SESSIONS[s.id] = s
    while len(_SESSIONS) > _MAX_SESSIONS:
        _SESSIONS.popitem(last=False)
    return s


def get(session_id: str) -> Session:
    return _SESSIONS[session_id]
