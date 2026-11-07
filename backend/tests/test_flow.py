"""Phase 2 gate: the full guided-learning viva works end to end with no API key."""
from assessor import keyword_assess
from lab import load_lab


def start(client, code):
    r = client.post("/api/sessions", json={"lab_id": "bfs-grid", "code": code})
    assert r.status_code == 200, r.text
    return r.json()


def post(client, sid, path, body=None):
    r = client.post(f"/api/sessions/{sid}/{path}", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def learn(client, sid, action, choice=None):
    return post(client, sid, "learn", {"action": action, "check_choice": choice})


def correct_choice(lab, concept, check_id):
    chk = next(c for c in lab.lesson(concept).checks if c.id == check_id)
    return next(c.id for c in chk.choices if c.correct)


def wrong_choice(lab, concept, check_id, prereq=False):
    chk = next(c for c in lab.lesson(concept).checks if c.id == check_id)
    return next(c.id for c in chk.choices if not c.correct and bool(c.reveals_prereq) == prereq)


def test_full_demo_flow(client, sample_code):
    lab = load_lab("bfs-grid")
    v = start(client, sample_code)
    sid = v["session_id"]
    assert v["mode"] == "mock"

    # 1. First question targets the visited-on-dequeue issue and highlights its lines.
    q = v["question"]
    assert q["concept_id"] == "visited_set"
    assert {17, 25} <= set(q["code_lines"])
    assert "Line 17" in q["text"] and "line 25" in q["text"]
    assert any(f["id"] == "visited_on_dequeue" for f in v["findings"])

    # 2. "I don't understand" opens learning and is NOT scored.
    v = post(client, sid, "confused")
    assert v["phase"] == "learning"
    assert v["lesson"]["step_kind"] == "intuition"

    # 3. The path goes beginner -> example -> trace -> mistake -> your code -> check.
    kinds = [v["lesson"]["step_kind"]]
    for _ in range(5):
        v = learn(client, sid, "next")
        kinds.append(v["lesson"]["step_kind"])
    assert kinds == ["intuition", "example", "trace", "mistake", "your_code", "check"]
    # Trace and mistake steps carry step-by-step frames.
    # The your_code step names the student's own lines.
    assert v["lesson"]["check"] is not None

    # 4. A wrong check adapts: targeted explanation + another explanation, then a new check.
    first_check = v["lesson"]["check"]["id"]
    v = learn(client, sid, "answer_check", wrong_choice(lab, "visited_set", first_check))
    assert v["lesson"]["step_kind"] == "alt"
    assert v["lesson"]["check_result"]["correct"] is False
    v = learn(client, sid, "check")
    second_check = v["lesson"]["check"]["id"]
    assert second_check != first_check

    # 5. A correct check -> recap with an invitation to retry.
    v = learn(client, sid, "answer_check", correct_choice(lab, "visited_set", second_check))
    assert v["lesson"]["step_kind"] == "recap"
    assert v["lesson"]["controls"][0] == "return"

    # 6. Return to the original question and answer it.
    v = learn(client, sid, "return")
    assert v["phase"] == "asking"
    assert v["question"]["concept_id"] == "visited_set"
    assert v["question"]["attempt"] == 1  # the "I don't understand" earlier was not an attempt
    strong = lab.demo_answers["visited_set"][1].answer
    v = post(client, sid, "answer", {"answer": strong})
    assert v["feedback"]["score"] == 2 and v["feedback"]["source"] == "demo"

    # 7. Continue through the other two concepts with free-text (fallback-scored) answers.
    v = post(client, sid, "continue")
    assert v["question"]["concept_id"] == "queue_fifo"
    v = post(client, sid, "answer", {"answer": "pop() would grab the newest cell instead, so the order changes."})
    assert v["feedback"]["score"] == 1 and v["feedback"]["source"] == "fallback"
    assert v["offer_learning"] and v["can_retry"]
    v = post(client, sid, "continue")
    assert v["question"]["concept_id"] == "shortest_path_guarantee"
    v = post(client, sid, "answer", {"answer": "It checks all paths and picks the minimum."})
    assert v["feedback"]["score"] == 0
    v = post(client, sid, "continue")
    assert v["phase"] == "done"

    # 8. Report: code-linked, evidence-backed, a next step for every gap.
    rep = client.get(f"/api/sessions/{sid}/report").json()
    by = {c["concept_id"]: c for c in rep["concepts"]}
    assert by["visited_set"]["status"] == "strong" and by["visited_set"]["used_learning"]
    assert by["visited_set"]["checks_total"] == 2 and by["visited_set"]["checks_correct"] == 1
    assert "line 25" in by["visited_set"]["next_step"]  # finding-specific fix even when strong
    for c in rep["concepts"]:
        assert c["code_lines"], c["concept_id"]
        assert c["evidence"], c["concept_id"]
        if c["status"] != "strong":
            assert c["next_step"], c["concept_id"]
    assert rep["any_fallback"] is True
    assert "Shortest-path guarantee" in rep["revisit"]


def test_wrong_answer_offers_learning_then_retry(client, sample_code):
    lab = load_lab("bfs-grid")
    sid = start(client, sample_code)["session_id"]
    v = post(client, sid, "answer", {"answer": lab.demo_answers["visited_set"][0].answer})
    assert v["phase"] == "feedback" and v["feedback"]["score"] == 0
    assert v["offer_learning"] is True
    assert v["feedback"]["evidence"]
    v = post(client, sid, "confused")
    assert v["phase"] == "learning"
    v = learn(client, sid, "return")
    assert v["question"]["attempt"] == 2


def test_typed_i_dont_know_is_not_scored(client, sample_code):
    sid = start(client, sample_code)["session_id"]
    v = post(client, sid, "answer", {"answer": "honestly I don't know"})
    assert v["phase"] == "learning"
    assert v["notice"] and "isn't counted" in v["notice"]
    rep = client.get(f"/api/sessions/{sid}/report").json()
    assert all(not c["attempts"] for c in rep["concepts"])


def test_controls_jump_and_simpler_cycles(client, sample_code):
    sid = start(client, sample_code)["session_id"]
    v = post(client, sid, "confused")
    assert set(["simpler", "example", "walkthrough", "check", "return"]) <= set(v["lesson"]["controls"])
    v = learn(client, sid, "walkthrough")
    assert v["lesson"]["step_kind"] == "trace" and v["lesson"]["trace"]["frames"]
    a = learn(client, sid, "simpler")["lesson"]
    b = learn(client, sid, "simpler")["lesson"]
    assert a["step_kind"] == b["step_kind"] == "alt" and a["title"] != b["title"]
    v = learn(client, sid, "example")
    assert v["lesson"]["code"]
    v = learn(client, sid, "check")
    assert v["lesson"]["check"]["choices"]


def test_prerequisite_detour_and_resume(client, sample_code):
    lab = load_lab("bfs-grid")
    sid = start(client, sample_code)["session_id"]
    post(client, sid, "confused")
    v = learn(client, sid, "check")
    assert v["lesson"]["check"]["id"] == "v1"
    v = learn(client, sid, "answer_check", wrong_choice(lab, "visited_set", "v1", prereq=True))
    assert v["lesson"]["step_kind"] == "prereq" and v["lesson"]["prereq_offer"] == "queue_fifo"
    v = learn(client, sid, "learn_prereq")
    assert v["lesson"]["concept_id"] == "queue_fifo" and v["lesson"]["detour_from"] == "visited_set"
    v = learn(client, sid, "check")
    v = learn(client, sid, "answer_check", correct_choice(lab, "queue_fifo", v["lesson"]["check"]["id"]))
    assert v["lesson"]["step_kind"] == "recap" and "resume" in v["lesson"]["controls"]
    v = learn(client, sid, "resume")
    assert v["lesson"]["concept_id"] == "visited_set" and v["lesson"]["step_kind"] == "check"
    assert v["lesson"]["check"]["id"] != "v1"


def test_your_code_step_names_student_lines(client, sample_code):
    sid = start(client, sample_code)["session_id"]
    post(client, sid, "confused")
    for _ in range(4):
        v = learn(client, sid, "next")
    assert v["lesson"]["step_kind"] == "your_code"
    assert "line 17" in v["lesson"]["body"] and "line 25" in v["lesson"]["body"]
    assert "still shortest" in v["lesson"]["body"]


def test_rubric_calibration_examples_score_as_labelled():
    lab = load_lab("bfs-grid")
    for cid, rubric in lab.rubric.items():
        for ex in rubric.examples:
            got = keyword_assess(rubric, ex.answer).score
            assert got == ex.score, f"{cid}: {ex.answer!r} scored {got}, labelled {ex.score}"


def test_correct_bfs_starts_with_prerequisites(client):
    code = (
        "from collections import deque\n"
        "def bfs(g, s, goal):\n"
        "    q = deque([s]); seen = {s}\n"
        "    while q:\n"
        "        u = q.popleft()\n"
        "        if u == goal: return True\n"
        "        for v in g[u]:\n"
        "            if v not in seen:\n"
        "                seen.add(v)\n"
        "                q.append(v)\n"
    )
    v = start(client, code)
    assert v["question"]["concept_id"] == "queue_fifo"
    assert v["findings"] == []


def test_unparseable_and_non_bfs_code_still_works(client):
    v = start(client, "def broken(:\n    queue.popleft()\n")
    assert v["phase"] == "asking" and v["notice"]
    v = start(client, "print('hello')\n")
    assert v["phase"] == "asking" and "couldn't find" in v["notice"]


def test_errors(client, sample_code):
    assert client.post("/api/sessions/nope/answer", json={"answer": "x"}).status_code == 404
    assert client.post("/api/sessions", json={"lab_id": "nope", "code": "x"}).status_code == 404
    sid = start(client, sample_code)["session_id"]
    assert client.post(f"/api/sessions/{sid}/learn", json={"action": "next"}).status_code == 409
    post(client, sid, "confused")
    r = client.post(f"/api/sessions/{sid}/learn", json={"action": "answer_check", "check_choice": "a"})
    assert r.status_code == 422  # not on a check step


def test_lab_endpoint_exposes_sample_and_demo_answers(client):
    lab = client.get("/api/labs/bfs-grid").json()
    assert "def shortest_path" in lab["sample_code"]
    assert set(lab["demo_answers"]) == {"queue_fifo", "visited_set", "shortest_path_guarantee"}
