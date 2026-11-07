import { useMemo, type ReactNode } from "react";

const KEYWORDS = new Set(("def return if elif else for while in not and or import from None True False continue break " +
  "class lambda is with as pass try except finally raise yield async await function const let var new this null " +
  "undefined public private protected static final void int long float double char bool boolean string String " +
  "struct enum fn mut match impl func package go defer interface type extends implements throw throws catch switch " +
  "case default do print println printf echo self super").split(" "));
const TOKEN = /(#.*$|\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`)|\b([A-Za-z_]\w*)\b|\b(\d+(?:\.\d+)?)\b/g;

function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const [tok, comment, str, word, num] = m;
    const k = m.index;
    if (comment) out.push(<span key={k} className="italic text-slate-400">{tok}</span>);
    else if (str) out.push(<span key={k} className="text-emerald-700">{tok}</span>);
    else if (word && KEYWORDS.has(word)) out.push(<span key={k} className="font-semibold text-brand-700">{tok}</span>);
    else if (num) out.push(<span key={k} className="text-amber-700">{tok}</span>);
    else out.push(tok);
    last = m.index + tok.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/**
 * Read-only code. With `raw`, the text is a server excerpt whose lines look like "  12 | code"
 * (or "   … |" for a gap); otherwise lines are numbered from 1.
 */
export function CodeView({ code, raw, dense }: { code: string; raw?: boolean; dense?: boolean }) {
  const rows = useMemo(() => code.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n").map((line, i) => {
    if (!raw) return { n: String(i + 1), text: line };
    const m = line.match(/^\s*(\d+|…) \| ?(.*)$/);
    return m ? { n: m[1], text: m[2] } : { n: "", text: line };
  }), [code, raw]);

  return (
    <div className="overflow-auto rounded-xl border-2 border-[#ece9f5] bg-[#fbfaff] font-mono" style={{ fontSize: dense ? "0.78rem" : "0.84rem" }}>
      <div className="min-w-max py-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex">
            <span className="w-12 shrink-0 select-none pr-3 text-right tabular-nums text-slate-400">{r.n}</span>
            <span className="whitespace-pre pr-4">{r.n === "…" ? "" : r.text.length ? highlight(r.text) : " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
