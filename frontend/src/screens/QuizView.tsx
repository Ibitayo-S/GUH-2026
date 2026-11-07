import { useEffect, useState } from "react";
import { AnswerSheet } from "../components/AnswerSheet";
import { SourceBadge } from "../components/Bits";
import { CodeView } from "../components/CodeView";
import { inline } from "../components/Rich";
import type { Quiz } from "../types";
import { expand, LETTERS, rangesLabel, TYPE_LABEL } from "../util";

export function QuizView({ quiz, answers, setAnswers, submitting, onSubmit }: {
  quiz: Quiz; answers: (number | null)[]; setAnswers: (a: (number | null)[]) => void; submitting: boolean; onSubmit: () => void;
}) {
  const [i, setI] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const q = quiz.questions[i];
  const n = quiz.questions.length;
  const answered = answers.filter((a) => a !== null).length;

  useEffect(() => { setShowCode(false); }, [i]);

  const choose = (row: number, k: number) => {
    const next = [...answers];
    next[row] = next[row] === k ? null : k;   // tap again to rub it out
    setAnswers(next);
    setConfirming(false);
  };
  const trySubmit = () => (answered < n && !confirming ? setConfirming(true) : onSubmit());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      const k = "1234".indexOf(e.key) >= 0 ? Number(e.key) - 1 : "abcd".indexOf(e.key.toLowerCase());
      if (k >= 0 && k < q.choices.length) choose(i, k);
      if (e.key === "ArrowRight" && i < n - 1) setI(i + 1);
      if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="display-wide text-2xl md:text-[1.75rem]">{quiz.title}</h1>
        <SourceBadge source={quiz.source} model={quiz.model} />
      </div>
      <p className="mt-1.5 text-[0.95rem] text-muted">Answer from memory. Nothing is marked until you hand in the sheet.</p>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        {/* question */}
        <article key={q.number} className="rise sheet min-w-0 p-5 md:p-7">
          <div className="flex items-baseline justify-between gap-3">
            <span className="form-label">Question {i + 1} of {n}</span>
            <span className="form-label !text-muted">{TYPE_LABEL[q.type]}</span>
          </div>
          <h2 className="mt-3 font-display text-[1.3rem] font-bold leading-snug md:text-[1.45rem]" style={{ fontStretch: "96%" }}>
            {inline(q.question)}
          </h2>

          {q.code && (
            <div className="mt-4">
              <button className="link text-[0.9rem]" aria-expanded={showCode} onClick={() => setShowCode((s) => !s)}>
                {showCode ? "Hide" : "Show"} {q.code.file}, {rangesLabel(q.code.lines)}
              </button>
              {showCode && <div className="rise mt-2"><CodeView code={q.code.text} raw cited={expand(q.code.lines)} /></div>}
            </div>
          )}

          <div className="mt-6 space-y-2" role="radiogroup" aria-label={`Options for question ${i + 1}`}>
            {q.choices.map((c, k) => {
              const on = answers[i] === k;
              return (
                <button key={k} role="radio" aria-checked={on} onClick={() => choose(i, k)}
                  className={`group flex w-full items-start gap-3.5 rounded-[5px] border px-3.5 py-3 text-left transition ${on
                    ? "border-ink/60 bg-paper" : "border-rule hover:border-form/60 hover:bg-form-tint/30"}`}>
                  <span className={`bubble mt-px shrink-0 ${on ? "filled pop" : "group-hover:bg-form-tint"}`} style={{ width: 26, height: 26, fontSize: 12.5 }}>
                    {LETTERS[k]}
                  </span>
                  <span className="pt-0.5 text-[1rem] leading-snug">{inline(c)}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center gap-2 border-t border-rule pt-4">
            <button className="btn btn-ghost !py-2" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</button>
            {i < n - 1
              ? <button className="btn btn-primary ml-auto !py-2" onClick={() => setI(i + 1)}>{answers[i] === null ? "Skip for now" : "Next question"}</button>
              : <button className="btn btn-primary ml-auto !py-2" disabled={submitting} onClick={trySubmit}>{submitting ? "Marking…" : "Hand in answers"}</button>}
          </div>
        </article>

        {/* the answer sheet */}
        <aside className="lg:sticky lg:top-20">
          <AnswerSheet rows={n} answers={answers} current={i} onRow={setI} onPick={(r, k) => { choose(r, k); setI(r); }} />
          <div className="mt-3 flex items-center justify-between text-[0.9rem]">
            <span className="text-muted"><span className="font-semibold text-ink">{answered}</span> of {n} answered</span>
            <button className="btn btn-primary !px-4 !py-2 text-[0.92rem]" disabled={submitting} onClick={trySubmit}>
              {submitting ? "Marking…" : "Hand in answers"}
            </button>
          </div>
          {confirming && answered < n && (
            <div className="rise mt-3 rounded-[5px] border border-amber-300 bg-amber-50 p-3 text-[0.9rem]">
              <p><span className="font-semibold">{n - answered} left blank.</span> Blank answers are marked wrong.</p>
              <div className="mt-2 flex gap-2">
                <button className="btn btn-ghost !px-3 !py-1.5 text-sm" onClick={() => { setConfirming(false); setI(answers.findIndex((a) => a === null)); }}>Go to first blank</button>
                <button className="btn btn-primary !px-3 !py-1.5 text-sm" disabled={submitting} onClick={onSubmit}>Hand in anyway</button>
              </div>
            </div>
          )}
          <p className="mt-4 hidden text-[0.8rem] text-muted lg:block">Keys: 1–4 to answer, ← → to move. Tap a filled circle again to clear it.</p>
        </aside>
      </div>
    </div>
  );
}
