import { useState } from "react";
import type { DemoAnswer, Mode, Question } from "../types";
import { inline } from "./Rich";
import { formatLines } from "../util";

interface Props {
  question: Question;
  conceptLabel: string;
  mode: Mode;
  demoAnswers: DemoAnswer[];
  busy: boolean;
  onAnswer: (text: string) => void;
  onConfused: () => void;
  onSkip: () => void;
}

export function QuestionCard({ question, conceptLabel, mode, demoAnswers, busy, onAnswer, onConfused, onSkip }: Props) {
  const [text, setText] = useState("");
  const ready = text.trim().length >= 3;

  return (
    <div className="card pop-in p-5 md:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-brand-700">{conceptLabel}</span>
        {question.attempt > 1 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-800">Attempt {question.attempt}</span>
        )}
        {question.code_lines.length > 0 && (
          <span className="text-xs font-bold text-slate-500">About {formatLines(question.code_lines, "line")} (highlighted)</span>
        )}
      </div>

      <h2 className="text-xl font-extrabold leading-snug md:text-[1.35rem]">{inline(question.text)}</h2>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && ready && !busy) onAnswer(text.trim()); }}
        placeholder="Explain in your own words. A sentence or two is enough."
        rows={4}
        className="mt-4 w-full resize-y rounded-2xl border-2 border-[#e4e0ef] bg-[#fbfaff] p-3.5 text-[1rem] font-semibold outline-none transition focus:border-brand-400 focus:bg-white"
        aria-label="Your answer"
      />

      {mode === "mock" && demoAnswers.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold uppercase tracking-wide text-fuchsia-700">Presenter demo answers:</span>
          {demoAnswers.map((d) => (
            <button key={d.label} className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 font-bold text-fuchsia-800 hover:bg-fuchsia-100" onClick={() => setText(d.answer)}>
              {d.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" disabled={!ready || busy} onClick={() => onAnswer(text.trim())}>
          Check my answer
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={onConfused}>
          <span aria-hidden>🤔</span> I don't understand
        </button>
        <button className="ml-auto text-sm font-bold text-slate-400 hover:text-slate-600" disabled={busy} onClick={onSkip}>
          Skip for now
        </button>
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-400">
        Choosing "I don't understand" isn't a wrong answer. Viva will teach the idea first.
      </p>
    </div>
  );
}
