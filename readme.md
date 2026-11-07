# GUH 2026: Viva

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
| `VIVA_DEMO` | unset | `1` ignores all keys and serves the example lab's prewritten quiz (e.g. on unreliable Wi-Fi) |
| `VIVA_SECRET` | dev value | Encrypts each quiz's answer key. **Set a long random string in production** |

**Note:** if `ANTHROPIC_API_KEY` is set in your user environment, the backend uses it automatically and runs in live mode. Each quiz is one model call, or two if the first output fails validation.

## Modes

| Mode | When | Behaviour |
|---|---|---|
| **Live, server key** (badge: *AI-written · model*) | `ANTHROPIC_API_KEY` set on the server | Generates a quiz for **any** manual + code |
| **Live, visitor's key** | No server key; the visitor pastes their own key in the app | Generates a quiz for their materials using **their** key |
| **Demo** (badge: *Demo · prewritten quiz*) | No server key, and the example lab (*Use the example lab*) | Serves a hand-written 10-question quiz for that lab. Nothing is generated, and no key is used even if one was pasted |
| **Needs a key** | No server key, no visitor key, other materials | Clear message asking for a key. Viva never fakes a quiz |

### Bring your own key
When the server has no key, the setup screen shows an optional **Anthropic API key** field:
- The key is kept in that browser tab only (`sessionStorage`), so it's gone when the tab closes.
- It's sent only as the `X-Anthropic-Api-Key` header of the generate request, over HTTPS when deployed.
- The server uses it for that single call and never stores it, logs it, echoes it back or puts it in the quiz token.
- The example lab never uses it.

## Deploy on Vercel

The backend is stateless, so it runs as a Vercel Python function. Each quiz's answer key travels with the student as an encrypted token (Fernet, keyed by `VIVA_SECRET`) instead of being kept in server memory. The frontend is served as static files.

Files: [`vercel.json`](vercel.json) (build, routing, function timeout), [`api/index.py`](api/index.py) (exposes the FastAPI app), [`requirements.txt`](requirements.txt) (runtime Python packages), [`.vercelignore`](.vercelignore).

1. In Vercel: **Add New → Project → Import** `Ibitayo-S/GUH-2026`. Leave **Root Directory** as the repo root and **Framework Preset** as *Other*. `vercel.json` sets the build.
2. **Environment Variables**, Production:
   - `VIVA_SECRET`: required. Use any long random string, e.g. the output of `python -c "import secrets; print(secrets.token_urlsafe(32))"`.
   - `ANTHROPIC_API_KEY`: leave **unset** to have visitors bring their own key, or set it to pay for every quiz yourself.
3. **Deploy.** Every push to `main` redeploys automatically.

Vercel limits:
- **Request size:** request bodies are capped at 4.5 MB, so the app limits PDF manuals to 3 MB.
- **Function time:** quiz generation can take up to ~60 s. `vercel.json` allows 300 s, which Vercel's current Hobby plan supports with Fluid Compute. If your plan rejects it, lower `maxDuration` and set `VIVA_EFFORT=low`.

## How it works

```
frontend/ (React + TypeScript + Vite + Tailwind)        backend/ (FastAPI + Pydantic)
  Setup: manual (PDF/MD/TXT or paste) + code files        main.py       routes: /api/quizzes, /submit, /retake, /example
         + optional own API key                          materials.py  PDF text extraction (PyMuPDF), size checks, numbering
  Quiz: answer sheet, no feedback until hand-in          prompts.py    quiz prompt (adapted from backend/prompt.txt)
  Results: red-pen marked sheet, answers + sources       llm.py        the only model call: Anthropic Messages API, structured output
  api.ts / types.ts  ← typed contract →                  quiz.py       validation, shuffling, encrypted quiz tokens, marking, retakes
                                                         demo_lab.py   example lab manual + code + prewritten quiz
api/index.py  → Vercel entry point for backend/main.py
```

- **Generation:** one `client.beta.messages.parse` call with the `QuizOut` Pydantic schema. The manual and the numbered code files go in the prompt. Server-side refusal fallbacks (`fallbacks: "default"`) are enabled.
- **Validation:** each question needs exactly 4 distinct options, compared exactly so `'sat'` and `'Sat'` count as different, plus a valid correct option. Code line references are checked against the uploaded file: out-of-range ones are dropped, overlong ones clamped. If fewer than 10 questions survive, Viva retries once and tells the model what was wrong; after that it returns a retryable error.
- **Fairness:** options are shuffled on the server, so the answer isn't always "A". The answer key travels inside an encrypted, tamper-proof token, so the browser can't read it before submitting or forge a different one.
- **Grounding rules** in the prompt: answerable from the materials, no trivia, plausible distractors based on real misconceptions, never claim to have run the code, label hypothetical changes as hypothetical.

### API
| Route | Body | Returns |
|---|---|---|
| `POST /api/quizzes` | `{manual: {filename, text \| pdf_base64}, code_files: [{filename, text}]}`, optional header `X-Anthropic-Api-Key` | Quiz with `token` (no answers) · 422 bad input · 503 needs a key · 502 model error (`retryable`) |
| `POST /api/quizzes/submit` | `{token, answers: [index \| null] × n}` | Results (answers revealed) · 409 expired or invalid token |
| `POST /api/quizzes/retake` | `{token, answers}` | New quiz with only the missed questions (409 if all correct) |
| `GET /api/health` | none | `{live, model, demo_forced, accepts_user_key}` |
| `GET /api/example` | none | The example lab's manual and code |

## Tests

```bash
cd backend
pytest -q
```
19 tests, run without network:
- **Demo quiz:** has 10 questions, hides the answers and shuffles the options;
- **Tokens:** the answer key is encrypted, and tampered tokens are rejected;
- **Your own key:** a visitor's key is used for that request only (never echoed or stored), the example lab never spends it, and `VIVA_DEMO` ignores it;
- **Marking:** scores and reveals the answers; retakes contain only the missed questions;
- **Bad input:** bad submissions and bad materials are rejected; no-key mode is honest;
- **Live path (stubbed model):** validation and grounding; retry and give-up on bad output; invalid questions dropped and case-distinct options kept; retryable errors;
- **PDF manuals:** text is extracted;
- **Real client:** connection errors are reported in plain language.

## Known limitations

- **Demo mode only knows the example lab.** Other materials need a key (the server's, or the visitor's own).
- **Live generation** has been used with real quizzes, and the tests cover it with a stubbed model. Model-written questions can still be imperfect; the sources shown with each answer let students check them.
- **Bring-your-own-key trust:** visitors have to trust whoever runs the deployment with their key for that one request. The code never stores it, but a modified deployment could.
- **Scanned PDFs** (images without a text layer) can't be read. Paste the text instead.
- **Size limits:** the manual is limited to 300,000 characters and the code to 200,000 characters (up to 20 files).
- **Quiz lifetime:** quiz tokens expire after 7 days, and changing `VIVA_SECRET` invalidates any open quizzes.
- **Out of scope:** accounts, progress across sessions, and spaced repetition.

## Other code in this repo

`backend/parse.py` + `backend/prompt.txt` are Ibitayo's original CLI generator (manual + code → 10 open questions as JSON). They're kept unchanged; the web app's prompt is adapted from them.
