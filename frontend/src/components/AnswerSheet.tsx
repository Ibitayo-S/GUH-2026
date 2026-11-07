import type { CSSProperties } from "react";
import { LETTERS } from "../util";

/** Marking info for one row, present only once the quiz is submitted. */
export interface RowMark { chosen: number | null; correct_index: number; correct: boolean }

interface Props {
  rows: number;
  options?: number;
  answers: (number | null)[];
  current?: number;
  onRow?: (row: number) => void;
  onPick?: (row: number, option: number) => void;
  marks?: RowMark[];          // results: draw the marker's red pen over the sheet
  compact?: boolean;
  label?: string;
}

/**
 * The signature element: a printed multiple-choice answer sheet. While answering it fills with graphite;
 * on results the same sheet comes back marked in red pen, one row after another.
 */
export function AnswerSheet({ rows, options = 4, answers, current, onRow, onPick, marks, compact, label = "Answer sheet" }: Props) {
  const size = compact ? 20 : 24;
  const step = 0.11; // seconds between marked rows
  return (
    <div className="sheet relative overflow-hidden" aria-label={label}>
      <div className="flex items-center justify-between border-b border-[var(--color-form)]/30 bg-form-tint/60 px-3 py-2">
        <span className="form-label">{label}</span>
        <span className="form-label !text-[0.65rem] opacity-70">Fill one circle per question</span>
      </div>
      <div className={compact ? "px-2 py-1.5" : "px-3 py-2"}>
        <div className="grid items-center" style={{ gridTemplateColumns: `2.2rem repeat(${options}, ${size + 10}px) 1.6rem` }}>
          <span />
          {Array.from({ length: options }, (_, k) => <span key={k} className="form-label text-center !text-[0.62rem]">{LETTERS[k]}</span>)}
          <span />
        </div>
        {Array.from({ length: rows }, (_, r) => {
          const mark = marks?.[r];
          const isCurrent = current === r && !marks;
          const delay = `${0.15 + r * step}s`;
          return (
            <div key={r} className={`grid items-center rounded-[4px] ${isCurrent ? "bg-hl/45" : ""}`}
              style={{ gridTemplateColumns: `2.2rem repeat(${options}, ${size + 10}px) 1.6rem`, height: size + (compact ? 6 : 10) }}>
              <button type="button" disabled={!onRow} onClick={() => onRow?.(r)} aria-label={`Go to question ${r + 1}`}
                className={`text-left font-display text-[0.95rem] font-extrabold tabular-nums ${onRow ? "cursor-pointer hover:text-form" : "cursor-default"} ${isCurrent ? "text-ink" : "text-muted"}`}
                style={{ fontStretch: "80%" }}>
                {r + 1}
              </button>
              {Array.from({ length: options }, (_, k) => {
                const filled = answers[r] === k;
                const circled = !!mark && mark.correct_index === k;
                return (
                  <span key={k} className="relative flex items-center justify-center">
                    <button type="button" disabled={!onPick} onClick={() => onPick?.(r, k)}
                      aria-label={`Question ${r + 1}, option ${LETTERS[k]}${filled ? ", filled" : ""}`}
                      className={`bubble ${filled ? "filled pop" : ""} ${onPick ? "cursor-pointer hover:bg-form-tint" : "cursor-default"}`}
                      style={{ width: size, height: size, fontSize: size * 0.48 }}>
                      {LETTERS[k]}
                    </button>
                    {circled && (
                      <svg className="pointer-events-none absolute" width={size + 12} height={size + 10} viewBox="0 0 36 34" aria-hidden>
                        <path className="pen draw" style={{ "--len": 110, animationDelay: delay } as CSSProperties}
                          d="M30 9 C 27 3, 10 2, 5 10 C 1 17, 6 29, 18 30 C 29 31, 34 22, 32 14 C 31 10, 27 6, 22 5" />
                      </svg>
                    )}
                  </span>
                );
              })}
              <span className="flex items-center justify-center">
                {mark && (
                  <svg width="22" height="22" viewBox="0 0 24 24" aria-label={mark.correct ? "correct" : "incorrect"}>
                    {mark.correct ? (
                      <path className="pen draw" style={{ "--len": 30, animationDelay: delay } as CSSProperties} d="M4 13 L9.5 18.5 L20.5 5" />
                    ) : (
                      <>
                        <path className="pen draw" style={{ "--len": 22, animationDelay: delay } as CSSProperties} d="M5 5 L19 19" />
                        <path className="pen draw" style={{ "--len": 22, animationDelay: `${0.15 + r * step + 0.12}s` } as CSSProperties} d="M19 5 L5 19" />
                      </>
                    )}
                  </svg>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
