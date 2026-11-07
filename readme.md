# Viva: understand your own code

> Upload your code. Viva finds where your understanding breaks, teaches the missing idea step by step, then checks that you can apply it.

Viva is a short, private, Duolingo-style viva on a student's **own** submission. It asks about specific lines of their code. When the student is stuck ("I don't understand", or a wrong answer), Viva switches to a guided learning path: a plain-language idea → a tiny code example → a step-by-step queue trace → a common mistake → back to *their* lines → a low-pressure check. Then the student retries the original question. A code-linked report closes the session.

It's formative and student-initiated. It is an understanding check, not a cheating detector. Submitted code is **read as text and never executed** (it is only parsed with Python's `ast`).

Built for Reply Student Tech Clash, "AI on Campus" (University of Manchester, 2026).

## Quick start

Needs Python 3.11+ (tested on 3.14) and Node 20+ (tested on 25).

**Backend** (terminal 1):
```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate      macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend** (terminal 2):
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. The Vite dev server proxies `/api` to port 8000.

**One-port option:** run `npm run build` in `frontend/`, then start the backend. FastAPI also serves the built app at http://localhost:8000.

## Mock mode vs live model

| | Mock mode (default) | Live mode |
|---|---|---|
| Enabled when | no `OPENAI_API_KEY`, or `VIVA_MOCK=1` | `OPENAI_API_KEY` set in `.env` |
| Questions, lessons, traces, checks | authored (`backend/labs/bfs-grid/*.json`) | same, all authored |
| Scoring free-text answers | rubric keyword fallback | model (temp 0.2, rubric + labelled examples), falling back on any error |
| "Back to your code" step | authored template filled with the student's line numbers | model-personalised, must cite a highlighted line or the template is used |
| Scripted demo answers | planned feedback ("Demo fixture") | same |

The UI always says where content came from: a **Mock mode** banner and badge, plus per-card labels **AI assessed**, **Fallback scoring**, **Demo fixture** or **Authored content**.

To go live, copy `.env.example` to `.env` in the repo root, set `OPENAI_API_KEY`, and restart the backend. The key is read only by the backend (`backend/config.py` → `backend/llm.py`) and never reaches the browser. `OPENAI_MODEL` defaults to `gpt-4.1-mini`.

## Demo script (about 3 minutes, works offline)

1. Click **Use sample BFS solution** → **Start my viva**. The sample passes its tests but marks cells visited when they are *dequeued* (line 17).
2. Viva asks about line 17 vs line 25, highlighted on the left.
3. Click **I don't understand**. Learning mode starts and it is *not scored*.
4. **Continue** through: chalk-marks idea → example → walkthrough (step the queue) → the late-marking mistake (watch D get queued twice) → your code (lines 17, 14 and 25).
5. Answer the check question wrongly. Viva explains why and offers another way of seeing it, then asks a *different* check. Answer it right, then click **Retry my question**.
6. Use the **Strong answer** presenter chip (or type your own) → feedback with evidence quoted from the answer.
7. FIFO queue: try the **Weak answer**, then **Try again** with the strong one. For the shortest-path question, try answering "Yes, always" on the stack check to see the **prerequisite detour** to FIFO queues and back.
8. The report shows strengths, gaps, evidence, the student's lines and one concrete next step each. It includes the fix for line 17, phrased accurately: duplicates and extra work, not a wrong answer.

You can also upload any `.py` file. A BFS that uses `pop()` gets a FIFO-first viva about its own `pop()` line.

## How it works

```
frontend/ (React + TS + Vite + Tailwind)        backend/ (FastAPI + Pydantic)
  Submit → Viva → Report                          analyzer.py   ast-only line mapping + findings
  CodeView (highlighted lines)                    session.py    asking → feedback ⇄ learning → done
  LessonPanel, QueueTrace, CheckQuestion          lessons.py    guided path + adaptive checks + detour
  api.ts / types.ts  ← typed contract →           assessor.py   demo match → live model → rubric fallback
                                                  llm.py        the only model call site; None on any failure
                                                  labs/bfs-grid/ lab, questions, rubric, lessons, demo answers
```

- **Contract:** [`docs/CONTRACT.md`](docs/CONTRACT.md), `backend/models.py` and `frontend/src/types.ts` (keep all three in sync).
- **Lab content lives in data files**, not prompts: `lab.json` (3 concepts and prerequisites), `questions.json`, `rubric.json` (levels, key points, misconceptions, labelled calibration examples), `lessons.json` (steps, traces, checks, alternative explanations), `demo_answers.json`.
- **Adaptivity:** the first concept is where the code suggests understanding may break (for example, visited-on-dequeue → Visited set). A wrong check → targeted explanation + an alternative explanation + a different check. A wrong check that reveals a prerequisite gap → optional detour, then back.

## Tests

```bash
cd backend
pytest -q
```
The tests cover the data validation, the full guided flow end to end without a key, the prerequisite detour, typed "I don't know" not being scored, rubric calibration (every labelled example scores as labelled), and the live-model paths with a stubbed model (valid output used and labelled; timeouts, bad scores or unquoted evidence fall back).

## Known limits

- One lab (BFS on a grid) and three concepts: `queue_fifo`, `visited_set`, `shortest_path_guarantee`.
- Sessions are kept in memory, so restarting the backend ends open sessions (the UI shows an error; start a new viva).
- Fallback scoring is keyword-based. It's calibrated on the rubric examples, but it can miss unusual phrasings. The live model is better at this.
- The analyzer recognises common BFS shapes (`deque`, `popleft`/`pop`, a `visited`/`seen` set). Unusual code still works, with a notice and less specific line links.
- The live-model path is covered by stubbed tests but was not run against a real key during development.
- Out of scope: auth, class heatmap, extra labs, running student code, deployment.
