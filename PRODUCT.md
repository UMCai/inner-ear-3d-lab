# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Medical & Neuroscience Students:** Building spatial intuition for inner-ear anatomy (bony labyrinth vs. membranous labyrinth, 27 IE-Map structures, Greenwood cochlear tonotopy) before exams and clinical rotations.
- **Otolaryngology (ENT), Neurology & Audiology Residents / Clinicians:** Exploring multiplanar temporal bone imaging (Pöschl, Stenvers, Axial, Coronal + SCDS), BPPV canalith repositioning maneuvers, caloric/vHIT vestibulo-ocular reflex diagnostics, and otologic surgical approaches (CI insertion, labyrinthectomy, IAC neurectomy).
- **Public & Technical Showcase Visitors:** First-time visitors discovering the platform via social media or engineering demos who want immediate visual clarity on what the simulator does and how the 3D stereotaxic specimen works.

## Product Purpose

Inner Ear 3D Lab (`IE-MAP 3D`) turns an abstract millimeter-scale inner ear dataset into an interactive WebGL2 spatial anatomy atlas and clinical neurotology laboratory. Success for the static showcase means a visitor understands the mechanism within seconds in both dark and light viewing conditions, sees the interactive 3D labyrinth center stage (`>= 85%` uncluttered canvas), and can inspect the five clinical workbench modes without visual noise.

## Positioning

Unlike textbook diagrams, static radiology viewers, or "cockpit" surgical software packed with dozens of permanent sidebars, Inner Ear 3D Lab pairs authentic IE-Map v1.0.0 Right-Anterior-Superior (RAS) stereotaxic millimeter geometry (`centroid [4.5, 1.4, 0.5]`, Three.js `+X Right / +Y Anterior / +Z Superior`) with progressive-disclosure **Modal Workbenches** so the 3D inner ear occupies virtually the entire viewport.

## Operating Context

- **Dual-Purpose Surface:** Works as both a shareable first-impression web showcase (`web/showcase.html`) and a live blueprint for the 5-mode production application (`web/index.html` / `AppHUD.ts`), usable in dark lighting (workstation / studio reveal) and daylight reading conditions.
- **Five Clinical Modes (Canonical Order):**
  1. `Anatomy Atlas` (`27` IE-Map structures, outer bone peel, radial explode, isolated inspection)
  2. `Hearing & Tonotopy` (Greenwood frequency-place mapping `20 Hz–20.7 kHz`, travelling wave, pure-tone Web Audio, Right Ear Pure-Tone Audiogram)
  3. `Virtual Radiology` (Oblique Temporal Bone MPR planes: Pöschl, Stenvers, Axial, Coronal; analytic GPU clipping; SCDS apical defect scenario)
  4. `Vestibular & VOR` (BPPV 6-maneuver repositioning, Caloric convection + Jongkees, vHIT Curthoys `40–80 ms` HIMP/SHIMP, 3D Eye Avatar + 3-lead nystagmogram)
  5. `Surgical Suites` (Cochlear Implant `28.0 mm` / `650°` / `>= 30 mN` breach guard, Labyrinthectomy compensation `tau = 72 h`, IAC Neurectomy ABR/EMG monitoring)

## Capabilities and Constraints

- **Anti-Cockpit Invariant:** Resting 3D stage area must stay `>= 85%` across desktop (`1440×900`, `1280×800`), tablet (`768×1024`), and mobile (`390×844`), with strict 1-at-a-time mutual exclusivity across all 5 workbench drawers and the 3-axis gyro flyout, plus mobile inspector suppression when a drawer opens.
- **Clinical & Coordinate Fidelity:** Preserve authentic IE-Map mesh identifiers, anatomical Latin names, RAS millimeter coordinates, and otologic formulas/parameters already implemented in the repository.
- **Rendering & Audio Constraints:** Three.js `0.170.0` WebGL2 zero-GC `requestAnimationFrame` loop; analytic GPU shader clipping in `gate3Materials.ts`; dynamic Web Audio synthesis only (no binary audio files); canonical assets sourced from `assets/iemap/` and synced into `web/public/assets/iemap/`.
- **Static Showcase Scope (Phase 1):** Redesign the frontend shell and interactive 3D hero showcase first (`web/showcase.html`) while keeping existing production `AppHUD.ts` contracts and domain tests green until the follow-up dynamic logic wiring phase.

## Brand Commitments

- **Product Name & Mark:** `IE-MAP 3D` · `Inner Ear 3D Lab` · `27-Part Anatomy Atlas`
- **User-Specified Dual-Theme Architecture:** System-aware Dark + Light dual-theme system combining frosted dark glass (`glass-dark-ui`) with light-mode technical paper drafting (`light-mode-paper-technical`), layered neutral elevation shadows (`beautiful-shadows`), and an interactive WebGL2 3D hero object (`webgl-3d-object`, upgraded toward `AgXToneMapping`, `RoomEnvironment` IBL, alpha-transparent canvas, and tone-mapped GLSL).
- **Deferred:** Figma design sync remains explicitly paused for this milestone.

## Evidence on Hand

- Canonical 27 anatomical IE-Map v1.0.0 `.obj` meshes in `assets/iemap/obj/` (synced to `web/public/assets/iemap/obj/`).
- Canonical semicircular canal RAS splines (`posterior`, `horizontal`, `anterior` JSON paths) and `eye_avatar.glb`.
- Production domain engines, shaders (`web/src/render/gate3Materials.ts`), WebGL2 stage (`web/src/render/DualStageScene.ts`), `docs/UI_DESIGN_SPEC.md`, and baseline layout reference (`static-frontend-redesign.html`).
- **Absences (Do Not Fabricate):** No external institutional endorsements, user counts, clinical trial efficacy claims, or third-party testimonials exist; showcase UI must present real dataset facts and clearly illustrative clinical presets without invented marketing claims.

## Product Principles

1. **Specimen First, Chrome Second:** Every viewport opens onto the luminous 3D labyrinth (`>= 85%` stage clearance); controls yield space until summoned.
2. **One Clinical Question at a Time:** Contextual bottom dock and mutually exclusive drawers match the active modality without permanent telemetry sprawl.
3. **Dual-Environment Legibility:** Both the dark studio workstation mode and the light paper-technical mode preserve clinical hierarchy, figure-ground separation, and WCAG AA readability.
4. **Scientific Truth Over Decoration:** Pin coordinates, tonotopic bands, canal geometry, and audiometric conventions reflect authentic neurotology rather than generic Sci-Fi styling.

## Accessibility & Inclusion

- Semantic landmarks, native `<dialog>` top-layer modality, ARIA tablists/accordions, `>= 4.5:1` AA text contrast in both light and dark themes, keyboard navigation for search/tabs/dialogs, `prefers-reduced-motion` safety, `viewport-fit=cover` + `env(safe-area-inset-*)` mobile ergonomics, and `<= 2.5x` fluid typography clamping for 200% zoom support.
