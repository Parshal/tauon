# Goal  
Implement a Niityt AI opponent mode: a rival faction that shares the infection grid, uses the same core mechanics, and plays via a simple heuristic loop with tunable difficulty, plus aligned docs.

# Context
Read static/niityt/docs/context-cheatsheet.md for background.
Read static/niityt/docs/handbook.md if you feel lost and need bigger picture.

# Summary  
- [ ] Design AI opponent flavor and rules (duel/survival, win/lose, scoring).  
- [ ] Extend state with ownership + AI resources and expose them to the renderer/shader.  
- [ ] Implement baseline AI decision loop with difficulty knobs.  
- [ ] Add mode selection + minimal UX for AI matches (start/end, basic cues).  
- [ ] Update handbook/snapshot and run a verification pass.

# TODO (keep tasks bite-sized)

## 1. Context + planning
- [ ] Re-skim core Niityt modules (`state.js`, `renderer.js`, `grid.frag.glsl`, `input.js`, `layout.js`) with an AI-opponent lens plus the latest handbook snapshot.
- [ ] Decide the initial AI opponent flavor (duel vs survival), game-end conditions, and scoring, then capture the decision in the handbook.

## 2. State: ownership & resources
- [ ] Add an ownership representation (e.g., per-cell owner buffer/texture) to `ProtoState` so the grid can distinguish neutral/player/AI cells.
- [ ] Integrate ownership into spread/healing rules, including conflict resolution when different sides push into the same region.
- [ ] Add AI-side resource pools (energy, fertilizer, and any minimal inventory) plus a shared `placeControlForSide()` entrypoint for human + AI placements.
- [ ] Extend `getRenderPayload()` to include ownership and basic AI telemetry needed by the renderer/shader.

## 3. Renderer + shader integration
- [ ] Extend `NiitytRenderer` to upload ownership / AI-uniforms without breaking existing contracts.
- [ ] Update `grid.frag.glsl` to branch on cell owner and apply distinct palettes/halos for player vs AI territory while preserving current cues (pointer, reach, fertilizer).
- [ ] (Optional) Add a simple AI pressure or territory-ratio HUD cue in the gutters.

## 4. AI decision loop
- [ ] Add AI tick bookkeeping inside `ProtoState` (decision timer, cadence).
- [ ] Implement a basic heuristic AI that periodically picks a cell + toolbelt slot to place based on reach/frontier/pigment opportunities.
- [ ] Expose difficulty knobs (decision frequency, aggression weights, resource advantages) via labeled constants.

## 5. Game modes & UX
- [ ] Introduce a `mode` field (e.g., `sandbox` / `vsAI`) and plumb it from `main.js` when mounting Niityt.
- [ ] Implement minimal start/end conditions and scoring for AI matches, including a readable definition of "win" and "loss".
- [ ] Add in-canvas feedback for AI matches (e.g., subtle win/lose banner or overlay text) that stays within the single-canvas HUD philosophy.
- [ ] Update the handbook snapshot to document AI modes, ownership, and UX affordances.

## 6. Parity, tests, and verification
- [ ] (Stretch) Mirror ownership, AI resources, and AI tick logic into the WASM core and wire it behind a feature flag.
- [ ] Run lint/tests/manual playtests for AI modes; summarize coverage, edge cases, and follow-ups in this file.

# AI helper prompt
> You are assisting with Niityt AI-opponent work. Pick exactly one unchecked task (or subtask) from the TODO above and complete it end-to-end. When you finish:
> 1. Summarize what you accomplished and how it changes gameplay/UX, especially how the AI behaves or is perceived.
> 2. Call out which visual/interaction design patterns or palettes you used (e.g., rival territory colors, HUD banners, shader motifs).
> 3. Ask the user to manually test the new AI behavior or mode for edge cases and unexpected interactions.
> 4. Mark the task done in the TODO list.
> 5. Ask the user whether they want to continue with the next task or refine the behavior you just delivered.
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

### Checkpoint – Dec 11 2025, ~00:24 UTC+02

**USER/AI recap (single sentences)**
USER: Asked to pivot the Niityt TODO file from pigment/toolbelt work to a new AI-opponent plan.
AI: Reframed the goal, summary, and TODO sections around an AI rival that shares the grid, and updated the AI helper prompt to target the new tasks.

**What’s next (working assumption)**
- Decide the initial opponent flavor (duel vs survival) and lock down win/lose conditions.
- Begin implementing the state-level ownership + AI resource changes before touching shaders or UX.
