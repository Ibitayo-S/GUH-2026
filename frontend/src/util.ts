export function formatLines(lines: number[], word = "line"): string {
  if (!lines.length) return "";
  const s = [...lines].sort((a, b) => a - b).map(String);
  if (s.length === 1) return `${word} ${s[0]}`;
  return `${word}s ${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`;
}
