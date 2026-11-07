import type { ContentSource, FeedbackSource, Mode } from "../types";

const LABELS: Record<FeedbackSource | ContentSource, { text: string; title: string; cls: string }> = {
  model: { text: "AI assessed", title: "Produced by the live model, checked against the rubric.", cls: "bg-sky-50 text-sky-800 border-sky-200" },
  fallback: { text: "Fallback scoring", title: "No live model: scored by matching the rubric's key points.", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  demo: { text: "Demo fixture", title: "This exact answer is a scripted demo answer with planned feedback.", cls: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200" },
  authored: { text: "Authored content", title: "Written by the course team in labs/bfs-grid/*.json.", cls: "bg-slate-50 text-slate-600 border-slate-200" },
};

export function SourceBadge({ source }: { source: FeedbackSource | ContentSource }) {
  const l = LABELS[source];
  return (
    <span title={l.title} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide ${l.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {l.text}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: Mode }) {
  return mode === "live" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-good-100 px-3 py-1 text-xs font-extrabold text-good-700">
      <span className="h-2 w-2 rounded-full bg-good-500" /> Live model
    </span>
  ) : (
    <span title="No API key set, or VIVA_MOCK=1" className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800">
      <span className="h-2 w-2 rounded-full bg-amber-500" /> Mock mode
    </span>
  );
}

export function MockBanner() {
  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <strong className="font-extrabold">Mock mode: no API key.</strong> Questions and lessons are authored content.
      Answers are scored by the rubric fallback, or by planned feedback for the scripted demo answers. Labels on each
      card show which.
    </div>
  );
}
