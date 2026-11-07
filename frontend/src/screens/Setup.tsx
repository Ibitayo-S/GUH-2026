import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { AnswerSheet } from "../components/AnswerSheet";
import type { CodeFileIn, ManualIn, QuizRequest } from "../types";
import { fileToBase64 } from "../util";

const MANUAL_ACCEPT = ".pdf,.md,.markdown,.txt";
const CODE_ACCEPT = ".py,.java,.c,.h,.cpp,.cc,.hpp,.js,.mjs,.ts,.tsx,.jsx,.kt,.rs,.go,.cs,.rb,.php,.swift,.scala,.sql,.sh,.r,.m,.hs,.txt";
const MAX_FILE = 10_000_000;
const lineCount = (t: string) => t.replace(/\n+$/, "").split("\n").length;
const PREVIEW = [0, 2, null, 1, 3, null, 0, null, null, null];

export function Setup({ initial, onGenerate }: { initial: QuizRequest | null; onGenerate: (req: QuizRequest) => void }) {
  const [manual, setManual] = useState<ManualIn | null>(initial?.manual ?? null);
  const [manualPaste, setManualPaste] = useState("");
  const [files, setFiles] = useState<CodeFileIn[]>(initial?.code_files ?? []);
  const [codePaste, setCodePaste] = useState("");
  const [pasteName, setPasteName] = useState("solution.py");
  const [error, setError] = useState<string | null>(null);
  const [example, setExample] = useState<{ manual: ManualIn; code_files: CodeFileIn[] } | null>(null);
  const manualRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.example().then(setExample).catch(() => { /* the example is optional */ }); }, []);

  async function addManual(file?: File) {
    setError(null);
    if (!file) return;
    if (file.size > MAX_FILE) return setError("That manual is over 10 MB. Upload just this lab's section.");
    if (file.name.toLowerCase().endsWith(".pdf")) setManual({ filename: file.name, pdf_base64: await fileToBase64(file) });
    else {
      const text = await file.text();
      if (text.includes("\u0000")) return setError("That manual isn't a PDF, Markdown or text file.");
      setManual({ filename: file.name, text });
    }
    setManualPaste("");
  }

  async function addCode(list: FileList | null) {
    setError(null);
    if (!list) return;
    const added: CodeFileIn[] = [];
    for (const f of Array.from(list)) {
      if (f.size > 300_000) { setError(`${f.name} is over 300 KB, so it wasn't added.`); continue; }
      const text = await f.text();
      if (text.includes("\u0000")) { setError(`${f.name} isn't a text file, so it wasn't added.`); continue; }
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
      if (code.some((c) => c.filename === name)) { setError(`There's already a file called ${name}. Rename the pasted code.`); return null; }
      code.push({ filename: name, text: codePaste });
    }
    if (!m && !code.length) { setError("Add the lab manual and your code first."); return null; }
    return { manual: m, code_files: code };
  }

  const hasManual = !!manual || !!manualPaste.trim();
  const hasCode = files.length > 0 || !!codePaste.trim();

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 md:pt-14">
      <section className="grid items-center gap-10 lg:grid-cols-[1fr_300px]">
        <div className="rise">
          <p className="form-label">Active recall for lab work</p>
          <h1 className="display-wide mt-3 text-[2.2rem] leading-[1.05] md:text-[3.1rem]">
            Turn your lab into a ten&#8209;question recall test.
          </h1>
          <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-ink/80">
            Upload the lab manual and the code you wrote. Answer ten questions from memory, then get the sheet back
            marked, with every answer traced to a section of the manual or a line of your own code.
          </p>
        </div>
        <div className="hidden lg:block" aria-hidden>
          <div className="rotate-[1.5deg]">
            <AnswerSheet rows={10} answers={PREVIEW} compact label="Your answer sheet" />
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-5 lg:grid-cols-2" aria-label="Lab materials">
        {/* manual */}
        <div className="sheet p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl font-extrabold">Lab manual</h2>
            <span className="form-label">PDF · Markdown · text</span>
          </div>
          {manual ? (
            <FileRow name={manual.filename ?? "Pasted manual"}
              detail={manual.pdf_base64 ? "PDF: text is extracted when you generate" : `${(manual.text ?? "").length.toLocaleString()} characters`}
              onRemove={() => setManual(null)} />
          ) : (
            <>
              <DropButton label="Choose the manual" hint="or drop it here" onClick={() => manualRef.current?.click()}
                onDrop={(f) => addManual(f[0])} />
              <textarea value={manualPaste} onChange={(e) => setManualPaste(e.target.value)} rows={7} aria-label="Paste the lab manual"
                placeholder="…or paste the lab instructions"
                className="mt-3 w-full resize-y rounded-[4px] border border-rule bg-paper/60 p-3 text-[0.92rem] outline-none focus:border-form focus:bg-sheet" />
            </>
          )}
          <input ref={manualRef} type="file" accept={MANUAL_ACCEPT} className="hidden" onChange={(e) => { addManual(e.target.files?.[0]); e.target.value = ""; }} />
        </div>

        {/* code */}
        <div className="sheet p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl font-extrabold">Your code</h2>
            <span className="form-label">Read as text · never run</span>
          </div>
          {files.map((f) => (
            <FileRow key={f.filename} name={f.filename} mono detail={`${lineCount(f.text)} lines`}
              onRemove={() => setFiles((cur) => cur.filter((c) => c !== f))} />
          ))}
          <DropButton label={files.length ? "Add more files" : "Choose code files"} hint="or drop them here" onClick={() => codeRef.current?.click()}
            onDrop={(f) => { const dt = new DataTransfer(); f.forEach((x) => dt.items.add(x)); addCode(dt.files); }} />
          <input ref={codeRef} type="file" multiple accept={CODE_ACCEPT} className="hidden" onChange={(e) => { addCode(e.target.files); e.target.value = ""; }} />
          <div className="mt-3 overflow-hidden rounded-[4px] border border-rule bg-paper/60 focus-within:border-form focus-within:bg-sheet">
            <input value={pasteName} onChange={(e) => setPasteName(e.target.value)} aria-label="File name for pasted code"
              className="w-full border-b border-rule bg-transparent px-3 py-1.5 font-mono text-[0.8rem] text-muted outline-none" />
            <textarea value={codePaste} onChange={(e) => setCodePaste(e.target.value)} rows={files.length ? 3 : 6} spellCheck={false}
              aria-label="Paste your code" placeholder="…or paste your code"
              className="w-full resize-y bg-transparent p-3 font-mono text-[0.8rem] outline-none" />
          </div>
        </div>
      </section>

      {error && <p className="mt-4 font-semibold text-redpen" role="alert">{error}</p>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button className="btn btn-primary !px-7 !py-3 text-[1.05rem]" disabled={!hasManual && !hasCode}
          onClick={() => { const r = build(); if (r) onGenerate(r); }}>
          Generate quiz
        </button>
        <button className="btn btn-ghost" disabled={!example} onClick={useExample}>Use the example lab</button>
        <span className="text-[0.9rem] text-muted sm:ml-2">
          {hasManual && hasCode ? "Questions will come from both the manual and your code."
            : hasManual ? "Add your code for code-reading and debugging questions."
            : hasCode ? "Add the manual for questions on the lab's concepts." : "Quizzes stay in this browser session only."}
        </span>
      </div>
    </div>
  );
}

function FileRow({ name, detail, mono, onRemove }: { name: string; detail: string; mono?: boolean; onRemove: () => void }) {
  return (
    <div className="rise mt-4 flex items-center gap-3 rounded-[4px] border border-form/30 bg-form-tint/50 px-3 py-2.5">
      <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden className="shrink-0 text-form">
        <path d="M1 1h9l5 5v13H1z" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M10 1v5h5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <div className="min-w-0 flex-1">
        <div className={`truncate font-semibold ${mono ? "font-mono text-[0.88rem]" : ""}`}>{name}</div>
        <div className="text-[0.8rem] text-muted">{detail}</div>
      </div>
      <button className="link text-[0.85rem]" onClick={onRemove}>Remove</button>
    </div>
  );
}

function DropButton({ label, hint, onClick, onDrop }: { label: string; hint: string; onClick: () => void; onDrop: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(Array.from(e.dataTransfer.files)); }}
      className={`mt-4 flex w-full flex-col items-center rounded-[4px] border-[1.5px] border-dashed px-4 py-5 transition ${over ? "border-form bg-form-tint" : "border-form/45 hover:border-form hover:bg-form-tint/40"}`}>
      <span className="font-display font-bold text-form-deep" style={{ fontStretch: "92%" }}>{label}</span>
      <span className="text-[0.82rem] text-muted">{hint}</span>
    </button>
  );
}
