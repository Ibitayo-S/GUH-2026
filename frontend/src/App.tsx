<<<<<<< HEAD
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { ModeBadge } from "./components/SourceBadge";
import { Report } from "./screens/Report";
import { Submit } from "./screens/Submit";
import { Viva } from "./screens/Viva";
import type { LabView, LearnAction, Report as ReportT, SessionView } from "./types";

type Screen = "submit" | "viva" | "report";

export default function App() {
  const [screen, setScreen] = useState<Screen>("submit");
  const [lab, setLab] = useState<LabView | null>(null);
  const [code, setCode] = useState("");
  const [filename, setFilename] = useState("my_solution.py");
  const [view, setView] = useState<SessionView | null>(null);
  const [report, setReport] = useState<ReportT | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.lab().then(setLab).catch((e) => setError(e.message));
  }, []);

  const run = useCallback(async (fn: () => Promise<SessionView>) => {
    setBusy(true);
    setError(null);
    try {
      const v = await fn();
      setView(v);
      if (v.phase === "done") {
        setReport(await api.report(v.session_id));
        setScreen("report");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const sid = view?.session_id ?? "";
  const actions = {
    answer: (t: string) => run(() => api.answer(sid, t)),
    confused: () => run(() => api.confused(sid)),
    learn: (a: LearnAction, c?: string) => run(() => api.learn(sid, a, c)),
    retry: () => run(() => api.retry(sid)),
    next: () => run(() => api.next(sid)),
  };

  function start(c: string, name: string) {
    setCode(c);
    setFilename(name);
    run(async () => {
      const v = await api.start(c);
      setScreen("viva");
      window.scrollTo({ top: 0 });
      return v;
    });
  }

  function restart() {
    setScreen("submit");
    setView(null);
    setReport(null);
    setError(null);
=======
import { useState } from "react";
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
      setError({ title: "Your answers couldn't be marked", message: `${(e as ApiError).message} Your answers are still filled in.`, retryable: true, retry: submit });
    } finally { setBusy(false); }
  }

  async function retake() {
    if (!results) return;
    setBusy(true);
    setError(null);
    try { startQuiz(await api.retake(results.quiz_id)); }
    catch (e) { setError({ title: "The retake couldn't start", message: (e as ApiError).message, retryable: false }); }
    finally { setBusy(false); }
>>>>>>> demo_front
  }

  return (
    <div className="min-h-full">
<<<<<<< HEAD
      <header className="sticky top-0 z-20 border-b-2 border-[#ece9f5] bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <button onClick={restart} className="flex items-center gap-2" aria-label="Viva home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-[0_3px_0_0_var(--color-brand-800)]">
              <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden><path d="M9 10l7 13 7-13" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span className="text-2xl font-black tracking-tight text-brand-700">viva</span>
          </button>
          <span className="hidden text-sm font-bold text-slate-400 sm:inline">Understand your own code</span>
          <div className="ml-auto flex items-center gap-3">
            {view && <ModeBadge mode={view.mode} />}
            {screen !== "submit" && <button className="chip" onClick={restart}>New viva</button>}
          </div>
=======
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
>>>>>>> demo_front
        </div>
      </header>

      {error && (
<<<<<<< HEAD
        <div className="mx-auto mt-4 max-w-7xl px-4">
          <div role="alert" className="flex items-center gap-3 rounded-2xl border-2 border-bad-500/30 bg-bad-100 px-4 py-3 text-sm font-bold text-bad-700">
            {error}
            <button className="ml-auto underline" onClick={() => setError(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {screen === "submit" && <Submit lab={lab} busy={busy} onStart={start} />}
      {screen === "viva" && view && lab && (
        <Viva view={view} lab={lab} code={code} filename={filename} busy={busy} actions={actions} />
      )}
      {screen === "report" && report && <Report report={report} code={code} onRestart={restart} />}
=======
        <div className="mx-auto mt-5 max-w-3xl px-4">
          <ErrorBox title={error.title} message={error.message} retryable={error.retryable} onRetry={error.retry} />
        </div>
      )}

      <main>
        {screen === "setup" && <Setup initial={materials} onGenerate={generate} />}
        {screen === "generating" && <Generating />}
        {screen === "quiz" && quiz && (
          <QuizView key={quiz.quiz_id} quiz={quiz} answers={answers} setAnswers={setAnswers} submitting={busy} onSubmit={submit} />
        )}
        {screen === "results" && results && (
          <ResultsView results={results} busy={busy} onRetake={retake}
            onNewQuiz={() => materials && generate(materials)} onStartOver={() => { setScreen("setup"); top(); }} />
        )}
      </main>
>>>>>>> demo_front
    </div>
  );
}
