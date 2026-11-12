# Inner Ear 3D Lab (Gate 3 Medaium) & Epley Maneuver Simulation

An interactive WebGL 3D anatomy and clinical simulation platform, paired with a reproducible 1080p (`1920x1080`, `30 fps`, `110.20s`) clinical educational animation for the **Epley Maneuver (Canalith Repositioning Procedure) for Right-Ear Posterior-Canal BPPV** using the **Gate 3 (`Medaium-BPPV-001` / `lemo-opuscar`)** visual design language.

---

## ⚡ Quick Start: Running the 3D Web Application

The interactive web application runs on **Vite**, **TypeScript**, and **Three.js** with a **Dual-Theme Editorial Specimen** UI (**Dark Glassroom** + **Light Paper-Technical**) powered by `THREE.AgXToneMapping` + `RoomEnvironment` IBL, a unified expandable `#note-sidebar` (`collapsed` → `compact` → `expanded` `[Note | Lab]` → `wide-read`), and 5 clinical workbenches:

1. **Anatomy Atlas:** 27 authentic IE-Map v1.0.0 RAS meshes, outer bone shell translucency peel, radial explode, guided presets, search combobox, and filterable parts tree.
2. **Hearing & Tonotopy:** Donald D. Greenwood auditory place-frequency engine (`20 Hz–20.7 kHz`), traveling-wave shader, Web Audio pure-tone synthesizer, and interactive Right-Ear audiogram (`AudiogramDrawer.ts`).
3. **Virtual Radiology:** Stereotaxic temporal bone MPR slicing (Pöschl, Stenvers, Axial, Coronal), analytic GPU fragment clipping, Retina 2D CT/T2-MRI drawer (`CTSliceDrawer.ts`), and SCDS third-window simulation.
4. **Vestibular & VOR:** Multi-canal BPPV (6 maneuvers + `#gyro-flyout`), Caloric thermal convection (COWS, Alexander's law, Jongkees calculator + butterfly vestibulogram), vHIT (`40–80 ms` Curthoys gain, HIMP/SHIMP, saccades), and synchronized 3D Eye Avatar (`VORDrawer.ts`).
5. **Surgical Suites:** Cochlear Implant insertion (`28.0 mm`, AOS curling, `>= 30 mN` translocation alarm), Labyrinthectomy (`70,000 RPM` drill + `tau = 72 h` compensation), and IAC Neurectomy (`"7-up, Coke down"`, Koos `0–IV`, ABR/EMG plots in `SurgicalDrawer.ts`).

Also included is the lightweight static showcase entrypoint at `http://127.0.0.1:5173/showcase.html` (`web/showcase.html`).

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v22.6+ or Node with TypeScript type stripping for `npm test`; v18+ for `npm run dev` / `npm run build`)
- `npm`
- Python 3 (optional, for physics/canal spline tests and Blender video pipeline)

### 2. Install Dependencies & Launch Development Server

On initial clone, install the web dependencies (this also syncs the tracked `assets/iemap/` runtime files into `web/public/assets/iemap/`):
```bash
cd web && npm install
```

Then run the dev server from the repository root:
```bash
npm run dev
```

Open your browser at:
👉 **http://127.0.0.1:5173/** (production clinical lab) · **http://127.0.0.1:5173/showcase.html** (editorial showcase)

### 3. Build, Verify & Preview

```bash
# Run full typecheck + 7 Node suites + Python spline/Epley self-tests + production Vite build
npm run verify

# Run Headless Chrome CDP geometric & multi-viewport QA across 1440x900, 1280x800, 768x1024, 390x844
npm run test:cdp

# Preview the production build locally
npm run preview
```

---


## 1. Visual Architecture & Core Teaching Mechanism

Every frame synchronizes two 3D views in `1:1` world-space lockstep inside a clean, distraction-free 3-zone editorial layout:

$$\text{3/4 Clinical Patient Pose \& Doctor Layer} \;\longleftrightarrow\; \text{Gate 3 IE-Map Right Labyrinth} \;\longrightarrow\; \text{Gravity } (\mathbf{g} \downarrow) \;\longrightarrow\; \text{Otoconia Migration}$$

1. **Dynamic Role Swap (Main Viewport $\leftrightarrow$ Linked PiP Inset)**:
   - **Movement Phase**: The **3/4 External Patient View** dominates the full-bleed Main Viewport (`1920 × 811`), showing the sculpted anatomical patient head (`GEO-head_sculpting_realistic`), affected right ear (`Right_ear_locator_ring`), shoulder pillow, translucent cyan **clinician support hands**, and **3D curved action arrows**. The synchronized **IE-Map Right Labyrinth** sits in the Top-Right PiP Inset (`RIGHT INNER EAR · LIVE POSE`) connected by a live cyan zoom line to the right ear.
   - **Settling Hold Phase (30–60 s)**: The **Gate 3 IE-Map Right Labyrinth Close-Up** smoothly swaps into the Main Viewport (with a compact top-right `GRAVITY` arrow and 5 warm amber canalith particles migrating through the translucent cyan posterior canal and lavender common crus into the sage-green utricle), while the **Patient Hold Pose** sits in the Top-Left PiP Inset (`PATIENT POSE · HOLD 30–60 s`).
2. **Gate 3 Editorial Lower-Third (`185 px`)**:
   - Features a `12 px` Medaium Cyan left vertical accent bar, a bold `Headline` (`font(31, True)`), a single concise `Support` sentence (`font(20, False)`), right-aligned timecode, and an 8-shot progress bar.
3. **Temporally Staged Pill Callouts**:
   - At most `1–2` rounded pill callouts appear at any time with smooth fade-in/out transitions and zero crossed leader lines.

---

## 2. 8-Shot Clinical Story & Vestibular Kinematics (`110.20s`)

| Shot | Time Window | Step Badge | Patient & Head Pose $(\psi_{\text{yaw}}, \theta_{\text{recline}})$ | Canalith Angle $(\phi)$ & Clinical Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **Shot 1: Locate** | `00:00.0 – 00:11.6` | `ANATOMY · LOCATE` | 3/4 translucent head cutaway $\to$ Gate 3 Labyrinth close-up | Highlights the right inner ear labyrinth embedded inside the right temporal bone, the translucent cyan posterior canal (`Sp`), and the sage-green utricle |
| **Shot 2: Pathology** | `00:11.6 – 00:23.2` | `PATHOLOGY · CANALITHS` | Upright sitting ($\theta = 0^\circ$) | 5 warm amber otoconia (`Schematic_canalith_01..05`) pooled at $\phi = -84^\circ$ just outside the posterior ampulla (`Ap`) |
| **Shot 3: Step 1** | `00:23.2 – 00:36.2` | `STEP 1 OF 5 · 45° RIGHT TURN` | Seated upright ($\theta = 0^\circ$), **Head turned $45^\circ$ Right** ($\psi = -45^\circ$) | Aligns the right posterior canal with the sagittal recline plane; shoulder pillow placed behind upper back ($\phi = -84^\circ$) |
| **Shot 4: Step 2** | `00:36.2 – 00:53.0` | `STEP 2 OF 5 · SUPINE 30° EXTENSION` | **Recline to supine with $20\text{–}30^\circ$ neck extension** over shoulder pillow ($\psi = -45^\circ, \theta = 120^\circ$) | Gravity draws otoconia ampullofugally away from the ampulla to the posterolateral canal apex ($\phi = -84^\circ \to +30^\circ$). **Hold $30\text{–}60\text{ s}$** |
| **Shot 5: Step 3** | `00:53.0 – 01:08.5` | `STEP 3 OF 5 · 90° LEFT TURN` | **$90^\circ$ contralateral head turn to $45^\circ$ Left** without lifting head ($\psi = +45^\circ, \theta = 120^\circ$) | Otoconia cross the superior arch of the posterior canal into the common crus ($\phi = +30^\circ \to +110^\circ$). **Hold $30\text{–}60\text{ s}$** |
| **Shot 6: Step 4** | `01:08.5 – 01:24.2` | `STEP 4 OF 5 · LEFT SHOULDER ROLL` | **Roll onto left shoulder ($\theta = 90^\circ$) + turn head $90^\circ$ Left** so nose points **$45^\circ$ down** ($\psi = +135^\circ$) | Aligns the common crus steeply downward so otoconia drain to the utricular exit ($\phi = +110^\circ \to +165^\circ$). **Hold $30\text{–}60\text{ s}$** |
| **Shot 7: Step 5** | `01:24.2 – 01:36.9` | `STEP 5 OF 5 · RETURN UPRIGHT` | **Return slowly to upright sitting** with chin slightly tucked ($\psi \to 0^\circ, \theta \to 0^\circ$) | **Otoconia Repositioned $\to$ Maneuver Complete**: particles exit and fan out inside the utricle ($\phi = +165^\circ \to +186^\circ$) |
| **Shot 8: Summary** | `01:36.9 – 01:50.2` | `CLINICAL SUMMARY · KEY PEARLS` | Upright clinical observation pose ($\psi = -25^\circ, \theta = 0^\circ$) | 4-item `KEY CLINICAL CHECKPOINTS — RIGHT EPLEY MANEUVER` summary card |

---

## 3. Repository Structure & Deliverables

```text
.
├── AGENTS.md / CLAUDE.md / DESIGN.md / PRODUCT.md / ARCHITECTURE.md / ROADMAP.md / STATUS.md / QA_NOTE.md
├── docs/                                   # Clinical specs, UI_DESIGN_SPEC.md & MEMORY.md
├── web/                                    # Vite + TypeScript + Three.js WebGL2 interactive app
│   ├── index.html                          # Production Dual-Theme Editorial Specimen UI (#note-sidebar)
│   ├── showcase.html                       # Phase 1 standalone static showcase entrypoint
│   └── src/
│       ├── audio/ToneSynthesizer.ts        # Procedural Web Audio tones, drill whine & EMG alarms
│       ├── data/                           # ontology.ts, objLoader.ts, canalPaths.ts, greenwoodEngine.ts, radiologyEngine.ts
│       ├── physics/                        # vestibularEngine.ts, diagnosticVestibularEngine.ts, surgicalEngine.ts
│       ├── render/                         # DualStageScene.ts (AgX + IBL + setViewOffset), gate3Materials.ts, eyeAvatar.ts
│       ├── showcase/                       # Phase 1 HeroSpecimen3D.ts, showcaseData.ts, showcase.css
│       └── ui/                             # AppHUD.ts, hudChrome.ts, AudiogramDrawer.ts, CTSliceDrawer.ts, VORDrawer.ts, SurgicalDrawer.ts
├── assets/iemap/
│   ├── look-config.json                    # Gate 3 (Medaium-BPPV-001) material, lighting & camera configuration
│   ├── iemap_right_labyrinth.glb           # Combined 3D glTF 2.0 binary asset of the Right Labyrinth
│   ├── eye_avatar.glb                      # 3D bilateral eye avatar with radial iris crypts
│   ├── posterior/horizontal/anterior_canal_path.json # Continuous 3D RAS splines
│   ├── vtk/*.vtk & obj/*.obj               # 27 authentic IE-Map v1.0.0 inner-ear surface meshes
│   └── fcsv/*.fcsv                         # 4 3D Slicer Markups fiducial files
├── output/
│   ├── epley_maneuver_right_bppv.mp4       # Final 1920x1080 @ 30fps H.264/AAC Gate 3 educational video (110.20s)
│   ├── epley_maneuver_right_bppv.srt       # Synchronized clinical subtitles (SRT)
│   └── mvp_*.png                           # Verified multi-viewport Dark & Light visual baselines
├── src/                                    # Python Blender 5.2 LTS video & physics pipeline
│   ├── anatomy/{prepare_iemap.py, export_glb_and_preview.py}
│   ├── physics/epley_simulator.py
│   ├── audio/build_audio.py
│   └── render/{blender_scene_builder.py, hud_compositor.py}
└── scripts/                                # Verification suites, spline exporters & CDP visual audits
    ├── verify_mvp_cdp.js
    ├── test_{hearing_engine,radiology_engine,vestibular_engine,eye_avatar_vor,vor_workbench,diagnostic_vestibular,surgical_engine}.js
    ├── test_canal_paths.py
    └── build_full_video.py
```

---

## 4. Reproducible Build & Verification Commands

### A. WebGL 3D Application (Interactive Atlas)
```bash
# 0. Install web dependencies & sync IE-Map runtime assets (initial clone)
cd web && npm install && cd ..

# 1. Start local dev server (Vite @ http://127.0.0.1:5173/)
npm run dev

# 2. Type-check, run all 7 Node suites + Python physics/spline tests, and build production bundle
npm run verify

# 3. Full build + 7 Node test suites (Hearing, Radiology, Vestibular, Eye Avatar, Workbench, Diagnostic VOR, Surgical)
npm test

# 4. Run multi-viewport Headless Chrome CDP verification (requires Google Chrome on macOS)
npm run test:cdp

# 5. Preview production build
npm run preview
```

### B. Headless Blender 5.2 LTS Editorial Video Pipeline
```bash
# 1. Generate IE-Map meshes, fiducials, 3D canal centerline, and Gate 3 look-config.json
python3 src/anatomy/prepare_iemap.py

# 2. Export combined glTF binary and render Gate 3 3D anatomical verification preview
/Applications/Blender.app/Contents/MacOS/Blender -b -P src/anatomy/export_glb_and_preview.py

# 3. Run 5-step vestibular kinematics & gravitational sedimentation self-test
python3 src/physics/epley_simulator.py

# 4. Synthesize 8-shot voiceover narration, sound design, SRT subtitles, and timeline_manifest.json
python3 src/audio/build_audio.py

# 5. Run headless Blender 5.2 LTS 3D render pass
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/build_full_video.py

# 6. Run parallel Gate 3 2D compositing, encode output/epley_maneuver_right_bppv.mp4, and generate QA sheets
python3 scripts/build_full_video.py --composite-only

# 7. (Optional) Run focused Step 1 to Step 2 Gate proof verification
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/render_proof_gate.py
python3 scripts/render_proof_gate.py --composite-only
```
