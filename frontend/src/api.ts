import type { LabView, LearnAction, Report, SessionView } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

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
  }
  return res.json() as Promise<T>;
}

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
};
