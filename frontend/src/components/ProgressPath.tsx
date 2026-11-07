import type { ProgressItem } from "../types";

const STYLE: Record<ProgressItem["status"], { ring: string; icon: string; label: string }> = {
  upcoming: { ring: "bg-white border-[#e4e0ef] text-slate-400", icon: "•", label: "Up next" },
  current: { ring: "bg-brand-600 border-brand-700 text-white pulse-ring", icon: "?", label: "Now" },
  learning: { ring: "bg-amber-400 border-amber-500 text-white pulse-ring", icon: "✎", label: "Learning" },
  strong: { ring: "bg-good-500 border-good-600 text-white", icon: "✓", label: "Strong" },
  developing: { ring: "bg-amber-300 border-amber-400 text-amber-900", icon: "½", label: "Developing" },
  revisit: { ring: "bg-bad-500 border-bad-700 text-white", icon: "!", label: "Revisit" },
  skipped: { ring: "bg-slate-200 border-slate-300 text-slate-500", icon: "–", label: "Skipped" },
};

export function ProgressPath({ items }: { items: ProgressItem[] }) {
  return (
    <ol className="flex items-start" aria-label="Viva progress">
      {items.map((it, i) => {
        const s = STYLE[it.status];
        return (
          <li key={it.concept_id} className="flex min-w-0 flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={`h-1 flex-1 rounded ${i === 0 ? "invisible" : items[i - 1].status === "upcoming" || it.status === "upcoming" ? "bg-[#e4e0ef]" : "bg-brand-200"}`} />
              <div
                className={`mx-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-lg font-black shadow-[0_3px_0_0_rgba(0,0,0,0.08)] ${s.ring}`}
                aria-label={`${it.label}: ${s.label}`}
              >
                {s.icon}
              </div>
              <div className={`h-1 flex-1 rounded ${i === items.length - 1 ? "invisible" : it.status === "upcoming" || items[i + 1].status === "upcoming" ? "bg-[#e4e0ef]" : "bg-brand-200"}`} />
            </div>
            <div className="mt-1.5 px-1 text-xs font-extrabold leading-tight text-slate-700">{it.label}</div>
            <div className="text-[0.68rem] font-bold uppercase tracking-wide text-slate-400">{s.label}</div>
          </li>
        );
      })}
    </ol>
  );
}

export function ScoreDots({ score, size = "md" }: { score: number | null; size?: "sm" | "md" }) {
  const d = size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5";
  const color = score === 2 ? "bg-good-500" : score === 1 ? "bg-amber-400" : "bg-bad-500";
  return (
    <span className="inline-flex gap-1" aria-label={score === null ? "Not assessed" : `Score ${score} of 2`}>
      {[0, 1].map((i) => (
        <span key={i} className={`${d} rounded-full ${score !== null && i < score ? color : score === 0 && i === 0 ? "bg-bad-100 ring-2 ring-bad-500/40" : "bg-[#e4e0ef]"}`} />
      ))}
    </span>
  );
}
