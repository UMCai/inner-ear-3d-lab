# Product Engineering Roadmap: Stage-by-Stage Implementation (`ROADMAP.md`)

> **Project:** Inner Ear 3D Lab  
> **Repository:** `inner-ear-3d-lab`  
> **Execution Strategy:** Phased modular delivery adhering to the "Modal Workbench" zero-clutter architecture.

---

## High-Level Milestone Overview

```mermaid
flowchart LR
    S0["Stage 0: Pure 3D Anatomy Lab<br/><b>[DONE]</b><br/>• 27 Authentic Meshes<br/>• Bone Peel & Explode<br/>• 60fps WebGL MVP"] 
    --> S1["Stage 1: Hearing & Tonotopy<br/><b>[DONE]</b><br/>• Greenwood Place Map<br/>• Web Audio Pure Tones<br/>• Interactive Audiogram<br/>• Mode Switcher"]
    --> S2["Stage 2: Virtual Radiology<br/><b>[DONE]</b><br/>• Pöschl's & Stenvers' Slicers<br/>• Shader Clipping Planes<br/>• 2D CT MPR Canvas<br/>• SCDS Third-Window"]
    --> S3["Stage 3: Vestibular & VOR<br/><b>[DONE]</b><br/>• Multi-Canal BPPV (Gufoni)<br/>• 3D Eye Nystagmus Avatar<br/>• Caloric COWS & vHIT"]
    --> S4["Stage 4: Surgical Scenarios<br/><b>[DONE]</b><br/>• Cochlear Implant Insertion<br/>• Labyrinthectomy Compensation<br/>• Acoustic Neuroma Staging"]
```

---

## Stage 0: Pure 3D Anatomy Lab MVP — ✅ COMPLETE

- [x] Ingest 27 authentic IE-Map v1.0.0 high-resolution meshes in stereotaxic RAS coordinates.
- [x] Implement single-stage Three.js WebGL canvas with 60fps OrbitControls.
- [x] Build Gate 3 custom GLSL shaders with rim lighting and backface culling (`gate3Materials.ts`).
- [x] Implement smooth camera fly-to interpolation for part framing.
- [x] Implement `Outer Bone Shell` translucency peel slider ($0\text{–}100\%$) and `Separate Parts` radial explode slider ($0\text{–}100\%$).
- [x] Implement 27-part clinical ontology (`ontology.ts`) with Latin names, innervation, fluid spaces, and clinical pearls.
- [x] Implement search bar with keyboard navigation and occlusion-aware screen-projected HTML pins.
- [x] Perform bundle optimization ($18\text{ kB}$ CSS, $582\text{ kB}$ JS) and multi-viewport verification.

---

## Stage 1: Audio-Visual Tonotopy Engine & Hearing Lab — ✅ COMPLETE

### Objective
Transform the static cochlea into an interactive frequency analyzer driven by the Greenwood function and real-time Web Audio API pure-tone synthesis, complete with an interactive clinical audiogram drawer.

### Task Breakdown
- [x] **Step 1.1: Web Audio Pure-Tone Synthesizer (`web/src/audio/ToneSynthesizer.ts`)**:
  - Implement a shared browser `AudioContext` with lazy user-gesture initialization.
  - Implement dynamic sine-wave generation (`OscillatorNode`, `GainNode`) with exponential attack/decay envelope ($50\text{ ms}$) to prevent speaker clicking.
  - Provide continuous pitch gliding for frequency scrubbing ($35\text{ ms}$ time constant).
  - Add safety dynamics compressor limiter ($-4\text{ dB}$ threshold, $12:1$ ratio).
- [x] **Step 1.2: Greenwood Place-Frequency Engine (`web/src/data/greenwoodEngine.ts`)**:
  - Implement the Donald D. Greenwood formula: $F(x) = 165.4 \cdot (10^{2.1 \cdot x} - 0.88)$ and inverse $x(F)$.
  - 100-knot 3D RAS spline table ($28.79\text{ mm}$ apex to base).
  - Ultra-fast continuous orthogonal segment projection ($<5\text{ ms}$ for 8k verts, zero memory leak / OOM).
  - Barycentric face vertex interpolation for raycast picking without inter-turn aliasing.
- [x] **Step 1.3: Hearing Mode Shading & Spectral Gradient in `DualStageScene.ts`**:
  - Add `hearingLab` mode support to `DualStageScene`.
  - In Hearing Mode: Automatically ghost the vestibular system (canals, ampullae, vestibule) to $15\%$ opacity to direct visual focus to the cochlea.
  - Render a continuous 7-stop perceptual rainbow spectral gradient along the cochlear coil (Red $\approx 20\text{ kHz}$ base $\to$ Gold $\approx 4\text{ kHz}$ $\to$ Green $\approx 1\text{ kHz}$ $\to$ Cyan $\approx 500\text{ Hz}$ $\to$ Violet $\approx 20\text{ Hz}$ apex).
  - Add animated traveling wave pulse ripple on tone trigger (`uWavePhase`).
- [x] **Step 1.4: Top Header Mode Switcher (`AppHUD.ts`)**:
  - Add the clean segmented mode pill in the top header: `[ 🏛️ Anatomy Atlas ] [ 🎵 Hearing & Tonotopy ]`.
  - Maintain desktop, tablet, and mobile responsiveness without crowding the search bar.
- [x] **Step 1.5: Contextual Bottom Dock for Hearing Mode**:
  - Morph the bottom bar when in Hearing Mode:
    - Logarithmic Frequency Slider ($20\text{ Hz}\to 20{,}000\text{ Hz}$).
    - `Play Tone ▶` toggle button and live readout (`4000 Hz · 4 kHz Notch (19.2 mm)`).
    - Audiometric octave jump chips (`125`, `250`, `500`, `1k`, `2k`, `4k`, `8k`).
- [x] **Step 1.6: Interactive Clinical Audiogram Drawer (`AudiogramDrawer.ts`)**:
  - Collapsible `[ 📊 Audiogram ▾ ]` drawer sliding up over the bottom-right corner.
  - Interactive $125\text{ Hz}\to 8{,}000\text{ Hz}$ / $-10\text{ dB}\to 120\text{ dB HL}$ standard clinical grid with right-ear red circle $\bigcirc$ markers and Speech Banana overlay.
  - 4 Clinical Presets: `Normal Hearing`, `Presbycusis (High Loss)`, `4 kHz Noise Notch`, `Ménière's (Low Loss)`.
  - Bi-directional 3D linking: selecting presets maps damaged hair-cell zones in crimson on the 3D cochlea.
  - Drawer mutual exclusivity: opening Audiogram closes Parts Drawer and vice versa.
- [x] **Step 1.7: Fluid Compartment & Voltage Badge in Inspector**:
  - Display Scala Media (Endolymph $+80\text{ mV}$, high $\text{K}^+$) vs. Scala Tympani/Vestibuli (Perilymph $0\text{ mV}$, high $\text{Na}^+$).
  - Display $150\text{ mV}$ electrical driving force badge.
- [x] **Step 1.8: Build & QA Verification**:
  - Zero TypeScript errors (`npm run build`).
  - Automated deep unit tests: `scripts/test_hearing_engine.js` (100% pass across 7 suites).
  - Headless Chrome CDP verification: `scripts/verify_mvp_cdp.js` (100% pass across 4 viewports with 0 errors).

---

## Stage 2: Virtual Temporal Bone Radiology & SCDS Third-Window — ✅ COMPLETE

### Objective
Enable medical students, ENT residents, and neuroradiologists to master multiplanar CT/MRI cross-sections of the petrous temporal bone directly against the 3D anatomical model.

> **Blueprint & Derivation Spec:** [`docs/STAGE2_PLAN.md`](docs/STAGE2_PLAN.md)  
> **Verification Suite:** `scripts/test_radiology_engine.js` (52/52 tests passing)

### Task Breakdown
- [x] **Step 2.1: Analytic Shader Slicing & 3D Helpers (`DualStageScene.ts`)**:
  - Exposed $O(1)$ GPU fragment clipping plane uniforms (`uClipActive`, `uClipNormal`, `uClipConstant`) across all 27 meshes.
  - Built 3D semi-transparent quad plane guide helper with Medaium cyan edge highlighting.
  - Implemented smooth camera fly-to perspective angles along plane normals.
  - Implemented SCDS 3D apical bone defect boundary with radiating acoustic sound wave arcs.
- [x] **Step 2.2: Stereotaxic Radiology Engine (`web/src/data/radiologyEngine.ts`)**:
  - **Pöschl's Plane**: Oblique sagittal parallel to the superior semicircular canal (gold standard for SSCD, default $+1.2\text{ mm}$ halo center).
  - **Stenvers' Plane**: Oblique coronal perpendicular to Pöschl's plane (profiles canal arch & vestibular aqueduct).
  - **True Axial Plane**: Horizontal canal signet ring and internal auditory canal (IAC).
  - **True Coronal Plane**: Cochlear modiolus and round window niche (right-handed convention $\mathbf{u} = [-1, 0, 0]$ Medial).
  - 100% continuous landmark dictionaries for all 4 planes with zero depth gaps.
- [x] **Step 2.3: Contextual Radiology Bottom Dock & Controls (`AppHUD.ts`, `style.css`)**:
  - Mode 3 switcher pill `[ 🩻 Virtual Radiology ]` in top header.
  - 4 Segmented plane chips (`Pöschl`, `Stenvers`, `True Axial`, `True Coronal`).
  - Continuous depth scrubber with live landmark readout and $\pm 0.5\text{ mm}$ step bump buttons.
  - Quick action toggles: `[⇄ Flip Cut]`, `[📐 Guide Plane]`, `[⚡ SCDS Defect]`, and `[🩻 2D CT Card ▾]`.
- [x] **Step 2.4: Synchronized 2D CT MPR Slice Drawer (`CTSliceDrawer.ts`)**:
  - Docked $360\times 360$ ($720\times 720$ physical retina) 2D canvas cross-sectional slice viewer.
  - Bone Window ($W:4000, L:+700\text{ HU}$) and T2 CISS MRI modes.
  - Standard radiological orientation tokens (`AS`/`PI`, `PL`/`AM`, `A`/`P`/`M`/`L`, `S`/`I`/`L`/`M`).
  - Precision 5 mm scale bar with 1 mm ticks and landmark crosshair.
  - Bi-directional horizontal drag scrubbing synchronized with 3D cutting plane.
- [x] **Step 2.5: Superior Canal Dehiscence (SCDS) Defect Simulation**:
  - Interactive bone defect toggle displaying $1.5\text{ mm}$ apical bone roof breach on Pöschl view.
  - Third-window biomechanics box in Floating Inspector detailing the clinical triad (Tullio phenomenon, Hennebert's sign, autophony).
  - Link to SCDS Audiogram preset demonstrating the low-frequency pseudo-conductive air-bone gap.
- [x] **Step 2.6: Verification & QA**:
  - Mathematical & mesh unit test suite `scripts/test_radiology_engine.js` (52/52 tests passing 100%).
  - Multi-viewport headless Chrome CDP test suite `scripts/verify_mvp_cdp.js` (Desktop $1440\times 900$, Desktop $1280\times 800$, Tablet $768\times 1024$, Mobile $390\times 844$) with 0 errors.
  - Production build clean compile (`cd web && npm run build`, 0 TypeScript/Vite errors).

---

## Stage 3: Multi-Canal Vestibular Dynamics & VOR Eye Avatar — ✅ COMPLETE

### Objective
Expand vestibular simulation beyond the posterior canal to encompass all 3 semicircular canals, complex BPPV maneuvers, caloric irrigation, video head impulse testing, and a synchronized 3D eye avatar demonstrating the vestibulo-ocular reflex.

> **Blueprint & Derivation Spec:** [`docs/STAGE3_PLAN.md`](docs/STAGE3_PLAN.md)  
> **Verification Suites:** `scripts/test_canal_paths.py`, `scripts/test_vestibular_engine.js` (72 tests), `scripts/test_eye_avatar_vor.js` (50 tests), `scripts/test_vor_workbench.js` (51 tests), `scripts/test_diagnostic_vestibular.js` (51 tests).

### Task Breakdown
- [x] **Step 3.1: Multi-Canal BPPV & Maneuver Presets**:
  - Horizontal Canal BPPV: Geotropic (canalithiasis) and Apogeotropic (cupulolithiasis) with Gufoni maneuver and Lempert 360° Barbecue roll.
  - Anterior Canal BPPV with Yacovino maneuver.
  - 3-DOF $SO(3)$ head kinematics with side-lying lateral roll ($\gamma = \pm 90^\circ$).
  - Two-phase Steinhausen cupular plunger model with passive elastic decay and Ewald's 2nd & 3rd laws neurophysiology.
- [x] **Step 3.2: Synchronized 3D Dual-Eye Avatar & VOR Kinematics Engine**:
  - 3D bilateral ocular avatar (`assets/iemap/eye_avatar.glb`, $PD = 62.0\text{ mm}$, 32 radial iris crypts for cyclotorsion tracking).
  - 3-DOF Listing's law kinematics ($q_z \equiv 0$) with vestibular cyclotorsion around line of sight.
  - Bilateral cyclovergent coupling, slow-phase peripheral drift integration, and ballistic resetting fast-phase saccades.
  - Monochromatic near-infrared (NIR) VNG shader with pupil centroid tracking $\oplus$ and corneal Purkinje glints $\ast$.
- [x] **Step 3.3: Caloric Testing Simulator (COWS Rule)**:
  - 1D Fourier thermal diffusion ODE ($\alpha = 0.14\text{ mm}^2/\text{s}$, depth $L=4.0\text{ mm}$) with temperature-dependent endolymph buoyancy.
  - Proves Cold Opposite, Warm Same (COWS) across both ears with warm (44°C), cold (30°C), and ice water (4°C) irrigations.
  - Alexander's law gaze modulation ($k=0.0133/^\circ$) and Jongkees bithermal formulation ($UW\%$, $DP\%$).
  - Claussen 4-quadrant butterfly vestibulogram with 15–30°/s normative corridor.
- [x] **Step 3.4: Video Head Impulse Test (vHIT)**:
  - 5th-order minimum-jerk kinematics ($T=120\text{ ms}$, $\Delta\theta = 15^\circ$, $250^\circ/\text{s}$) across Horizontal, RALP, and LARP canal planes.
  - Curthoys 40–80ms area gain calculation, overt/covert saccades, goggle slippage artifact, and SHIMP paradigm.
  - Dual-trace high-speed velocity plot with live $SO(3)$ 3D head thrusts.

---

## Stage 4: Otologic Surgical Scenarios & Procedural Pathology — ✅ COMPLETE

### Objective
Deliver specialized otologic surgical planning tools, implant kinematics, and biotelemetry simulators for otologic surgeons, neurotology fellows, and residents.

> **Blueprint & Derivation Spec:** `stage4_surgical_simulation_plan.md`  
> **Verification Suite:** `scripts/test_surgical_engine.js` (56/56 assertions passing 100%)

### Task Breakdown
- [x] **Step 4.1: Cochlear Implant (CI) Scala Tympani Insertion**:
  - Continuous 3D Scala Tympani insertion trajectory ($0\dots 31.0\text{ mm}$ depth, $0^\circ \to 720^\circ$ angular coverage).
  - Dynamic Advance Off-Stylet (AOS) curling factor ($0.0 \to 1.0$) with non-linear friction and curvature force accumulation.
  - 22 platinum electrode band contacts mapping Donald D. Greenwood place-frequencies ($18\text{ kHz}$ to $250\text{ Hz}$).
  - Procedural 3D electrode array tube (`THREE.BufferGeometry`) and 22 platinum sphere contact meshes in `DualStageScene.ts`.
- [x] **Step 4.2: Scalar Translocation Warning System**:
  - Continuous insertion force telemetry and basilar membrane proximity tracking.
  - Critical safety threshold trigger ($F > 150\text{ mN}$) flagging basilar membrane rupture and scala vestibuli breach.
  - Fragment shader crimson rupture emergency alarm (`uTranslocationBreach`) and Web Audio mechanical rupture snap transient.
- [x] **Step 4.3: Transmastoid Labyrinthectomy & Central Compensation**:
  - High-speed surgical drilling canal unroofing progression ($0\dots 100\%$) with milling luminescence shader (`uSurgicalDrillActive`, `uCanalUnroofed`).
  - Web Audio 70,000 RPM otologic drill whine with high-frequency harmonics and mechanical flutter.
  - Acute unilateral complete vestibular deafferentation and central vestibular compensation ODE ($\text{SPV}(t) = \text{SPV}_{\text{acute}} e^{-t / \tau}$ with $\tau = 4.0\text{ days}$) extinguishing spontaneous nystagmus to $0.0^\circ/\text{s}$.
- [x] **Step 4.4: Retrosigmoid Neurectomy & IAC Vestibular Schwannoma Staging**:
  - Porus acousticus 4-quadrant anatomical mapping (Anterosuperior = Facial VII, Anteroinferior = Cochlear, Posterosuperior = Superior Vestibular, Posteroinferior = Inferior Vestibular: "7-up, Coke down").
  - Koos vestibular schwannoma tumor classification (Stages I–IV: intracanalicular $\le 10\text{ mm}$ to giant $>30\text{ mm}$ brainstem compression).
  - Continuous electrophysiological biotelemetry: ABR Wave V latency prolongation $\Delta\tau_{\text{ABR}}$ ($5.6\dots 8.5\text{ ms}$) and amplitude degradation.
  - Continuous facial nerve EMG neurotonic spike rate and voltage alarm ($\mu\text{V}$) triggered by mechanical traction ($F_{\text{traction}} > 2.0\text{ g}$) or sub-millimeter proximity ($d < 1.0\text{ mm}$), paired with Web Audio $180\text{ Hz}$ EMG acoustic alert.
- [x] **Step 4.5: Docked Surgical Drawer, HUD Integration & Multi-Viewport Verification**:
  - 5th docked modal card (`SurgicalDrawer.ts`, $360\times 360$ logical, $720\times 720$ physical) with 2D endoscopic monitor and live biotelemetry strip chart.
  - Header mode switcher `[ 🔬 Surgical Suites ]` and contextual bottom dock `#surgical-dock-content` with CI, Labyrinthectomy, and Neurectomy workbenches.
  - Strict 5-drawer mutual exclusivity (`partsDrawer`, `audiogramDrawer`, `ctSliceDrawer`, `vorDrawer`, `surgicalDrawer`, and `gyroFlyout`).
  - 100% test pass on `scripts/test_surgical_engine.js` (56 tests), root `npm test` (all 7 suites passing), `cd web && npm run build` (0 errors), and headless Chrome CDP visual multi-viewport validation.
