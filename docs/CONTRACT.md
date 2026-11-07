# Viva API contract

Source of truth: [`backend/models.py`](../backend/models.py) (Pydantic), mirrored by [`frontend/src/types.ts`](../frontend/src/types.ts). Change all three together.

All routes are under `/api`. Every session action returns the full `SessionView`, so the UI just re-renders whatever comes back.

| Method | Route | Body | Returns | Allowed in phase |
|---|---|---|---|---|
| GET | `/api/health` | none | `{ ok, mode }` | any |
| GET | `/api/labs/{lab_id}` | none | `LabView`: concepts, `sample_code`, `demo_answers` | any |
| POST | `/api/sessions` | `{ lab_id, code }` | `SessionView` (first question) | n/a |
| POST | `/api/sessions/{id}/answer` | `{ answer }` | `SessionView` → `feedback`, or `learning` if the answer is "I don't know"-style | `asking` |
| POST | `/api/sessions/{id}/confused` | none | `SessionView` → `learning` (never scored) | `asking`, `feedback` |
| POST | `/api/sessions/{id}/learn` | `{ action, check_choice? }` | `SessionView` | `learning` |
| POST | `/api/sessions/{id}/retry` | none | `SessionView` → `asking`, attempt + 1 | `feedback` |
| POST | `/api/sessions/{id}/continue` | none | `SessionView` → next concept or `done` | `asking`, `feedback` |
| GET | `/api/sessions/{id}` | none | `SessionView` | any |
| GET | `/api/sessions/{id}/report` | none | `Report` | any (best after `done`) |

Errors: `404` unknown lab or session · `409` action not allowed in this phase · `422` bad body or invalid lesson action.

## Learn actions
`next` (continue down the main path) · `simpler` (an alternative explanation) · `example` · `walkthrough` (step-by-step trace) · `check` (a new check question) · `answer_check` + `check_choice` · `learn_prereq` (take the offered detour) · `resume` (back from the detour) · `return` (leave learning and retry the original question).

Main path: `intuition → example → trace → mistake → your_code → check`. Side steps: `alt`, `recap`, `prereq`.

## Provenance labels (shown in the UI)
- `SessionView.mode`: `live` if the backend has `OPENAI_API_KEY` and is not in `VIVA_MOCK`; otherwise `mock`.
- `Feedback.source`: `model` (live Assessor), `fallback` (rubric keyword scoring), or `demo` (a scripted demo answer matched exactly).
- `Question.source` / `LessonView.source`: `authored` (from `labs/<lab>/*.json`) or `model` (personalised by the live model).

## Example: `POST /api/sessions` with the sample solution
```json
{
  "session_id": "1b0e…", "mode": "mock", "phase": "asking",
  "code_links": { "queue_fifo": [10, 14, 25], "visited_set": [11, 15, 17, 24], "shortest_path_guarantee": [14, 18, 19] },
  "findings": [{ "id": "visited_on_dequeue", "concept_id": "visited_set", "lines": [17, 25],
                 "message": "Line 17 marks a cell as visited only after it is popped…", "fix": "Move `visited.add(...)`…" }],
  "progress": [{ "concept_id": "visited_set", "label": "Visited set", "status": "current" }, …],
  "question": { "id": 1, "concept_id": "visited_set", "attempt": 1, "source": "authored",
                "code_lines": [11, 14, 15, 17, 24, 25],
                "text": "Line 17 marks a cell as visited only after it is popped on line 14. Suppose two cells…" },
  "feedback": null, "offer_learning": false, "can_retry": false, "lesson": null, "notice": null
}
```

## Example: `POST /api/sessions/{id}/learn {"action":"answer_check","check_choice":"a"}` (wrong)
```json
{
  "phase": "learning",
  "lesson": { "concept_id": "visited_set", "step_kind": "alt", "step_index": 5, "step_count": 6,
              "title": "Let's look at it another way", "body": "**Simpler: stamp it when you see it.** …",
              "check_result": { "correct": false, "chosen": "a", "message": "B adds D. When C is popped…" },
              "highlight_lines": [11, 15, 17, 24],
              "controls": ["check", "next", "example", "walkthrough", "return"], "source": "authored" },
  …
}
```
