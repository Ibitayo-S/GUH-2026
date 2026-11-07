import { useRef, useState } from "react";
import type { LabView } from "../types";

interface Props {
  lab: LabView | null;
  busy: boolean;
  onStart: (code: string, filename: string) => void;
}

const MAX_BYTES = 200_000;

export function Submit({ lab, busy, onStart }: Props) {
  const [code, setCode] = useState("");
  const [filename, setFilename] = useState("my_solution.py");
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    setFileError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".py")) { setFileError("Please choose a Python (.py) file."); return; }
    if (file.size > MAX_BYTES) { setFileError("That file is over 200 KB. Paste the relevant function instead."); return; }
    // Read as plain text. Viva never runs the code.
    setCode(await file.text());
    setFilename(file.name);
  }

  const lineCount = code ? code.replace(/\n+$/, "").split("\n").length : 0;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:py-12 lg:grid-cols-[1fr_1.15fr] lg:items-start">
      <section className="lg:pt-6">
        <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-brand-700">
          Understanding check, not a cheating detector
        </span>
        <h1 className="mt-4 text-3xl font-black leading-[1.12] tracking-tight md:text-4xl xl:text-[2.75rem]">
          Upload your code. <span className="text-brand-600">Viva finds where your understanding breaks,</span> teaches the missing idea step by step, then checks you can apply it.
        </h1>
        <p className="mt-4 text-lg font-semibold text-slate-600">
          Your tests prove your code works. Viva helps you prove to yourself that you understand <em>why</em>.
        </p>

        <ol className="mt-7 space-y-3">
          {[
            ["1", "Submit your BFS solution", "Paste it or upload a .py file."],
            ["2", "Answer questions about your own lines", "Each question highlights the code it's about."],
            ["3", "Stuck? Learn it step by step", "Intuition, a tiny example, a trace, a common mistake, then back to your code."],
            ["4", "Get a report tied to your code", "Strengths, gaps, evidence and one next step per gap."],
          ].map(([n, t, d]) => (
            <li key={n} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-lg font-black text-brand-600 shadow-[0_3px_0_0_#ece9f5] ring-2 ring-[#ece9f5]">{n}</span>
              <div>
                <div className="font-extrabold">{t}</div>
                <div className="text-sm font-semibold text-slate-500">{d}</div>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-7 rounded-2xl bg-white/70 p-4 text-sm font-semibold text-slate-600 ring-2 ring-[#ece9f5]">
          🔒 <strong className="font-extrabold">Formative and private.</strong> Viva is student-initiated and isn't graded.
          Your code is read as text and <strong className="font-extrabold">never run</strong>.
        </p>
      </section>

      <section className="card p-5 md:p-6">
        <div className="text-xs font-black uppercase tracking-wider text-slate-400">Lab</div>
        <h2 className="mt-1 text-xl font-black">{lab?.title ?? "Loading lab…"}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">{lab?.summary}</p>
        {lab && (
          <div className="mt-3 flex flex-wrap gap-2">
            {lab.concepts.map((c) => (
              <span key={c.id} title={c.description} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-extrabold text-brand-700">{c.label}</span>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button className="btn btn-soft !py-2 text-sm" onClick={() => fileRef.current?.click()}>⬆ Upload .py file</button>
          <input ref={fileRef} type="file" accept=".py,text/x-python" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          <button
            className="btn btn-soft !py-2 text-sm"
            disabled={!lab}
            onClick={() => { if (lab) { setCode(lab.sample_code); setFilename("sample_solution.py"); setFileError(null); } }}
          >
            Use sample BFS solution
          </button>
          {code && <span className="ml-auto text-xs font-bold text-slate-400">{filename} · {lineCount} lines</span>}
        </div>
        {fileError && <p className="mt-2 text-sm font-bold text-bad-700">{fileError}</p>}

        <textarea
          value={code}
          onChange={(e) => { setCode(e.target.value); if (filename === "sample_solution.py") setFilename("my_solution.py"); }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
          spellCheck={false}
          placeholder={"Paste your BFS solution here, or drop a .py file.\n\nfrom collections import deque\n\ndef shortest_path(grid, start, goal):\n    ..."}
          className="mt-3 h-[22rem] w-full resize-y rounded-2xl border-2 border-[#e4e0ef] bg-[#fbfaff] p-4 font-mono text-[0.82rem] leading-relaxed outline-none transition focus:border-brand-400 focus:bg-white"
          aria-label="Your code"
        />

        <button className="btn btn-primary mt-4 w-full !py-3.5 text-lg" disabled={!code.trim() || busy} onClick={() => onStart(code, filename)}>
          {busy ? "Reading your code…" : "Start my viva →"}
        </button>
        <p className="mt-2 text-center text-xs font-semibold text-slate-400">About five minutes · three concepts · you can ask for help at any point</p>
      </section>
    </div>
  );
}
