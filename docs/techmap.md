# Tauon Markdown Viewer — Codemap (core only)

1. **Process bootstrap**
   - `tauon.sh` resolves its own path, keeps the current `$PWD` as `BASE_DIR`, and launches `python3 app.py` with that env, so each run scopes the viewer to where you invoked it.
   - `app.py` reads `BASE_DIR` (env override optional) and spins up a Flask app on `127.0.0.1:8000`.

2. **Request handling (GET /?file=rel/path.md)**
   - Reject absolute paths / `..` hops, ensure suffix ∈ {`.md`, `.markdown`}.
   - Resolve `full_path = BASE_DIR / rel_path`, read UTF-8 text, convert via `markdown.markdown(..., extensions=[extra, fenced_code, tables])`.
   - Wrap result with `render_file_page()` → `render_page()` using `templates/layout.html`.

3. **Directory tree + navigation**
   - `build_tree()` walks `BASE_DIR.rglob("*.md")`, returns nested `{files, dirs}`.
   - `render_tree*` helpers emit HTML for sidebar tree, highlight the selected doc, inject into template as `{{ tree|safe }}`.

4. **Template skeleton (`templates/layout.html`)**
   - Split layout: sticky sidebar (tree + toggle), draggable divider, main panel with file path form + preview slot (`{{ main|safe }}`).
   - Loads `static/css/layout.css`, the modular JS bundle (`zoom.js`, `sidebar-toggle.js`, `sidebar-resize.js`, `log-cards.js`, `layout.js`), and mounts the Themer plugin (canvas + HUD) via `/static/themer/src/index.js` when the theme is enabled.

5. **Client behavior (modular JS)**
   - `static/js/zoom.js`: LocalStorage-based zoom, intercepts Ctrl/⌘ ±/wheel to keep layout stable.
   - `static/js/sidebar-toggle.js`: handles collapse button + icon, tracks saved width in a shared `TauonUI.sidebarState` namespace.
   - `static/js/sidebar-resize.js`: drag divider, restores width when reopening, clamps widths.
   - `static/js/log-cards.js`: Markdown post-pass for log/stats cards.
   - `static/js/layout.js`: tiny orchestrator that calls each `TauonUI.init*` module on `DOMContentLoaded` and logs errors.

6. **Styling (`static/css/layout.css`)**
   - Sets neon-dark theme, layout grid, sidebar/main chrome, button styles, markdown typography, `.log-entry` / `.log-stats` visuals.
   - Coordinates with `.cd-*` classes emitted by Themer so Tauon pages and the plugin share consistent spacing + z-index rules without restyling the WebGL surface.

7. **Themer plugin (static/themer)**
   - Lives under `static/themer/` and ships as a drop-in WebGL2 backdrop + HUD dock hooked into Tauon's layout via standard `<link>` / `<script type="module">` tags.
   - Treat its README + docs (`static/themer/README.md`, `static/themer/docs/*.md`) as the source of truth for shaders, HUD controls, and AI workflows—Tauon docs only note the integration point so they stay lightweight.

That’s the full flow: shell launcher → Flask route → markdown conversion → Jinja layout → JS/CSS enhancements. No Themer coupling.
