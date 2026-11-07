import type { Source } from "../types";

export function SourceBadge({ source, model }: { source: Source; model?: string | null }) {
  return source === "live" ? (
    <span title="Written by the AI model from the materials you uploaded"
      className="inline-flex items-center gap-1.5 rounded-[4px] border border-form/40 bg-form-tint px-2 py-0.5 font-display text-[0.72rem] font-bold uppercase tracking-wide text-form-deep"
      style={{ fontStretch: "78%" }}>
      AI-written{model ? ` · ${model}` : ""}
    </span>
  ) : (
    <span title="A prewritten quiz for the example lab. Nothing was generated."
      className="inline-flex items-center gap-1.5 rounded-[4px] border border-amber-400/60 bg-amber-50 px-2 py-0.5 font-display text-[0.72rem] font-bold uppercase tracking-wide text-amber-900"
      style={{ fontStretch: "78%" }}>
      Demo · prewritten quiz
    </span>
  );
}

export function Generating() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center" role="status">
      <div className="thinking sheet flex gap-2.5 px-5 py-4" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="bubble" style={{ width: 18, height: 18, animationDelay: `${i * 0.22}s` }} />
        ))}
      </div>
      <h2 className="display-wide mt-6 text-2xl">Writing your quiz</h2>
      <p className="mt-2 text-[0.95rem] text-muted">
        Reading the manual and your code, then writing ten questions with one right answer each. With a live model this takes 20–60 seconds.
      </p>
    </div>
  );
}

export function ErrorBox({ title, message, retryable, onRetry }: { title: string; message: string; retryable?: boolean; onRetry?: () => void }) {
  return (
    <div role="alert" className="rise sheet border-l-4 !border-l-redpen p-4">
      <div className="font-display text-[1.02rem] font-extrabold">{title}</div>
      <p className="mt-1 text-[0.95rem] text-ink/80">{message}</p>
      {retryable && onRetry && <button className="btn btn-ghost mt-3 !py-1.5 text-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}
