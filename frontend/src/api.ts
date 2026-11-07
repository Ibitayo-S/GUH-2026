import type { CodeFileIn, ManualIn, Quiz, QuizRequest, Results } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string, public retryable: boolean) {
    super(message);
  }
}

async function call<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the Viva server. Is the backend running on port 8000?", true);
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

export const api = {
  example: () => call<{ manual: ManualIn; code_files: CodeFileIn[] }>("/example", undefined, "GET"),
  create: (req: QuizRequest) => call<Quiz>("/quizzes", req),
  submit: (id: string, answers: (number | null)[]) => call<Results>(`/quizzes/${id}/submit`, { answers }),
  retake: (id: string) => call<Quiz>(`/quizzes/${id}/retake`),
};
