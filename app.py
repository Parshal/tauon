from flask import Flask, request, abort, render_template
import markdown
from pathlib import Path
import html
import os

# ---- CONFIG ----
# Change this if your markdown root directory is elsewhere:
base_dir_env = os.environ.get("BASE_DIR")

if base_dir_env:
    BASE_DIR = Path(base_dir_env).resolve()
else:
    BASE_DIR = Path(__file__).resolve().parent.parent

app = Flask(__name__)

# ---- BASE PAGE TEMPLATE (SIDEBAR + MAIN VIEW) ----

# ---- TREE BUILDING ----

def build_tree():
    """
    Walk BASE_DIR and build a tree of all .md files.
    Returns a nested dict: { "files": [relpath], "dirs": {name: subtree, ...} }
    """
    root = {"files": [], "dirs": {}}

    for path in BASE_DIR.rglob("*.md"):
        rel = path.relative_to(BASE_DIR)
        parts = list(rel.parts)
        current = root
        for part in parts[:-1]:
            current = current["dirs"].setdefault(part, {"files": [], "dirs": {}})
        current["files"].append(rel)

    return root


def render_file_item(rel_path, selected_rel=None):
    rel_str = str(rel_path).replace("\\", "/")
    safe_rel = html.escape(rel_str)
    label = html.escape(rel_path.name)
    selected_class = ""
    if selected_rel is not None and rel_str == selected_rel:
        selected_class = " selected"
    return (
        '<li class="file">'
        f'<div class="tree-row file-row{selected_class}">'
        f'<a href="/?file={safe_rel}">'
        '<span class="icon">📄</span>'
        f'<span class="label">{label}</span>'
        '</a>'
        '<span class="suffix">.md</span>'
        '</div>'
        '</li>'
    )


def render_tree_node(name, node, selected_rel=None):
    safe_name = html.escape(name)
    html_parts = []

    html_parts.append('<li class="folder">')
    html_parts.append(
        '<div class="tree-row folder-row">'
        '<span class="toggle-arrow">▼</span>'
        '<span class="icon">📁</span>'
        f'<span class="label">{safe_name}</span>'
        '</div>'
    )
    html_parts.append('<div class="children"><ul class="tree">')

    for dname in sorted(node["dirs"].keys()):
        subtree = node["dirs"][dname]
        html_parts.append(render_tree_node(dname, subtree, selected_rel))

    for rel in sorted(node["files"], key=lambda p: str(p)):
        html_parts.append(render_file_item(rel, selected_rel))

    html_parts.append("</ul></div></li>")
    return "".join(html_parts)


def render_tree(selected_rel=None):
    tree = build_tree()
    out = []
    out.append('<ul class="tree">')

    for rel in sorted(tree["files"], key=lambda p: str(p)):
        out.append(render_file_item(rel, selected_rel))

    for dname in sorted(tree["dirs"].keys()):
        subtree = tree["dirs"][dname]
        out.append(render_tree_node(dname, subtree, selected_rel))

    out.append("</ul>")
    return "".join(out)


# ---- MAIN CONTENT RENDERING ----

def render_page(
    title: str,
    main_html: str,
    main_title: str,
    main_path: str,
    path_input: str,
    selected_rel: str | None,
    body_class: str = ""
) -> str:
    base_str = str(BASE_DIR)
    base_short = Path(BASE_DIR).name

    return render_template(
        "layout.html",
        title=title,
        main=main_html,
        main_title=main_title,
        main_path=main_path,
        path_input=path_input,
        base=base_str,
        base_short=base_short,
        tree=render_tree(selected_rel),
        body_class=body_class or "",
    )



def render_index_page() -> str:
    example = "2025/11-17-notes.md"
    main_html = f"""
<h2>Welcome</h2>
<p>
  This is a simple Markdown viewer for your <code>.md</code> files.
  Use the file list on the left or type a relative path into the box above.
</p>
<p>
  Example: if a file on disk is <code>{example}</code>, type
  <code>{example}</code> and press <strong>Open</strong>.
</p>
<hr />
<p>
  The left side can be collapsed with the round button on its edge.
  The A-/A+ buttons adjust only text size, without changing the layout.
</p>
"""
    return render_page(
        title="Markdown viewer",
        main_html=main_html,
        main_title="Markdown viewer",
        main_path="No file selected",
        path_input="",
        selected_rel=None,
        body_class=""
    )


def render_file_page(rel: Path, html_body: str) -> str:
    rel_str = str(rel).replace("\\", "/")
    main_html = f"""
<h2>Preview</h2>
<hr />
{html_body}
"""
    return render_page(
        title=rel.name,
        main_html=main_html,
        main_title=rel.name,
        main_path=rel_str,
        path_input=rel_str,
        selected_rel=rel_str,
        body_class=""
    )


# ---- ROUTES ----

@app.route("/", methods=["GET"])
def index_or_view():
    rel = (request.args.get("file") or "").strip()
    if not rel:
        return render_index_page()

    rel_path = Path(rel)

    if rel_path.is_absolute() or ".." in rel_path.parts:
        abort(400, description="Invalid path")

    full_path = (BASE_DIR / rel_path).resolve()

    if not full_path.is_file():
        abort(404, description=f"File not found: {rel_path}")

    if full_path.suffix.lower() not in {".md", ".markdown"}:
        abort(400, description="Only .md and .markdown files are allowed")

    text = full_path.read_text(encoding="utf-8")

    html_body = markdown.markdown(
        text,
        extensions=["extra", "fenced_code", "tables"]
    )

    rel_from_base = full_path.relative_to(BASE_DIR)
    return render_file_page(rel_from_base, html_body)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)
