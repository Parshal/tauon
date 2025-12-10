# Goal  
Implement Niityt gameplay/UX updates: visible eight-color map with fertilizer tiles, eight-slot toolbelt, toned-down pointer glow, improved reach visualization, fertilizer counter with timed boosts, and refreshed docs.

# Context
Read static/niityt/docs/context-cheatsheet.md for background.
Read static/niityt/docs/handbook.md if you feel lost and need bigger picture.

# Summary  
- [x] Review existing Niityt logic/docs.  
- [ ] Implement feature set (colors, toolbelt, glow, fertilizer mechanics, docs).  
- [ ] Verify via lint/tests/manual run + summarize.

# TODO (keep tasks bite-sized)

## 1. Context + planning
- [ ] Re-read [state.js](cci:7://file:///home/void/repo/tauon/static/niityt/state.js:0:0-0:0), [renderer.js](cci:7://file:///home/void/repo/tauon/static/niityt/renderer.js:0:0-0:0), [grid.frag.glsl](cci:7://file:///home/void/repo/tauon/static/niityt/shaders/grid.frag.glsl:0:0-0:0), input.js, related CSS/template files, and [docs/handbook.md](cci:7://file:///home/void/repo/tauon/static/niityt/docs/handbook.md:0:0-0:0) to lock down current expectations.

## 2. Pigments + pickup flow
- [x] Visible pigment seeding
  - [x] Update `ProtoState.generatePigmentLayer()` to spawn 20 fertilizer (white) cells plus one of each flower color.  
  - [x] Ensure `cellColors/pigments` keep flowers visible at start.
- [x] Grass→flower pickup flow
  - [x] Adjust `spread()`/`onCellClaimed()` so grass claiming a flower transfers pigment into the toolbelt.  
  - [x] Confirm new grass inherits the pigment color for replanting.

## 3. Toolbelt UX
- [x] Restore eight-slot support
  - [x] Confirm constants/UI allow eight slots per side.  
  - [x] Update renderer/shader arrays + rail loops so all slots render.  
  - [x] Ensure keyboard/mouse cycling addresses eight positions.
- [x] Fertilizer UI polish
  - [x] Render fertilizer tiles as plain white (no glow).  
  - [x] Add numeric fertilizer counter overlay to the fertilizer toolbelt slot (shader/HUD).

## 4. Visual feedback tweaks
- [x] Pointer glow reduction via `grid.frag.glsl::renderPointer` (~35% of prior intensity).  
- [x] Reach visualization overhaul (4-tile radius from growth + bottom edge, bright in-reach ground vs dim out-of-reach, placements gated by reach).

## 5. Fertilizer mechanics
 - [x] Track fertilizer inventory per toolbelt icon.  
 - [x] Implement drop action (~30 s boost) that accelerates nearby growth of the matching color.  
 - [x] Integrate boost effect into the state tick and render any indicator.

## 6. Docs + verification
- [ ] Update [static/niityt/docs/handbook.md](cci:7://file:///home/void/repo/tauon/static/niityt/docs/handbook.md:0:0-0:0) + dated snapshot to describe new mechanics/visuals/status.  
- [ ] Run lint/tests/manual playtest; summarize results and remaining TODOs, then update this checklist.

# AI helper prompt
> You are assisting with Niityt feature delivery. Pick exactly one unchecked task (or subtask) from the TODO above and complete it end-to-end. When you finish:
> 1. Summarize what you accomplished and how it changes gameplay/UX.
> 2. Call out which visual/interaction design patterns or palettes you used (e.g., glow attenuation style, HUD typography, shader motifs).
> 3. Ask the user to manually test the feature for any edge cases or unexpected behavior.
> 4. Mark the task done in the TODO list.
> 5. Ask the user whether they want to continue with the next task or tweak what you just delivered.
> 6. When recapping a session, summarize the main beats as alternating single-sentence lines prefixed with `USER:` and `AI:`, then check this TODO file and update the latest checkpoint to reflect what changed and what’s next.
> Keep responses concise and focused on shippable increments.

### Checkpoint – Dec 10 2025, 18:50 UTC+02

**What’s done**
- Pigment seeding now guarantees 20 fertilizer tiles + one of each bloom, and the shader shows them pre-claim so players start with visible targets.
- Grass claiming a flower harvests the pigment into the toolbelt while leaving the tile’s color tied to the currently selected tool.
- Pointer glow intensity tuned down to ~35 % for less HUD glare.

**What’s next (AI helper prompt guidance)**
1. **Pick exactly one unchecked TODO item** (likely “Toolbelt UX → Restore eight-slot support” next, since pickup flow is finished).
2. Complete it end-to-end (code + docs/tests if needed).
3. When finished:
   - Summarize the change + gameplay effect.
   - Name the visual/interaction motifs touched (e.g., shader rail layout, HUD typography).
   - Ask for manual testing coverage.
   - Mark the specific TODO entry as `[x]`.
   - Ask whether to continue with the next task or adjust the latest change.

**Recommended next task**
- `## 3. Toolbelt UX → Restore eight-slot support` (includes slot constants, renderer/shader arrays, and input cycling).

### Checkpoint – Dec 10 2025, 20:24 UTC+02

**USER/AI recap (single sentences)**
USER: Asked to make pigment seeds discrete and visible, restore eight-slot toolbelt rails, and speed up the otherwise slow-feeling field.  
AI: Implemented discrete seeding with 20 fertilizer tiles and one of each bloom, verified eight-slot support across state/renderer/shader, and tuned spread speed and shader rails.  
USER: Reported that gutters still only showed two slots per side and that the pigment layer looked like noisy color rather than clear seeds.  
AI: Fixed gutter rail Y-mapping in the fragment shader and kept pigment previews grounded on a darker brown/gray soil so the few seeds stand out.  
USER: Asked to treat pigments as permanent tools gated only by energy instead of depleting stacks, and adjusted spread parameters to get a more active field.  
AI: Switched the toolbelt HUD to binary on/off items, made pigments unlimited-use unlocks, and left energy as the primary cost for planting any unlocked species.

**What’s done since last checkpoint**
- Eight-slot toolbelt UX is in place, including wheel/number-key cycling and full rail rendering on both gutters.  
- Pigment seeds now appear as a small set of clearly visible tiles (20 fertilizer + one of each bloom) over neutral ground.  
- Toolbelt items act as permanent unlocks with binary HUD slots; planting is gated by energy rather than pigment charges.  
- Spread speed and reinforcement probabilities have been tuned so fields evolve more quickly while staying readable.
 - Fertilizer UI is polished: fertilizer tiles show as flat white seeds, and the fertilizer toolbelt slot displays a numeric fertilizer counter.

**What’s next (working assumption)**
- Implement actual tool interactions for unlocked pigments (beyond color-only planting), then circle back to reach visualization, fertilizer mechanics, and docs.

### Checkpoint – Dec 10 2025, 21:03 UTC+02

**USER/AI recap (single sentences)**
USER: Asked to treat the Niityt TODO as source of truth, polish fertilizer HUD feedback, and remove the now-useless power-up mechanic.  
AI: Delivered flat white fertilizer seeds with a numeric fertilizer counter on the fertilizer toolbelt slot, deleted the global power-up system from state/renderer/shader, and aligned docs/context with the new behavior.  

**What’s done since last checkpoint**
- Fertilizer UI is now fully integrated: seeds render as pure white tiles over neutral soil, and the fertilizer toolbelt slot shows a numeric fertilizer counter.  
- The random power-up spark mechanic and its growth-boost timers have been removed; spread pace now depends solely on the claimed-cell bonus and base spread parameters.  
- Niityt docs and the quick context sheet no longer reference power-ups and instead describe the right gutter as reserved space for future diagnostics or boost-style cues.  

**What’s next (working assumption)**
- Revisit fertilizer mechanics to tie fertilizer drops to a localized, color-aware growth boost (inventory per toolbelt icon, timed effect, and HUD indicator), then move on to reach visualization and final docs/verification.

### Checkpoint – Dec 10 2025, ~21:15 UTC+02

**USER/AI recap (single sentences)**
USER: Pointed out that tools couldn’t be switched with the mouse and asked for a default meadow tool plus a fertilizer tool with a visible count on the belt itself.
AI: Introduced a locked-in meadow tool as the primary slot, a dedicated fertilizer slot with a two-digit count overlay, and mouse-based selection on both toolbelt rails while preserving keyboard controls.

**What’s done since last checkpoint**
- Meadow/grass now lives in a dedicated default toolbelt slot that starts active when a new field loads.
- Fertilizer occupies its own locked toolbelt slot, with a numeric fertilizer count rendered directly on the icon; the old left gutter fertilizer bar/counter has been removed to reduce clutter.
- Mouse clicks on the left and right rails now switch the active tool to the clicked slot, mirroring the existing 1–8 number keys and Q/E or wheel-based cycling.

### Checkpoint – Dec 10 2025, ~22:00 UTC+02

**USER/AI recap (single sentences)**
USER: Asked for visible discrete pigment seeds, a full eight-slot toolbelt, and a more active-feeling field.
AI: Implemented 20 white fertilizer tiles plus one of each bloom, restored eight-slot rails across state/renderer/shader, and tuned spread speed.
USER: Requested that pigments become permanent tools gated by energy and that fertilizer HUD/power-up behavior be clarified.
AI: Switched the toolbelt to unlimited-use pigment unlocks, moved fertilizer counting into the fertilizer tool slot, and removed the obsolete global power-up system.
USER: Pointed out missing mouse-based tool switching, the need for a default meadow tool, and confusion around fertilizer HUD clutter.
AI: Added locked-in meadow and fertilizer core tools, enabled mouse selection on both rails, and simplified the fertilizer HUD to a readable on-slot counter only.
USER: Asked for a proper reach mechanic plus visualization, with a 4-tile radius from growth/bottom and placements following the reach instead of a fixed band.
AI: Implemented a 4-tile reach mask from growth and the bottom edge, brightened in-reach ground against dim out-of-reach, and gated placement so it only works inside the bright reach zone.

**What’s next (working assumption)**
- Implement fertilizer mechanics for the fertilizer tool (inventory per icon, timed local growth boost, and visual indicator).
- Update the Niityt handbook + snapshot and run a final lint/tests/manual playtest pass, then summarize verification and remaining ideas.
