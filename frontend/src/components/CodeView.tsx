import { useEffect, useMemo, useRef, type ReactNode } from "react";

const KEYWORDS = new Set([
  "def", "return", "if", "elif", "else", "for", "while", "in", "not", "and", "or", "import", "from",
  "None", "True", "False", "continue", "break", "class", "lambda", "is", "with", "as", "pass", "print",
]);
const TOKEN = /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b([A-Za-z_]\w*)\b|\b(\d+)\b/g;

function highlightPython(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const [tok, comment, str, word, num] = m;
    const k = `${m.index}`;
    if (comment) out.push(<span key={k} className="text-slate-400 italic">{tok}</span>);
    else if (str) out.push(<span key={k} className="text-emerald-700">{tok}</span>);
    else if (word && KEYWORDS.has(word)) out.push(<span key={k} className="text-brand-700 font-semibold">{tok}</span>);
    else if (word && /^(deque|set|len|range|append|popleft|pop|add)$/.test(word)) out.push(<span key={k} className="text-sky-700">{tok}</span>);
    else if (num) out.push(<span key={k} className="text-amber-700">{tok}</span>);
    else out.push(tok);
    last = m.index + tok.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

interface Props {
  code: string;
  highlight?: number[];
  /** Show only lines around the highlight (for report snippets). */
  window?: number;
  maxHeight?: string;
  scrollToHighlight?: boolean;
  dense?: boolean;
}

export function CodeView({ code, highlight = [], window, maxHeight, scrollToHighlight, dense }: Props) {
  const lines = useMemo(() => code.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n"), [code]);
  const hl = useMemo(() => new Set(highlight), [highlight]);
  const boxRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLDivElement>(null);
  const first = highlight.length ? Math.min(...highlight) : null;

  useEffect(() => {
    if (!scrollToHighlight || !firstRef.current || !boxRef.current) return;
    const box = boxRef.current;
    const top = firstRef.current.offsetTop - box.clientHeight / 3;
    box.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [scrollToHighlight, first, highlight.join(",")]);

  let start = 1;
  let end = lines.length;
  if (window !== undefined && highlight.length) {
    start = Math.max(1, Math.min(...highlight) - window);
    end = Math.min(lines.length, Math.max(...highlight) + window);
  }

  return (
    <div
      ref={boxRef}
      className="relative overflow-auto rounded-2xl bg-[#fbfaff] border-2 border-[#ece9f5] font-mono"
      style={{ maxHeight, fontSize: dense ? "0.76rem" : "0.82rem" }}
    >
      <div className="min-w-max py-2">
        {lines.slice(start - 1, end).map((text, i) => {
          const n = start + i;
          const on = hl.has(n);
          return (
            <div
              key={n}
              ref={n === first ? firstRef : undefined}
              className={`flex transition-colors duration-300 ${on ? "bg-amber-100/80" : ""}`}
            >
              <span
                className={`sticky left-0 w-11 shrink-0 select-none pr-3 text-right tabular-nums ${
                  on ? "bg-amber-200/90 text-amber-900 font-semibold" : "bg-[#fbfaff] text-slate-400"
                }`}
              >
                {n}
              </span>
              <span className={`border-l-4 pl-3 pr-4 whitespace-pre ${on ? "border-amber-400" : "border-transparent"}`}>
                {text.length ? highlightPython(text) : " "}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
