# Repository Long-Term Memory & Chronological Timeline (`docs/MEMORY.md`)

> **Repository:** `radiant-darwin` (Inner Ear 3D Lab / Gate 3 Medaium)  
> **Maintainers:** AI Pair Programming Team (Antigravity & Claude)  
> **Purpose:** Permanent repository memory capturing milestones, architectural pivots, clinical validations, and critical engineering decisions.

---

## 1. Chronological Timeline & Milestones

### 2026-10-08 to 2026-10-10: Gate 3 BPPV 3D Video & Headless Pipeline
- **Objective:** Build a reproducible, code-driven 1080p (`1920x1080`, `30 fps`, `110.20s`) clinical animation demonstrating the Epley Maneuver for right-ear posterior-canal BPPV.
- **Key Milestones Achieved:**
  - Ingested 27 authentic IE-Map v1.0.0 high-resolution surface meshes (`assets/iemap/obj/*.obj`, `assets/iemap/vtk/*.vtk`).
  - Extracted smooth 3D posterior canal path (`assets/iemap/posterior_canal_path.json`, 313 samples, $19.33\text{ mm}$, $0.25\text{–}0.31\text{ mm}$ clearance inside `ls_Hsapiens_Sp`).
  - Built physical Stokes gravity sedimentation engine (`src/physics/epley_simulator.py`) simulating 5 amber canalith particles ($r=0.135\text{ mm}$) with milestone knot anchors ($-84^\circ \to +30^\circ \to +110^\circ \to +165^\circ \to +186^\circ$).
  - Integrated authentic CC0 sculpted human head (`GEO-head_sculpting_realistic`) with single-surface translucent cutaway and asymmetric `Right_ear_locator_ring`.
  - Built parallel Gate 3 compositor (`src/render/hud_compositor.py`) and encoded `output/epley_maneuver_right_bppv.mp4`.

---

### 2026-10-11 to 2026-10-13: The "Radical Subtraction" & Pure 3D WebGL MVP
- **Context:** The initial web prototype attempted to replicate the entire video pipeline (multi-window PiP, nystagmus meters, multi-megabyte uncompressed audio, complex mode switchers).
- **Architectural Pivot ("Radical Subtraction"):**
  - **Eliminated:** All heavy audio files ($18\text{ MB}$), top-right 3D head PiP secondary scene, complex quiz modals, and cluttered telemetry sidebars.
  - **Created:** A pure, laser-focused **Single-Stage Three.js WebGL Anatomy Lab** (`web/src/`).
  - **Results:**
    - 60fps silky smooth rendering across desktop, tablet, and mobile handsets.
    - Bundle size reduction: CSS reduced by 50% ($18.0\text{ kB}$), JS reduced by 15% ($582\text{ kB}$).
    - Added organic tissue hover glow, camera fly-to framing, `Outer Bone Shell` peel slider ($0\text{–}100\%$), `Separate Parts` radial explode slider ($0\text{–}100\%$), and 4 guided view presets.
    - Created rich 27-part ontology (`web/src/data/ontology.ts`) with Latin names, innervation, fluid compartments, and clinical pearls.

---

### 2026-10-14: Clinical Expansion Strategy & "Modal Workbench" Consensus
- **Context:** The pure 3D anatomical atlas was verified and complete. The team evaluated what high-value features to add for medical students, ENT residents, and audiology specialists.
- **Architectural & Clinical Decisions:**
  1. **Target Audience Scope:** Formally expanded to serve **both** undergraduate medical students (physiology, VOR, tonotopy) and postgraduate residents/specialists (pathology, radiology, surgery).
  2. **The "Modal Workbench" Paradigm:** Formally rejected the "cockpit trap." Agreed to maintain the 85%+ full-bleed 3D canvas and swap bottom dock controls contextually per mode (`🧬 Anatomy`, `🎧 Hearing`, `🌀 Vestibular`, `🩻 CT Slicing`).
  3. **Implementation Sequence:** Selected **Phase 1: Audio-Visual Tonotopy Engine & Hearing Lab** as the immediate next build.
  4. **Documentation Standardization:** Established `docs/**`, `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `docs/MEMORY.md`, and `ROADMAP.md` as permanent repo memory.

---

## 2. Key Architecture & Engineering Decisions (ADRs)

### ADR-001: Right-Anterior-Superior (RAS) Stereotaxic Coordinate Frame
- **Decision:** All 27 anatomical meshes and 3D paths are anchored in millimeters using the standard medical RAS stereotaxic coordinate system.
- **Centroid Calibration:** Calibrated at `[4.5, 1.4, 0.5]` mm.
- **Rationale:** Guarantees exact co-planar alignment with clinical DICOM imaging (HRCT and MRI CISS/FIESTA) and Slicer fiducial sets without arbitrary scaling or rotational drift.

### ADR-002: Analytic Shader-Level Clipping Plane (`gate3Materials.ts`)
- **Decision:** Implement cross-sectional clipping directly inside GLSL fragment shaders (`uClipActive`, `uClipNormal`, `uClipConstant`) rather than boolean CSG mesh slicing.
- **Rationale:** Instant $O(1)$ GPU plane cuts with zero geometric overhead or memory re-allocation. Enables instantaneous, smooth scrubbing for Pöschl's and Stenvers' radiological planes at full 60fps.

### ADR-003: Single-Surface Backface Culling for Translucent Shells
- **Decision:** In translucent and ghost modes (`uSingleSurface > 0.5`), discard backfaces (`!gl_FrontFacing`) in the fragment shader.
- **Rationale:** Prevents visually confusing double-wall interference patterns and self-overlap artifacts when rendering translucent bones or glass cutaways.

### ADR-004: Zero-Asset Audio Synthesis via Web Audio API
- **Decision:** Synthesize characteristic tonotopic frequencies dynamically using native browser Web Audio oscillators (`OscillatorNode`, `GainNode`) rather than loading static MP3/WAV files.
- **Rationale:**
  - Pure sine waves with mathematically exact frequencies according to the Greenwood function ($20\text{ Hz}\to 20\text{ kHz}$).
  - Eliminates megabytes of network audio payloads.
  - Allows seamless pitch gliding during frequency slider scrubbing without audio artifacts.

### ADR-005: Occlusion-Aware Screen-Projected Pinning
- **Decision:** 3D structure pins are calculated via Three.js vector projection to 2D HTML elements, equipped with raycast/depth buffer occlusion flags.
- **Rationale:** Allows responsive, styled HTML typography for labels that automatically fade when a structure rotates behind opaque bone, avoiding 3D billboard texture blur.

---

## 3. Directory & File Memory Map

```
/Users/umcai/Documents/antigravity/radiant-darwin/
├── AGENTS.md               # Unified instructions for AI agents working in this repo
├── CLAUDE.md               # Claude-specific environment and style guidelines
├── ARCHITECTURE.md         # High-abstract system architecture and data flow
├── ROADMAP.md              # Stage-by-stage engineering plan
├── STATUS.md               # Current milestone status and completed checklists
├── QA_NOTE.md              # Quality assurance, video verification, and visual audit
├── README.md               # High-level project overview
│
├── docs/                   # Architectural & clinical design specifications
│   ├── UI_DESIGN_SPEC.md   # Modal Workbench UI/UX spec & progressive disclosure
│   ├── CLINICAL_PILLARS.md # 4 expansion pillars (Hearing, Vestibular, CT, Surgery)
│   └── MEMORY.md           # This file: chronological memory & ADRs
│
├── assets/
│   ├── iemap/              # 27 authentic OBJ/VTK meshes, GLB, paths, and metadata
│   └── iemap_bundle_extracted/ # Source Otsu segmentations
│
├── src/                    # Python Blender & physics pipeline
│   ├── anatomy/            # Mesh ingestion, GLB export, Slicer fiducials
│   ├── physics/            # Stokes ODE gravity solver for BPPV
│   └── render/             # Headless Blender scene builder & HUD compositor
│
└── web/                    # Modern Three.js WebGL 60fps Web Application
    ├── index.html          # Clean entry point
    ├── vite.config.ts      # Vite configuration
    ├── package.json        # Dependencies (Three.js, TypeScript)
    └── src/
        ├── main.ts         # Application bootstrapper
        ├── style.css       # Gate 3 design tokens & responsive styles
        ├── data/
        │   ├── ontology.ts # 27-part clinical metadata, presets, innervation
        │   ├── objLoader.ts# Three.js OBJ buffer loader & cache
        │   └── fcsvParser.ts# 3D Slicer markups & path parser
        ├── physics/
        │   └── epleyPhysics.ts # TypeScript BPPV kinematics & steps
        ├── render/
        │   ├── DualStageScene.ts # Core Three.js render loop & camera controller
        │   └── gate3Materials.ts # Custom GLSL shaders & analytic clipping
        └── ui/
            └── AppHUD.ts   # DOM manager, search, floating inspector, bottom dock
```
