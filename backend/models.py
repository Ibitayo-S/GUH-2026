"""Typed contract for the Viva quiz (mirrored in frontend/src/types.ts).

  * API request/response bodies.
  * QuizOut / QuizQuestionOut: what the model must return. Validated by Pydantic, then checked again
    (10 questions, a valid correct option, code lines that exist) before a quiz is stored.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Source = Literal["live", "demo"]
QuestionType = Literal["conceptual", "code_reading", "debugging"]


class LineRange(BaseModel):
    start: int
    end: int


# ---------------------------------------------------------------- model output

class QuizQuestionOut(BaseModel):
    type: QuestionType
    topic: str = Field(description="2-5 word topic label, e.g. 'Dictionary counting'")
    question: str
    choices: list[str] = Field(description="exactly 4 options; one correct; no 'all/none of the above'")
    correct_index: int = Field(description="0-based index of the correct option")
    explanation: str = Field(description="why the correct option is right and the tempting wrong one is wrong")
    source_kind: Literal["manual", "code"]
    source_ref: str = Field(description="manual section heading/number, or the function name for code questions")
    code_file: Optional[str] = Field(description="file name for code questions, else null")
    code_lines: list[LineRange] = Field(description="relevant lines in code_file; empty for manual questions")


class QuizOut(BaseModel):
    title: str = Field(description="short title for the quiz, e.g. 'Lab 4: Word frequencies'")
    questions: list[QuizQuestionOut]


# ---------------------------------------------------------------- API: input

class ManualIn(BaseModel):
    filename: Optional[str] = None
    text: Optional[str] = Field(default=None, max_length=400_000)
    pdf_base64: Optional[str] = Field(default=None, max_length=30_000_000)


class CodeFileIn(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=200_000)


class QuizRequest(BaseModel):
    manual: Optional[ManualIn] = None
    code_files: list[CodeFileIn] = Field(default_factory=list, max_length=20)


# ---------------------------------------------------------------- API: quiz (answers hidden)

class CodeExcerpt(BaseModel):
    file: str
    lines: list[LineRange]
    text: str            # numbered excerpt, so students can look at THEIR code for code-reading questions


class QuizQuestion(BaseModel):
    number: int
    type: QuestionType
    topic: str
    question: str
    choices: list[str]
    code: Optional[CodeExcerpt]


class Quiz(BaseModel):
    quiz_id: str
    title: str
    source: Source
    model: Optional[str]
    questions: list[QuizQuestion]
    is_retake: bool
    materials: dict[str, str]  # e.g. {"manual": "lab4.pdf (12,340 chars)", "code": "word_counter.py"}


# ---------------------------------------------------------------- API: results (answers revealed)

class SubmitRequest(BaseModel):
    answers: list[Optional[int]]


class QuestionResult(BaseModel):
    number: int
    type: QuestionType
    topic: str
    question: str
    choices: list[str]
    chosen_index: Optional[int]
    correct_index: int
    correct: bool
    explanation: str
    source_kind: Literal["manual", "code"]
    source_ref: str
    code: Optional[CodeExcerpt]


class TopicResult(BaseModel):
    topic: str
    correct: int
    total: int


class Results(BaseModel):
    quiz_id: str
    title: str
    source: Source
    score: int
    total: int
    unanswered: int
    by_type: dict[str, list[int]]          # type -> [correct, total]
    review_topics: list[TopicResult]      # topics with at least one miss, worst first
    questions: list[QuestionResult]
    can_retake: bool


class ErrorBody(BaseModel):
    detail: str
    retryable: bool
