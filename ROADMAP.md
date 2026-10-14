# Product Engineering Roadmap: Stage-by-Stage Implementation (`ROADMAP.md`)

> **Project:** Inner Ear 3D Lab  
> **Repository:** `radiant-darwin`  
> **Execution Strategy:** Phased modular delivery adhering to the "Modal Workbench" zero-clutter architecture.

---

## High-Level Milestone Overview

```mermaid
flowchart LR
    S0["Stage 0: Pure 3D Anatomy Lab<br/><b>[DONE]</b><br/>• 27 Authentic Meshes<br/>• Bone Peel & Explode<br/>• 60fps WebGL MVP"] 
    --> S1["Stage 1: Hearing & Tonotopy<br/><b>[NEXT]</b><br/>• Greenwood Place Map<br/>• Web Audio Pure Tones<br/>• Interactive Audiogram<br/>• Mode Switcher"]
    --> S2["Stage 2: Virtual Radiology<br/>• Pöschl's & Stenvers' Slicers<br/>• Shader Clipping Planes<br/>• SCDS Third-Window"]
    --> S3["Stage 3: Vestibular & VOR<br/>• Multi-Canal BPPV (Gufoni)<br/>• 3D Eye Nystagmus Avatar<br/>• Caloric COWS Convection"]
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

## Stage 1: Audio-Visual Tonotopy Engine & Hearing Lab — 🚀 IMMEDIATE NEXT BUILD

### Objective
Transform the static cochlea into an interactive frequency analyzer driven by the Greenwood function and real-time Web Audio API pure-tone synthesis, complete with an interactive clinical audiogram drawer.

### Task Breakdown
- [ ] **Step 1.1: Web Audio Pure-Tone Synthesizer (`web/src/audio/ToneSynthesizer.ts`)**:
  - Implement a shared browser `AudioContext` with lazy user-gesture initialization.
  - Implement dynamic sine-wave generation (`OscillatorNode`, `GainNode`) with exponential attack/decay envelope ($50\text{ ms}$) to prevent speaker clicking.
  - Provide continuous pitch gliding for frequency scrubbing.
- [ ] **Step 1.2: Greenwood Place-Frequency Engine (`web/src/data/greenwoodEngine.ts`)**:
  - Implement the Donald D. Greenwood formula: $F(x) = 165.4 \cdot (10^{2.1 \cdot x} - 0.88)$.
  - Map normalized distance $x \in [0.0, 1.0]$ to 3D vertex coordinates along the `mesh_david_cochlea` / `cochlea_membrane` spiral.
  - Provide inverse mapping: given any 3D hit point on the cochlea, compute the corresponding frequency in Hertz.
- [ ] **Step 1.3: Hearing Mode Shading & Spectral Gradient in `DualStageScene.ts`**:
  - Add `hearingLab` mode support to `DualStageScene`.
  - In Hearing Mode: Automatically ghost the vestibular system (canals, ampullae, vestibule) to $15\%$ opacity to direct visual focus to the cochlea.
  - Render a continuous perceptual spectral gradient along the cochlear coil (Red $\approx 20\text{ kHz}$ base $\to$ Gold $\approx 4\text{ kHz}$ $\to$ Cyan $\approx 1\text{ kHz}$ $\to$ Violet $\approx 20\text{ Hz}$ apex).
  - Add animated traveling wave pulse ripple on tone trigger.
- [ ] **Step 1.4: Top Header Mode Switcher (`AppHUD.ts`)**:
  - Add the clean segmented mode pill in the top header: `[ 🧬 Anatomy ] [ 🎧 Hearing Lab ]`.
  - Maintain desktop, tablet, and mobile responsiveness without crowding the search bar.
- [ ] **Step 1.5: Contextual Bottom Dock for Hearing Mode**:
  - Morph the bottom bar when in Hearing Mode:
    - Logarithmic Frequency Slider ($20\text{ Hz}\to 20{,}000\text{ Hz}$).
    - `Play Tone 🔊` button and live readout (`4,000 Hz · Consonants & High Pitch`).
    - 4 Clinical Presets: `Normal Hearing`, `Presbycusis (High Loss)`, `4 kHz Noise Notch`, `Apical Loss (Ménière)`.
- [ ] **Step 1.6: Interactive Mini-Audiogram Drawer**:
  - Add a collapsible `[ 📊 Interactive Audiogram ]` drawer sliding up over the bottom-right corner.
  - Interactive $125\text{ Hz}\to 8{,}000\text{ Hz}$ / $-10\text{ dB}\to 120\text{ dB HL}$ standard clinical grid.
  - Tapping a hearing loss preset highlights the damaged hair-cell sector directly on the 3D cochlea.
- [ ] **Step 1.7: Fluid Compartment & Voltage Badge in Inspector**:
  - Display Scala Media (Endolymph $+80\text{ mV}$, high $\text{K}^+$) vs. Scala Tympani/Vestibuli (Perilymph $0\text{ mV}$, high $\text{Na}^+$).
  - Concise mechanotransduction summary for medical students.
- [ ] **Step 1.8: Build & QA Verification**:
  - Zero TypeScript errors (`npm run build`).
  - Verify Web Audio smooth tone playback and 60fps rendering across desktop, tablet, and mobile.

---

## Stage 2: Virtual Temporal Bone Radiology & SCDS Third-Window

### Objective
Enable medical students and ENT residents to master multiplanar CT/MRI cross-sections of the petrous temporal bone directly against the 3D anatomical model.

### Task Breakdown
- [ ] **Step 2.1: Analytic Shader Slicing Integration**:
  - Expose the existing GLSL clipping plane uniforms in `gate3Materials.ts` to `DualStageScene.ts`.
- [ ] **Step 2.2: Clinical Slicing Plane Presets**:
  - **Pöschl's Plane**: Oblique sagittal parallel to the superior semicircular canal (gold standard for SSCD).
  - **Stenvers' Plane**: Oblique coronal perpendicular to Pöschl's plane (profiles canal arch & vestibular aqueduct).
  - **True Axial Plane**: Horizontal canal signet ring and internal auditory canal (IAC).
  - **True Coronal Plane**: Cochlear modiolus and round window niche.
- [ ] **Step 2.3: Contextual CT Bottom Dock & Depth Slider**:
  - Single depth slider scrubbing through the temporal bone with live millimeter readout.
- [ ] **Step 2.4: Synchronized 2D CT Slice Card**:
  - Side-by-side or docked mini-CT display showing corresponding authentic HRCT slices.
- [ ] **Step 2.5: Superior Canal Dehiscence (SCDS) Defect Toggle**:
  - Interactive bone defect toggle displaying acoustic/hydraulic sound shunting, Tullio phenomenon, and autophony.

---

## Stage 3: Multi-Canal Vestibular Dynamics & VOR Eye Avatar

### Objective
Expand vestibular simulation beyond the posterior canal to encompass all 3 semicircular canals, complex BPPV maneuvers, caloric irrigation, and a synchronized 3D eye avatar demonstrating the vestibulo-ocular reflex.

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
