<<<<<<< HEAD
export function formatLines(lines: number[], word = "line"): string {
  if (!lines.length) return "";
  const s = [...lines].sort((a, b) => a - b).map(String);
  if (s.length === 1) return `${word} ${s[0]}`;
  return `${word}s ${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`;
=======
import type { LineRange, QuestionType } from "./types";

export function rangesLabel(rs: LineRange[]): string {
  if (!rs.length) return "";
  const parts = rs.map((r) => (r.start === r.end ? `${r.start}` : `${r.start}–${r.end}`));
  return (rs.length === 1 && rs[0].start === rs[0].end ? "line " : "lines ") + parts.join(", ");
}

export const TYPE_LABEL: Record<QuestionType, string> = {
  conceptual: "Concept",
  code_reading: "Code reading",
  debugging: "Debugging",
};

export const LETTERS = ["A", "B", "C", "D", "E"];

export function expand(rs: LineRange[]): number[] {
  const out: number[] = [];
  for (const r of rs) for (let i = r.start; i <= r.end; i++) out.push(i);
  return out;
}

export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
>>>>>>> demo_front
}
