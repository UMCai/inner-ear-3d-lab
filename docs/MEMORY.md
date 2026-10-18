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

### 2026-10-14: Stage 1 — Audio-Visual Tonotopy Engine & Hearing Lab (Completed)
- **Objective:** Transform static cochlea into an interactive auditory-physiological simulator driven by the Donald D. Greenwood place-frequency function ($F(x) = 165.4 \cdot (10^{2.1 x} - 0.88)$ Hz) and native browser Web Audio API sine synthesis, linked with an interactive Clinical Pure-Tone Audiogram Drawer.
- **Key Deliverables:**
  - `web/src/data/greenwoodEngine.ts`: Greenwood forward & inverse engine, 100-knot 3D RAS spline table ($28.79\text{ mm}$ apex to base), continuous segment projection attribute mapper ($<5\text{ ms}$ for 8k vertices, zero OOM), speech acoustic landmarks.
  - `web/src/audio/ToneSynthesizer.ts`: Singleton Web Audio service with shared `AudioContext` lazily resumed on user gesture, click-free exponential gain envelopes ($50\text{ ms}$ attack/decay, floor $0.0001$), continuous pitch glide ($35\text{ ms}$), safety limiter compressor.
  - `web/src/ui/AudiogramDrawer.ts`: Clinical pure-tone air conduction SVG grid ($-10\text{ to }120\text{ dB HL}$, $125\text{ to }8{,}000\text{ Hz}$, right ear red circle $\bigcirc$ markers), 4 clinical presets (`Normal`, `Presbycusis`, `4 kHz Noise Notch`, `Ménière's`), speech banana phoneme overlay.
  - `web/src/render/gate3Materials.ts`: Dynamic tonotopy shader with 7-stop perceptual rainbow heatmap, von Békésy asymmetric traveling wave simulation, and audiogram pathology crimson desaturation mask.
  - `web/src/render/DualStageScene.ts`: Lab mode transitions (`setLabMode('anatomy' | 'hearing')`), glowing 3D resonant cursor sphere tracking the cochlear spline, raycast face picking with continuous frequency evaluation.
  - `web/src/ui/AppHUD.ts`: Header Mode Switcher, contextual Hearing Workbench dock with log frequency slider ($20\text{ Hz}\to 20\text{ kHz}$), octave jump chips, drawer mutual exclusivity, and electrophysiology badges ($+80\text{ mV}$ EP, $150\text{ mV}$ driving force).
  - Automated tests: `scripts/test_hearing_engine.js` (100% pass across 7 suites) and `scripts/verify_mvp_cdp.js` (100% pass across all 4 viewports with zero console errors).

---

### 2026-10-15: Stage 2 — Virtual Temporal Bone Radiology & SCDS Third-Window (Completed & Verified)
- **Objective:** Build an authentic temporal bone multiplanar reformation (MPR) engine and Superior Semicircular Canal Dehiscence (SCDS / Minor's Syndrome) third-window simulator.
- **Key Milestones Achieved:**
  - `web/src/data/radiologyEngine.ts`: Derived and validated 4 canonical clinical MPR planes (Pöschl, Stenvers, Axial, Coronal) using PCA on authentic IE-Map meshes. Enforced strict right-handed orthonormal triads $(\mathbf{u}, \mathbf{v}, \mathbf{n})$ where $\mathbf{u} \times \mathbf{v} = \mathbf{n}$ with Coronal $\mathbf{u} = [-1, 0, 0]$ (Medial) and unit-normalized normals. Built continuous 100% landmark tables across calibrated depth ranges.
  - `web/src/render/DualStageScene.ts`: Exposed GPU fragment shader analytic half-space clipping uniforms (`uClipActive`, `uClipNormal`, `uClipConstant`) across all 27 meshes. Built 3D plane quad helper with Medaium cyan edge highlighting, camera fly-to perspective angles, and SCDS 3D apical defect with radiating acoustic wave visualization.
  - `web/src/ui/CTSliceDrawer.ts`: Synchronized 2D CT MPR Canvas slice viewer ($360\times 360$ logical, $720\times 720$ physical retina) supporting Bone Window ($W:4000, L:+700\text{ HU}$) and T2 CISS MRI modes, standard orientation tokens (`AS`/`PI`, `PL`/`AM`, `A`/`P`/`M`/`L`, `S`/`I`/`L`/`M`), 5 mm precision scale bar, interactive drag scrubbing, and SCDS defect caliper.
  - `web/src/ui/AppHUD.ts` & `web/src/style.css`: Mode 3 `[ 🩻 Virtual Radiology ]` in Top Header switcher, contextual bottom dock Radiology Workbench (plane chips, depth scrubber with live landmark readout, flip cut, guide plane, SCDS toggle, CT card toggle). SCDS Third-Window Biomechanics box in Floating Inspector (Tullio phenomenon, Hennebert's sign, autophony, and link to SCDS audiogram). Strict drawer mutual exclusivity.
  - `web/src/ui/AudiogramDrawer.ts`: Added 5th clinical preset: SSCD Third Window (low-frequency pseudo-conductive air-bone gap).
  - Automated verification: `scripts/test_radiology_engine.js` (52/52 tests passing 100%), `scripts/test_hearing_engine.js` (7/7 suites passing 100%), `npm run build` (0 errors), and `scripts/verify_mvp_cdp.js` (100% pass across all 4 viewports with 0 errors and visual screenshots captured).

---

### 2026-10-17: Stage 3 — Step 1: Geometric & Asset Foundation (Completed & Verified)
- **Objective:** Lay the anatomical and geometric foundations for Multi-Canal BPPV dynamics and 3D VOR eye avatars.
- **Key Deliverables Achieved:**
  - `horizontal_canal_path.json` ($150$ knots, $15.46\text{ mm}$, mean lumen clearance $0.234\text{ mm}$ inside `ls_Hsapiens_Sl.obj`) with continuous Bishop parallel transport frames.
  - `anterior_canal_path.json` ($150$ knots, $19.19\text{ mm}$, mean lumen clearance $0.270\text{ mm}$ inside `ls_Hsapiens_Sa.obj`), smoothly transitioning through the Common Crus at $[4.20, -2.20, 2.00]\text{ mm}$ to Utricle orifice at $[4.03, -0.15, 0.10]\text{ mm}$.
  - `assets/iemap/eye_avatar.glb` ($274.9\text{ kB}$): Clean bilateral 3D eye avatar with clinical interpupillary distance $PD = 62.0\text{ mm}$ (pivoting at $\pm 31\text{ mm}$), physiological $24.0\text{ mm}$ globe diameter, prolate cornea cap, and $32$ procedural high-contrast radial iris crypts guaranteeing visible cyclotorsion tracking.
  - `web/src/data/canalPaths.ts`: Semicircular canal data loader and continuous 3D interpolation functions.
  - Verification: Automated suite `scripts/test_canal_paths.py` (100% pass across 4 suites), `npm test` (hearing + radiology passing 100%), and `npm run build` (0 errors).


### 2026-10-18: Stage 3 — Step 2: Multi-Canal BPPV Physics Engine (Completed & Verified)
- **Objective:** Generalize the 2-DOF prototype simulator into a multi-canal, 3-DOF head kinematics, continuous Stokes sedimentation, and Steinhausen cupular plunger physics engine modeling Ewald's 2nd & 3rd laws and CN VIII neurophysiology across all 6 clinical maneuvers.
- **Key Deliverables Achieved:**
  - `web/src/physics/vestibularEngine.ts`:
    - 3-DOF Analytical Head Kinematics: $R_{\text{head}}(\psi, \theta, \gamma) = R_x(\theta) R_z(\psi) R_y(\gamma) \in SO(3)$, correctly orienting $+X_{\text{head}}$ (right ear) to $-Z_{\text{world}}$ when $\gamma = +90^\circ$ (right-ear down decubitus) and to $+Z_{\text{world}}$ when $\gamma = -90^\circ$ (left-ear down decubitus). Reducible to 2-DOF prototype when $\gamma = 0^\circ$.
    - Continuous 3D Stokes Sedimentation ODE: Overdamped terminal sedimentation $v_{\text{sed}} \propto g_{\text{proj}} = -t_{\text{world}, z}$ along continuous 3D RAS splines with viscous stiction deadzone ($|g_{\text{proj}}| < 0.045$), terminal velocity bounding ($\le 48.0^\circ/\text{s}$), and 5-particle cloud tracking with utricular fan-out.
    - Steinhausen Cupular Plunger Model: Two-phase ODE with active fluid drag coupling ($\kappa_{\text{drag}} = 2.2\text{ s}^{-1}$) and authentic passive elastic restoration ($\tau_{\text{return}} = 1.8\text{ s}$), plus lumen-narrowing factors (duct: 1.0, crus: 0.35, utricle: 0.02).
    - Ewald's 2nd & 3rd Laws Neurophysiology: CN VIII afferent firing rate ($10\dots 310\text{ sp/s}$, resting $90\text{ sp/s}$) respecting canal-specific polarities (horizontal ampullopetal excitatory; vertical ampullofugal excitatory) and authentic $2.75\times$ physiological asymmetry, driving 3D slow-phase eye velocity and fast-phase nystagmus vectors.
    - 6 Clinical Maneuvers & Presets: Epley (5 steps), Semont (3 steps), Gufoni Geotropic (4 steps), Gufoni Apogeotropic (4 steps), Lempert 360° Barbecue Roll (5 steps), and Yacovino (4 steps).
    - Backward Compatibility: Drop-in `RealtimeEpleySimulator` wrapper matching all static helpers, formulas, and legacy types, supporting flexible 4-arg and 5-arg `stepPhysics` calls without NaN corruption.
  - `scripts/test_vestibular_engine.js`: Standalone Node.js ESM test suite with 72 assertions across 8 test suites passing 100%, deeply verifying SO(3) kinematics, multi-canal splines, Stokes ODE, Steinhausen plunger decay, Ewald's laws/CN VIII firing, and all 6 clinical maneuvers.
  - Root `package.json`: Added `test:vestibular` and integrated into root `npm test`.
  - Verification: `npm test` (all 3 suites: hearing, radiology, vestibular passing 100%) and `npm run build` (clean 0 errors).

### 2026-10-18: Stage 3 — Step 3: 3D Eye Avatar & VOR Kinematics Engine (Completed & Verified)
- **Objective:** Construct the 3D ocular avatar and VOR kinematics engine driving authentic nystagmus (slow drift + resetting ballistic saccades) with 3-DOF Listing's law kinematics, bilateral cyclovergent coupling, and infrared VNG telemetry.
- **Key Deliverables Achieved:**
  - `web/src/render/eyeAvatar.ts`:
    - Scene Graph & Asset Ingestion: Three.js GLTFLoader pipeline ingesting `assets/iemap/eye_avatar.glb` ($274.9\text{ kB}$), caching `EyeAvatarRoot`, `EyePivot_R`, `EyePivot_L`, `Iris_R`, `Iris_L`, `PupilBacking_R`, `PupilBacking_L`, `Sclera_R`, `Sclera_L`, and cornea meshes. Exposes both `load()` and `loadAvatar()` aliases. Camera positioned at $[0.0, 0.0, -0.22\text{ m}]$ looking towards $[0, 0, 0]$ with `camera.up.set(0, 1, 0)` matching the $-Z$ optical axis.
    - 3-DOF Listing's Law Kinematics: Single-axis Listing plane rotation ($\mathbf{u} = [\theta_v/\Theta, -\psi_h/\Theta, 0]$, $q_z \equiv 0$) with active vestibular cyclotorsion around $-Z$ ($\mathbf{q}_{\text{torsion}} = [0, 0, -\sin(\phi_t/2), \cos(\phi_t/2)]$).
    - Bilateral Cyclovergent Coupling: Right extorsion ($+\phi_t$ temporal) and Left intorsion ($+\phi_t$ nasal) tilting both upper poles rightward ($+X$) during upbeat-right torsional nystagmus, conjugate horizontal yaw, conjugate vertical pitch.
    - Sawtooth Nystagmus Waveform & Neural Integrator: Slow drift integration from `VestibularTelemetryState.slowPhaseVelocityDegPerSec`, central ballistic saccadic burst generator ($400\text{–}700^\circ/\text{s}$, $25\text{–}40\text{ ms}$, anti-parallel reset with $-10\%$ overshoot), retinal slip threshold ($3.0^\circ\text{–}6.0^\circ$), inter-saccadic timeout ($200\text{–}350\text{ ms}$), and brainstem neural integrator elastic leak ($\tau_{\text{leak}} = 0.8\text{ s}$).
    - Infrared VNG Mode & P-CR Telemetry: Monochromatic NIR shader toggle ($850\text{–}940\text{ nm}$ luminance with high-contrast pupil isolation), deduplicated material shader compilation preventing uniform redefinition errors, 3D-to-2D pupil centroid projection $\oplus$, and closed-form paraxial Purkinje glint reflection $\ast$ on corneal sphere ($R_c = 7.8\text{ mm}$, virtual IR source at $[0.02, 0.04, -0.20\text{ m}]$).
    - 60fps Zero-Allocation Ring Buffer: `NystagmogramRingBuffer` using pre-allocated typed arrays (`Float32Array(600)`, `Uint8Array(600)`) with scalar `push(time, h, v, t, spv, isFastPhase)` method and pre-allocated static scratch math buffers generating 0 per-frame heap allocations.
  - `scripts/test_eye_avatar_vor.js`: Standalone Node.js ESM test suite with 50 assertions across 7 test suites passing 100% (GLTF integrity, Listing's law, bilateral VOR, sawtooth dynamics, NIR telemetry, ring buffer, build integrity).
  - Root `package.json`: Added `test:eye-avatar` and integrated into root `npm test`.
  - Verification: `npm test` (all 4 suites: hearing, radiology, vestibular, eye-avatar passing 100%) and `npm run build` (clean 0 errors).

---

## 2. Key Architecture & Engineering Decisions (ADRs)

### ADR-008: 3-DOF Listing's Law Kinematics & Sawtooth VOR Avatar Engine
- **Decision:** Separate ocular rotations into single-axis Listing plane rotations ($q_z \equiv 0$) for visual fixations/saccades and active cyclotorsional rotations around $-Z$ ($\mathbf{q}_{\text{torsion}}$) for vestibular drive. Model bilateral cyclovergence directly with identical torsion angle ($\phi_t$) rotating both upper poles toward patient right, producing right extorsion and left intorsion.
- **Rationale:** Prevents false kinematic gimbal torsion inherent in Euler angle compositions. Accurately simulates the physiological diagnostic hallmark of posterior canal BPPV (torsional-upbeating nystagmus with lateral iris crypt displacement) at 60fps with zero allocations.

### ADR-007: 3-DOF Head Kinematics & Two-Phase Steinhausen Plunger Model
- **Decision:** Model 3-DOF head orientation via analytical $R_{\text{head}}(\psi, \theta, \gamma) = R_x(\theta) R_z(\psi) R_y(\gamma) \in SO(3)$ and cupular deflection via a two-phase ODE distinguishing active sediment drag coupling ($\kappa_{\text{drag}} = 2.2\text{ s}^{-1}$) from passive elastic restoration ($\tau_{\text{return}} = 1.8\text{ s}$) with Ewald asymmetry ($2.75\times$).
- **Rationale:** Supports true lateral side-lying maneuvers (Semont, Gufoni, Lempert Barbecue Roll) with exact gravitational projections ($g_{\text{proj}} = -t_{\text{world}, z}$ in $O(1)$) and accurately reproduces clinical nystagmus latency, crescendo, and decrescendo decay.

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

### ADR-006: Stereotaxic Multiplanar Reformatting (MPR) Planes & Coordinate Orthonormality
- **Decision:** Derive all 4 clinical radiological planes using strict orthonormal triads $(\mathbf{u}, \mathbf{v}, \mathbf{n})$ where $\mathbf{u} \times \mathbf{v} = \mathbf{n}$ and unit-normalized normals ($\|\mathbf{n}\| = 1.0$), with uniform translation $u_{\text{ClipConstant}} = -(C \cdot \mathbf{n} + s)$ relative to otic capsule centroid $C = [4.40, 2.01, -0.31]\text{ mm}$.
- **Rationale:** Prevents floating-point metric drift in GPU fragment shader clipping and guarantees that 2D CT canvas orientations (`AS`/`PI`, `PL`/`AM`, `A`/`P`/`M`/`L`, `S`/`I`/`L`/`M`) accurately reflect standard neuroradiology viewing conventions without mirror image inversions.

### ADR-007: Procedural Radial Iris Crypts for 3-DOF Cyclotorsion Tracking
- **Decision:** Generate 32 radial high-contrast iris crypts and perilimbal microvascular branching directly into the 3D eye avatar texture (`assets/iemap/eye_avatar.glb`).
- **Rationale:** On a generic spherical eyeball or solid iris color, roll/cyclotorsion (rotation around the line of sight) is completely invisible. In posterior canal BPPV (Dix-Hallpike) and vertical canal pathology, the pathognomonic diagnostic sign is torsional nystagmus. High-contrast radial trabeculae make subtle cyclorotation immediately obvious to clinicians and students without requiring external telemetry text overlays.

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
│   ├── STAGE2_PLAN.md      # Stage 2 implementation blueprint & mathematical derivations
│   ├── STAGE3_PLAN.md      # Stage 3 implementation blueprint & multi-canal VOR architecture
│   └── MEMORY.md           # This file: chronological memory & ADRs
│
├── scripts/                # Verification, headless test & render scripts
│   ├── test_hearing_engine.js   # Stage 1 unit test suite (7 suites)
│   ├── test_radiology_engine.js # Stage 2 mathematical & clinical verification (52 tests)
│   ├── test_canal_paths.py      # Stage 3 Step 1 multi-canal spline & eye avatar verifier
│   ├── generate_multicanal_splines.py # Continuous 3D spline generator for Horizontal & Anterior canals
│   ├── export_eye_avatar_glb.py # CC0 sculpted eye extractor & cyclotorsion texture generator
│   └── verify_mvp_cdp.js        # Multi-viewport Chrome CDP automated test
│
├── assets/
│   ├── iemap/              # 27 authentic OBJ/VTK meshes, GLB, canal splines, eye avatar, and metadata
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
        │   ├── fcsvParser.ts# 3D Slicer markups & path parser
        │   ├── canalPaths.ts# Multi-canal 3D spline loader & interpolation
        │   ├── greenwoodEngine.ts # Stage 1 tonotopy math engine
        │   └── radiologyEngine.ts # Stage 2 MPR planes & SCDS math
        ├── physics/
        │   └── epleyPhysics.ts # TypeScript BPPV kinematics & steps
        ├── render/
        │   ├── DualStageScene.ts # Core Three.js render loop & camera controller
        │   └── gate3Materials.ts # Custom GLSL shaders & analytic clipping
        └── ui/
            ├── AppHUD.ts        # DOM manager, search, floating inspector, bottom dock
            ├── AudiogramDrawer.ts # Interactive clinical audiogram drawer
            └── CTSliceDrawer.ts # Interactive 2D CT MPR canvas slice viewer
```

