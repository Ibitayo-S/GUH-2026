import { useState } from "react";
import { api, ApiError } from "./api";
import { ErrorBox, Spinner } from "./components/Bits";
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
    try {
      startQuiz(await api.create(req));
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
      setResults(await api.submit(quiz.quiz_id, answers));
      setScreen("results");
      top();
    } catch (e) {
      const err = e as ApiError;
      setError({ title: "Your answers couldn't be marked", message: `${err.message} Your answers are still here.`, retryable: true, retry: submit });
    } finally { setBusy(false); }
  }

  async function retake() {
    if (!results) return;
    setBusy(true);
    setError(null);
    try { startQuiz(await api.retake(results.quiz_id)); }
    catch (e) { setError({ title: "The retake couldn't be started", message: (e as ApiError).message, retryable: false }); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b-2 border-[#ece9f5] bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <button onClick={() => { setScreen("setup"); setError(null); }} className="flex items-center gap-2" aria-label="Viva home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 shadow-[0_3px_0_0_var(--color-brand-800)]">
              <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden><path d="M9 10l7 13 7-13" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span className="text-2xl font-black tracking-tight text-brand-700">viva</span>
          </button>
          <span className="hidden text-sm font-bold text-slate-400 sm:inline">Active recall quizzes from your labs</span>
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-4 max-w-3xl px-4">
          <ErrorBox title={error.title} message={error.message} retryable={error.retryable} onRetry={error.retry} />
        </div>
      )}

      {screen === "setup" && <Setup initial={materials} onGenerate={generate} />}
      {screen === "generating" && (
        <Spinner label="Writing your 10-question quiz…"
          sub="Viva is reading the manual and your code to write questions that test recall. This usually takes 20–60 seconds with a live model." />
      )}
      {screen === "quiz" && quiz && (
        <QuizView key={quiz.quiz_id} quiz={quiz} answers={answers} setAnswers={setAnswers} submitting={busy} onSubmit={submit} />
      )}
      {screen === "results" && results && (
        <ResultsView results={results} busy={busy} onRetake={retake}
          onNewQuiz={() => materials && generate(materials)} onStartOver={() => { setScreen("setup"); top(); }} />
      )}
    </div>
  );
}
