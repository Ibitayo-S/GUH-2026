"""Loads and validates the local lab data files (graph, questions, rubric, lessons, demo answers)."""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from models import ConceptLesson, ConceptRubric, DemoAnswer, LabFile, LessonsFile

LABS_DIR = Path(__file__).parent / "labs"


@dataclass(frozen=True)
class Lab:
    meta: LabFile
    questions: dict[str, dict[str, str]]
    rubric: dict[str, ConceptRubric]
    lessons: LessonsFile
    demo_answers: dict[str, list[DemoAnswer]]
    sample_code: str

    def concept(self, cid: str):
        return next(c for c in self.meta.concepts if c.id == cid)

    def lesson(self, cid: str) -> ConceptLesson:
        return self.lessons.concepts[cid]

    @property
    def concept_ids(self) -> list[str]:
        return [c.id for c in self.meta.concepts]


def _read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=8)
def load_lab(lab_id: str) -> Lab:
    d = LABS_DIR / lab_id
    if not d.is_dir():
        raise KeyError(lab_id)
    meta = LabFile.model_validate(_read(d / "lab.json"))
    lab = Lab(
        meta=meta,
        questions=_read(d / "questions.json"),
        rubric={k: ConceptRubric.model_validate(v) for k, v in _read(d / "rubric.json").items()},
        lessons=LessonsFile.model_validate(_read(d / "lessons.json")),
        demo_answers={
            k: [DemoAnswer.model_validate(a) for a in v]
            for k, v in _read(d / "demo_answers.json").items()
        },
        sample_code=(d / "sample_solution.py").read_text(encoding="utf-8"),
    )
    _check_references(lab)
    return lab


def _check_references(lab: Lab) -> None:
    """Cross-file checks the schemas alone can't express."""
    ids = set(lab.concept_ids)
    for name, mapping in (("questions", lab.questions), ("rubric", lab.rubric),
                          ("lessons", lab.lessons.concepts), ("demo_answers", lab.demo_answers)):
        missing = ids - set(mapping)
        if missing:
            raise ValueError(f"{name} is missing concepts: {sorted(missing)}")
    for q in lab.questions.values():
        if "default" not in q:
            raise ValueError("every concept needs a 'default' question")
    for tname, trace in lab.lessons.traces.items():
        if trace.graph not in lab.lessons.graphs:
            raise ValueError(f"trace {tname} uses unknown graph {trace.graph}")
        n_lines = trace.code.count("\n") + 1
        for f in trace.frames:
            if not 1 <= f.line <= n_lines:
                raise ValueError(f"trace {tname}: frame line {f.line} out of range")
    for cid, lesson in lab.lessons.concepts.items():
        kinds = [s.kind for s in lesson.steps]
        if kinds != ["intuition", "example", "trace", "mistake"]:
            raise ValueError(f"lesson {cid}: steps must be intuition, example, trace, mistake")
        for s in lesson.steps:
            if s.trace and s.trace not in lab.lessons.traces:
                raise ValueError(f"lesson {cid}: unknown trace {s.trace}")
        if "default" not in lesson.your_code:
            raise ValueError(f"lesson {cid}: your_code needs a 'default' template")
        for chk in lesson.checks:
            if sum(c.correct for c in chk.choices) != 1:
                raise ValueError(f"check {chk.id}: exactly one choice must be correct")
            for c in chk.choices:
                if c.reveals_prereq and c.reveals_prereq not in lab.concept(cid).prereqs:
                    raise ValueError(f"check {chk.id}: {c.reveals_prereq} is not a prereq of {cid}")
