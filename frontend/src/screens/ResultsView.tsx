import { useState, type CSSProperties } from "react";
import { AnswerSheet } from "../components/AnswerSheet";
import { SourceBadge } from "../components/Bits";
import { CodeView } from "../components/CodeView";
import { inline } from "../components/Rich";
import type { QuestionResult, Results } from "../types";
import { expand, LETTERS, rangesLabel, TYPE_LABEL } from "../util";

const verdict = (score: number, total: number) => {
  const p = score / total;
  return p === 1 ? "Full marks. Everything recalled correctly."
    : p >= 0.7 ? "Strong recall, with a few gaps to close."
    : p >= 0.4 ? "Some of it stuck. Work through the missed questions below."
    : "Most of this hasn't stuck yet. Go through each missed question, then retake them.";
};

export function ResultsView({ results, busy, onRetake, onNewQuiz, onStartOver }: {
  results: Results; busy: boolean; onRetake: () => void; onNewQuiz: () => void; onStartOver: () => void;
}) {
  const missed = results.total - results.score;
  const [filter, setFilter] = useState<"missed" | "all">(missed ? "missed" : "all");
  const shown = results.questions.filter((q) => filter === "all" || !q.correct);
  const marks = results.questions.map((q) => ({ chosen: q.chosen_index, correct_index: q.correct_index, correct: q.correct }));
  const scoreDelay = `${0.25 + results.total * 0.11}s`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8">
      <div className="grid gap-8 lg:grid-cols-[300px_1fr] lg:items-start">
        {/* the marked sheet */}
        <aside className="lg:sticky lg:top-20">
          <div className="relative mb-3 flex items-end gap-3 px-1">
            <div className="relative">
              <span className="hand fade-in block text-[3.4rem] leading-none" style={{ animationDelay: scoreDelay }}>
                {results.score}<span className="text-[2rem]">/{results.total}</span>
              </span>
              <svg className="pointer-events-none absolute -left-4 -top-3" width="150" height="88" viewBox="0 0 150 88" aria-hidden>
                <path className="pen draw" style={{ "--len": 380, animationDelay: scoreDelay } as CSSProperties}
                  d="M128 22 C 110 4, 40 2, 16 22 C -2 38, 14 76, 70 80 C 122 84, 146 60, 136 34 C 132 24, 120 16, 104 12" />
              </svg>
            </div>
            <span className="form-label mb-2 ml-auto">Marked</span>
          </div>
          <AnswerSheet rows={results.total} answers={marks.map((m) => m.chosen)} marks={marks} compact label="Your answer sheet" />
        </aside>

        {/* summary + review */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <h1 className="display-wide text-2xl md:text-[1.75rem]">{results.title}</h1>
            <SourceBadge source={results.source} />
          </div>
          <p className="mt-3 text-[1.1rem]">{verdict(results.score, results.total)}</p>
          {results.unanswered > 0 && <p className="mt-1 text-[0.92rem] text-muted">{results.unanswered} left blank (marked wrong).</p>}

          <dl className="mt-5 grid grid-cols-3 divide-x divide-rule rounded-[5px] border border-rule bg-sheet">
            {Object.entries(results.by_type).map(([t, [c, n]]) => (
              <div key={t} className="px-4 py-3">
                <dt className="form-label">{TYPE_LABEL[t as keyof typeof TYPE_LABEL] ?? t}</dt>
                <dd className="mt-0.5 font-display text-2xl font-extrabold tabular-nums">{c}<span className="text-base text-muted">/{n}</span></dd>
              </div>
            ))}
          </dl>

          {results.review_topics.length > 0 && (
            <div className="mt-5">
              <h2 className="form-label">Revise these topics</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {results.review_topics.map((t) => (
                  <li key={t.topic} className="rounded-[4px] border border-redpen/30 bg-redpen-tint px-2.5 py-1 text-[0.9rem]">
                    {t.topic} <span className="tabular-nums text-muted">· {t.correct}/{t.total}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="no-print mt-6 flex flex-wrap gap-2">
            {results.can_retake && <button className="btn btn-primary" disabled={busy} onClick={onRetake}>Retake the {missed} you missed</button>}
            <button className="btn btn-ghost" disabled={busy} onClick={onNewQuiz}>New quiz, same lab</button>
            <button className="btn btn-ghost" disabled={busy} onClick={onStartOver}>Change materials</button>
          </div>

          <div className="mt-10 flex items-center gap-3 border-b border-rule pb-2">
            <h2 className="font-display text-xl font-extrabold">Marked answers</h2>
            <div className="no-print ml-auto flex text-[0.88rem]" role="tablist">
              {(["missed", "all"] as const).map((f) => (
                <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
                  className={`border-b-2 px-3 py-1 font-semibold ${filter === f ? "border-form text-ink" : "border-transparent text-muted hover:text-ink"}`}>
                  {f === "missed" ? `Missed (${missed})` : `All (${results.total})`}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {shown.length === 0 && <p className="text-muted">You got every question right, so there's nothing to review.</p>}
            {shown.map((q) => <MarkedQuestion key={q.number} q={q} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function MarkedQuestion({ q }: { q: QuestionResult }) {
  return (
    <article className="sheet p-5">
      <div className="flex items-start gap-3">
        <svg width="26" height="26" viewBox="0 0 24 24" className="mt-0.5 shrink-0" aria-label={q.correct ? "Correct" : "Incorrect"}>
          {q.correct ? <path className="pen" d="M4 13 L9.5 18.5 L20.5 5" /> : <><path className="pen" d="M5 5 L19 19" /><path className="pen" d="M19 5 L5 19" /></>}
        </svg>
        <div className="min-w-0 flex-1">
          <div className="form-label !text-muted">Question {q.number} · {TYPE_LABEL[q.type]} · {q.topic}{q.chosen_index === null ? " · left blank" : ""}</div>
          <h3 className="mt-1.5 font-display text-[1.12rem] font-bold leading-snug" style={{ fontStretch: "96%" }}>{inline(q.question)}</h3>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5 sm:pl-[38px]">
        {q.choices.map((c, k) => {
          const right = k === q.correct_index;
          const chosen = k === q.chosen_index;
          return (
            <li key={k} className={`flex items-start gap-3 rounded-[4px] px-2 py-1.5 ${right ? "bg-redpen-tint/60" : ""}`}>
              <span className="relative mt-px flex shrink-0 items-center justify-center">
                <span className={`bubble ${chosen ? "filled" : ""}`} style={{ width: 22, height: 22, fontSize: 11 }}>{LETTERS[k]}</span>
                {right && (
                  <svg className="pointer-events-none absolute" width="34" height="32" viewBox="0 0 36 34" aria-hidden>
                    <path className="pen" d="M30 9 C 27 3, 10 2, 5 10 C 1 17, 6 29, 18 30 C 29 31, 34 22, 32 14 C 31 10, 27 6, 22 5" />
                  </svg>
                )}
              </span>
              <span className={`text-[0.95rem] leading-snug ${right ? "font-semibold" : chosen ? "" : "text-muted"}`}>
                {inline(c)}
                {chosen && !right && <span className="hand ml-2 text-[0.95rem]">your answer</span>}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 border-l-[3px] border-redpen pl-3.5 sm:ml-[38px]">
        <div className="hand text-[0.95rem] leading-none">Marker's note</div>
        <div className="mt-1 text-[0.95rem] leading-relaxed">{inline(q.explanation)}</div>
      </div>

      <div className="mt-4 sm:ml-[38px]">
        <div className="text-[0.85rem] text-muted">
          <span className="form-label mr-1.5">Source</span>
          {q.source_kind === "manual" ? <>Lab manual, {inline(q.source_ref)}</>
            : <>Your code{q.code ? `, ${q.code.file} ${rangesLabel(q.code.lines)}` : q.source_ref ? `, ${q.source_ref}` : ""}</>}
        </div>
        {q.code && <div className="mt-2"><CodeView code={q.code.text} raw cited={expand(q.code.lines)} /></div>}
      </div>
    </article>
  );
}
