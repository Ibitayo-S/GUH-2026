"""Quiz flow: demo lab without a key, honest 'no model' for other materials, live path with a stubbed model."""
import base64

import pytest

import demo_lab
import llm
import quiz as Q

EXAMPLE = {"manual": {"filename": demo_lab.MANUAL_FILENAME, "text": demo_lab.MANUAL},
           "code_files": [{"filename": demo_lab.CODE_FILENAME, "text": demo_lab.CODE}]}


def make(client, body, status=200):
    r = client.post("/api/quizzes", json=body)
    assert r.status_code == status, r.text
    return r.json()


def correct_answers(qz):
    """Peek at the answer key inside the encrypted token (tests only)."""
    return [q["correct_index"] for q in Q._open(qz["token"])["questions"]]


def submit(client, qz, answers, status=200):
    r = client.post("/api/quizzes/submit", json={"token": qz["token"], "answers": answers})
    assert r.status_code == status, r.text
    return r.json()


# ---------------------------------------------------------------- demo mode

def test_demo_quiz_has_ten_mcqs_and_hides_answers(client):
    qz = make(client, EXAMPLE)
    assert qz["source"] == "demo" and qz["model"] is None and len(qz["questions"]) == 10
    for q in qz["questions"]:
        assert len(q["choices"]) == 4
        assert "correct_index" not in q and "explanation" not in q
    types = {q["type"] for q in qz["questions"]}
    assert types == {"conceptual", "code_reading", "debugging"}
    code_q = next(q for q in qz["questions"] if q["code"])
    assert code_q["code"]["file"] == "word_counter.py" and " | " in code_q["code"]["text"]
    assert qz["materials"]["code"] == "word_counter.py"


def test_demo_options_are_shuffled(client):
    first_positions = set()
    for _ in range(6):
        qz = make(client, EXAMPLE)
        first_positions.update(correct_answers(qz))
    assert len(first_positions) > 1  # the correct option isn't always "A"


def test_token_hides_answers_and_cannot_be_tampered_with(client):
    qz = make(client, EXAMPLE)
    assert "correct_index" not in qz["token"] and "explanation" not in qz["token"]  # encrypted, not just encoded
    tampered = qz["token"][:-6] + ("A" if qz["token"][-6] != "A" else "B") + qz["token"][-5:]
    r = client.post("/api/quizzes/submit", json={"token": tampered, "answers": [0] * 10})
    assert r.status_code == 409 and "Generate a new one" in r.json()["detail"]


def test_submit_scores_and_reveals_everything(client):
    qz = make(client, EXAMPLE)
    key = correct_answers(qz)
    answers = key[:7] + [(key[7] + 1) % 4, (key[8] + 1) % 4, None]
    res = submit(client, qz, answers)
    assert res["score"] == 7 and res["total"] == 10 and res["unanswered"] == 1 and res["can_retake"]
    row = res["questions"][7]
    assert row["correct"] is False and row["chosen_index"] == answers[7] and row["correct_index"] == key[7]
    assert row["explanation"] and row["source_ref"]
    assert sum(c for c, _ in res["by_type"].values()) == 7
    assert res["review_topics"] and all(t["correct"] < t["total"] for t in res["review_topics"])


def test_retake_contains_only_missed_questions(client):
    qz = make(client, EXAMPLE)
    key = correct_answers(qz)
    answers = [k if i % 2 == 0 else None for i, k in enumerate(key)]
    r = client.post("/api/quizzes/retake", json={"token": qz["token"], "answers": answers})
    rt = r.json()
    assert rt["is_retake"] and rt["title"].startswith("Retake: ") and len(rt["questions"]) == 5
    missed = {qz["questions"][i]["question"] for i in range(1, 10, 2)}
    assert {q["question"] for q in rt["questions"]} == missed
    res = submit(client, rt, correct_answers(rt))
    assert res["score"] == 5 and res["can_retake"] is False
    r = client.post("/api/quizzes/retake", json={"token": rt["token"], "answers": correct_answers(rt)})
    assert r.status_code == 409


def test_bad_submissions(client):
    qz = make(client, EXAMPLE)
    submit(client, qz, [0] * 3, status=422)
    submit(client, qz, [9] * 10, status=422)
    assert client.post("/api/quizzes/submit", json={"token": "nope", "answers": []}).status_code == 409


def test_other_materials_without_key_are_not_faked(client):
    r = client.post("/api/quizzes", json={"manual": {"text": "Lab 1: loops"}, "code_files": [{"filename": "a.py", "text": "for i in range(3): print(i)"}]})
    assert r.status_code == 503 and "API key" in r.json()["detail"] and r.json()["retryable"] is False


def test_visitor_key_is_used_for_that_request_only(client, monkeypatch):
    """No server key: a key sent in the header enables live generation for that request."""
    seen = []

    def structured(schema, system, messages, max_tokens=16000, api_key=None):
        seen.append(api_key)
        return schema.model_validate(_quiz_json())

    monkeypatch.setattr(llm, "structured", structured)
    r = client.post("/api/quizzes", json=LIVE_BODY, headers={"X-Anthropic-Api-Key": "  sk-ant-visitor  "})
    assert r.status_code == 200 and r.json()["source"] == "live" and seen == ["sk-ant-visitor"]
    assert "sk-ant-visitor" not in r.text   # never echoed back, not even inside the token
    assert "sk-ant-visitor" not in str(Q._open(r.json()["token"]))
    # Without the header the same materials are refused again: nothing was remembered.
    assert client.post("/api/quizzes", json=LIVE_BODY).status_code == 503


def test_example_lab_never_spends_a_visitor_key(client, monkeypatch):
    def structured(*a, **k):
        raise AssertionError("the example lab must not call the model")

    monkeypatch.setattr(llm, "structured", structured)
    r = client.post("/api/quizzes", json=EXAMPLE, headers={"X-Anthropic-Api-Key": "sk-ant-visitor"})
    assert r.status_code == 200 and r.json()["source"] == "demo"


def test_demo_forced_ignores_visitor_keys(client, monkeypatch):
    monkeypatch.setenv("VIVA_DEMO", "1")
    r = client.post("/api/quizzes", json=LIVE_BODY, headers={"X-Anthropic-Api-Key": "sk-ant-visitor"})
    assert r.status_code == 503


def test_materials_validation(client):
    assert client.post("/api/quizzes", json={}).status_code == 422
    r = client.post("/api/quizzes", json={"manual": {"filename": "x.pdf", "pdf_base64": "not base64!!"}})
    assert r.status_code == 422 and "corrupted" in r.json()["detail"]
    dup = {"code_files": [{"filename": "a.py", "text": "x"}, {"filename": "a.py", "text": "y"}]}
    assert client.post("/api/quizzes", json=dup).status_code == 422


def test_demo_line_references_exist():
    n = len(demo_lab.CODE.splitlines())
    for q in demo_lab.QUIZ["questions"]:
        assert len(q["choices"]) == 4 and len(set(q["choices"])) == 4
        for r in q["code_lines"]:
            assert 1 <= r["start"] <= r["end"] <= n


# ---------------------------------------------------------------- live mode (stubbed model)

def _quiz_json(n=10, overrides=None):
    overrides = overrides or {}
    qs = []
    for i in range(n):
        q = {"type": ["conceptual", "code_reading", "debugging"][i % 3], "topic": f"Topic {i % 4}",
             "question": f"Question {i}?", "choices": [f"right {i}", f"wrong a{i}", f"wrong b{i}", f"wrong c{i}"],
             "correct_index": 0, "explanation": "because", "source_kind": "code" if i % 2 else "manual",
             "source_ref": "Section 1", "code_file": "loop.py" if i % 2 else None,
             "code_lines": [{"start": 2, "end": 2}] if i % 2 else []}
        q.update(overrides.get(i, {}))
        qs.append(q)
    return {"title": "Lab 1: Loops", "questions": qs}


LIVE_BODY = {"manual": {"filename": "lab1.md", "text": "# Lab 1\n## Section 1\nLoops repeat code."},
             "code_files": [{"filename": "loop.py", "text": "total = 0\nfor i in range(3):\n    total += i\nprint(total)\n"}]}


@pytest.fixture()
def live(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    replies, calls = [], []

    def structured(schema, system, messages, max_tokens=16000, api_key=None):
        calls.append((system, messages[0]["content"]))
        r = replies.pop(0)
        if isinstance(r, Exception):
            raise r
        return schema.model_validate(r)

    monkeypatch.setattr(llm, "structured", structured)
    return replies, calls


def test_live_quiz_is_validated_and_grounded(client, live):
    replies, calls = live
    replies.append(_quiz_json(overrides={1: {"code_lines": [{"start": 2, "end": 2}, {"start": 50, "end": 60}]},
                                         3: {"code_file": "src/loop.py"}}))
    qz = make(client, LIVE_BODY)
    assert qz["source"] == "live" and qz["model"] and len(qz["questions"]) == 10
    q1 = qz["questions"][1]
    assert q1["code"]["lines"] == [{"start": 2, "end": 2}]            # line 50-60 doesn't exist: dropped
    assert qz["questions"][3]["code"]["file"] == "loop.py"            # path prefix matched to the uploaded file
    system, user = calls[0]
    assert "Exactly 10 multiple-choice questions" in system and "NOT run the code" in system
    assert '<manual name="lab1.md">' in user and '<code file="loop.py">' in user and "   2 | for i in range(3):" in user


def test_live_retries_once_when_output_is_unusable(client, live):
    replies, calls = live
    replies.append(_quiz_json(n=7))                                        # too few
    replies.append(_quiz_json())
    qz = make(client, LIVE_BODY)
    assert len(qz["questions"]) == 10 and len(calls) == 2
    assert "only 7 usable questions" in calls[1][1]


def test_live_drops_invalid_questions_and_keeps_case_distinct_options(client, live):
    replies, _ = live
    q = _quiz_json(n=12, overrides={0: {"correct_index": 7}, 1: {"choices": ["a", "a", "b", "c"]},
                                    2: {"choices": ["`'sat'`", "`'Sat'`", "`'sat,'`", "`''`"]}})
    replies.append(q)
    qz = make(client, LIVE_BODY)
    texts = [x["question"] for x in qz["questions"]]
    assert "Question 0?" not in texts and "Question 1?" not in texts and "Question 2?" in texts
    assert len(texts) == 10


def test_live_gives_up_after_second_bad_output(client, live):
    replies, _ = live
    bad = _quiz_json(overrides={i: {"choices": ["same", "same", "x", "y"]} for i in range(5)})
    replies.extend([bad, bad])
    r = client.post("/api/quizzes", json=LIVE_BODY)
    assert r.status_code == 502 and r.json()["retryable"] is True


def test_live_model_error_is_retryable(client, live):
    replies, _ = live
    replies.append(llm.LLMError("The model took too long to respond. Try again."))
    r = client.post("/api/quizzes", json=LIVE_BODY)
    assert r.status_code == 502 and r.json() == {"detail": "The model took too long to respond. Try again.", "retryable": True}


def test_live_pdf_manual_is_extracted(client, live):
    import pymupdf

    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), "Section 3: Recursion needs a base case.")
    replies, calls = live
    replies.append(_quiz_json())
    body = {"manual": {"filename": "lab.pdf", "pdf_base64": base64.b64encode(doc.tobytes()).decode()}, "code_files": LIVE_BODY["code_files"]}
    make(client, body)
    assert "Recursion needs a base case" in calls[0][1]


def test_real_client_connection_failure_is_friendly(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "http://127.0.0.1:9")
    monkeypatch.setattr(llm, "_client", None)
    from models import QuizOut

    with pytest.raises(llm.LLMError) as e:
        llm.structured(QuizOut, "sys", [{"role": "user", "content": "hi"}])
    assert e.value.retryable
    monkeypatch.setattr(llm, "_client", None)
