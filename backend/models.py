"""Typed contract for Viva. Mirrored by frontend/src/types.ts and documented in docs/CONTRACT.md.

Two groups of models live here:
  * Lab data models: validate the JSON files in labs/<lab_id>/.
  * API models: request and response bodies.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

ConceptId = Literal["queue_fifo", "visited_set", "shortest_path_guarantee"]
Score = Literal[0, 1, 2]
Source = Literal["model", "fallback", "demo"]
StepKind = Literal[
    "intuition", "example", "trace", "mistake", "your_code", "check", "alt", "recap", "prereq"
]
LearnAction = Literal[
    "next", "simpler", "example", "walkthrough", "check", "answer_check",
    "learn_prereq", "resume", "return",
]


# ---------------------------------------------------------------- lab data

class Concept(BaseModel):
    id: ConceptId
    label: str
    description: str
    prereqs: list[ConceptId]


class LabFile(BaseModel):
    id: str
    title: str
    summary: str
    concepts: list[Concept]


class KeyPoint(BaseModel):
    id: str
    label: str
    keywords: list[str]
    hint: str
    core: bool = False


class Misconception(BaseModel):
    id: str
    keywords: list[str]
    explanation: str


class RubricExample(BaseModel):
    score: Score
    answer: str


class ConceptRubric(BaseModel):
    levels: dict[Literal["0", "1", "2"], str]
    key_points: list[KeyPoint]
    misconceptions: list[Misconception]
    feedback: dict[Literal["0", "1", "2"], str]
    strength: str
    next_step: str
    examples: list[RubricExample]


class GraphNode(BaseModel):
    id: str
    x: float
    y: float


class TraceGraph(BaseModel):
    nodes: list[GraphNode]
    edges: list[tuple[str, str]]
    start: str
    goal: str


class TraceFrame(BaseModel):
    line: int
    current: Optional[str]
    queue: list[str]
    visited: list[str]
    note: str
    dist: Optional[dict[str, int]] = None
    duplicate: Optional[str] = None
    found_path: Optional[list[str]] = None


class TraceFile(BaseModel):
    graph: str
    code: str
    frames: list[TraceFrame]


class LessonStepFile(BaseModel):
    kind: Literal["intuition", "example", "trace", "mistake"]
    title: str
    body: str
    code: Optional[str] = None
    trace: Optional[str] = None


class CheckChoice(BaseModel):
    id: str
    text: str
    correct: bool
    explanation: str
    reveals_prereq: Optional[ConceptId] = None


class CheckQuestionFile(BaseModel):
    id: str
    prompt: str
    choices: list[CheckChoice]


class AltExplanation(BaseModel):
    title: str
    body: str


class ConceptLesson(BaseModel):
    steps: list[LessonStepFile]
    your_code: dict[str, str]
    alt: list[AltExplanation]
    checks: list[CheckQuestionFile]
    recap: str


class LessonsFile(BaseModel):
    graphs: dict[str, TraceGraph]
    traces: dict[str, TraceFile]
    concepts: dict[ConceptId, ConceptLesson]


class DemoAnswer(BaseModel):
    label: str
    answer: str
    score: Score
    evidence: str
    misconception: Optional[str]
    message: str


# ---------------------------------------------------------------- API

class LabView(BaseModel):
    id: str
    title: str
    summary: str
    concepts: list[Concept]
    sample_code: str
    demo_answers: dict[ConceptId, list[DemoAnswer]]


class StartRequest(BaseModel):
    lab_id: str = "bfs-grid"
    code: str = Field(min_length=1, max_length=50_000)


class AnswerRequest(BaseModel):
    answer: str = Field(min_length=1, max_length=4_000)


class LearnRequest(BaseModel):
    action: LearnAction
    check_choice: Optional[str] = None


class Finding(BaseModel):
    """Something the static analyzer noticed in the student's code (never executed)."""
    id: str
    concept_id: ConceptId
    lines: list[int]
    message: str


class Question(BaseModel):
    id: int
    concept_id: ConceptId
    text: str
    code_lines: list[int]
    attempt: int
    source: Source


class Feedback(BaseModel):
    question_id: int
    concept_id: ConceptId
    score: Score
    verdict: str
    evidence: str
    misconception: Optional[str]
    message: str
    missing: list[str]
    source: Source


class TraceView(BaseModel):
    graph: TraceGraph
    code: str
    frames: list[TraceFrame]


class CheckView(BaseModel):
    id: str
    prompt: str
    choices: list[dict[str, str]]  # [{id, text}], correctness hidden


class CheckResult(BaseModel):
    correct: bool
    chosen: str
    message: str


class LessonView(BaseModel):
    concept_id: ConceptId
    concept_label: str
    step_kind: StepKind
    step_index: int          # position in the main path (0-based), for progress dots
    step_count: int
    title: str
    body: str
    code: Optional[str] = None
    trace: Optional[TraceView] = None
    highlight_lines: list[int] = []   # lines in the student's code to highlight
    check: Optional[CheckView] = None
    check_result: Optional[CheckResult] = None
    prereq_offer: Optional[ConceptId] = None
    detour_from: Optional[ConceptId] = None
    controls: list[LearnAction]
    source: Literal["authored", "model"]


class ProgressItem(BaseModel):
    concept_id: ConceptId
    label: str
    status: Literal["upcoming", "current", "learning", "strong", "developing", "revisit", "skipped"]


class SessionView(BaseModel):
    session_id: str
    mode: Literal["live", "mock"]
    phase: Literal["asking", "feedback", "learning", "done"]
    code_links: dict[str, list[int]]
    findings: list[Finding]
    progress: list[ProgressItem]
    question: Optional[Question] = None
    feedback: Optional[Feedback] = None
    offer_learning: bool = False
    can_retry: bool = False
    lesson: Optional[LessonView] = None
    notice: Optional[str] = None


class Attempt(BaseModel):
    attempt: int
    score: Score
    evidence: str
    source: Source


class ConceptReport(BaseModel):
    concept_id: ConceptId
    label: str
    status: Literal["strong", "developing", "revisit", "not_assessed"]
    best_score: Optional[Score]
    attempts: list[Attempt]
    evidence: Optional[str]
    code_lines: list[int]
    used_learning: bool
    checks_correct: int
    checks_total: int
    finding: Optional[str]
    next_step: Optional[str]


class Report(BaseModel):
    session_id: str
    mode: Literal["live", "mock"]
    lab_title: str
    concepts: list[ConceptReport]
    strengths: list[str]
    revisit: list[str]
    summary: str
    any_fallback: bool
