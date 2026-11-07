<<<<<<< HEAD
import type { LabView, LearnAction, Report, SessionView } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
=======
import type { CodeFileIn, ManualIn, Quiz, QuizRequest, Results } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string, public retryable: boolean) {
>>>>>>> demo_front
    super(message);
  }
}

<<<<<<< HEAD
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(0, "Can't reach the Viva server. Is the backend running on port 8000?");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch { /* keep statusText */ }
    throw new ApiError(res.status, detail);
=======
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
>>>>>>> demo_front
  }
  return res.json() as Promise<T>;
}

<<<<<<< HEAD
const post = <T,>(path: string, body?: unknown) =>
  call<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  lab: (labId = "bfs-grid") => call<LabView>(`/labs/${labId}`),
  start: (code: string, labId = "bfs-grid") => post<SessionView>("/sessions", { lab_id: labId, code }),
  answer: (sid: string, answer: string) => post<SessionView>(`/sessions/${sid}/answer`, { answer }),
  confused: (sid: string) => post<SessionView>(`/sessions/${sid}/confused`),
  learn: (sid: string, action: LearnAction, checkChoice?: string) =>
    post<SessionView>(`/sessions/${sid}/learn`, { action, check_choice: checkChoice ?? null }),
  retry: (sid: string) => post<SessionView>(`/sessions/${sid}/retry`),
  next: (sid: string) => post<SessionView>(`/sessions/${sid}/continue`),
  report: (sid: string) => call<Report>(`/sessions/${sid}/report`),
=======
export const api = {
  example: () => call<{ manual: ManualIn; code_files: CodeFileIn[] }>("/example", undefined, "GET"),
  create: (req: QuizRequest) => call<Quiz>("/quizzes", req),
  submit: (id: string, answers: (number | null)[]) => call<Results>(`/quizzes/${id}/submit`, { answers }),
  retake: (id: string) => call<Quiz>(`/quizzes/${id}/retake`),
>>>>>>> demo_front
};
