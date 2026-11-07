import type { LearnAction, LessonView } from "../types";
import { CheckQuestion } from "./CheckQuestion";
import { CodeView } from "./CodeView";
import { QueueTrace } from "./QueueTrace";
import { Rich } from "./Rich";
import { SourceBadge } from "./SourceBadge";
import { formatLines } from "../util";

const STEPS = ["Idea", "Example", "Walkthrough", "Mistake", "Your code", "Check"];
const STEP_OF: Partial<Record<LessonView["step_kind"], number>> = {
  intuition: 0, example: 1, trace: 2, mistake: 3, your_code: 4, check: 5,
};

function label(action: LearnAction, lesson: LessonView, labels: Record<string, string>): string {
  switch (action) {
    case "next": return lesson.step_kind === "alt" ? "Continue the lesson" : "Continue →";
    case "simpler": return "Explain it more simply";
    case "example": return "Show an example";
    case "walkthrough": return "Walk through the code";
    case "check": return lesson.step_kind === "recap" || lesson.step_kind === "alt" ? "Try another check question" : "Try a check question";
    case "return": return lesson.step_kind === "recap" && !lesson.detour_from ? "Retry my question" : "Return to my question";
    case "learn_prereq": return `Take the detour: ${labels[lesson.prereq_offer ?? ""] ?? "prerequisite"}`;
    case "resume": return `Back to ${labels[lesson.detour_from ?? ""] ?? "my lesson"}`;
    default: return action;
  }
}

const CHIP_ICON: Partial<Record<LearnAction, string>> = {
  simpler: "🪶", example: "🧩", walkthrough: "👣", check: "✅", return: "↩", next: "📖",
};

interface Props {
  lesson: LessonView;
  busy: boolean;
  labels: Record<string, string>;
  onAction: (action: LearnAction, choice?: string) => void;
}

export function LessonPanel({ lesson, busy, labels, onAction }: Props) {
  const current = STEP_OF[lesson.step_kind];
  const primary = lesson.step_kind === "check" ? null : lesson.controls[0];
  const chips = lesson.controls.filter((c) => c !== primary);
  const isCurrentChip = (a: LearnAction) =>
    (a === "example" && lesson.step_kind === "example") ||
    (a === "walkthrough" && lesson.step_kind === "trace") ||
    (a === "check" && lesson.step_kind === "check");

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-[#ece9f5] bg-gradient-to-r from-amber-50 to-brand-50 px-5 py-3">
        <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">Learning mode</span>
        <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Not scored</span>
        <span className="ml-auto text-sm font-extrabold text-brand-800">{lesson.concept_label}</span>
      </div>

      {lesson.detour_from && (
        <div className="border-b-2 border-[#ece9f5] bg-sky-50 px-5 py-2 text-sm font-bold text-sky-800">
          Quick detour: {lesson.concept_label} first, then back to {labels[lesson.detour_from]}.
        </div>
      )}

      <div className="px-5 pt-4">
        <div className="flex gap-1.5" aria-label="Learning path">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-2 rounded-full transition-colors ${
                i === current ? "bg-brand-600" : i <= lesson.step_index ? "bg-brand-200" : "bg-[#ece9f5]"
              }`} />
              <div className={`mt-1 hidden text-[0.66rem] font-extrabold uppercase tracking-wide sm:block ${i === current ? "text-brand-700" : "text-slate-400"}`}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      <div key={`${lesson.concept_id}-${lesson.step_kind}-${lesson.title}`} className="pop-in px-5 pb-5 pt-4 md:px-6">
        {lesson.check_result && (
          <div className={`mb-4 rounded-2xl border-2 px-4 py-3 ${lesson.check_result.correct ? "border-good-500/40 bg-good-100/70" : "border-amber-300 bg-amber-50"}`}>
            <div className={`text-sm font-black ${lesson.check_result.correct ? "text-good-700" : "text-amber-800"}`}>
              {lesson.check_result.correct ? "✓ Nice, that's right" : "Not quite, and that's useful to know"}
            </div>
            <Rich text={lesson.check_result.message} className="mt-1 text-[0.97rem] font-semibold text-slate-800" />
          </div>
        )}

        <div className="mb-2 flex items-start gap-3">
          <h3 className="text-[1.35rem] font-black leading-tight">{lesson.title}</h3>
          <span className="ml-auto shrink-0 pt-1"><SourceBadge source={lesson.source} /></span>
        </div>
        <Rich text={lesson.body} className="text-[1.03rem] font-semibold text-slate-700" />

        {lesson.step_kind === "your_code" && lesson.highlight_lines.length > 0 && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-1.5 text-sm font-extrabold text-amber-900">
            ← Highlighted in your code: {formatLines(lesson.highlight_lines, "line")}
          </p>
        )}

        {lesson.code && <div className="mt-4"><CodeView code={lesson.code} /></div>}
        {lesson.trace && <div className="mt-4"><QueueTrace trace={lesson.trace} /></div>}
        {lesson.check && (
          <div className="mt-4">
            <CheckQuestion check={lesson.check} busy={busy} onPick={(id) => onAction("answer_check", id)} />
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {primary && (
            <button
              className={`btn ${primary === "return" || primary === "resume" ? "btn-good" : "btn-primary"} mr-2`}
              disabled={busy}
              onClick={() => onAction(primary)}
            >
              {label(primary, lesson, labels)}
            </button>
          )}
          {chips.map((c) => (
            <button key={c} className="chip" disabled={busy || isCurrentChip(c)} onClick={() => onAction(c)}>
              <span aria-hidden>{CHIP_ICON[c] ?? "•"}</span> {label(c, lesson, labels)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
