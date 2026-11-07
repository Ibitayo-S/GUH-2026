import { useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { ErrorBox, Generating } from "./components/Bits";
import { QuizView } from "./screens/QuizView";
import { ResultsView } from "./screens/ResultsView";
import { Setup } from "./screens/Setup";
import type { Quiz, QuizRequest, Results } from "./types";

type Screen = "setup" | "generating" | "quiz" | "results";

export default function App() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [materials, setMaterials] = useState<QuizRequest | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [results, setResults] = useState<Results | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; message: string; retryable: boolean; retry?: () => void } | null>(null);
  const [serverHasKey, setServerHasKey] = useState(false);
  // A visitor's own key lives only in this tab (sessionStorage), never on the server.
  const [apiKey, setApiKeyState] = useState(() => { try { return sessionStorage.getItem("viva.apiKey") ?? ""; } catch { return ""; } });
  const setApiKey = (k: string) => {
    setApiKeyState(k);
    try { if (k) sessionStorage.setItem("viva.apiKey", k); else sessionStorage.removeItem("viva.apiKey"); } catch { /* storage unavailable */ }
  };

  // Hide the key field when the server has its own key, or ignores keys (demo forced).
  useEffect(() => { api.health().then((h) => setServerHasKey(h.live || !h.accepts_user_key)).catch(() => {}); }, []);

  const top = () => window.scrollTo({ top: 0 });

  function startQuiz(q: Quiz) {
    setQuiz(q);
    setAnswers(q.questions.map(() => null));
    setResults(null);
    setScreen("quiz");
    top();
  }

  async function generate(req: QuizRequest) {
    setMaterials(req);
    setError(null);
    setScreen("generating");
    top();
    try {
      startQuiz(await api.create(req, serverHasKey ? undefined : apiKey || undefined));
    } catch (e) {
      const err = e as ApiError;
      setError({ title: "The quiz couldn't be generated", message: err.message, retryable: err.retryable, retry: () => generate(req) });
      setScreen("setup");
    }
  }

  async function submit() {
    if (!quiz) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await api.submit(quiz, answers));
      setScreen("results");
      top();
    } catch (e) {
      setError({ title: "Your answers couldn't be marked", message: `${(e as ApiError).message} Your answers are still filled in.`, retryable: true, retry: submit });
    } finally { setBusy(false); }
  }

  async function retake() {
    if (!results || !quiz) return;
    setBusy(true);
    setError(null);
    try { startQuiz(await api.retake(quiz, answers)); }
    catch (e) { setError({ title: "The retake couldn't start", message: (e as ApiError).message, retryable: false }); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <button onClick={() => { setScreen("setup"); setError(null); }} className="flex items-center gap-2.5" aria-label="Viva, back to your materials">
            <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden>
              <circle cx="9" cy="11" r="7.5" fill="none" stroke="var(--color-form)" strokeWidth="2" />
              <circle cx="21" cy="11" r="7.5" fill="var(--color-ink)" />
            </svg>
            <span className="display-wide text-[1.35rem] leading-none tracking-[-0.03em]">viva</span>
          </button>
          <span className="form-label hidden sm:inline">Recall quizzes for lab work</span>
          {screen === "quiz" && quiz && <span className="ml-auto text-[0.85rem] text-muted">{quiz.is_retake ? "Retake" : "Quiz in progress"}</span>}
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-5 max-w-3xl px-4">
          <ErrorBox title={error.title} message={error.message} retryable={error.retryable} onRetry={error.retry} />
        </div>
      )}

      <main>
        {screen === "setup" && (
          <Setup initial={materials} onGenerate={generate} apiKey={apiKey} setApiKey={setApiKey} serverHasKey={serverHasKey} />
        )}
        {screen === "generating" && <Generating />}
        {screen === "quiz" && quiz && (
          <QuizView key={quiz.quiz_id} quiz={quiz} answers={answers} setAnswers={setAnswers} submitting={busy} onSubmit={submit} />
        )}
        {screen === "results" && results && (
          <ResultsView results={results} busy={busy} onRetake={retake}
            onNewQuiz={() => materials && generate(materials)} onStartOver={() => { setScreen("setup"); top(); }} />
        )}
      </main>
    </div>
  );
}
