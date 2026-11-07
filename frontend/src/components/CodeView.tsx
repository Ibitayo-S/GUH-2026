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
    if (comment) out.push(<span key={k} className="italic text-muted">{tok}</span>);
    else if (str) out.push(<span key={k} className="text-[#8a4b0f]">{tok}</span>);
    else if (word && KEYWORDS.has(word)) out.push(<span key={k} className="font-semibold text-form-deep">{tok}</span>);
    else if (num) out.push(<span key={k} className="text-[#7a3f8f]">{tok}</span>);
    else out.push(tok);
    last = m.index + tok.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/**
 * Read-only code listing. With `raw`, the text is a server excerpt whose lines look like "  12 | code"
 * (or "   … |" for a gap). `cited` line numbers get a highlighter stroke.
 */
export function CodeView({ code, raw, cited = [] }: { code: string; raw?: boolean; cited?: number[] }) {
  const rows = useMemo(() => code.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n").map((line, i) => {
    if (!raw) return { n: String(i + 1), text: line };
    const m = line.match(/^\s*(\d+|…) \| ?(.*)$/);
    return m ? { n: m[1], text: m[2] } : { n: "", text: line };
  }), [code, raw]);
  const citedSet = new Set(cited.map(String));

  return (
    <div className="overflow-auto rounded-[4px] border border-rule bg-[#fbfcfa] font-mono text-[0.8rem] leading-[1.6]">
      <div className="min-w-max py-1.5">
        {rows.map((r, i) => {
          const on = citedSet.has(r.n);
          return (
            <div key={i} className="flex">
              <span className={`w-11 shrink-0 select-none border-r border-rule pr-2.5 text-right tabular-nums ${on ? "font-semibold text-ink" : "text-muted/70"}`}>{r.n}</span>
              <span className="whitespace-pre pl-3 pr-4">
                {r.n === "…" ? "" : <span className={on ? "bg-hl/70 [box-decoration-break:clone] px-0.5 -mx-0.5" : ""}>{r.text.length ? highlight(r.text) : " "}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
