"""Scores one free-text answer against the concept rubric.

Order: scripted demo answer (exact match) -> live model (if a key is set) -> rubric keyword fallback.
Every result says where it came from so the UI can label it.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Optional

from pydantic import BaseModel

import llm
from lab import Lab
from models import ConceptRubric

CONFUSED_PHRASES = (
    "i don't know", "i dont know", "idk", "no idea", "not sure", "i don't understand",
    "i dont understand", "dunno", "no clue", "i'm lost", "im lost", "confused", "don't get it",
    "dont get it", "i have no idea",
)
VERDICTS = {2: "Solid understanding", 1: "Partly there", 0: "Not yet"}


@dataclass
class AssessResult:
    score: int
    evidence: str
    misconception: Optional[str]
    message: str
    missing: list[str] = field(default_factory=list)
    source: str = "fallback"

    @property
    def verdict(self) -> str:
        return VERDICTS[self.score]


def normalize(text: str) -> str:
    text = text.lower().replace("’", "'").replace("‘", "'").replace("`", "")
    return re.sub(r"\s+", " ", text).strip()


def _sentences(text: str) -> list[str]:
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+|\n+", text.strip()) if p.strip()]
    return parts or [text.strip()]


def _clip(s: str, n: int = 180) -> str:
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def _matches(norm_answer: str, keywords: list[str]) -> bool:
    return any(normalize(k) in norm_answer for k in keywords)


def is_confused(lab: Lab, concept_id: str, answer: str) -> bool:
    """'I don't know'-style answers route to learning mode instead of being scored."""
    n = normalize(answer)
    if not any(p in n for p in CONFUSED_PHRASES):
        return False
    rubric = lab.rubric[concept_id]
    return not any(_matches(n, kp.keywords) for kp in rubric.key_points)


def keyword_assess(rubric: ConceptRubric, answer: str) -> AssessResult:
    n = normalize(answer)
    matched = [kp for kp in rubric.key_points if _matches(n, kp.keywords)]
    mis = next((m for m in rubric.misconceptions if _matches(n, m.keywords)), None)
    has_core = any(kp.core for kp in rubric.key_points)
    core_hit = any(kp.core for kp in matched)

    if len(matched) >= 2 and (core_hit or not has_core):
        score = 2
    elif matched:
        score = 1
    else:
        score = 0
    if mis:
        score = min(score, 1) if matched else 0

    # Evidence: the sentence that earned (or cost) the score, quoted verbatim.
    sentences = _sentences(answer)
    ordered = sorted(matched, key=lambda kp: not kp.core)
    keyword_sets = [kp.keywords for kp in ordered] + ([mis.keywords] if mis else [])
    evidence = None
    for kws in keyword_sets:
        evidence = next((s for s in sentences if _matches(normalize(s), kws)), None)
        if evidence:
            break
    evidence = _clip(evidence or sentences[0])

    message = rubric.feedback[str(score)]
    if mis:
        message += " " + mis.explanation
    missing = [kp.hint for kp in rubric.key_points if kp.core and kp not in matched][:2] if score < 2 else []
    return AssessResult(score=score, evidence=evidence, misconception=mis.explanation if mis else None,
                        message=message, missing=missing, source="fallback")


def _demo_match(lab: Lab, concept_id: str, answer: str) -> Optional[AssessResult]:
    key = normalize(answer).rstrip(".!? ")
    for demo in lab.demo_answers.get(concept_id, []):
        if normalize(demo.answer).rstrip(".!? ") == key:
            rubric = lab.rubric[concept_id]
            missing = [kp.hint for kp in rubric.key_points if kp.core][:1] if demo.score < 2 else []
            return AssessResult(score=demo.score, evidence=demo.evidence, misconception=demo.misconception,
                                message=demo.message, missing=missing, source="demo")
    return None


class _LiveAssessment(BaseModel):
    score: int
    evidence: str
    misconception: Optional[str]
    message: str
    missing: list[str]


ASSESSOR_SYSTEM = """You are the Assessor in Viva, a formative, private understanding check on a student's own code.
Score ONE answer about ONE concept strictly against the rubric provided.
- 2 = correct mechanism AND why it matters. 1 = partially correct or vague. 0 = wrong, missing or "I don't know".
- Never reward length, confidence or jargon on its own. Use the labelled examples to calibrate.
- "evidence" MUST be an exact, verbatim quote (one sentence or clause) copied from the student's answer.
- "misconception": one sentence naming a specific wrong belief, or null.
- "message": one or two encouraging, specific sentences (max 40 words). Do not reveal the full model answer.
- "missing": up to 2 short hints for what the answer lacked (empty if score is 2).
Be accurate about BFS: marking visited on dequeue causes duplicate queue entries and extra work; it does not by itself make the returned path wrong."""


def _live(lab: Lab, concept_id: str, question: str, answer: str) -> Optional[AssessResult]:
    rubric = lab.rubric[concept_id]
    payload = {
        "concept": lab.concept(concept_id).model_dump(),
        "question": question,
        "student_answer": answer,
        "rubric_levels": rubric.levels,
        "key_points": [{"label": kp.label, "core": kp.core} for kp in rubric.key_points],
        "known_misconceptions": [m.explanation for m in rubric.misconceptions],
        "labelled_examples": [e.model_dump() for e in rubric.examples],
    }
    out = llm.call_json(_LiveAssessment, ASSESSOR_SYSTEM, json.dumps(payload), temperature=0.2)
    if out is None or out.score not in (0, 1, 2):
        return None
    evidence = out.evidence.strip().strip('"')
    if not evidence or normalize(evidence) not in normalize(answer):
        # The model must quote the student; if it didn't, quote the most relevant sentence ourselves.
        evidence = keyword_assess(rubric, answer).evidence
    return AssessResult(score=out.score, evidence=_clip(evidence), misconception=out.misconception or None,
                        message=out.message.strip(), missing=[m for m in out.missing if m][:2] if out.score < 2 else [],
                        source="model")


def assess(lab: Lab, concept_id: str, question: str, answer: str) -> AssessResult:
    return (
        _demo_match(lab, concept_id, answer)
        or _live(lab, concept_id, question, answer)
        or keyword_assess(lab.rubric[concept_id], answer)
    )
