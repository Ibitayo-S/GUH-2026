"""Static analysis of a student's BFS code.

The code is only *parsed* (ast.parse) or scanned with regexes. It is never imported or executed.
Output: which lines relate to which concept, named "role" lines for question/lesson templates,
and findings such as "visited is marked when a cell is dequeued".
"""
from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field

from models import Finding

VISITED_HINTS = ("visit", "seen", "explored", "discovered", "closed")
GOAL_HINTS = ("goal", "target", "end", "dest", "finish")


@dataclass
class Analysis:
    parsed: bool
    lines: dict[str, list[int]]            # concept_id -> lines
    roles: dict[str, int]                  # pop_line, append_line, add_line, ...
    flags: set[str] = field(default_factory=set)
    findings: list[Finding] = field(default_factory=list)
    looks_like_bfs: bool = True

    def lines_for(self, concept_id: str, template: str = "") -> list[int]:
        """Concept lines plus any role line a question/lesson template mentions (e.g. {append_line})."""
        import string

        refs = {f for _, f, _, _ in string.Formatter().parse(template) if f}
        extra = {self.roles[r] for r in refs if r in self.roles}
        return sorted(set(self.lines.get(concept_id, [])) | extra)

    def role_text(self) -> dict[str, str]:
        out = {k: str(v) for k, v in self.roles.items()}
        out["visited_lines"] = format_lines(self.lines.get("visited_set", []))
        return out


def format_lines(lines: list[int]) -> str:
    if not lines:
        return "the highlighted lines"
    s = [str(n) for n in lines]
    return s[0] if len(s) == 1 else ", ".join(s[:-1]) + " and " + s[-1]


def _name_of(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return None


def _is_visited_name(name: str | None) -> bool:
    return bool(name) and any(h in name.lower() for h in VISITED_HINTS)


def _parents(tree: ast.AST) -> dict[ast.AST, ast.AST]:
    parents: dict[ast.AST, ast.AST] = {}
    for node in ast.walk(tree):
        for child in ast.iter_child_nodes(node):
            parents[child] = node
    return parents


def _ancestors(node: ast.AST, parents: dict[ast.AST, ast.AST]):
    while node in parents:
        node = parents[node]
        yield node


def analyze(code: str) -> Analysis:
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return _regex_analyze(code)
    return _ast_analyze(tree)


def _ast_analyze(tree: ast.AST) -> Analysis:
    parents = _parents(tree)
    queue_names: set[str] = set()
    visited_names: set[str] = set()

    # Pass 1: discover the queue and visited variable names.
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call):
            fn = _name_of(node.value.func)
            for t in node.targets:
                tn = _name_of(t)
                if fn == "deque" and tn:
                    queue_names.add(tn)
                if fn in ("set", "dict") and _is_visited_name(tn):
                    visited_names.add(tn)
        if isinstance(node, ast.Assign) and isinstance(node.value, (ast.Set, ast.Dict, ast.List, ast.SetComp)):
            for t in node.targets:
                if _is_visited_name(_name_of(t)):
                    visited_names.add(_name_of(t))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            owner = _name_of(node.func.value)
            if node.func.attr == "popleft" and owner:
                queue_names.add(owner)
            if node.func.attr == "add" and _is_visited_name(owner):
                visited_names.add(owner)

    roles: dict[str, int] = {}
    q_lines: set[int] = set()
    v_lines: set[int] = set()
    check_lines: set[int] = set()
    g_lines: set[int] = set()
    flags: set[str] = set()
    add_nodes: list[ast.AST] = []
    append_nodes: list[ast.AST] = []
    pop_node = None
    bfs_loop = None

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call) and _name_of(node.value.func) == "deque":
            q_lines.add(node.lineno)
            roles.setdefault("deque_line", node.lineno)
        if isinstance(node, ast.Assign) and any(_name_of(t) in visited_names for t in node.targets):
            v_lines.add(node.lineno)
            roles.setdefault("visited_init_line", node.lineno)
        if isinstance(node, ast.While) and any(
            isinstance(n, ast.Name) and n.id in queue_names for n in ast.walk(node.test)
        ):
            bfs_loop = bfs_loop or node
            roles.setdefault("while_line", node.lineno)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            owner, attr = _name_of(node.func.value), node.func.attr
            if owner in queue_names and attr in ("popleft", "pop"):
                q_lines.add(node.lineno)
                if pop_node is None:
                    pop_node = node
                    roles["pop_line"] = node.lineno
                if attr == "pop" and not node.args:
                    flags.add("uses_pop")
            if owner in queue_names and attr in ("append", "appendleft"):
                append_nodes.append(node)
            if owner in visited_names and attr == "add":
                v_lines.add(node.lineno)
                add_nodes.append(node)
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Subscript) and _name_of(t.value) in visited_names:
                    v_lines.add(node.lineno)
                    add_nodes.append(node)
        if isinstance(node, ast.Compare):
            for op, comp in zip(node.ops, node.comparators):
                if isinstance(op, (ast.In, ast.NotIn)) and _name_of(comp) in visited_names:
                    v_lines.add(node.lineno)
                    check_lines.add(node.lineno)
                if isinstance(op, ast.Eq):
                    names = [_name_of(node.left), _name_of(comp)]
                    if any(n and any(h in n.lower() for h in GOAL_HINTS) for n in names):
                        g_lines.add(node.lineno)
                        roles.setdefault("goal_line", node.lineno)

    append_nodes.sort(key=lambda n: n.lineno)
    add_nodes.sort(key=lambda n: n.lineno)
    if append_nodes:
        # Prefer the append inside the main loop (the neighbour append), not the initial seed.
        in_loop = [n for n in append_nodes if bfs_loop is not None and bfs_loop in _ancestors(n, parents)]
        roles["append_line"] = (in_loop or append_nodes)[0].lineno
        q_lines.add(roles["append_line"])

    # Return under the goal check.
    if "goal_line" in roles:
        for node in ast.walk(tree):
            if isinstance(node, ast.Return) and node.lineno >= roles["goal_line"]:
                if any(getattr(a, "lineno", None) == roles["goal_line"] for a in _ancestors(node, parents)):
                    roles["return_line"] = node.lineno
                    g_lines.add(node.lineno)
                    break

    # Visited-on-dequeue: inside the BFS loop, cells are added to visited outside the inner
    # neighbour loop (i.e. right after popping), and never at the point they are appended.
    if bfs_loop is not None and add_nodes:
        loop_adds = [n for n in add_nodes if bfs_loop in _ancestors(n, parents)]
        inner_loops = [n for n in ast.walk(bfs_loop) if isinstance(n, (ast.For, ast.While)) and n is not bfs_loop]
        adds_in_inner = [n for n in loop_adds if any(l in _ancestors(n, parents) for l in inner_loops)]
        adds_outer = [n for n in loop_adds if n not in adds_in_inner]
        if adds_outer and not adds_in_inner:
            flags.add("visited_on_dequeue")
            roles["add_line"] = adds_outer[0].lineno
        elif adds_in_inner:
            roles["add_line"] = adds_in_inner[0].lineno
    elif add_nodes:
        roles["add_line"] = add_nodes[0].lineno

    # Membership check just before the append (the guard), and the skip-on-pop check.
    if "append_line" in roles:
        guards = [l for l in check_lines if l < roles["append_line"] and l > roles.get("pop_line", 0)]
        if guards:
            roles["check_line"] = max(guards)
    if not visited_names:
        flags.add("no_visited")

    lines = {
        "queue_fifo": sorted(q_lines),
        "visited_set": sorted(v_lines),
        "shortest_path_guarantee": sorted(g_lines | ({roles["pop_line"]} if "pop_line" in roles else set())),
    }
    a = Analysis(parsed=True, lines=lines, roles=roles, flags=flags,
                 looks_like_bfs=bool(queue_names) and "pop_line" in roles)
    a.findings = _findings(a)
    return a


def _regex_analyze(code: str) -> Analysis:
    """Fallback for code that doesn't parse (e.g. a half-finished paste)."""
    src = code.splitlines()
    roles: dict[str, int] = {}
    q, v, g = [], [], []
    flags: set[str] = set()
    for i, line in enumerate(src, start=1):
        s = line.strip()
        if "deque(" in s:
            q.append(i); roles.setdefault("deque_line", i)
        if re.search(r"\.popleft\(\)|\.pop\(\)", s):
            q.append(i); roles.setdefault("pop_line", i)
            if ".pop()" in s:
                flags.add("uses_pop")
        if ".append(" in s and "pop_line" in roles:
            q.append(i); roles.setdefault("append_line", i)
        if any(h in s.lower() for h in VISITED_HINTS):
            v.append(i)
            if ".add(" in s:
                roles.setdefault("add_line", i)
        if re.search(r"==\s*(goal|target|end)|(goal|target|end)\s*==", s):
            g.append(i); roles.setdefault("goal_line", i)
    if "pop_line" in roles and "add_line" in roles and "append_line" in roles:
        indent = lambda n: len(src[n - 1]) - len(src[n - 1].lstrip())
        if roles["add_line"] < roles["append_line"] and indent(roles["add_line"]) == indent(roles["pop_line"]):
            flags.add("visited_on_dequeue")
    a = Analysis(parsed=False,
                 lines={"queue_fifo": sorted(set(q)), "visited_set": sorted(set(v)),
                        "shortest_path_guarantee": sorted(set(g + ([roles["pop_line"]] if "pop_line" in roles else [])))},
                 roles=roles, flags=flags, looks_like_bfs="pop_line" in roles)
    a.findings = _findings(a)
    return a


def _findings(a: Analysis) -> list[Finding]:
    out: list[Finding] = []
    r = a.roles
    if "visited_on_dequeue" in a.flags:
        out.append(Finding(
            id="visited_on_dequeue", concept_id="visited_set",
            lines=sorted({r.get("add_line", 0), r.get("append_line", 0)} - {0}),
            message=(f"Line {r.get('add_line')} marks a cell as visited only after it is popped. A cell that is still "
                     f"waiting in the queue can be appended again (line {r.get('append_line', '?')}), causing duplicate "
                     "entries and extra work. That doesn't make the result wrong by itself."),
            fix=(f"Move `visited.add(...)` from line {r.get('add_line')} to just before `queue.append(...)` on line "
                 f"{r.get('append_line', '?')}, and add the start cell to `visited` when you create it. Then count how "
                 "many times append runs on an empty 10x10 grid before and after the change."),
        ))
    if "uses_pop" in a.flags:
        out.append(Finding(
            id="uses_pop", concept_id="queue_fifo", lines=[r["pop_line"]] if "pop_line" in r else [],
            message=f"Line {r.get('pop_line')} uses `pop()`, which takes the newest item, so the search is depth-first.",
            fix=f"Change `pop()` to `popleft()` on line {r.get('pop_line')} and re-trace a small grid by hand.",
        ))
    if "no_visited" in a.flags and a.looks_like_bfs:
        out.append(Finding(
            id="no_visited", concept_id="visited_set", lines=[],
            message="No visited set was found. On a grid with cycles, cells can be explored again and again.",
            fix="Add a `visited` set, mark each cell when you append it, and skip neighbours already in it.",
        ))
    return out
