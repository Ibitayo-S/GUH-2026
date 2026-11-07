"""Phase 1 gate: every lab data file validates against the Pydantic models and cross-references resolve."""
import ast

from lab import load_lab


def test_lab_loads_and_validates():
    lab = load_lab("bfs-grid")
    assert lab.concept_ids == ["queue_fifo", "visited_set", "shortest_path_guarantee"]


def test_prereqs_point_backwards():
    lab = load_lab("bfs-grid")
    seen: set[str] = set()
    for c in lab.meta.concepts:
        assert set(c.prereqs) <= seen, f"{c.id} lists a prereq that comes after it"
        seen.add(c.id)


def test_rubric_has_examples_for_every_level():
    lab = load_lab("bfs-grid")
    for cid, r in lab.rubric.items():
        assert {e.score for e in r.examples} == {0, 1, 2}, cid
        assert any(k.core for k in r.key_points), cid


def test_lessons_have_three_checks_and_alternatives():
    lab = load_lab("bfs-grid")
    for cid in lab.concept_ids:
        lesson = lab.lesson(cid)
        assert len(lesson.checks) >= 2, cid
        assert len(lesson.alt) >= 2, cid


def test_sample_solution_is_valid_python():
    # Parsed only, never executed: Viva treats submissions as text.
    ast.parse(load_lab("bfs-grid").sample_code)
