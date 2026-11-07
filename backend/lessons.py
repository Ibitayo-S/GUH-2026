"""Guided learning path: a small state machine over the authored lesson data.

Main path:  intuition -> example -> trace -> mistake -> your_code -> check
Side steps: alt (another explanation), recap (after a correct check),
            prereq (offer a detour when a wrong check reveals a prerequisite gap).
Learning mode is never scored; check answers only steer the next step.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from analyzer import Analysis
from lab import Lab
from models import CheckResult, CheckView, LessonView, TraceView

MAIN = ["intuition", "example", "trace", "mistake", "your_code", "check"]
CHIPS = ["simpler", "example", "walkthrough", "check", "return"]


class LessonError(ValueError):
    pass


class _Default(dict):
    def __missing__(self, key):  # template slot the analyzer couldn't fill
        return "the highlighted line"


@dataclass
class LessonState:
    concept_id: str
    kind: str = "intuition"
    furthest: int = 0
    alt_index: int = -1
    check_id: Optional[str] = None
    used_checks: list[str] = field(default_factory=list)
    result: Optional[CheckResult] = None
    prereq_offer: Optional[str] = None
    parent: Optional["LessonState"] = None
    your_code_text: Optional[str] = None      # live-model personalisation, if any


def _goto(state: LessonState, lab: Lab, kind: str) -> None:
    state.kind = kind
    state.result = None
    state.prereq_offer = None
    if kind in MAIN:
        state.furthest = max(state.furthest, MAIN.index(kind))
    if kind == "check":
        _pick_check(state, lab)


def _pick_check(state: LessonState, lab: Lab) -> None:
    checks = [c.id for c in lab.lesson(state.concept_id).checks]
    unused = [c for c in checks if c not in state.used_checks]
    if unused:
        nxt = unused[0]
    else:  # all used: rotate, never repeating the one just shown
        last = state.check_id or checks[-1]
        nxt = checks[(checks.index(last) + 1) % len(checks)]
    state.check_id = nxt
    state.used_checks.append(nxt)


def apply(state: LessonState, lab: Lab, action: str, choice: Optional[str],
          stats: dict[str, list[int]]) -> LessonState:
    """Apply one learner action. Returns the (possibly different) active lesson state."""
    lesson = lab.lesson(state.concept_id)
    if action == "next":
        if state.kind in MAIN and state.kind != "check":
            _goto(state, lab, MAIN[MAIN.index(state.kind) + 1])
        else:
            _goto(state, lab, MAIN[min(state.furthest + 1, len(MAIN) - 1)])
    elif action == "simpler":
        state.alt_index = (state.alt_index + 1) % len(lesson.alt)
        state.kind, state.result, state.prereq_offer = "alt", None, None
    elif action == "example":
        _goto(state, lab, "example")
    elif action == "walkthrough":
        _goto(state, lab, "trace")
    elif action == "check":
        _goto(state, lab, "check")
    elif action == "answer_check":
        if state.kind != "check" or not state.check_id:
            raise LessonError("There is no check question to answer right now.")
        chk = next(c for c in lesson.checks if c.id == state.check_id)
        picked = next((c for c in chk.choices if c.id == choice), None)
        if picked is None:
            raise LessonError(f"Unknown choice {choice!r}.")
        s = stats.setdefault(state.concept_id, [0, 0])
        s[1] += 1
        state.result = CheckResult(correct=picked.correct, chosen=picked.id, message=picked.explanation)
        if picked.correct:
            s[0] += 1
            state.kind = "recap"
        elif picked.reveals_prereq and state.parent is None:
            state.kind = "prereq"
            state.prereq_offer = picked.reveals_prereq
        else:
            state.alt_index = (state.alt_index + 1) % len(lesson.alt)
            state.kind = "alt"
    elif action == "learn_prereq":
        if not state.prereq_offer:
            raise LessonError("No prerequisite detour is on offer.")
        return LessonState(concept_id=state.prereq_offer, parent=state)
    elif action == "resume":
        if state.parent is None:
            raise LessonError("Not in a detour.")
        parent = state.parent
        _goto(parent, lab, "check")
        return parent
    else:
        raise LessonError(f"Unsupported action {action!r}.")
    return state


def _controls(state: LessonState) -> list[str]:
    if state.kind == "check":
        return ["simpler", "example", "walkthrough", "return"]
    if state.kind == "recap":
        return ["resume", "check", "return"] if state.parent else ["return", "check", "simpler"]
    if state.kind == "prereq":
        return ["learn_prereq", "check", "simpler", "return"]
    if state.kind == "alt":
        return ["check", "next", "example", "walkthrough", "return"]
    return ["next"] + CHIPS


def render(state: LessonState, lab: Lab, analysis: Analysis) -> LessonView:
    cid = state.concept_id
    lesson = lab.lesson(cid)
    label = lab.concept(cid).label
    highlight = analysis.lines.get(cid, [])
    base = dict(
        concept_id=cid, concept_label=label, step_kind=state.kind,
        step_index=state.furthest, step_count=len(MAIN), highlight_lines=highlight,
        check_result=state.result, controls=_controls(state), source="authored",
        detour_from=state.parent.concept_id if state.parent else None,
    )

    if state.kind in ("intuition", "example", "trace", "mistake"):
        step = next(s for s in lesson.steps if s.kind == state.kind)
        trace = None
        if step.trace:
            t = lab.lessons.traces[step.trace]
            trace = TraceView(graph=lab.lessons.graphs[t.graph], code=t.code, frames=t.frames)
        return LessonView(**base, title=step.title, body=step.body, code=step.code, trace=trace)

    if state.kind == "your_code":
        variant = next((f for f in analysis.flags if f in lesson.your_code), "default")
        template = lesson.your_code[variant]
        if state.your_code_text:
            body, src = state.your_code_text, "model"
        else:
            body, src = template.format_map(_Default(analysis.role_text())), "authored"
        base["source"] = src
        base["highlight_lines"] = analysis.lines_for(cid, template)
        return LessonView(**base, title="Back to your code", body=body)

    if state.kind == "check":
        chk = next(c for c in lesson.checks if c.id == state.check_id)
        return LessonView(**base, title="Quick check",
                          body="No pressure: this isn't scored. Pick the answer that fits best.",
                          check=CheckView(id=chk.id, prompt=chk.prompt,
                                          choices=[{"id": c.id, "text": c.text} for c in chk.choices]))

    if state.kind == "alt":
        alt = lesson.alt[max(state.alt_index, 0)]
        title = "Let's look at it another way" if state.result else alt.title
        return LessonView(**base, title=title, body=alt.body if not state.result else f"**{alt.title}.** {alt.body}")

    if state.kind == "recap":
        if state.parent:
            parent_label = lab.concept(state.parent.concept_id).label
            return LessonView(**base, title="Nice, that's the foundation",
                              body=f"{lesson.recap}\n\nNow let's head back to **{parent_label}** with this in mind.")
        return LessonView(**base, title="You've got it",
                          body=f"{lesson.recap}\n\nReady to try your original question again?")

    if state.kind == "prereq":
        pre = lab.concept(state.prereq_offer)
        return LessonView(**base, title=f"This builds on the {pre.label}",
                          body=(f"Your answer suggests the tricky part is **{pre.label}**, which {label.lower()} depends on. "
                                "Want a quick detour through it first? You'll come straight back here afterwards."),
                          prereq_offer=state.prereq_offer)

    raise LessonError(f"unknown step {state.kind}")
