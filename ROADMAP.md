# Product Engineering Roadmap: Stage-by-Stage Implementation (`ROADMAP.md`)

> **Project:** Inner Ear 3D Lab  
> **Repository:** `radiant-darwin`  
> **Execution Strategy:** Phased modular delivery adhering to the "Modal Workbench" zero-clutter architecture.

---

## High-Level Milestone Overview

```mermaid
flowchart LR
    S0["Stage 0: Pure 3D Anatomy Lab<br/><b>[DONE]</b><br/>• 27 Authentic Meshes<br/>• Bone Peel & Explode<br/>• 60fps WebGL MVP"] 
    --> S1["Stage 1: Hearing & Tonotopy<br/><b>[DONE]</b><br/>• Greenwood Place Map<br/>• Web Audio Pure Tones<br/>• Interactive Audiogram<br/>• Mode Switcher"]
    --> S2["Stage 2: Virtual Radiology<br/><b>[DONE]</b><br/>• Pöschl's & Stenvers' Slicers<br/>• Shader Clipping Planes<br/>• 2D CT MPR Canvas<br/>• SCDS Third-Window"]
    --> S3["Stage 3: Vestibular & VOR<br/><b>[NEXT]</b><br/>• Multi-Canal BPPV (Gufoni)<br/>• 3D Eye Nystagmus Avatar<br/>• Caloric COWS Convection"]
    --> S4["Stage 4: Surgical Scenarios<br/>• Cochlear Implant Insertion<br/>• Scalar Translocation Risk<br/>• Acoustic Neuroma Staging"]
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

> **Blueprint & Derivation Spec:** [`docs/STAGE2_PLAN.md`](file:///Users/umcai/Documents/antigravity/radiant-darwin/docs/STAGE2_PLAN.md)  
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

## Stage 3: Multi-Canal Vestibular Dynamics & VOR Eye Avatar

### Objective
Expand vestibular simulation beyond the posterior canal to encompass all 3 semicircular canals, complex BPPV maneuvers, caloric irrigation, and a synchronized 3D eye avatar demonstrating the vestibulo-ocular reflex.

> **Blueprint & Derivation Spec:** [`docs/STAGE3_PLAN.md`](file:///Users/umcai/Documents/antigravity/radiant-darwin/docs/STAGE3_PLAN.md)  
> **Status:** Phase 3A Architecture & Preparation Active

### Task Breakdown
- [ ] **Step 3.1: Multi-Canal BPPV & Maneuver Presets**:
  - Horizontal Canal BPPV: Geotropic (canalithiasis) and Apogeotropic (cupulolithiasis) with Gufoni maneuver and Lempert 360° Barbecue roll.
  - Anterior Canal BPPV with Yacovino maneuver.
- [ ] **Step 3.2: Synchronized 3D Dual-Eye Avatar**:
  - Inset 3D eye model showing compensatory slow-phase gaze drift and fast-phase resetting saccades.
- [ ] **Step 3.3: Caloric Testing Simulator (COWS Rule)**:
  - Simulate warm ($44^\circ\text{C}$) vs. cold ($30^\circ\text{C}$) convective endolymph flow and Jongkees canal paresis calculation.
- [ ] **Step 3.4: Video Head Impulse Test (vHIT)**:
  - High-acceleration head thrust simulation across horizontal, RALP, and LARP canal planes with covert/overt saccade detection.

---

## Stage 4: Otologic Surgical Scenarios & Procedural Pathology

### Objective
Deliver specialized otologic surgical planning tools for surgical residents and otologists.

### Task Breakdown
- [ ] **Step 4.1: Cochlear Implant (CI) Scala Tympani Insertion**:
  - Simulated electrode array insertion through Round Window vs. Cochleostomy approaches.
  - Real-time angular insertion depth ($0^\circ \to 360^\circ \to 540^\circ$) and Greenwood frequency coverage readout.
- [ ] **Step 4.2: Scalar Translocation Warning System**:
  - Collision detection flagging basilar membrane rupture into the scala vestibuli.
- [ ] **Step 4.3: Vestibular Schwannoma (Acoustic Neuroma) Koos Staging**:
  - Tumor growth slider (Stages I–IV) demonstrating internal auditory canal compression of CN VII and CN VIII.
