---
version: 1
slug: "web-showcase-html"
primary_target: "web/showcase.html"
related_targets: []
---

# Surface Brief: `web/showcase.html`

- **Scope & Mode:** Persuade + Experience (public showcase & clinical teaching workbench for `Inner Ear 3D Lab` / `IE-MAP 3D`).
- **Audience:** Otolaryngology clinicians, neuroscience/medical students, and first-time public visitors discovering the simulator.
- **Visitor Job & Action:** Immediately grasp the millimeter-scale RAS inner-ear mechanism, orbit/inspect the live 3D labyrinth specimen, and switch seamlessly across the 5 clinical workbench modes in either dark or light viewing environments.
- **Constraints:** Anti-Cockpit `>= 85%` resting 3D stage area across desktop (`1440×900`, `1280×800`), tablet (`768×1024`), and mobile (`390×844`); strict 6-overlay mutual exclusivity; mobile inspector suppression on active drawers; faithful IE-Map v1.0.0 anatomy and neurotologic constants; zero fabricated endorsements or efficacy claims; illustrative presets labeled clearly.

## Direction contract

- **THESIS:** The showcase is a full-bleed stereotaxic anatomical specimen rather than a multi-corner HUD or SaaS dashboard; a translucent WebGL2 labyrinth dominates `>= 85%` of every viewport while all anatomical reading and clinical plots live cleanly inside one expandable left-hand Note sidebar (`#note-sidebar`).
- **OWN-WORLD:** System-reactive dual material polarity pairing obsidian darkroom frosted glass (`#0a1016` depth, `rgba(15, 22, 29, 0.84)` blurred panes, pewter masked hairline edge, clinical mineral-teal `#2ec4b6` and bone-ivory `#e7dfd1` signals) with architectural technical paper drafting (`#f5f5f3` crisp drafting ground, `rgba(255, 255, 255, 0.91)` sheets, `#14181c` primary ink, `1px` outer specimen framing with `7px` corner L-brackets, `#0c667e` cyan-teal and `#b45309` otolith accents), layered neutral shadows, `'Avenir Next'` display/UI typography (`16px` note prose, `>= 13px` interactive controls), and `ui-monospace` tabular numerals.
- **STORY:** First-time visitors recognize a real right-sided human inner ear rotated in RAS space (`[4.5, 1.4, 0.5] mm`), expand the left Note sidebar (`compact 280px` → `expanded 388px` → `476px` `Further Read` `<details>`, or bottom sheet on mobile) to inspect mechanisms in plain Patient or Clinical language, switch across all 5 clinical domains (`Anatomy Atlas`, `Hearing & Tonotopy`, `Virtual Radiology`, `Vestibular & VOR`, `Surgical Suites`) inside the unified `[Note | <Lab>]` pane, and open a printable clinical summary report grounded in canonical dataset facts.
- **FIRST VIEWPORT:** A single `48px` (`44px` mobile) top navigation header carries the brand cluster, 5-mode tablist, accessible search combobox (`header-search-btn` icon on tablet), Report trigger (icon-only below `900px`), Light/Dark quick toggle, and Settings popover; behind everything, a 100dvw×100dvh `AgXToneMapping` + `RoomEnvironment` IBL WebGL2 canvas centers the illuminated 27-part inner ear with occlusion-aware 3D pins, framed beside a compact upper-left Note preview card (`280px` desktop / `256px` tablet / `198px` mobile) and a contextual bottom workbench dock carrying trailing `Toggle 3D Labels` and `Reset View` buttons (`--dock-shift-x` + `setViewOffset` keeping the stage unobstructed when expanded).
- **FORM:** Code-led interactive Modal Workbench (`1` on grounded shortlist; seed:bfe83b6004de1c2d; plus user-pinned dual-theme `glass-dark-ui` + `light-mode-paper-technical` + `webgl-3d-object` + `beautiful-shadows` constraints from approved plan). Signature interaction: expanding `#note-sidebar` smoothly widens the reader (`388px -> 476px`) with `<details>` intrinsic sizing while shifting 3D `camera.setViewOffset` and `#bottom-bar` symmetrically into open canvas space across all 5 clinical modalities (tonotopic spectrum, Pöschl cross-section, moving otoconia, CI spiral carrier).
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
