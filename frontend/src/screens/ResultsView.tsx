import { useState } from "react";
import { SourceBadge } from "../components/Bits";
import { CodeView } from "../components/CodeView";
import { inline } from "../components/Rich";
import type { QuestionResult, Results } from "../types";
import { LETTERS, rangesLabel, TYPE_LABEL } from "../util";

export function ResultsView({ results, busy, onRetake, onNewQuiz, onStartOver }: {
  results: Results; busy: boolean; onRetake: () => void; onNewQuiz: () => void; onStartOver: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "missed">(results.score < results.total ? "missed" : "all");
  const pct = Math.round((100 * results.score) / results.total);
  const missed = results.total - results.score;
  const shown = results.questions.filter((q) => filter === "all" || !q.correct);
  const headline = pct === 100 ? "Perfect recall! 🎉" : pct >= 70 ? "Strong recall, nearly there." : pct >= 40 ? "A good start. Review the gaps below." : "Lots to review. That's what practice is for.";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400">Results · {results.title}</span>
          <span className="ml-auto"><SourceBadge source={results.source} /></span>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div className="text-6xl font-black tracking-tight text-brand-700">{results.score}<span className="text-3xl text-slate-400">/{results.total}</span></div>
          <div className="pb-1.5">
            <div className="text-xl font-black">{headline}</div>
            {results.unanswered > 0 && <div className="text-sm font-semibold text-slate-500">{results.unanswered} left unanswered</div>}
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {Object.entries(results.by_type).map(([t, [c, n]]) => (
            <div key={t} className="rounded-xl bg-[#fbfaff] px-3 py-2 ring-2 ring-[#ece9f5]">
              <div className="text-xs font-black uppercase tracking-wide text-slate-400">{TYPE_LABEL[t as keyof typeof TYPE_LABEL] ?? t}</div>
              <div className="text-lg font-black">{c}/{n}</div>
            </div>
          ))}
        </div>
        {results.review_topics.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-black">Topics to review</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {results.review_topics.map((t) => (
                <span key={t.topic} className="rounded-full bg-rose-50 px-3 py-1 text-sm font-bold text-rose-800 ring-2 ring-rose-100">{t.topic} · {t.correct}/{t.total}</span>
              ))}
            </div>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {results.can_retake && <button className="btn btn-primary" disabled={busy} onClick={onRetake}>↻ Retake the {missed} I missed</button>}
          <button className="btn btn-ghost" disabled={busy} onClick={onNewQuiz}>New quiz from the same materials</button>
          <button className="btn btn-ghost" disabled={busy} onClick={onStartOver}>Use different materials</button>
        </div>
      </section>

      <div className="mt-6 flex items-center gap-2">
        <h2 className="text-lg font-black">Answers</h2>
        <div className="ml-auto flex rounded-xl bg-white p-1 ring-2 ring-[#ece9f5]">
          {(["missed", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1 text-sm font-black ${filter === f ? "bg-brand-600 text-white" : "text-slate-500"}`}>
              {f === "missed" ? `Missed (${missed})` : `All (${results.total})`}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 space-y-4">
        {shown.length === 0 && <p className="font-semibold text-slate-500">Nothing missed. Every answer was right.</p>}
        {shown.map((q) => <ResultCard key={q.number} q={q} />)}
      </div>
    </div>
  );
}

function ResultCard({ q }: { q: QuestionResult }) {
  return (
    <article className={`card overflow-hidden ${q.correct ? "" : "border-rose-200"}`}>
      <div className={`h-1.5 ${q.correct ? "bg-emerald-500" : "bg-rose-400"}`} />
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wider">
          <span className={q.correct ? "text-emerald-700" : "text-rose-700"}>{q.correct ? "✓ Correct" : q.chosen_index === null ? "Unanswered" : "✗ Not quite"}</span>
          <span className="text-slate-400">· Question {q.number} · {TYPE_LABEL[q.type]} · {q.topic}</span>
        </div>
        <h3 className="mt-1.5 text-[1.05rem] font-extrabold leading-snug">{inline(q.question)}</h3>
        <ul className="mt-3 space-y-1.5">
          {q.choices.map((c, k) => {
            const isRight = k === q.correct_index;
            const isChosen = k === q.chosen_index;
            return (
              <li key={k} className={`flex items-start gap-2.5 rounded-xl px-3 py-2 text-sm font-bold ${isRight ? "bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200"
                : isChosen ? "bg-rose-50 text-rose-900 ring-2 ring-rose-200" : "text-slate-500"}`}>
                <span className="w-5 shrink-0 font-black">{LETTERS[k]}</span>
                <span className="flex-1">{inline(c)}</span>
                {isRight && <span className="shrink-0 text-xs font-black uppercase">Correct</span>}
                {isChosen && !isRight && <span className="shrink-0 text-xs font-black uppercase">Your answer</span>}
              </li>
            );
          })}
        </ul>
        <div className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-900">💡 {inline(q.explanation)}</div>
        <div className="mt-3 text-xs font-bold text-slate-500">
          Where this comes from: {q.source_kind === "manual" ? <>📄 Lab manual: {inline(q.source_ref)}</>
            : <>💻 Your code{q.code ? ` · ${q.code.file}, ${rangesLabel(q.code.lines)}` : q.source_ref ? ` · ${q.source_ref}` : ""}</>}
        </div>
        {q.code && <div className="mt-2"><CodeView code={q.code.text} raw dense /></div>}
      </div>
    </article>
  );
}
