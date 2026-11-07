import type { CodeFileIn, ManualIn, Quiz, QuizRequest, Results } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string, public retryable: boolean) {
    super(message);
  }
}

async function call<T>(path: string, body?: unknown, method = "POST", headers: Record<string, string> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the Viva server. Check your connection and try again.", true);
  }
  if (res.status === 413) {
    throw new ApiError(413, "Those materials are too large to upload. Try a smaller PDF, or paste just this lab's section.", false);
  }
  if (!res.ok) {
    let detail = res.statusText;
    let retryable = res.status >= 500 && res.status !== 503;
    try {
      const b = await res.json();
      if (typeof b.detail === "string") detail = b.detail;
      else if (Array.isArray(b.detail)) detail = b.detail.map((d: { msg: string }) => d.msg).join("; ");
      if (typeof b.retryable === "boolean") retryable = b.retryable;
    } catch { /* keep statusText */ }
    throw new ApiError(res.status, detail, retryable);
  }
  return res.json() as Promise<T>;
}

export interface Health { live: boolean; model: string; demo_forced: boolean; accepts_user_key: boolean }

export const api = {
  health: () => call<Health>("/health", undefined, "GET"),
  example: () => call<{ manual: ManualIn; code_files: CodeFileIn[] }>("/example", undefined, "GET"),
  // A visitor's own Anthropic key travels only in this request's header; the server never stores it.
  create: (req: QuizRequest, apiKey?: string) =>
    call<Quiz>("/quizzes", req, "POST", apiKey ? { "X-Anthropic-Api-Key": apiKey } : {}),
  submit: (quiz: Quiz, answers: (number | null)[]) => call<Results>("/quizzes/submit", { token: quiz.token, answers }),
  retake: (quiz: Quiz, answers: (number | null)[]) => call<Quiz>("/quizzes/retake", { token: quiz.token, answers }),
};
