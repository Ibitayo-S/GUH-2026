import type { Feedback } from "../types";
import { ScoreDots } from "./ProgressPath";
import { inline } from "./Rich";
import { SourceBadge } from "./SourceBadge";

interface Props {
  feedback: Feedback;
  offerLearning: boolean;
  canRetry: boolean;
  isLast: boolean;
  busy: boolean;
  onLearn: () => void;
  onRetry: () => void;
  onContinue: () => void;
}

const TONE = {
  2: { box: "border-good-500/40 bg-good-100/60", title: "text-good-700", emoji: "🎉" },
  1: { box: "border-amber-300 bg-amber-50", title: "text-amber-800", emoji: "💡" },
  0: { box: "border-bad-500/30 bg-bad-100/60", title: "text-bad-700", emoji: "🧭" },
} as const;

export function FeedbackCard({ feedback, offerLearning, canRetry, isLast, busy, onLearn, onRetry, onContinue }: Props) {
  const t = TONE[feedback.score];
  return (
    <div className={`pop-in rounded-3xl border-2 p-5 md:p-6 ${t.box}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xl" aria-hidden>{t.emoji}</span>
        <h3 className={`text-xl font-black ${t.title}`}>{feedback.verdict}</h3>
        <ScoreDots score={feedback.score} />
        <span className="ml-auto"><SourceBadge source={feedback.source} /></span>
      </div>

      <p className="mt-3 text-[1.02rem] font-semibold leading-relaxed text-slate-800">{inline(feedback.message)}</p>

      <blockquote className="mt-3 rounded-2xl border-l-4 border-slate-300 bg-white/70 px-4 py-2.5 text-sm text-slate-700">
        <span className="block text-[0.7rem] font-black uppercase tracking-wide text-slate-400">Evidence from your answer</span>
        “{feedback.evidence}”
      </blockquote>

      {feedback.missing.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm font-semibold text-slate-700">
          {feedback.missing.map((m) => <li key={m} className="flex gap-2"><span className="text-brand-500">→</span>{inline(m)}</li>)}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {offerLearning && (
          <button className="btn btn-primary" disabled={busy} onClick={onLearn}>
            Teach me this step by step
          </button>
        )}
        {canRetry && <button className="btn btn-ghost" disabled={busy} onClick={onRetry}>Try again</button>}
        <button className={`btn ${offerLearning ? "btn-ghost" : "btn-good"}`} disabled={busy} onClick={onContinue}>
          {isLast ? "See my report" : "Continue"} →
        </button>
      </div>
    </div>
  );
}
