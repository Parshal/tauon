# Themer – AI Doc Run Prompt

Use this prompt verbatim (or adapt minimally) whenever an AI session needs to refresh the `docs/ai_gen` knowledge base.

---

## Goal
Capture a **token-efficient, high-signal snapshot** of Themer—the drop-in theme module pairing WebGL2 backdrop, HUD dock, and hue-animated DOM chrome—so future AI can reason about renderer, UI, CSS, host integration, and docs without rereading the whole repo. Treat the output as persistent memory that must stay aligned with the codebase.

## Scope
- Path: `tauon/static/themer`
- Surfaces to cover every run:
  1. **Runtime stack** – `src/index.js`, `core`, `modules`, `data`, `shaders`.
  2. **Theme surfaces** – `css/themer.css`, `themer.html`, `templates/`, `static/` assets that host the theme.
  3. **Docs + logs** – `docs/intro.md`, `docs/styler/styler.md`, `docs/dora/*`, `docs/ai_gen/*`, and any other narrative/state trackers.
  4. **Integration glue** – anything that makes Themer a drop-in plugin (store wiring, exports, `window.Themer` + `window.ThemerLegacy`, installation scripts).
- Out of scope: unrelated Tauon repo roots outside `themer/` or deleted passes unless reintroduced.
- Docs live under `docs/ai_gen/` – each run appends/updates files there only.

## Rules of Engagement
1. **Read before you write.** Use tooling to inspect files; never invent behavior. If something is uncertain, say so explicitly.
2. **Minimal tokens, maximal facts.** Prefer bullet lists, tables, enum-style IDs. Avoid filler prose.
3. **Stable references.** Cite files as `@path#start-end`. Mention key uniforms, data shapes, and control flow.
4. **Delta friendly.** When describing changes, note commit/date/context so future runs can diff mentally.
5. **Single source of truth.** If docs diverge from code, update the doc immediately or leave a TODO with the precise fix needed.
6. **Styler awareness.** Reference `docs/styler/styler.md` in every snapshot when summarizing heuristics so humans + copilots can trace the classifier contract without rereading code.

## Suggested Output Skeleton
```
# Themer Snapshot (YYYY-MM-DD)

## Topology
- entry points ...
- shader files ...

## Runtime Flow
1. store -> renderer -> shader ...

## Shader Notes
| Uniform | Source | Effect |

## Open Questions / TODOs
- [ ] item
```
Feel free to extend sections when needed (e.g., “UI bindings”, “Known constraints”).

## Procedure Checklist
1. `ls` / tree `themer/` to refresh directory map.
2. Read/skim the runtime stack (config, store, engine, renderer, UI, shaders) **and** the skinning surfaces (CSS, templates/static, demo entrypoints).
3. Skim `docs/intro.md`, `docs/styler/styler.md`, `docs/dora/*`, and existing `docs/ai_gen` snapshots to understand narrative/log state.
4. Write / update markdown snapshots in `docs/ai_gen/` following the skeleton and cite files. Call out which previous snapshot you superseded.
5. Re-read the new doc to ensure it matches the inspected code, link to `docs/styler/styler.md` when covering heuristics, then summarize changes in the chat so the human knows what got recorded.

---
Keep this file short and strict—future runs should copy these expectations before documenting anything else.
