import { useEffect, useState } from "react";
import { SourceBadge } from "../components/Bits";
import { CodeView } from "../components/CodeView";
import { inline } from "../components/Rich";
import type { Quiz } from "../types";
import { LETTERS, rangesLabel, TYPE_LABEL } from "../util";

export function QuizView({ quiz, answers, setAnswers, submitting, onSubmit }: {
  quiz: Quiz; answers: (number | null)[]; setAnswers: (a: (number | null)[]) => void; submitting: boolean; onSubmit: () => void;
}) {
  const [i, setI] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const q = quiz.questions[i];
  const n = quiz.questions.length;
  const unanswered = answers.filter((a) => a === null).length;

  useEffect(() => { setShowCode(false); }, [i]);

  const choose = (k: number) => {
    const next = [...answers];
    next[i] = k;
    setAnswers(next);
    setConfirming(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const k = "1234".indexOf(e.key) >= 0 ? Number(e.key) - 1 : "abcd".indexOf(e.key.toLowerCase());
      if (k >= 0 && k < q.choices.length) choose(k);
      if (e.key === "ArrowRight" && i < n - 1) setI(i + 1);
      if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-black">{quiz.title}</h1>
        <span className="ml-auto"><SourceBadge source={quiz.source} model={quiz.model} /></span>
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-500">
        Answer from memory. You'll see the right answers and explanations after you submit.
      </p>

      {/* progress */}
      <div className="mt-4 flex gap-1.5" aria-label="Questions">
        {quiz.questions.map((_, k) => (
          <button key={k} onClick={() => setI(k)} aria-label={`Question ${k + 1}${answers[k] !== null ? ", answered" : ""}`}
            className={`h-9 flex-1 rounded-lg text-sm font-black transition ${k === i ? "bg-brand-600 text-white shadow-[0_3px_0_0_var(--color-brand-800)]"
              : answers[k] !== null ? "bg-brand-100 text-brand-800" : "bg-white text-slate-400 ring-2 ring-[#ece9f5]"}`}>
            {k + 1}
          </button>
        ))}
      </div>

      <div key={q.number} className="card pop-in mt-5 p-5 md:p-6">
        <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
          <span>Question {i + 1} of {n}</span><span>·</span><span>{TYPE_LABEL[q.type]}</span>
        </div>
        <h2 className="text-[1.2rem] font-extrabold leading-snug">{inline(q.question)}</h2>

        {q.code && (
          <div className="mt-3">
            <button className="text-sm font-bold text-brand-700 hover:underline" onClick={() => setShowCode((s) => !s)}>
              {showCode ? "Hide" : "Show"} your code ({q.code.file}, {rangesLabel(q.code.lines)})
            </button>
            {showCode && <div className="mt-2"><CodeView code={q.code.text} raw dense /></div>}
          </div>
        )}

        <div className="mt-4 grid gap-2.5" role="radiogroup" aria-label="Options">
          {q.choices.map((c, k) => {
            const on = answers[i] === k;
            return (
              <button key={k} role="radio" aria-checked={on} onClick={() => choose(k)}
                className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left font-bold transition ${on
                  ? "border-brand-500 bg-brand-50 text-brand-900 shadow-[0_3px_0_0_var(--color-brand-200)]"
                  : "border-[#e4e0ef] bg-white hover:border-brand-200 hover:bg-[#fbfaff]"}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-black ${on ? "border-brand-600 bg-brand-600 text-white" : "border-[#e4e0ef] text-slate-500"}`}>{LETTERS[k]}</span>
                <span className="pt-0.5">{inline(c)}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button className="btn btn-ghost !py-2" disabled={i === 0} onClick={() => setI(i - 1)}>← Back</button>
          {i < n - 1 ? (
            <button className="btn btn-primary ml-auto !py-2" onClick={() => setI(i + 1)}>{answers[i] === null ? "Skip for now →" : "Next →"}</button>
          ) : (
            <button className="btn btn-primary ml-auto !py-2" disabled={submitting} onClick={() => (unanswered && !confirming ? setConfirming(true) : onSubmit())}>
              {submitting ? "Marking…" : "Submit quiz"}
            </button>
          )}
        </div>
        {confirming && unanswered > 0 && (
          <div className="pop-in mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 ring-2 ring-amber-200">
            {unanswered} question{unanswered === 1 ? " is" : "s are"} unanswered and will count as wrong.
            <div className="mt-2 flex gap-2">
              <button className="btn btn-ghost !py-1 text-sm" onClick={() => { setConfirming(false); setI(answers.findIndex((a) => a === null)); }}>Go to the first one</button>
              <button className="btn btn-primary !py-1 text-sm" disabled={submitting} onClick={onSubmit}>Submit anyway</button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-xs font-semibold text-slate-400">Tip: press 1–4 to choose an option and ← → to move between questions.</p>
    </div>
  );
}
