import { useEffect, useState } from "react";
import type { TraceView } from "../types";
import { CodeView } from "./CodeView";

/** Step-by-step BFS walkthrough: graph, queue, visited set and the code line being run. */
export function QueueTrace({ trace }: { trace: TraceView }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frames = trace.frames;
  const f = frames[i];
  const last = i === frames.length - 1;

  useEffect(() => { setI(0); setPlaying(false); }, [trace.code, trace.graph.nodes.length, frames.length]);
  useEffect(() => {
    if (!playing) return;
    if (last) { setPlaying(false); return; }
    const t = setTimeout(() => setI((x) => Math.min(x + 1, frames.length - 1)), 1700);
    return () => clearTimeout(t);
  }, [playing, i, last, frames.length]);

  const pos = Object.fromEntries(trace.graph.nodes.map((n) => [n.id, n]));
  const queued = new Set(f.queue);
  const visited = new Set(f.visited);
  const path = f.found_path ?? [];
  const onPath = (a: string, b: string) => {
    for (let k = 0; k + 1 < path.length; k++) {
      if ((path[k] === a && path[k + 1] === b) || (path[k] === b && path[k + 1] === a)) return true;
    }
    return false;
  };

  const nodeStyle = (id: string) => {
    if (id === f.current) return { fill: "var(--color-brand-600)", stroke: "var(--color-brand-800)", text: "white" };
    if (f.duplicate === id && queued.has(id)) return { fill: "var(--color-bad-100)", stroke: "var(--color-bad-500)", text: "var(--color-bad-700)" };
    if (queued.has(id)) return { fill: "var(--color-brand-100)", stroke: "var(--color-brand-500)", text: "var(--color-brand-800)" };
    if (visited.has(id)) return { fill: "var(--color-good-100)", stroke: "var(--color-good-600)", text: "var(--color-good-700)" };
    return { fill: "white", stroke: "#cfcae0", text: "#64748b" };
  };

  return (
    <div className="rounded-2xl border-2 border-[#ece9f5] bg-white p-3">
      <div className="grid gap-3 2xl:grid-cols-[1.1fr_1fr]">
        <div className="mx-auto w-full max-w-md">
          <svg viewBox="0 0 330 180" className="w-full" role="img" aria-label={`Graph, step ${i + 1}: ${f.note}`}>
            {trace.graph.edges.map(([a, b]) => (
              <line
                key={a + b}
                x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y}
                stroke={onPath(a, b) ? "var(--color-good-500)" : "#dcd7ea"}
                strokeWidth={onPath(a, b) ? 6 : 3}
                strokeLinecap="round"
              />
            ))}
            {trace.graph.nodes.map((n) => {
              const s = nodeStyle(n.id);
              return (
                <g key={n.id} style={{ transition: "all .3s" }}>
                  <circle cx={n.x} cy={n.y} r={18} fill={s.fill} stroke={s.stroke} strokeWidth={3} />
                  <text x={n.x} y={n.y + 5} textAnchor="middle" fontWeight={900} fontSize={15} fill={s.text}>{n.id}</text>
                  {f.dist && f.dist[n.id] !== undefined && (
                    <text x={n.x} y={n.y - 25} textAnchor="middle" fontSize={11} fontWeight={800} fill="var(--color-brand-700)">d={f.dist[n.id]}</text>
                  )}
                  {(n.id === trace.graph.start || n.id === trace.graph.goal) && (
                    <text x={n.x} y={n.y + 35} textAnchor="middle" fontSize={10} fontWeight={800} fill="#94a3b8" letterSpacing=".05em">
                      {n.id === trace.graph.start ? "START" : "GOAL"}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] font-bold text-slate-500">
            <Legend color="var(--color-brand-600)" label="exploring" />
            <Legend color="var(--color-brand-100)" border="var(--color-brand-500)" label="in queue" />
            <Legend color="var(--color-good-100)" border="var(--color-good-600)" label="visited" />
            {frames.some((x) => x.duplicate) && <Legend color="var(--color-bad-100)" border="var(--color-bad-500)" label="duplicate" />}
          </div>
        </div>
        <div className="min-w-0">
          <CodeView code={trace.code} highlight={[f.line]} dense />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 overflow-x-auto">
        <span className="shrink-0 text-xs font-extrabold uppercase tracking-wide text-slate-400">Front</span>
        <div className="flex min-h-10 items-center gap-1.5">
          {f.queue.length === 0 && <span className="text-sm font-bold text-slate-400">(empty)</span>}
          {f.queue.map((q, k) => (
            <span
              key={`${q}-${k}`}
              className={`pop-in flex h-9 w-9 items-center justify-center rounded-xl border-2 font-black ${
                f.duplicate === q && f.queue.filter((x) => x === q).length > 1
                  ? "border-bad-500 bg-bad-100 text-bad-700"
                  : "border-brand-400 bg-brand-50 text-brand-800"
              }`}
            >
              {q}
            </span>
          ))}
        </div>
        <span className="shrink-0 text-xs font-extrabold uppercase tracking-wide text-slate-400">Back</span>
        <span className="ml-auto shrink-0 text-xs font-bold text-slate-500">
          visited: <span className="font-mono text-good-700">{"{" + f.visited.join(", ") + "}"}</span>
        </span>
      </div>

      <div key={i} className="pop-in mt-3 rounded-xl bg-brand-50 px-3 py-2 text-[0.95rem] font-semibold text-brand-800">
        {f.note}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button className="chip" onClick={() => { setPlaying(false); setI((x) => Math.max(0, x - 1)); }} disabled={i === 0}>
          ← Back
        </button>
        <button className="chip" onClick={() => { setPlaying(false); setI((x) => Math.min(frames.length - 1, x + 1)); }} disabled={last}>
          Next step →
        </button>
        <button className="chip" onClick={() => { if (last) setI(0); setPlaying((p) => !p); }}>
          {playing ? "❚❚ Pause" : last ? "↺ Replay" : "▶ Play"}
        </button>
        <span className="ml-auto text-xs font-extrabold text-slate-400">Step {i + 1} of {frames.length}</span>
      </div>
    </div>
  );
}

function Legend({ color, border, label }: { color: string; border?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-3 w-3 rounded-full" style={{ background: color, border: `2px solid ${border ?? color}` }} />
      {label}
    </span>
  );
}
