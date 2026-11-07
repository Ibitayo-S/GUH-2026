// Mirrors backend/models.py. Keep in sync with docs/CONTRACT.md.

export type ConceptId = "queue_fifo" | "visited_set" | "shortest_path_guarantee";
export type Score = 0 | 1 | 2;
export type FeedbackSource = "model" | "fallback" | "demo";
export type ContentSource = "model" | "authored";
export type Mode = "live" | "mock";
export type Phase = "asking" | "feedback" | "learning" | "done";
export type StepKind =
  | "intuition" | "example" | "trace" | "mistake" | "your_code" | "check" | "alt" | "recap" | "prereq";
export type LearnAction =
  | "next" | "simpler" | "example" | "walkthrough" | "check" | "answer_check"
  | "learn_prereq" | "resume" | "return";

export interface Concept { id: ConceptId; label: string; description: string; prereqs: ConceptId[] }

export interface DemoAnswer {
  label: string; answer: string; score: Score; evidence: string; misconception: string | null; message: string;
}

export interface LabView {
  id: string; title: string; summary: string; concepts: Concept[]; sample_code: string;
  demo_answers: Record<ConceptId, DemoAnswer[]>;
}

export interface Finding { id: string; concept_id: ConceptId; lines: number[]; message: string; fix: string }

export interface Question {
  id: number; concept_id: ConceptId; text: string; code_lines: number[]; attempt: number; source: ContentSource;
}

export interface Feedback {
  question_id: number; concept_id: ConceptId; score: Score; verdict: string; evidence: string;
  misconception: string | null; message: string; missing: string[]; source: FeedbackSource;
}

export interface GraphNode { id: string; x: number; y: number }
export interface TraceGraph { nodes: GraphNode[]; edges: [string, string][]; start: string; goal: string }
export interface TraceFrame {
  line: number; current: string | null; queue: string[]; visited: string[]; note: string;
  dist?: Record<string, number> | null; duplicate?: string | null; found_path?: string[] | null;
}
export interface TraceView { graph: TraceGraph; code: string; frames: TraceFrame[] }

export interface CheckView { id: string; prompt: string; choices: { id: string; text: string }[] }
export interface CheckResult { correct: boolean; chosen: string; message: string }

export interface LessonView {
  concept_id: ConceptId; concept_label: string; step_kind: StepKind; step_index: number; step_count: number;
  title: string; body: string; code?: string | null; trace?: TraceView | null; highlight_lines: number[];
  check?: CheckView | null; check_result?: CheckResult | null; prereq_offer?: ConceptId | null;
  detour_from?: ConceptId | null; controls: LearnAction[]; source: ContentSource;
}

export interface ProgressItem {
  concept_id: ConceptId; label: string;
  status: "upcoming" | "current" | "learning" | "strong" | "developing" | "revisit" | "skipped";
}

export interface SessionView {
  session_id: string; mode: Mode; phase: Phase; code_links: Record<string, number[]>;
  findings: Finding[]; progress: ProgressItem[]; question?: Question | null; feedback?: Feedback | null;
  offer_learning: boolean; can_retry: boolean; lesson?: LessonView | null; notice?: string | null;
}

export interface Attempt { attempt: number; score: Score; evidence: string; source: FeedbackSource }

export interface ConceptReport {
  concept_id: ConceptId; label: string; status: "strong" | "developing" | "revisit" | "not_assessed";
  best_score: Score | null; attempts: Attempt[]; evidence: string | null; code_lines: number[];
  used_learning: boolean; checks_correct: number; checks_total: number; finding: string | null;
  next_step: string | null;
}

export interface Report {
  session_id: string; mode: Mode; lab_title: string; concepts: ConceptReport[]; strengths: string[];
  revisit: string[]; summary: string; any_fallback: boolean;
}
