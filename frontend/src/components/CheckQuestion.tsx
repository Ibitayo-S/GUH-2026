import type { CheckView } from "../types";
import { inline } from "./Rich";

export function CheckQuestion({ check, busy, onPick }: { check: CheckView; busy: boolean; onPick: (id: string) => void }) {
  return (
    <div className="pop-in">
      <p className="mb-3 text-lg font-extrabold leading-snug">{inline(check.prompt)}</p>
      <div className="grid gap-2.5">
        {check.choices.map((c, i) => (
          <button
            key={c.id}
            disabled={busy}
            onClick={() => onPick(c.id)}
            className="btn btn-ghost !justify-start !rounded-2xl text-left !font-bold"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-[#e4e0ef] text-sm font-black text-slate-500">
              {String.fromCharCode(65 + i)}
            </span>
            <span>{inline(c.text)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
