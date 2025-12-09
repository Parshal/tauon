# Styler Dev Notes

## Module Surfaces
- Runtime: `static/themer/src/modules/styler.js` (instantiated by `ThemerEngine` @ `src/core/engine.js`).
- Visual contract: `[data-styler]` hooks in `static/themer/css/themer.css` (jade block currently the only role).
- UI awareness: ControlPanel does not drive Styler yet; future knobs land via store once descriptors stabilize.

## Pipeline (scan → filter → classify → style)
1. **Boot** — constructor grabs `rootSelector` (default `body`), `minTextLength`, scan cadence (`scanIntervalMs`), then calls `scan()`.
2. **Scan** — breadth-first crawl from `getRoot()`; queue skips subtrees whose tags live in `FORBIDDEN_TAGS`.
3. **Filter** — `isCandidate` short-circuits if already tagged, tag not in `BLOCK_TAGS`, or trimmed text < `minTextLength`.
4. **Classify** — `classify(node)` iterates `CLASSIFIERS`; each entry can expose either `test(node)` (single descriptor) or `collect(node)` (array of descriptors, each with its own `target` for styling). This allows classifiers to gather structural context (e.g., grouping a heading and its siblings) before deferring to `style()`.
5. **Style** — `style(node, descriptor)` stamps `data-styler="<descriptor.id>"` on the provided target, then tracks it inside `this.nodes` for future diff logic.
6. **Loop** — `engine.loop()` calls `styler.tick(delta)` (currently noop) and `styler.rescan(delta)` to re-run `scan()` every `scanIntervalMs`.

## Candidate Heuristics
- BLOCK: `section`, `article`, `div`, `li`, `main` (treat as block contenders).
- FORBIDDEN: `script`, `style`, `noscript`, `template` (skip entire subtree).
- Text floor: default 48 chars; raise for verbose-only styling, lower when testing sparse datasets.

## Heading Cluster Classifier (primary)
- **Goal:** build a card per heading by bundling the heading plus its subsequent content until the next heading of the same or higher level.
- **Selector:** scans `h2–h6` descendants inside each candidate node.
- **Grouping rules:** starting from the heading, pull siblings until a heading of equal/higher rank is encountered. Require ≥80 trimmed characters across the bundle to avoid empty shells.
- **Descriptor:** pushes `{ id: 'jade-card', label: 'headingCluster', target: <wrapper>, meta: { headingTag, nodeCount, charCount } }`. Wrappers are inserted inline (`section.cd-heading-card`) before styling so the standard jade card visuals apply without special cases.
- **Guards:** headings already inside a `[data-styler]` block are skipped to prevent double wrapping during rescans.

## Jade Classifier v0 (legacy, disabled)
- **Purpose:** identify “feature cluster” sections with real copy.
- **Status:** gated behind `ENABLE_FEATURE_CLUSTER`; currently `false` so it is not active in production.
- **Match conditions:**
  - ≥120 chars trimmed text.
  - At least one heading (`h1–h6`).
  - Body richness: (`p` count ≥ 2) OR (list items ≥ 3) OR (any emphasis `strong|em|code|mark`).
- **Descriptor:** `{ id: 'jade-card', label: 'featureCluster', meta: { blockCount, paragraphs } }`.
- **Styling outcome:** `[data-styler="jade-card"]` picks up jade gradient, 2px border, and `jade-breathe` keyframes (calm brightness pulse) defined in CSS when re-enabled.

## CSS Contract
- Base `[data-styler]` styles provide padding, rounded corners, float animation.
- Role-specific overrides (jade) may redefine radius, borders, gradient masks.
- Future roles should follow the same attribute pattern; avoid inline colors in JS unless descriptors need them for runtime animation.

## Engine + HUD Interaction
- Engine instantiates Styler once; no shared state with store yet.
- HUD (ControlPanel) now renders minimized by default to keep stage clean; toggling does not influence Styler.
- When we add palette controls, wire store → Styler via options or a setter, not via DOM scraping.

## AI Handoff Notes
- Prefer generic tooling: keep “scan → filter → classify → style” intact and let classifiers describe their own targets/wrappers. Avoid hard-coding markdown-specific logic or naming.
- Heading clusters are the current focus—optimize for “heading + following content until next equal/higher heading.” Future tweaks should refine this heuristic instead of reverting to paragraph-length gating.
- If you re-enable legacy classifiers or add new ones (stats, quotes, etc.), gate them via feature flags/config so experimentation stays opt-in.
- Any new UI widgets or DOM mods should be expressed via descriptor metadata rather than ad-hoc DOM mutations, so later AIs can reason about responsibilities.

## Backlog Hooks
- Registry diffing (track removed nodes, allow external `addNode/removeNode`).
- Deterministic color seeding (hash descriptor text → hue) + future palette sync with store presets.
- Additional classifiers (quotes, stat boards, code islands) referencing `descriptor.meta` for density metrics.
- MutationObserver or IntersectionObserver assist to avoid full rescans on dynamic hosts.
- Documented public API once `this.nodes` exposes queries for AI/UX tooling.
