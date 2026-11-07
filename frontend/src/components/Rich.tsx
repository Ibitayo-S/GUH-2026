import { Fragment, type ReactNode } from "react";

/** Tiny markdown subset: paragraphs, **bold**, *italic*, `code`. Model text is rendered as text, never as HTML. */
export function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i} className="font-extrabold">{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) return <code key={i} className="inline-code">{p.slice(1, -1)}</code>;
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function Rich({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`prose-viva ${className}`}>
      {text.split(/\n{2,}/).map((para, i) => <p key={i}>{inline(para)}</p>)}
    </div>
  );
}
