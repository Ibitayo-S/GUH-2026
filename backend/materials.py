"""Turning uploaded lab materials into text for the quiz prompt.

The manual may be a PDF (text extracted with PyMuPDF, as in backend/parse.py), Markdown or plain text.
Student code is only ever handled as text: it is numbered for line references, never imported or run.
"""
from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass

from models import CodeFileIn, LineRange, ManualIn, QuizRequest

MAX_MANUAL_CHARS = 300_000
MAX_CODE_CHARS = 200_000


class MaterialsError(ValueError):
    """Bad or unusable input: shown to the learner as-is (HTTP 422)."""


@dataclass
class Materials:
    manual_name: str | None
    manual_text: str
    code_files: list[CodeFileIn]

    def file(self, name: str | None) -> CodeFileIn | None:
        if not name:
            return None
        exact = next((f for f in self.code_files if f.filename == name), None)
        if exact:
            return exact
        base = name.replace("\\", "/").rsplit("/", 1)[-1]
        return next((f for f in self.code_files if f.filename.replace("\\", "/").rsplit("/", 1)[-1] == base), None)

    def describe(self) -> dict[str, str]:
        out = {}
        if self.manual_text:
            out["manual"] = f"{self.manual_name or 'pasted manual'} ({len(self.manual_text):,} characters)"
        if self.code_files:
            out["code"] = ", ".join(f.filename for f in self.code_files)
        return out


def pdf_to_text(data: bytes) -> str:
    import pymupdf  # imported lazily: only needed for PDF manuals

    try:
        with pymupdf.open(stream=data, filetype="pdf") as doc:
            return "\n".join(page.get_text() for page in doc)
    except Exception as exc:  # noqa: BLE001 - any parse failure is a user-facing input problem
        raise MaterialsError(f"Couldn't read that PDF ({exc.__class__.__name__}). Try exporting it again or paste the text.")


def load(req: QuizRequest) -> Materials:
    manual_name, manual_text = None, ""
    if req.manual:
        manual_name = req.manual.filename
        if req.manual.pdf_base64:
            try:
                raw = base64.b64decode(req.manual.pdf_base64, validate=True)
            except (binascii.Error, ValueError):
                raise MaterialsError("The PDF upload was corrupted. Please try uploading it again.")
            manual_text = pdf_to_text(raw)
            if not manual_text.strip():
                raise MaterialsError("That PDF has no extractable text (it may be scanned images). Paste the manual text instead.")
        elif req.manual.text:
            manual_text = req.manual.text
    manual_text = manual_text.strip()

    files = [f for f in req.code_files if f.text.strip()]
    names = [f.filename for f in files]
    if len(set(names)) != len(names):
        raise MaterialsError("Two code files have the same name. Rename one of them.")
    if not manual_text and not files:
        raise MaterialsError("Add the lab manual and your code (at least one of them) to generate a quiz.")
    if len(manual_text) > MAX_MANUAL_CHARS:
        raise MaterialsError(f"The manual is very long ({len(manual_text):,} characters). Upload just this lab's section "
                             f"(up to {MAX_MANUAL_CHARS:,} characters).")
    total = sum(len(f.text) for f in files)
    if total > MAX_CODE_CHARS:
        raise MaterialsError(f"The code is very long ({total:,} characters). Upload just the files for this lab.")
    if any("\x00" in f.text for f in files):
        raise MaterialsError("One of the code files doesn't look like text.")
    return Materials(manual_name=manual_name, manual_text=manual_text, code_files=files)


def numbered(text: str) -> str:
    return "\n".join(f"{i:>4} | {line}" for i, line in enumerate(text.splitlines(), start=1))


def clean_ranges(ranges: list[LineRange] | None, n_lines: int) -> list[LineRange]:
    """Keep only line references that exist; fix reversed ranges; clamp overlong ones; drop duplicates."""
    out: list[LineRange] = []
    for r in ranges or []:
        a, b = sorted((r.start, r.end))
        if b < 1 or a > n_lines:
            continue
        a, b = max(1, a), min(n_lines, b)
        if not any(x.start == a and x.end == b for x in out):
            out.append(LineRange(start=a, end=b))
    return sorted(out, key=lambda r: (r.start, r.end))


def excerpt(text: str, ranges: list[LineRange], context: int = 1) -> str:
    """Numbered lines covering the ranges (plus a little context), with '…' between gaps."""
    lines = text.splitlines()
    keep: set[int] = set()
    for r in ranges:
        keep.update(range(max(1, r.start - context), min(len(lines), r.end + context) + 1))
    out, prev = [], None
    for n in sorted(keep):
        if prev is not None and n != prev + 1:
            out.append("   … |")
        out.append(f"{n:>4} | {lines[n - 1]}")
        prev = n
    return "\n".join(out)
