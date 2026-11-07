import type { Source } from "../types";

export function SourceBadge({ source, model }: { source: Source; model?: string | null }) {
  return source === "live" ? (
    <span title="Questions written by the live model from your materials" className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[0.7rem] font-black uppercase tracking-wide text-sky-800">
      <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> AI generated{model ? ` · ${model}` : ""}
    </span>
  ) : (
    <span title="Prewritten quiz for the built-in example lab. Nothing was generated." className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[0.7rem] font-black uppercase tracking-wide text-amber-800">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Demo · prewritten quiz
    </span>
  );
}

export function Spinner({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center" role="status">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
      <div className="text-lg font-black">{label}</div>
      {sub && <div className="max-w-md text-sm font-semibold text-slate-500">{sub}</div>}
    </div>
  );
}

export function ErrorBox({ title = "Something went wrong", message, retryable, onRetry, onBack }: { title?: string; message: string; retryable?: boolean; onRetry?: () => void; onBack?: () => void }) {
  return (
    <div role="alert" className="pop-in rounded-2xl border-2 border-rose-200 bg-rose-50 p-4">
      <div className="font-black text-rose-800">{title}</div>
      <p className="mt-1 text-sm font-semibold text-rose-900">{message}</p>
      <div className="mt-3 flex gap-2">
        {retryable && onRetry && <button className="btn btn-ghost !py-1.5 text-sm" onClick={onRetry}>↻ Try again</button>}
        {onBack && <button className="btn btn-ghost !py-1.5 text-sm" onClick={onBack}>← Back to my materials</button>}
      </div>
    </div>
  );
}
