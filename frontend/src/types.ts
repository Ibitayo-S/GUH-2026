// Mirrors backend/models.py.

export type Source = "live" | "demo";
export type QuestionType = "conceptual" | "code_reading" | "debugging";
export interface LineRange { start: number; end: number }

export interface ManualIn { filename?: string | null; text?: string | null; pdf_base64?: string | null }
export interface CodeFileIn { filename: string; text: string }
export interface QuizRequest { manual?: ManualIn | null; code_files: CodeFileIn[] }

export interface CodeExcerpt { file: string; lines: LineRange[]; text: string }

export interface QuizQuestion {
  number: number; type: QuestionType; topic: string; question: string; choices: string[]; code: CodeExcerpt | null;
}
export interface Quiz {
  quiz_id: string; token: string; title: string; source: Source; model: string | null; questions: QuizQuestion[];
  is_retake: boolean; materials: Record<string, string>;
}

export interface QuestionResult {
  number: number; type: QuestionType; topic: string; question: string; choices: string[];
  chosen_index: number | null; correct_index: number; correct: boolean; explanation: string;
  source_kind: "manual" | "code"; source_ref: string; code: CodeExcerpt | null;
}
export interface TopicResult { topic: string; correct: number; total: number }
export interface Results {
  quiz_id: string; title: string; source: Source; score: number; total: number; unanswered: number;
  by_type: Record<string, [number, number]>; review_topics: TopicResult[]; questions: QuestionResult[]; can_retake: boolean;
}
