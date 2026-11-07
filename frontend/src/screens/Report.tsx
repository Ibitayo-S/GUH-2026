import { CodeView } from "../components/CodeView";
import { ScoreDots } from "../components/ProgressPath";
import { inline } from "../components/Rich";
import { MockBanner, SourceBadge } from "../components/SourceBadge";
import type { ConceptReport, Report as ReportT } from "../types";
import { formatLines } from "../util";

const STATUS: Record<ConceptReport["status"], { text: string; cls: string; bar: string }> = {
  strong: { text: "Strong", cls: "bg-good-100 text-good-700", bar: "bg-good-500" },
  developing: { text: "Developing", cls: "bg-amber-100 text-amber-800", bar: "bg-amber-400" },
  revisit: { text: "Revisit", cls: "bg-bad-100 text-bad-700", bar: "bg-bad-500" },
  not_assessed: { text: "Not assessed", cls: "bg-slate-100 text-slate-500", bar: "bg-slate-300" },
};

export function Report({ report, code, onRestart }: { report: ReportT; code: string; onRestart: () => void }) {
  // Gaps first, then code fixes Viva spotted even where the explanation was strong.
  const gaps = [
    ...report.concepts.filter((c) => c.status !== "strong" && c.next_step),
    ...report.concepts.filter((c) => c.status === "strong" && c.next_step),
  ];
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {report.mode === "mock" && <div className="mb-5"><MockBanner /></div>}

      <section className="card p-6 md:p-8">
        <div className="text-xs font-black uppercase tracking-wider text-slate-400">Your understanding report · private to you</div>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{report.lab_title}</h1>
        <p className="mt-3 text-lg font-semibold text-slate-700">{report.summary}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {report.concepts.map((c) => (
            <a key={c.concept_id} href={`#${c.concept_id}`} className="rounded-2xl border-2 border-[#ece9f5] p-3 transition hover:border-brand-200">
              <div className={`mb-2 h-1.5 rounded-full ${STATUS[c.status].bar}`} />
              <div className="flex items-center gap-2">
                <span className="font-extrabold">{c.label}</span>
                <span className="ml-auto"><ScoreDots score={c.best_score} size="sm" /></span>
              </div>
              <div className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-black uppercase tracking-wide ${STATUS[c.status].cls}`}>{STATUS[c.status].text}</div>
            </a>
          ))}
        </div>
      </section>

      {gaps.length > 0 && (
        <section className="mt-6 rounded-3xl border-2 border-brand-200 bg-brand-50 p-6">
          <h2 className="text-lg font-black text-brand-800">Your next steps</h2>
          <ol className="mt-3 space-y-2">
            {gaps.map((c, i) => (
              <li key={c.concept_id} className="flex gap-3 text-[0.98rem] font-semibold text-slate-800">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-black text-white">{i + 1}</span>
                <span><strong className="font-extrabold">{c.label}:</strong> {inline(c.next_step!)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {report.strengths.length > 0 && (
        <section className="mt-6 rounded-3xl border-2 border-good-500/30 bg-good-100/50 p-6">
          <h2 className="text-lg font-black text-good-700">Strengths</h2>
          <ul className="mt-2 space-y-1.5">
            {report.strengths.map((s) => <li key={s} className="flex gap-2 font-semibold text-slate-800"><span className="text-good-600">✓</span>{s}</li>)}
          </ul>
        </section>
      )}

      <div className="mt-6 space-y-5">
        {report.concepts.map((c) => <ConceptCard key={c.concept_id} c={c} code={code} />)}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={onRestart}>Start a new viva</button>
        <button className="btn btn-ghost" onClick={() => window.print()}>Print / save as PDF</button>
        <span className="text-sm font-semibold text-slate-400">Formative only. Nothing here is sent to your lecturer.</span>
      </div>
    </div>
  );
}

function ConceptCard({ c, code }: { c: ConceptReport; code: string }) {
  const s = STATUS[c.status];
  const first = c.attempts[0];
  const lastA = c.attempts[c.attempts.length - 1];
  return (
    <article id={c.concept_id} className="card scroll-mt-24 overflow-hidden">
      <div className={`h-2 ${s.bar}`} />
      <div className="grid gap-5 p-5 md:grid-cols-[1fr_1fr] md:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black">{c.label}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wide ${s.cls}`}>{s.text}</span>
            <ScoreDots score={c.best_score} />
          </div>

          {c.attempts.length > 1 && first && lastA && (
            <p className="mt-2 text-sm font-bold text-slate-500">
              Attempt 1: {first.score}/2 → Attempt {lastA.attempt}: {lastA.score}/2
              {lastA.score > first.score && <span className="ml-1 text-good-700"> · improved</span>}
            </p>
          )}

          {c.evidence ? (
            <blockquote className="mt-3 rounded-2xl border-l-4 border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
              <span className="mb-0.5 flex items-center gap-2 text-[0.7rem] font-black uppercase tracking-wide text-slate-400">
                Evidence from your answer {lastA && <SourceBadge source={c.attempts.reduce((b, a) => (a.score >= b.score ? a : b)).source} />}
              </span>
              “{c.evidence}”
            </blockquote>
          ) : (
            <p className="mt-3 text-sm font-semibold text-slate-500">You didn't answer this one, so there's no evidence yet.</p>
          )}

          {(c.used_learning || c.checks_total > 0) && (
            <p className="mt-3 text-sm font-bold text-amber-800">
              ✎ Used the learning path{c.checks_total > 0 && ` · ${c.checks_correct}/${c.checks_total} check questions right`}
            </p>
          )}

          {c.finding && (
            <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-2 ring-amber-200">
              <div className="text-[0.7rem] font-black uppercase tracking-wide text-amber-700">What Viva noticed in your code</div>
              {inline(c.finding)}
            </div>
          )}

          {c.next_step && (
            <div className="mt-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-900 ring-2 ring-brand-100">
              <div className="text-[0.7rem] font-black uppercase tracking-wide text-brand-600">Next step</div>
              {inline(c.next_step)}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">
            Your code · {c.code_lines.length ? formatLines(c.code_lines, "line") : "no specific lines"}
          </div>
          {c.code_lines.length > 0 && <CodeView code={code} highlight={c.code_lines} window={2} dense />}
        </div>
      </div>
    </article>
  );
}
