# Quality Assurance & Verification Report (`QA_NOTE.md`)

## 1A. Web Application Phase 2 Multi-Viewport & Build Verification
- **Production App Entry**: [`web/index.html`](web/index.html) (`AppHUD.ts`, `hudChrome.ts`, `DualStageScene.ts`, `gate3Materials.ts`, `style.css`) + Showcase (`web/showcase.html`)
- **Automated Typecheck, Unit, Physics & Bundle Suite (`npm run verify`)**:
  - `npm run sync:assets`: `27` OBJ meshes, `4` FCSV markups, `6` core files (`anterior`/`horizontal`/`posterior` splines, `eye_avatar.glb`, metadata, `look-config.json`).
  - `tsc -p web/tsconfig.json --noEmit`: `0` errors (`noUnusedLocals` + `noUnusedParameters` enabled).
  - Node ESM Domain Suites (`7/7` suites, `392` assertions passing 100%): `test:hearing`, `test:radiology`, `test:vestibular`, `test:eye-avatar`, `test:workbench`, `test:diagnostic`, `test:surgical`.
  - Python Canal Splines & Epley Physics (`npm run test:python`): `test_canal_paths.py` + `epley_simulator.py` passing 100%.
  - `vite build`: clean bundle across `index.html`, `showcase.html`, `three-vendor`, and `surgicalEngine` chunks.
- **4-Viewport Headless Chrome CDP & Dual-Theme Audit (`npm run test:cdp`)**:
  - Verified both **Dark Glassroom** (`data-theme="dark"`) and **Light Paper-Technical** (`data-theme="light"`) polarities, native `#settings-popover`, `<details id="further-read-details">` (`wide-read`), `#sidebar-pane-lab` 5-drawer exclusivity + `#gyro-flyout`, and `<dialog id="report-dialog">`.
  - **0 console errors**, **0 overlaps**, **0 horizontal overflow**, and `>= 85%` unobstructed resting 3D stage area across every viewport (`1440×900`, `1280×800`, `768×1024`, `390×844`).
  - Up-to-date Phase 2 visual baselines captured under [`output/`](output/) via `node scripts/verify_mvp_cdp.js --update-baselines`.

---

## 1B. Executive Summary (Headless Blender Editorial Video Pipeline)
- **Final Video Artifact**: [output/epley_maneuver_right_bppv.mp4](output/epley_maneuver_right_bppv.mp4)
- **Subtitle Artifact**: [output/epley_maneuver_right_bppv.srt](output/epley_maneuver_right_bppv.srt)
- **QA Review Sheets** (local `build/qa/` outputs, gitignored):
  - `build/qa/review-contact-1080p.png` (8-frame full-HD review grid)
  - `build/qa/review-small-screen-640x360.png` (`640x360` small-screen legibility proof grid)
- **3D Anatomical Asset & Look Bundle**:
  - [assets/iemap/iemap_right_labyrinth.glb](assets/iemap/iemap_right_labyrinth.glb), [assets/iemap/look-config.json](assets/iemap/look-config.json), [assets/iemap/iemap_Metadata.json](assets/iemap/iemap_Metadata.json), `assets/iemap/vtk/*.vtk` (27 authentic meshes), `assets/iemap/obj/*.obj` (27 authentic meshes), `assets/iemap/fcsv/*.fcsv` (4 Slicer fiducial sets), [assets/iemap/posterior_canal_path.json](assets/iemap/posterior_canal_path.json) (313 samples, 19.33 mm, 0.25–0.31 mm clearance inside `ls_Hsapiens_Sp`)
- **Video Technical Specification**:
  - Resolution: `1920x1080` (`16:9` Full HD, progressive `yuv420p`)
  - Frame Rate: `30.00 fps` (`3,306 frames`)
  - Duration: `110.2000 seconds` (`01:50.20`)
  - Video Codec: `H.264 / AVC (libx264, High@L4.1, CRF 18)`
  - Audio Codec: `AAC LC, 44.1 kHz, Stereo, 192 kbps` (8 clinical narration segments + `-33 dBFS` ambient harmonic pad + positional transition cues + crystalline settling chimes)

---

## 2. Gate 3 Redesign & Visual Audit Verification

### 2.1 Gate 3 Visual Identity (`Medaium-BPPV-001` Style)
- **Background & Palette**: Deep dark charcoal `#071014` (`BG = (7, 16, 20)`, Blender world `linear_rgba = [0.004, 0.014, 0.02, 1.0]`), panel dark slate `PANEL = (22, 31, 35)`, primary accent Medaium Cyan `CYAN = (82, 220, 242)` (`#52dcf2`), warm amber `WARM = (240, 170, 98)` (`#f0aa62`).
- **Highlighted Active Repositioning Pathway**:
  - `right.posterior_duct` (`ls_Hsapiens_Sp`): Translucent Medaium Cyan (`alpha=0.34`, `roughness=0.14`) so internal canalith migration is clearly visible through the canal wall.
  - `right.common_crus_posterior` (`ls_Hsapiens_CCp`): Soft translucent lavender (`alpha=0.42`, `roughness=0.16`).
  - `right.utricle` (`ls_Hsapiens_utricle`): Translucent sage green (`alpha=0.45`, `roughness=0.20`).
  - `right.posterior_ampulla` (`ls_Hsapiens_Ap`): Warm amber (`#f0aa62`, `alpha=0.88`).
- **Muted Context Anatomy**: `right.anterior_duct` (`Sa`), `right.lateral_duct` (`Sl`), `right.cochlea` (`mesh_david_cochlea`), `ls_Hsapiens_OC`, `saccule`, and non-posterior ampullae are rendered in smooth, opaque muted slate-grey (`(0.42, 0.51, 0.65)`); the noisy outer bony labyrinth shell (`segT2_th1.07_Otsu`) and internal cupula plugs (`Cd_*`) are hidden (`visible=false`).
- **5 Enlarged Canalith Particles**: 5 warm amber spheres (`Schematic_canalith_01..05`, `r=0.135 mm`) travel deterministically along the continuous 3D `Sp -> CCp -> Utricle` spline (`-84° -> +30° -> +110° -> +165° -> +186°`), highlighted with synchronized 2D warm halo rings (`particles_2d`) and a continuous trajectory line.

### 2.2 Radical UI Simplification & Dynamic Role Swap
- **Eliminated Legacy Clutter**: Removed the 5-panel boxed dashboard, persistent right-hand telemetry sidebar, Cranial View axial yaw compass dial, bottom physics strip (`g·T`, `s = xx.x mm`), fake quantitative cupula percentages, and `7–8` simultaneous leader-line boxes.
- **3-Zone Gate 3 Editorial Frame**:
  1. **Top Bar (`84 px`)**: `MEDAIUM / EPLEY MANEUVER · RIGHT POSTERIOR-CANAL BPPV` on the left, rounded cyan-bordered step pill badge on the right.
  2. **Full-Bleed 3D Main Viewport (`1920 × 811`, `y = 84..895`) + 1 Linked PiP Inset**:
     - **Movement Phase**: 3/4 External Patient View dominates the Main Viewport; synchronized Right Labyrinth sits in the Top-Right PiP Inset (`RIGHT INNER EAR · LIVE POSE`) connected by a live cyan zoom line to the patient's `Right_ear_locator_ring`.
     - **Settling Hold Phase (30–60 s)**: Smooth 14-frame cross-dissolve swaps the Gate 3 Right Labyrinth Close-Up into the Main Viewport (with compact top-right `GRAVITY` arrow and warm canalith halo rings) while the Patient Hold Pose moves to the Top-Left PiP Inset (`PATIENT POSE · HOLD 30–60 s`).
  3. **Gate 3 Editorial Lower-Third (`y = 895..1080`, `185 px`)**: Dark slate `PANEL` background, `12 px` solid left `CYAN` vertical accent bar, bold `Headline` (`font(31, True)`), concise `Support` sentence (`font(20, False)`), right-aligned timecode, and chapter progress bar.
- **Temporally Staged Pill Callouts**: Maximum `1–2` rounded pill callouts visible at any moment, fading in and out smoothly with `window_alpha` and zero crossed leader lines.

### 2.3 3/4 External Patient Camera, Monolithic Sculpted Head & 3D Action Arrows
- **Sculpted Anatomical Head (`GEO-head_sculpting_realistic`)**: Authentic CC0 sculpted anatomical human head and neck mesh (ingested from `assets/iemap-realistic-head-context-candidate.blend`) integrating cranium, brow ridges, recessed orbital sockets, eyelids, ocular globes (`sclera.L/R`, `iris.L/R`), straight nasal dorsum/tip/alae, cheekbones, lips, jawline/chin, sculpted auricles, and neck column seated into the open collar of `ContouredTorso`, paired with the asymmetric `Right_ear_locator_ring`.
- **Shot 1 Translucent Cutaway (`scene1_locate_part1.png`)**: Single-surface glass head cutaway (`LightPath.Transparent Depth < 0.5` + front-face culling) revealing the authentic 3D IE-Map right vestibular labyrinth embedded inside the right temporal bone without internal neck/ear primitive overlap.
- **3D Curved Action Arrows**: Smooth Frenet-swept tubular 3D action arrows (`ArrowStep1..5`) float cleanly in open space outside the patient's head and torso during active movement transitions.
- **Elevated 3/4 Clinical Camera Perspective**: Clearly shows every head yaw and pitch rotation (`45° R`, `20–30° neck extension`, `90° L turn`, `90° left-shoulder roll with nose 45° down`, and upright return) without requiring an abstract compass dial.

### 2.4 Medical Copy Corrections Verified
- Opening pathophysiology copy (`00:00–00:05.5`): *"In posterior-canal BPPV, displaced otoconia enter the posterior semicircular canal."*
- Final step status (`01:28–01:36`): *"Otoconia Repositioned → Maneuver Complete"* and conditional resolution (*"Particles exit into the utricle; if posterior-canal BPPV is the cause, vertigo should resolve."*).
- Zero fake cupula percentage readouts and zero unsourced `>80%` single-session efficacy claims.

---

## 3. Inspected QA Keyframes (`build/qa/`, gitignored build artifacts)
1. `build/qa/scene1_locate_part1.png` (`t = 2.8s`: Cutaway Head & Shoulders showing embedded Right Inner Ear Labyrinth + linked `RIGHT INNER EAR · LIVE POSE` PiP)
2. `build/qa/scene1_locate.png` (`t = 8.8s`: Dynamic Role Swap to Gate 3 Right Labyrinth Close-Up highlighting `Posterior Semicircular Canal` and `Utricle`)
3. `build/qa/scene2_pathology.png` (`t = 20.0s`: Gate 3 Pathology Close-Up showing 5 warm amber canaliths at `-90°` near the posterior ampulla and the `Common Crus → Utricle` pathway)
4. `build/qa/scene3_step1.png` (`t = 32.5s`: Step 1 Hold — Right posterior canal aligned with upcoming recline plane)
5. `build/qa/scene4_step2.png` (`t = 48.0s`: Step 2 Hold — Supine `20–30°` neck extension; otoconia migrate to `+30°` posterolateral apex)
6. `build/qa/scene5_step3.png` (`t = 63.5s`: Step 3 Hold — `90°` contralateral left turn; otoconia cross superior arch into common crus at `+110°`)
7. `build/qa/scene6_step4.png` (`t = 79.5s`: Step 4 Hold — Left-shoulder lateral decubitus with nose `45°` down; otoconia drain down common crus to `+165°`)
8. `build/qa/scene7_step5.png` (`t = 92.5s`: Step 5 Return Upright — `Otoconia Repositioned → Maneuver Complete` at `+188°` inside the utricle)
9. `build/qa/scene8_summary.png` (`t = 106.0s`: Post-Maneuver Clinical Observation & 4-item `KEY CLINICAL CHECKPOINTS — RIGHT EPLEY MANEUVER` card)

---

## 4. Defect Audit & Rigorous Verification Records

### 4.1 Defect 1: Labyrinth Stage Boundary Bleed & Midline Slicing (Fatal Visual Bug)
- **Input**: Dual-stage orthographic camera rendering with `self.labyrinth_scale = 0.80` and `stage_origin = Vector((4.5, 0.0, 0.5))`.
- **Expected**: The 3D Right Labyrinth stage geometry is completely contained within the right half of the render canvas ($X > 0.0$, $x \ge 1280$ px), leaving the patient stage clean and unpolluted.
- **Actual**: The authentic IE-Map `ls_Hsapiens_Sp` mesh extended across the world midline to $X = -0.62$ ($x = 1214$ px), spilling 66 px into the patient viewport. In all patient-dominant frames (e.g., `scene1_locate_part1.png`, `scene3_step1_part1.png`), an unanchored floating cyan ghost artifact appeared on the right. In all labyrinth-dominant frames (Scenes 2, 4, 6, 7), the posterior canal was sliced off flat vertically at $x = 1280$.
- **Root Cause**: The prior worker scaled the authentic 27-mesh bundle by 0.80 without verifying the orthographic projection footprint of the full $14.5\text{ mm}$ RAS mesh extent relative to the dividing plane $X = 0.0$.
- **Fix & Verification**: Set `self.labyrinth_scale = 0.44` and `self.labyrinth_stage_origin = Vector((6.00, 0.0, 0.70))` in `src/render/blender_scene_builder.py`. Verified across all 399 rendered raw poses:
  - Labyrinth stage $x_{\min} = 1531\text{ px}$ (margin from midline: **251 px** buffer).
  - Labyrinth stage $x_{\max} = 2376\text{ px}$ (margin from right border: **184 px** buffer).
  - Midline spill count in band $[1200, 1279]\text{ px}$: **0 / 399 poses (100.0% clean)**.

### 4.2 Defect 2: Patient Bust Shoulder Flare / Epaulet Clipping (Visual Rigging Defect)
- **Input**: Appending `GEO-head_sculpting_realistic` directly onto `NeckPivot` and rotating head $\pm 45^\circ$ (Step 1, Step 3) or $135^\circ$ (Step 4).
- **Expected**: A smooth anatomical neck column rotates seamlessly inside the open blue tunic collar of `ContouredTorso`.
- **Actual**: The CC0 sculpt includes a wide clavicle/shoulder bust base ($\sim 1.0\text{ m}$ scaled width, local $r = 0.148$). Rotating the rigid object swung the shoulder base outside the tunic collar, protruding like broken white epaulet wings through the patient's chest.
- **Root Cause**: The sculpted head asset was an unrigged bust containing clavicle geometry, rather than an isolated neck column.
- **Fix & Verification**: In `append_authentic_sculpted_head()`, programmatically tapered all vertices below the anatomical neck line ($z_{\text{local}} < 0.135$, $z_{\min} = 0.035$) radially inward to $r \le 0.072$ using smooth cosine interpolation. The resulting cylindrical neck column rotates completely inside the open collar with zero clipping across all 5 Epley poses.

### 4.3 Defect 3: Step 3 Pill Callout Misanchoring
- **Input**: In Step 3 (head turned $45^\circ$ left), anchoring the "Rotate Head 90° Left" action pill callout to `ear_main`.
- **Expected**: Callouts point to clearly visible anatomical features.
- **Actual**: In Step 3, the right ear is turned away onto the far side of the head and occluded, causing the leader line to terminate on empty air behind the head silhouette.
- **Fix & Verification**: Added `project_patient_nose()` to `DualStageBlenderScene` and mapped `nose_main` in `hud_compositor.py`. Re-anchored the Step 3 rotation pill to the patient's nose tip, providing a crisp, intuitive visual reference for the contralateral head turn.

### 4.4 Defect 4: Proof Gate Script Broken Import
- **Input**: Running `scripts/render_proof_gate.py --composite-only`.
- **Expected**: Clean generation of `build/proof/proof_gate_step1_to_step2.mp4`.
- **Actual**: Crashed with `ImportError: cannot import name 'compute_canonical_slot_map' from 'src.render.hud_compositor'`.
- **Root Cause**: `compute_canonical_slot_map` was an obsolete helper from early development that was removed when Gate 3 staged pills were implemented.
- **Fix & Verification**: Removed obsolete import and unused slot interpolation from `scripts/render_proof_gate.py`. Updated `ras_landmarks` to authentic IE-Map coordinates (`utricle = [4.58, 1.87, 0.35]`, `cochlea = [1.77, 6.38, -2.96]`). Re-ran full proof pass: rendered 45 poses and encoded `build/proof/proof_gate_step1_to_step2.mp4` with zero errors.
