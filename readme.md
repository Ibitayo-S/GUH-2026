# GUH 2026: Viva (Ibi, temmulain, Uzair)

> Upload a lab manual and your code. Get a 10-question quiz that makes you recall what you learned.

Viva turns a university programming lab into an **active-recall quiz**. A student uploads the lab manual and the code they wrote for it, and Viva writes **10 multiple-choice questions** from those materials:

- **Concept** questions on the ideas in the manual;
- **Code reading** questions on what *their* code does and why (citing real line numbers);
- **Debugging** questions on what would break, or what a change would do.

The student answers all ten from memory, with **no feedback until they submit**. The correct answers stay on the server until then. After submitting they see:
- their score, broken down by question type;
- the topics to review;
- for every question: the right answer, an explanation, and where it comes from (a manual section, or file and lines with an excerpt).

**Retake the ones I missed** re-asks only the missed questions with the options reshuffled.

Code is read as text and **never executed**. Quizzes live only in memory (no accounts).

## Setup

Needs Python 3.11+ (tested on 3.14) and Node 20+ (tested on 25).

**Backend:**
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate    macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend** (in a second terminal):
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 (Vite proxies `/api` to port 8000).

**One-port option:** run `npm run build` in `frontend/` once; the backend then also serves the app at http://localhost:8000.

## Environment variables

Set these in your environment or in a `.env` file in the repo root (see [`.env.example`](.env.example)). Only the backend reads them; the browser never sees the key.

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Enables **live mode** (`ANTHROPIC_AUTH_TOKEN` also works) |
| `VIVA_MODEL` | `claude-sonnet-5-5` | Model ID (same default as `backend/parse.py`) |
| `VIVA_EFFORT` | `medium` | Model effort: `low` is faster, `high` writes more careful distractors |
| `VIVA_TIMEOUT` | `180` | Seconds before a generation request gives up |
| `VIVA_DEMO` | unset | `1` ignores the key and serves the example lab's prewritten quiz (e.g. on unreliable Wi-Fi) |

**Note:** if `ANTHROPIC_API_KEY` is set in your user environment, the backend uses it automatically and runs in live mode. Each quiz is one model call, or two if the first output fails validation.

## Modes

| Mode | When | Behaviour |
|---|---|---|
| **Live** (badge: *AI generated · model*) | A key is set and `VIVA_DEMO` isn't | Generates a quiz for **any** manual + code |
| **Demo** (badge: *Demo · prewritten quiz*) | No key (or `VIVA_DEMO=1`) **and** the materials are the built-in example lab (*Use the example lab*) | Serves a hand-written 10-question quiz for that lab. Nothing is generated |
| **No model** | No key, other materials | Clear message that a model is needed. Viva never fakes a quiz |

## How it works

```
frontend/ (React + TypeScript + Vite + Tailwind)        backend/ (FastAPI + Pydantic)
  Setup: manual (PDF/MD/TXT or paste) + code files        main.py       routes: /api/quizzes, /submit, /retake, /example
  Quiz: one question at a time, no feedback              materials.py  PDF text extraction (PyMuPDF), size checks, numbering
  Results: score, review topics, answers + sources       prompts.py    quiz prompt (adapted from backend/prompt.txt)
  api.ts / types.ts  ← typed contract →                  llm.py        the only model call: Anthropic Messages API, structured output
                                                         quiz.py       validation, option shuffling, storage, marking, retakes
                                                         demo_lab.py   example lab manual + code + prewritten quiz
```

- **Generation:** one `client.beta.messages.parse` call with the `QuizOut` Pydantic schema. The manual and the numbered code files go in the prompt. Server-side refusal fallbacks (`fallbacks: "default"`) are enabled.
- **Validation:** each question needs exactly 4 distinct options, compared exactly so `'sat'` and `'Sat'` count as different, plus a valid correct option. Code line references are checked against the uploaded file: out-of-range ones are dropped, overlong ones clamped. If fewer than 10 questions survive, Viva retries once and tells the model what was wrong; after that it returns a retryable error.
- **Fairness:** options are shuffled on the server, so the answer isn't always "A", and correct answers are only sent after submission.
- **Grounding rules** in the prompt: answerable from the materials, no trivia, plausible distractors based on real misconceptions, never claim to have run the code, label hypothetical changes as hypothetical.

### API
| Route | Body | Returns |
|---|---|---|
| `POST /api/quizzes` | `{manual: {filename, text \| pdf_base64}, code_files: [{filename, text}]}` | Quiz (no answers) · 422 bad input · 503 no model · 502 model error (`retryable`) |
| `POST /api/quizzes/{id}/submit` | `{answers: [index \| null] × n}` | Results (answers revealed) |
| `POST /api/quizzes/{id}/retake` | none | New quiz with only the missed questions (409 before submitting or if all correct) |
| `GET /api/example` | none | The example lab's manual and code |

## Tests

```bash
cd backend
pytest -q
```
16 tests, run without network:
- **Demo quiz:** has 10 questions, hides the answers and shuffles the options;
- **Marking:** scores, reveals the answers and is idempotent; retakes contain only the missed questions;
- **Bad input:** bad submissions and bad materials are rejected; no-key mode is honest;
- **Live path (stubbed model):** validation and grounding; retry and give-up on bad output; invalid questions dropped and case-distinct options kept; retryable errors;
- **PDF manuals:** text is extracted;
- **Real client:** connection errors are reported in plain language.

## Known limitations

- **Demo mode only knows the example lab.** Other materials need a key.
- **Live generation** was exercised with real calls during development (on the earlier explainer version), and the quiz path is covered with a stubbed model. Model-written questions can still be imperfect; the sources shown with each answer let students check them.
- **Scanned PDFs** (images without a text layer) can't be read. Paste the text instead.
- **Size limits:** the manual is limited to 300,000 characters and the code to 200,000 characters (up to 20 files).
- **In-memory storage:** restarting the backend loses open quizzes.
- **Out of scope:** accounts, progress across sessions, and spaced repetition.

## Other code in this repo

`backend/parse.py` + `backend/prompt.txt` are Ibitayo's original CLI generator (manual + code → 10 open questions as JSON). They're kept unchanged; the web app's prompt is adapted from them.
