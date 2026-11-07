import { CodeView } from "../components/CodeView";
import { FeedbackCard } from "../components/FeedbackCard";
import { LessonPanel } from "../components/LessonPanel";
import { ProgressPath } from "../components/ProgressPath";
import { QuestionCard } from "../components/QuestionCard";
import { MockBanner } from "../components/SourceBadge";
import type { LabView, LearnAction, SessionView } from "../types";
import { formatLines } from "../util";

interface Props {
  view: SessionView;
  lab: LabView;
  code: string;
  filename: string;
  busy: boolean;
  actions: {
    answer: (t: string) => void;
    confused: () => void;
    learn: (a: LearnAction, choice?: string) => void;
    retry: () => void;
    next: () => void;
  };
}

export function Viva({ view, lab, code, filename, busy, actions }: Props) {
  const labels = Object.fromEntries(lab.concepts.map((c) => [c.id, c.label]));
  const highlight = view.phase === "learning" && view.lesson ? view.lesson.highlight_lines : view.question?.code_lines ?? [];
  const focusConcept = view.lesson?.concept_id ?? view.question?.concept_id;
  const isLast = view.progress.findIndex((p) => p.concept_id === view.question?.concept_id) === view.progress.length - 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {view.mode === "mock" && <div className="mb-4"><MockBanner /></div>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg" aria-hidden>📄</span>
              <span className="font-mono text-sm font-semibold text-slate-600">{filename}</span>
              <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-[0.7rem] font-black uppercase tracking-wide text-slate-500">Read-only · never run</span>
            </div>
            <CodeView code={code} highlight={highlight} maxHeight="calc(100vh - 15rem)" scrollToHighlight />
            {highlight.length > 0 && focusConcept && (
              <p className="mt-3 text-sm font-bold text-slate-500">
                <span className="mr-1.5 inline-block h-3 w-3 rounded-sm bg-amber-300 align-middle" />
                {formatLines(highlight, "Line")} {highlight.length === 1 ? "relates" : "relate"} to <span className="text-brand-700">{labels[focusConcept]}</span>.
              </p>
            )}
          </div>
        </aside>

        <main className="space-y-5">
          <div className="card px-4 py-4">
            <ProgressPath items={view.progress} />
          </div>

          {view.notice && (
            <div className="pop-in rounded-2xl border-2 border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-900">{view.notice}</div>
          )}

          {view.phase === "asking" && view.question && (
            <QuestionCard
              key={view.question.id}
              question={view.question}
              conceptLabel={labels[view.question.concept_id]}
              mode={view.mode}
              demoAnswers={lab.demo_answers[view.question.concept_id] ?? []}
              busy={busy}
              onAnswer={actions.answer}
              onConfused={actions.confused}
              onSkip={actions.next}
            />
          )}

          {view.phase === "feedback" && view.feedback && (
            <>
              {view.question && (
                <div className="rounded-2xl bg-white/60 px-4 py-3 text-sm font-semibold text-slate-500 ring-2 ring-[#ece9f5]">
                  <span className="font-black uppercase tracking-wide text-slate-400">Question · </span>{view.question.text.replace(/`/g, "")}
                </div>
              )}
              <FeedbackCard
                feedback={view.feedback}
                offerLearning={view.offer_learning}
                canRetry={view.can_retry}
                isLast={isLast}
                busy={busy}
                onLearn={actions.confused}
                onRetry={actions.retry}
                onContinue={actions.next}
              />
            </>
          )}

          {view.phase === "learning" && view.lesson && (
            <LessonPanel lesson={view.lesson} busy={busy} labels={labels} onAction={actions.learn} />
          )}
        </main>
      </div>
    </div>
  );
}
