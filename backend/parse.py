import sys, json, pathlib
import anthropic, pymupdf
from dotenv import load_dotenv
load_dotenv()

SKIP_DIRS = {".git", "node_modules", "build", "target", "__pycache__", ".idea"}
CODE_EXT = {".java", ".py", ".c", ".cpp", ".h", ".js", ".ts", ".kt", ".rs", ".go"}
MAX_FILE_CHARS = 16000

def read_manual(path):
    p = pathlib.Path(path)
    if p.suffix == ".pdf":
        return "\n".join(page.get_text() for page in pymupdf.open(p))
    return p.read_text()

def read_code(path):
    root = pathlib.Path(path)
    if root.is_file():
        return f"=== FILE: {root.name} ===\n{root.read_text(errors='ignore')[:MAX_FILE_CHARS]}"
    parts = []
    for f in sorted(root.rglob("*")):
        rel = f.relative_to(root)
        if not f.is_file() or any(d in SKIP_DIRS for d in rel.parts) or f.suffix not in CODE_EXT:
            continue
        parts.append(f"=== FILE: {rel} ===\n{f.read_text(errors='ignore')[:MAX_FILE_CHARS]}")
    return "\n\n".join(parts)

manual = read_manual(sys.argv[1])
code = read_code(sys.argv[2])
print(f"manual: {len(manual)} chars, code: {len(code)} chars", file=sys.stderr)

template = pathlib.Path("prompt.txt").read_text()
assert "{manual}" in template and "{code}" in template, "prompt.txt missing placeholders"
prompt = template.replace("{manual}", manual).replace("{code}", code)

client = anthropic.Anthropic()
resp = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=16000,
    messages=[{"role": "user", "content": prompt}],
)
text = "".join(b.text for b in resp.content if b.type == "text")
text = text.strip().removeprefix("```json").removesuffix("```").strip()
questions = json.loads(text)
print(json.dumps(questions, indent=2))