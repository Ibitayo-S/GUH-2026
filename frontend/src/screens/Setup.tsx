import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { CodeFileIn, ManualIn, QuizRequest } from "../types";
import { fileToBase64 } from "../util";

const MANUAL_ACCEPT = ".pdf,.md,.markdown,.txt";
const CODE_ACCEPT = ".py,.java,.c,.h,.cpp,.cc,.hpp,.js,.mjs,.ts,.tsx,.jsx,.kt,.rs,.go,.cs,.rb,.php,.swift,.scala,.sql,.sh,.r,.m,.hs,.txt";
const MAX_FILE = 10_000_000;

export function Setup({ initial, onGenerate }: { initial: QuizRequest | null; onGenerate: (req: QuizRequest) => void }) {
  const [manual, setManual] = useState<ManualIn | null>(initial?.manual ?? null);
  const [manualPaste, setManualPaste] = useState(initial?.manual?.text && !initial.manual.filename ? initial.manual.text : "");
  const [files, setFiles] = useState<CodeFileIn[]>(initial?.code_files ?? []);
  const [codePaste, setCodePaste] = useState("");
  const [pasteName, setPasteName] = useState("solution.py");
  const [error, setError] = useState<string | null>(null);
  const [example, setExample] = useState<{ manual: ManualIn; code_files: CodeFileIn[] } | null>(null);
  const manualRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.example().then(setExample).catch(() => { /* example is optional */ }); }, []);

  async function addManual(file?: File) {
    setError(null);
    if (!file) return;
    if (file.size > MAX_FILE) return setError("That manual is over 10 MB. Upload just this lab's section.");
    if (file.name.toLowerCase().endsWith(".pdf")) setManual({ filename: file.name, pdf_base64: await fileToBase64(file) });
    else {
      const text = await file.text();
      if (text.includes("\u0000")) return setError("That manual doesn't look like a text, Markdown or PDF file.");
      setManual({ filename: file.name, text });
    }
    setManualPaste("");
  }

  async function addCode(list: FileList | null) {
    setError(null);
    if (!list) return;
    const added: CodeFileIn[] = [];
    for (const f of Array.from(list)) {
      if (f.size > 300_000) { setError(`${f.name} is over 300 KB, so it was skipped.`); continue; }
      const text = await f.text();
      if (text.includes("\u0000")) { setError(`${f.name} doesn't look like a text file, so it was skipped.`); continue; }
      added.push({ filename: f.name, text });
    }
    setFiles((cur) => [...cur.filter((c) => !added.some((a) => a.filename === c.filename)), ...added]);
  }

  function useExample() {
    if (!example) return;
    setManual(example.manual); setManualPaste(""); setFiles(example.code_files); setCodePaste(""); setError(null);
  }

  function build(): QuizRequest | null {
    const m: ManualIn | null = manual ?? (manualPaste.trim() ? { filename: null, text: manualPaste } : null);
    const code = [...files];
    if (codePaste.trim()) {
      const name = pasteName.trim() || "solution.txt";
      if (code.some((c) => c.filename === name)) { setError(`You already have a file called ${name}. Rename the pasted code.`); return null; }
      code.push({ filename: name, text: codePaste });
    }
    if (!m && !code.length) { setError("Add your lab manual and your code first."); return null; }
    return { manual: m, code_files: code };
  }

  const hasManual = !!manual || !!manualPaste.trim();
  const hasCode = files.length > 0 || !!codePaste.trim();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <div className="max-w-3xl">
        <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-brand-700">Active recall for your labs</span>
        <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight md:text-[2.5rem]">
          Upload a lab manual and your code. <span className="text-brand-600">Get a 10-question quiz</span> that makes you recall what you learned.
        </h1>
        <p className="mt-3 font-semibold text-slate-600">
          Answer all ten from memory, with no hints along the way. Then see your score, the right answers and exactly where each one comes from in the manual or your code. Retake the ones you missed.
        </p>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        {/* manual */}
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-black text-white">1</span>
            <h2 className="text-lg font-black">Lab manual</h2>
            <span className="ml-auto text-xs font-bold text-slate-400">PDF, Markdown or text</span>
          </div>
          {manual ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-brand-50 px-3 py-3 ring-2 ring-brand-100">
              <span className="text-2xl" aria-hidden>📄</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-extrabold">{manual.filename ?? "Pasted manual"}</div>
                <div className="text-xs font-semibold text-slate-500">{manual.pdf_base64 ? "PDF: the text is extracted on the server" : `${(manual.text ?? "").length.toLocaleString()} characters`}</div>
              </div>
              <button className="text-sm font-bold text-brand-700 hover:underline" onClick={() => setManual(null)}>Remove</button>
            </div>
          ) : (
            <>
              <button className="btn btn-soft mt-4 w-full" onClick={() => manualRef.current?.click()}>⬆ Upload the manual</button>
              <div className="my-2 text-center text-xs font-bold text-slate-400">or paste it</div>
              <textarea value={manualPaste} onChange={(e) => setManualPaste(e.target.value)} rows={9} aria-label="Lab manual text"
                placeholder="Paste the lab instructions here…"
                className="w-full resize-y rounded-xl border-2 border-[#e4e0ef] bg-[#fbfaff] p-3 text-sm font-semibold outline-none focus:border-brand-400 focus:bg-white" />
            </>
          )}
          <input ref={manualRef} type="file" accept={MANUAL_ACCEPT} className="hidden" onChange={(e) => { addManual(e.target.files?.[0]); e.target.value = ""; }} />
        </section>

        {/* code */}
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-black text-white">2</span>
            <h2 className="text-lg font-black">Your code</h2>
            <span className="ml-auto text-xs font-bold text-slate-400">One or more files · never run</span>
          </div>
          <button className="btn btn-soft mt-4 w-full" onClick={() => codeRef.current?.click()}>⬆ Upload code files</button>
          <input ref={codeRef} type="file" multiple accept={CODE_ACCEPT} className="hidden" onChange={(e) => { addCode(e.target.files); e.target.value = ""; }} />
          {files.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {files.map((f) => (
                <li key={f.filename} className="flex items-center gap-2 rounded-lg bg-[#fbfaff] px-3 py-1.5 ring-2 ring-[#ece9f5]">
                  <span className="font-mono text-sm font-semibold">{f.filename}</span>
                  <span className="text-xs font-semibold text-slate-400">{f.text.replace(/\n+$/, "").split("\n").length} lines</span>
                  <button className="ml-auto text-xs font-bold text-brand-700 hover:underline" onClick={() => setFiles((cur) => cur.filter((c) => c !== f))}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          <div className="my-2 text-center text-xs font-bold text-slate-400">or paste it</div>
          <input value={pasteName} onChange={(e) => setPasteName(e.target.value)} aria-label="File name for pasted code"
            className="mb-1.5 w-full rounded-lg border-2 border-[#e4e0ef] px-3 py-1.5 font-mono text-sm outline-none focus:border-brand-400" />
          <textarea value={codePaste} onChange={(e) => setCodePaste(e.target.value)} rows={files.length ? 4 : 7} spellCheck={false} aria-label="Pasted code"
            placeholder="Paste your code here…"
            className="w-full resize-y rounded-xl border-2 border-[#e4e0ef] bg-[#fbfaff] p-3 font-mono text-[0.8rem] outline-none focus:border-brand-400 focus:bg-white" />
        </section>
      </div>

      {error && <p className="mt-4 font-bold text-rose-700">{error}</p>}

      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <button className="btn btn-primary !px-8 !py-3.5 text-lg" disabled={!hasManual && !hasCode} onClick={() => { const r = build(); if (r) onGenerate(r); }}>
          Generate my 10-question quiz →
        </button>
        <button className="btn btn-ghost" disabled={!example} onClick={useExample}>Use the example lab</button>
        <span className="text-sm font-semibold text-slate-400 sm:ml-2">
          {hasManual && hasCode ? "Manual + code: the best mix of questions." : hasManual ? "Add your code too for code-reading and debugging questions." : hasCode ? "Add the manual too for questions on the lab's concepts." : ""}
        </span>
      </div>
      <p className="mt-6 text-xs font-semibold text-slate-400">🔒 Your code is read as text and never run. Quizzes live only in this session.</p>
    </div>
  );
}
