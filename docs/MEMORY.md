# Repository Long-Term Memory & Chronological Timeline (`docs/MEMORY.md`)

> **Repository:** `inner-ear-3d-lab` (Inner Ear 3D Lab / Gate 3 Medaium)  
> **Maintainers:** AI Pair Programming Team (Antigravity & Claude)  
> **Purpose:** Permanent repository memory capturing milestones, architectural pivots, clinical validations, and critical engineering decisions.

---

## 1. Chronological Timeline & Milestones

### 2026-11-11: Phase 1 Static Showcase — Dual-Theme One-Side Expandable Note Sidebar (`web/showcase.html`)
- **Objective:** Prototype a social-media-worthy dual-polarity (Dark Glassroom + Light Paper-Technical) static frontend showcase before wiring Phase 2 production changes (`web/index.html`, `AppHUD.ts`, `DualStageScene.ts`), specifically replacing crowded small multi-corner overlays with a calm **One-Side Expandable Note Sidebar**.
- **Key Deliverables Achieved:**
  - `web/showcase.html`, `web/src/showcase/showcase.css`, `web/src/showcase/main.ts`, `web/src/showcase/showcaseData.ts`: Unified `#note-sidebar` (`collapsed` pill → `compact` `280px`/`256px`/`198px` preview → `expanded` `388px` `[Note | <Lab>]` reader → `476px` `Further Read` `<details>` with inline `Patient | Clinical` tone switch; bottom reader sheet on `<= 720px`), dynamic `--stage-left-gutter` / `--dock-shift-x` bottom-dock clearance, trailing `.dock-stage-utils`, `16px` note prose, and `>= 13px` interactive UI controls.
  - `web/src/showcase/HeroSpecimen3D.ts`: `THREE.AgXToneMapping`, `RoomEnvironment` IBL, alpha-transparent WebGL2 stage synced to resolved light/dark polarity via GLSL `#include <tonemapping_fragment>` + `#include <colorspace_fragment>`, and dynamic `camera.setViewOffset` framing rightward/upward as `#note-sidebar` expands.
  - `DESIGN.md`, `.impeccable/design.json`, `.impeccable/surfaces/web-showcase-html.md`: Synchronized dual-polarity design system documentation; `impeccable detect --json` returns zero findings and multi-viewport Chrome CDP checks pass across `1440×900`, `1280×800`, `768×1024`, and `390×844` in both themes with `0` console/network errors.

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

### 2026-10-19: Stage 3 — Step 4: Contextual Vestibular Workbench & VORDrawer (Completed & Verified)
- **Objective:** Construct the contextual vestibular bottom dock, interactive 3-axis head gyro flyout, docked clinical VNG & 3D VOR drawer (`VORDrawer.ts`), and floating inspector card vestibular telemetry, unified by strict 4-drawer mutual exclusivity and zero-allocation 60fps render loops.
- **Key Deliverables Achieved:**
  - `web/src/ui/VORDrawer.ts`: Docked clinical VNG card ($360\text{ px}$ width) mounting 3D Eye Avatar canvas ($360\times 220$ logical, $720\times 440$ physical) and rolling 3-channel Nystagmogram strip chart canvas ($360\times 110$ logical, $720\times 220$ physical) with 2x Retina scaling. Connects to `EyeAvatarEngine` with Listing's law kinematics and cyclotorsion, 2D gaze tracking HUD overlay (pupil crosshairs $\oplus$, corneal Purkinje glints $\ast$), live degree telemetry readouts (H, V, T, SPV, fast-phase beat direction token), near-infrared VNG toggle, and zero-allocation strip chart (Cyan H, Lime V, Amber T) reading from `NystagmogramRingBuffer` with red vertical saccade tick indicators.
  - `web/src/ui/AppHUD.ts`:
    - Mode 4 button `[ 🌀 Vestibular & VOR ]` (`#mode-vestibular-btn`).
    - Contextual bottom dock `#vestibular-dock-content`: 6 maneuver protocol chips (`epley`, `semont`, `gufoni_geotropic`, `gufoni_apogeotropic`, `barbecue_roll`, `yacovino`), step progress scrubber ($0\dots N-1$), clinical hold timer countdown badge, clearance % badge, bump navigation buttons, play sequencer engine (`isSequencerPlaying`), 3-axis gyro flyout (`#gyro-flyout`, Yaw $\pm 180^\circ$, Pitch $-30^\circ\dots 120^\circ$, Roll $\pm 90^\circ$), crystal reset button, and VOR Eyes drawer toggle button.
    - Floating Inspector Card Vestibular Telemetry: Authoritative clinical vestibular box rendering active canal/plane badge, CN VIII primary afferent firing rate bar gauge ($10\dots 310\text{ sp/s}$ with $90\text{ sp/s}$ resting baseline marker and dynamic color coding), Ewald's law banner, patient sensation badge, clearance %, clinical pearls, and button `#vest-view-vor-btn` opening `VORDrawer`.
    - Strict 4-Drawer Mutual Exclusivity: Opening any of `VORDrawer`, `CTSliceDrawer`, `AudiogramDrawer`, or `PartsDrawer` immediately closes all other three drawers.
  - `web/src/render/DualStageScene.ts`:
    - Concurrently pre-loads all 3 canal splines via `loadAllCanalPaths()`.
    - Instantiates 5-particle amber otoconial cloud mesh group (`SphereGeometry(0.135, 12, 12)` with `0.22` halo glow).
    - Camera fly-to to vestibular perspective ($[21.5, -11.5, 7.2] \to [4.5, 1.5, 0.2]$) upon mode switch.
    - Selective anatomical ghosting: Cochlea (`mesh_david_cochlea`) and Bony Capsule (`segT2_th1.07_Otsu`) ghosted to $15\%$ opacity with `depthWrite: false`, while semicircular ducts and vestibule remain at full visibility ($95\%$).
    - 60fps render loop stepping: advances `vestibularEngine.stepPhysics()`, updates otoconia mesh coordinates, and forwards telemetry to `vorDrawer.updateTelemetry()`.
  - `web/src/style.css`: Responsive CSS styling for `#vestibular-dock-content`, `.protocol-chip`, `#gyro-flyout`, `.vor-drawer`, and `.cn8-gauge-wrap`, guaranteeing $\ge 85\%$ canvas stage command across desktop, tablet, and mobile.
  - `scripts/test_vor_workbench.js`: Standalone Node.js ESM test suite with 51 assertions across 7 test suites passing 100% (DOM structure, 6 maneuvers, scrubber/timer, gyro SO(3) math, VORDrawer layout/mutual exclusivity, strip chart projection/clamping, and build integrity).
  - Root `package.json`: Added `test:workbench` and integrated into root `npm test` passing all 5 test suites (hearing, radiology, vestibular, eye-avatar, workbench).

---

### 2026-10-20: Technical Debt & UI/UX Polish Pass (Completed & Verified)
- **Objective:** Eliminate accumulated technical debt, synchronization bugs, transient heap allocations in render loops, and bundle chunk warnings identified in the self-audit.
- **Key Deliverables Achieved:**
  - `web/src/ui/AppHUD.ts`:
    - Arrow Inversion Fix: Corrected chevron indicators across all drawers (`CTCard`, `Audiogram`, `VOR`, `Parts`) to strictly display `'▸'` when collapsed/closed and `'▾'` when expanded/opened, fixing inverted arrow initial states and close callbacks.
    - Unified Panel Exclusivity: `#gyro-flyout` integrated as an exclusive panel alongside the 4 lab drawers. Opening any drawer auto-closes `gyroFlyout`, and opening `gyroFlyout` auto-closes all drawers.
    - Mobile Z-Index Conflict Elimination: `updateMobileDrawerExclusivity()` detects when `gyroFlyout` is active and hides `.inspector-card` via `.drawer-active` (`display: none !important;`) on mobile ($\le 640\text{ px}$).
  - `web/src/style.css`: Added scroll containment (`max-height: 56vh; overflow-y: auto;`) to `.gyro-flyout` on mobile handsets.
  - `web/src/physics/vestibularEngine.ts`: Refactored `interpolateAtPhi()` and `computeParticlesRAS()` with direct scalar arithmetic and static scratch targets (`scratchSample`, `cachedParticles`), eliminating ~54 heap allocations/frame (~3,240 allocs/sec) while retaining complete backward compatibility.
  - `web/src/render/DualStageScene.ts`:
    - Zero-Allocation Pin Projections: Pre-allocated `scratchPinVector = new THREE.Vector3()` and static candidate pin arrays in `computeProjectedPins()`, eliminating all per-frame `new THREE.Vector3()` heap allocations across 27 anatomical meshes.
    - Complete Resource Cleanup: Enhanced `dispose()` to call `this.controls.dispose()`, unbind all 5 container pointer/mouse DOM event listeners (`pointerdown` with capture, `pointermove`, `pointerup`, `pointercancel`, `dblclick`), and recursively traverse the scene graph to dispose all mesh geometries and materials.
  - `web/vite.config.ts`: Configured Rollup `manualChunks` to isolate `three` into `three-vendor` and set `chunkSizeWarningLimit: 700`, achieving a clean build with 0 TypeScript/Vite errors and 0 bundle size warnings.
  - Verification: 100% pass across all 5 unit test suites (`npm test`), 100% pass across all 3 viewports in headless Chrome CDP test (`scripts/verify_mvp_cdp.js`), and clean production build (`npm run build`).

---

### 2026-10-20: Stage 3 — Phase 3B: Diagnostic Vestibular Testing Suite (Caloric Irrigation & vHIT) (Completed & Verified)
- **Objective:** Expand the vestibular laboratory with an authentic, medically rigorous neurotological diagnostic testing suite modeling Caloric Thermal Convection (COWS rule, Alexander's law gaze modulation, Jongkees formula) and Video Head Impulse Testing (vHIT 3-canal minimum-jerk kinematics, Curthoys 40–80ms area gain, overt/covert compensatory saccades, goggle slippage artifact, SHIMP paradigm, and SO(3) 3D head thrusts).
- **Key Deliverables Achieved:**
  - `web/src/physics/diagnosticVestibularEngine.ts`:
    - 1D Fourier Thermal Diffusion ODE: Models endolymph temperature delta over 40s irrigation with tissue thermal diffusivity $\alpha = 0.14\text{ mm}^2/\text{s}$ and external auditory canal depth $L = 4.0\text{ mm}$, driving temperature-dependent density change ($\Delta\rho = -\beta \rho_0 \Delta T$), hydrostatic buoyancy pressure in $+30^\circ$ supine posture, and Poiseuille convective endolymph flow driving cupular deflection and CN VIII firing rates ($10\dots 310\text{ sp/s}$).
    - COWS Rule Neurophysiology: Proves Cold Opposite, Warm Same across both ears. Warm 44°C (+7°C) produces ampullopetal convective flow and CN VIII excitation ($153.9\text{ sp/s}$), eliciting ipsilateral slow drift and contralateral/same-side fast phase. Cold 30°C (-7°C) produces ampullofugal convective flow and CN VIII inhibition ($58.1\text{ sp/s}$), eliciting contralateral fast phase. Ice water 4°C (-33°C) tests residual function in vestibular paresis ($30.0\text{ sp/s}$).
    - Alexander's Law Gaze Modulation: $SPV(\theta_g) = SPV_0 \cdot \max(0.15, 1.0 + k \cdot \text{sign}(SPV_0) \cdot \theta_g)$ with $k = 0.0133/^\circ$ ($\pm 40\%$ modulation at $\pm 30^\circ$ gaze), maintaining peripheral nystagmus non-reversal floor, with automated 1st Degree ($<10^\circ/\text{s}$), 2nd Degree ($10\dots 25^\circ/\text{s}$), and 3rd Degree ($>25^\circ/\text{s}$) classification.
    - Jongkees Bithermal Formulation: Calculates Unilateral Weakness ($UW$, threshold $25\%$), Directional Preponderance ($DP$, threshold $30\%$), and total response sum ($\sum < 20^\circ/\text{s}$ bilateral weakness flag) with complete areflexia zero-division protection, paretic ear flagging, and automated clinical interpretation generator.
    - vHIT Minimum-Jerk Kinematics: 5th-order polynomial minimum-jerk head impulse kinematics ($T=120\text{ ms}$, $\Delta\theta = 15^\circ$, peak velocity $250^\circ/\text{s}$, peak acceleration $6545^\circ/\text{s}^2$) projecting along canal pair axes (Horizontal Yaw $[0, 0, 1]$, RALP $[0.707, -0.707, 0]$, LARP $[0.707, 0.707, 0]$) with orthonormal unit SO(3) quaternions.
    - Curthoys 40–80ms Area Gain & Saccades: Curthoys area gain ($G = \frac{\int_{40}^{80} |v_{\text{eye}}| dt}{\int_{40}^{80} |v_{\text{head}}| dt}$), overt saccades (post-impulse latency $140\text{–}180\text{ ms}$), covert saccades (intra-impulse latency $75\text{–}95\text{ ms}$), goggle slippage transient artifacts, and SHIMP (Suppression Head Impulse) anti-compensatory saccade generation.
    - Zero-Allocation `VHITImpulseBuffer`: Pre-allocated contiguous Float32Array buffers (350 samples at 1ms resolution) with zero heap allocations during simulation or rendering.
  - `web/src/render/gate3Materials.ts` & `web/src/render/DualStageScene.ts`:
    - GLSL convective glow fragment uniforms (`uCaloricActive`, `uCaloricTempDiff`, `uCaloricDiffusion`, `uCaloricTime`) rendering dynamic warmth (crimson) and cold (cyan) convective glow inside the horizontal canal lumen.
    - Contralateral mirrored labyrinth mode (`scale.x = -1.0`) with `uMirrored` uniform flipping `isFacingOut = !gl_FrontFacing` to resolve inverted face normals, rim Fresnel shading, and `uSingleSurface` cutaway backface culling for seamless right/left ear switching.
    - Live SO(3) head quaternion animation during thrusts and caloric $+30^\circ$ supine posture fly-to.
    - Telemetry bridge connecting `setCaloricSimulationState()` to horizontal slow-phase eye drift and nystagmus fast-phase beats in the main render loop.
  - `web/src/ui/VORDrawer.ts`:
    - Diagnostic strip modes (`'nystagmogram' | 'caloric' | 'vhit'`), Alexander gaze buttons & modulation badge, zero-allocation `VHITImpulseBuffer`, and `renderVHITDualTracePlot()` with 40–80ms shaded gain window, target gain badge, and saccade tags.
    - Authentic Claussen 4-quadrant Caloric Butterfly Plot (`renderCaloricButterflyPlot()`): visualizes $R_{44}, R_{30}, L_{44}, L_{30}$ peak slow phase velocities in an amber/cyan butterfly vestibulogram with a 15–30°/s normative corridor, live pulsing active irrigation ring marker, and dynamic Jongkees UW%/DP% calculation badge.
  - `web/src/ui/AppHUD.ts` & `web/src/style.css`:
    - Subnav modality switcher [ 🌀 BPPV │ 🌡️ Caloric │ ⚡ vHIT ].
    - Caloric workbench: temperature chips (Warm 44°C, Cold 30°C, Ice 4°C), laterality selector (Right / Left), irrigation countdown timer, Alexander gaze chips, and Jongkees Calculator modal with clinical presets.
    - vHIT workbench: canal pair selector (Horizontal, RALP, LARP), direction selector, clinical presets, HIMP/SHIMP toggle, slippage toggle, and Deliver Thrust button.
    - Backward-compatible CSS chip names (`.caloric-chip`, `.vhit-pair-chip`) preserving BPPV test assertions.
  - Verification:
    - Standalone Node.js ESM test suite `scripts/test_diagnostic_vestibular.js` passing 51/51 assertions (100%).
    - Root `npm test` running all 6 test suites passing 336/336 assertions (100%).
    - Headless Chrome CDP tests (`scripts/verify_mvp_cdp.js`) passing 100% across Desktop, Tablet, and Mobile viewports with zero console errors.

---

### 2026-10-21: Stage 4 — Surgical Approaches & Implant Simulations (Completed & Verified)
- **Objective:** Construct an authentic otologic and neurotologic surgical simulation suite covering Cochlear Implant (CI) insertion along the Scala Tympani with Advance Off-Stylet (AOS) curling and basilar membrane translocation rupture warning; Transmastoid Labyrinthectomy with high-speed drilling canal unroofing, acute deafferentation, and central vestibular compensation ODE; and Retrosigmoid Neurectomy with internal auditory canal (IAC) 4-quadrant anatomy ("7-up, Coke down"), Koos tumor staging, and continuous ABR Wave V / facial nerve EMG neurotelemetry.
- **Key Deliverables Achieved:**
  - `web/src/physics/surgicalEngine.ts`:
    - CI Kinematics & Insertion Dynamics: 3D Scala Tympani insertion depth ($0\dots 31.0\text{ mm}$), angular insertion depth ($0^\circ \to 360^\circ \to 540^\circ \to 720^\circ$), Greenwood tonotopic place-frequency mapping across 22 platinum electrode band contacts ($18\text{ kHz}$ to $250\text{ Hz}$), non-linear friction and curvature force accumulation ($F_{\text{insert}}(L) = F_{\text{base}} + k_{\text{fric}} \cdot L + k_{\text{curv}} \cdot \theta(L)^2$ with stylet release relief), basilar membrane proximity tracking, and scalar translocation breach risk flag when $F > 150\text{ mN}$ ($0.15\text{ N}$).
    - Transmastoid Labyrinthectomy & Central Compensation ODE: High-speed surgical drilling canal unroofing progression ($0\dots 100\%$), acute complete vestibular deafferentation, and pure central vestibular compensation ODE ($\text{SPV}(t) = \text{SPV}_{\text{acute}} e^{-t / \tau}$ with $\tau = 4.0\text{ days}$) extinguishing spontaneous nystagmus to $0.0^\circ/\text{s}$ (Alexander 0th degree) at complete static compensation.
    - Retrosigmoid Neurectomy & IAC 4-Quadrant Anatomy: Stereotaxic 4-quadrant mapping at porus acousticus (Anterosuperior = Facial VII, Anteroinferior = Cochlear, Posterosuperior = Superior Vestibular, Posteroinferior = Inferior Vestibular), Koos vestibular schwannoma staging (I–IV: $\le 10\text{ mm}$ intracanalicular to $>30\text{ mm}$ giant brainstem compression), continuous ABR Wave V latency prolongation $\Delta\tau_{\text{ABR}}$ ($5.6\dots 8.5\text{ ms}$) and amplitude degradation, and continuous facial nerve EMG neurotonic spike rate and voltage alarm ($\mu\text{V}$) triggered by mechanical traction ($F_{\text{traction}} > 2.0\text{ g}$) or sub-millimeter proximity ($d < 1.0\text{ mm}$).
  - `web/src/render/gate3Materials.ts` & `web/src/render/DualStageScene.ts`:
    - Shader Uniforms: `uSurgicalDrillActive` (bone milling luminescence with high-frequency flicker), `uCanalUnroofed` (discrete superior arch ceiling cutaway reveal across all 3 canals and otic capsule), `uTranslocationBreach` (pulsing crimson basilar membrane rupture emergency visual alarm driven by `uSurgicalTime * 16.0`), and Greenwood tonotopic color helper `getGreenwoodColor()`.
    - Procedural 3D Electrode Array: Pre-allocated 64-segment $\times$ 8-slice silicone carrier tube (`THREE.BufferGeometry`) with zero-heap vertex updates, 3D pitch/yaw trajectory deviation, and 22 platinum contact sphere meshes with Greenwood tonotopic coloring ($E_1$ apical violet $\to$ $E_{22}$ basal red).
    - Dynamic Surgical Perspectives: Camera tweens for Round Window micro-focus ($[12.5, -4.5, -1.8] \to [7.2, 0.8, -1.5]$), Mastoid posterior-lateral view ($[18.0, -14.0, 6.0] \to [4.5, 1.5, 0.5]$), and Retrosigmoid IAC view ($[-15.0, -8.0, 3.0] \to [1.0, 3.5, 0.5]$).
  - `web/src/audio/ToneSynthesizer.ts`:
    - Otologic Sound Synthesis: High-speed otologic drill whine ($70{,}000\text{ RPM} \to \sim 1167\text{ Hz}$ with $2.3\text{ kHz}$ harmonic and mechanical flutter), facial nerve EMG neurotonic burst alarm ($180\text{ Hz}$ sawtooth with rapid amplitude modulation), and scalar translocation rupture transient snap (low-frequency impulse click with exponential decay).
  - `web/src/ui/SurgicalDrawer.ts`:
    - Docked 5th modal card ($360\times 360$ logical, $720\times 720$ physical retina) mounting 2D Endoscopic Monitor canvas (`#surg-monitor-canvas`) and lower live force/biotelemetry plot canvas (`#surg-plot-canvas`).
    - 2D Endoscopic Monitor: Cross-sectional Scala Tympani view with RW membrane and basilar membrane, canal unroofing mastoidectomy view with drill burr, and IAC 4-quadrants view with Bill's bar, falciform crest, and Koos tumor cleavage planes.
    - Live Biotelemetry Strip: CI insertion depth vs. force curve with $150\text{ mN}$ threshold, labyrinthectomy post-op compensation decay curve, and synchronized ABR Wave V trace ($5.6\dots 8.5\text{ ms}$) and real-time facial nerve EMG neurotonic voltage strip ($\mu\text{V}$).
  - `web/src/ui/AppHUD.ts` & `web/src/style.css`:
    - Mode 5 button `[ 🔬 Surgical Suites ]` in top header.
    - Contextual bottom dock `#surgical-dock-content` supporting 3 subview workbenches (CI, Labyrinthectomy, Neurectomy) with insertion sliders, motorized auto-insertion, drill whine toggles, Koos tumor stage chips, traction force slider, nerve cleavage highlight, and EMG audio alarms.
    - Bidirectional AudiogramDrawer integration: Automatically switches to `acoustic_trauma` (120 dB HL) on CI scalar rupture, `labyrinthectomy_anacusis` (120 dB HL) on neuroepithelial curettage, and restores `normal` hearing upon selective neurectomy with cochlear nerve preservation.
    - Strict 5-drawer mutual exclusivity (`partsDrawer`, `audiogramDrawer`, `ctSliceDrawer`, `vorDrawer`, `surgicalDrawer`, and `gyroFlyout`).
    - Mobile z-index protection and $\ge 85\%$ canvas stage command across all devices.
  - Verification:
    - Standalone Node.js ESM test suite `scripts/test_surgical_engine.js` passing 56/56 assertions (100%).
    - Root `npm test` running all 7 test suites passing 392/392 assertions (100%).
    - Headless Chrome CDP tests (`scripts/verify_mvp_cdp.js`) passing 100% across Desktop (1440×900), Desktop Standard (1280×800), Tablet (768×1024), and Mobile (390×844) viewports with zero console errors.
### 2026-10-26: Industrial-Grade Web App Hardening & Architecture Rigor Audit (Completed & Verified)
- **Objective:** Audit and harden the entire web application to industrial grade, eliminating per-frame allocations, guaranteeing WebGL context loss/recovery, synchronizing touch orbit gestures across 3D pin overlays, enforcing sample-accurate Web Audio stopping with master gain ceilings, implementing mobile safe-area insets, WCAG AA contrast compliance, and enabling strict TypeScript compiler rules (`noUnusedLocals`, `noUnusedParameters`).
- **Key Deliverables Achieved:**
  - `web/src/ui/SurgicalDrawer.ts`: Replaced fixed simulation delta with true dynamic delta-time via `performance.now()` with non-negative jitter guards. Paused and resumed `requestAnimationFrame` loop automatically based on drawer open/closed state. Upgraded canvas axis tick labels and tonic resting text to `#94a3b8` (contrast ratio > 7:1) for WCAG AA compliance.
  - `web/src/ui/AppHUD.ts`: Pre-allocated `activePinIdSet` eliminating per-frame `new Set()` and `.map()` heap allocations during 3D pin projections. Cached DOM elements for vestibular telemetry cards and updated `.textContent` and `.style.width` in-place, eliminating 60fps DOM destruction. Implemented complete pointer lifecycle forwarding (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) with pointer capture on `.projected-pin`, preserving click-to-select while propagating drag gestures with `pageX`/`pageY` to canvas to allow smooth 3D camera orbiting without getting Three.js OrbitControls stuck.
  - `web/src/render/DualStageScene.ts`: Registered `webglcontextlost` (with mandatory `event.preventDefault()`) and `webglcontextrestored` event listeners on canvas with render loop suspension/resumption, unbinding on disposal, and `isDisposed` safety checks. Decoupled direct imports of `VORDrawer` and `SurgicalDrawer` into `IVORDrawerTarget` and `ISurgicalDrawerTarget` interfaces with `onSurgicalStateUpdate` and `onVestibularTelemetry` subscriptions. Pre-allocated static pin sort comparator `DualStageScene.comparePinCandidates`.
  - `web/src/audio/ToneSynthesizer.ts`: Converted surgical drill, facial EMG, and scalar rupture sound nodes to sample-accurate `osc.stop(now + 0.04)` and `osc.onended = () => { osc.disconnect(); gain.disconnect(); }`. Introduced dedicated `masterGainNode` (`setMasterVolume`, `getMasterVolume`, `toggleMute`, `setMuted`, `getIsMuted`, `getMasterGain`) and routed all procedural audio through `masterGain` -> `safetyLimiter` -> `audioCtx.destination` to prevent digital clipping across summed multi-source playback.
  - `web/index.html` & `web/src/style.css`: Added `viewport-fit=cover` and iOS `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)` rules across headers, docks, cards, and modal flyouts. Added `touch-action: none` and `user-select: none` to `.projected-pin`.
  - `web/tsconfig.json`: Enabled `"noUnusedLocals": true` and `"noUnusedParameters": true`, resolved all unused symbol warnings/errors across the codebase.
- **Verification:**
  - `cd web && npm run build` completes cleanly with 0 TypeScript and 0 Vite errors.
  - All 7 test suites (hearing, radiology, vestibular, eye-avatar, workbench, diagnostic, surgical) pass 100% (392/392 assertions).
  - Headless Chrome CDP tests (`scripts/verify_mvp_cdp.js`) pass 100% across all 4 responsive viewports (Desktop High-Res, Desktop Standard, Tablet Portrait, Mobile Handset) with 0 console errors and 0 unhandled exceptions.

---

### 2026-10-27: VOR Eye Realism Overhaul & Multi-Viewport UI Anti-Crowding Hardening (Completed & Verified)
- **Objective:** Eliminate the fake/doll-like appearance of the 3D VOR eye avatar and resolve UI layout crowding, horizontal/vertical overflow, and drawer overextension across Desktop (1440×900, 1280×800), Tablet Portrait (768×1024), and Mobile Handset (390×844).
- **Key Deliverables Achieved:**
  - `web/src/ui/VORDrawer.ts`: Implemented `renderOcularOverlay` with `evenodd` canvas cutouts.
    - *Daylight Natural Mode:* Anatomical palpebral fissure (eyelid) contour framing with superior arch covering superior sclera and grazing top 15% of iris, inferior arch tangent to the inferior limbus, lateral/medial canthi, and upper eyelid lashline depth shadow gradient.
    - *NIR VNG Mode:* Dual circular ocular ports ($r=48\text{ px}$) with 4 NIR illuminator LED glints at $45^\circ/135^\circ/225^\circ/315^\circ$, concentric calibration reticles ($\pm 10^\circ, \pm 20^\circ$), and yellow P-CR tracking vector line.
    - Swapped inverted eyelid coordinates: Left Eye labeled "Left Eye (OS)" and Right Eye labeled "Right Eye (OD)" matching screen coordinates.
    - Softened natural crosshairs to `rgba(56, 189, 248, 0.45)` with 1.0px width while keeping `#facc15` 1.5px in NIR mode.
  - `web/src/render/eyeAvatar.ts`: Upgraded sclera materials to `THREE.MeshPhysicalMaterial` with clearcoat 0.7, roughness 0.28, resolving Three.js material warnings. DataTextures mapped for procedural iris (crypts of Fuchs, collarette, radial fibers) and microvascular sclera.
  - `web/src/style.css`:
    - Globally constrained `html, body, #app` to `max-width: 100vw; overflow-x: hidden;`.
    - Expanded `.bottom-viz-bar` to `width: min(1340px, calc(100% - 32px))` on desktop to give comfortable horizontal breathing room.
    - Caloric testing subview: set `.caloric-chip` to compact padding ($3\times 5\text{ px}$), set `.vestibular-protocol-group` to `flex-shrink: 1; min-width: 0; overflow-x: auto;`, locked `.vestibular-timeline-wrap` to `min-width: 260px; flex: 0 0 auto;`, and hid `.caloric-laterality-tag` on screens $\le 1360\text{ px}$ to eliminate horizontal collisions between Alexander Gaze and action buttons.
    - Tablet Portrait ($\le 960\text{ px}$): Added complete responsive flex-wrapping for `.vestibular-dock-content`, `.vest-subnav-bar`, `.vest-subview`, `.vestibular-protocol-group`, `.vestibular-timeline-wrap`, and `.vestibular-actions-group`. Elevated `.vor-drawer` bottom offset to `calc(175px + env(safe-area-inset-bottom))` with `max-height: calc(100vh - 240px)` so it never collides with multi-row bottom docks.
    - Mobile Handset ($\le 640\text{ px}$): Constrained `.lab-header`, `.brand-cluster`, `.search-container`, and `.mode-switcher` so mobile handset renders 100% within 390px bounds. Elevated `.vor-drawer` bottom offset to `calc(198px + env(safe-area-inset-bottom))` with `max-height: calc(100vh - 260px)` to float cleanly above bottom bars.
- **Verification:**
  - Production Web Build: `cd web && npm run build` completes cleanly with 0 TypeScript/Vite errors in 929ms.
  - Unit/Integration Tests: `npm test` runs 7 test suites (hearing, radiology, vestibular, eye-avatar, workbench, diagnostic, surgical) — all 392 assertions pass 100%.
  - Headless Chrome CDP Tests: `node scripts/verify_mvp_cdp.js` succeeds with 0 console errors and 0 unhandled exceptions across Desktop High-Res, Desktop Standard, Tablet Portrait, and Mobile Handset. Visual inspection of screenshots confirmed 0 overflow, 0 clipping, and realistic ocular framing.

---

## 2. Key Architecture & Engineering Decisions (ADRs)

### ADR-013: Pointer Lifecycle Synchronization & Zero-Allocation 60fps HUD Pipelines
- **Decision:** Implement complete pointer lifecycle forwarding (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) on 3D projected pin overlays with explicit `pageX`/`pageY` population and pointer capture, synchronizing with Three.js `OrbitControls` on the underlying canvas while preserving stationary clicks for structure selection. Eliminate all per-frame heap allocations in projected pin sorting and DOM updates in vestibular telemetry using pre-allocated ID sets and in-place `.textContent` updates.
- **Rationale:** Prevents touch orbit gestures on mobile/tablet devices from getting stuck in multi-touch dolly/pan mode due to orphaned pointer IDs in Three.js OrbitControls, while eliminating garbage collection pauses during continuous 60fps simulation.

### ADR-012: Cranial Nerve VIII (CN VIII) Neurotelemetry & Diagnostic Mode Telemetry Decoupling
- **Decision:** Explicitly model CN VIII primary vestibular afferent spike rate arrays (`cn8FiringRateArray: Float32Array`, 350 samples) inside `VHITImpulseBuffer` across all clinical presets (normal 90–255 sp/s, acute neuritis blunted to 25–45 sp/s, vestibular schwannoma blunted to 40–70 sp/s, bilateral loss down to 10–15 sp/s). Decouple diagnostic submodes (`vestSubmode: 'bppv' | 'caloric' | 'vhit'`) inside `DualStageScene` so BPPV otolith sedimentation ODE is halted during Caloric irrigation and vHIT head thrusts, preventing gravity drift contamination of caloric convection and high-speed impulses. Enforce sticky header containment on `.inspector-header` and strict structure-scoped activation for SCDS third-window panels.
- **Rationale:** Resolves cross-modal telemetry contamination where switching from BPPV to Caloric or vHIT caused erratic nystagmus and spinning vertigo readouts. Ensures full clinical fidelity for medical education when demonstrating cranial nerve 8 afferent firing rates and VOR compensation.

### ADR-011: Otologic Surgical Kinematics, Translocation Mechanics & Intraoperative Neurotelemetry
- **Decision:** Model Cochlear Implant (CI) insertion along the authentic 3D Scala Tympani path with Advance Off-Stylet (AOS) non-linear mechanical curling and a strict $150\text{ mN}$ basilar membrane rupture threshold triggering fragment shader emergency alarms (`uTranslocationBreach`) and Web Audio acoustic transients. Model Labyrinthectomy deafferentation using a pure central vestibular compensation ODE ($\text{SPV}(t) = \text{SPV}_{\text{acute}} e^{-t / \tau}$) that extinguishes spontaneous nystagmus to $0.0^\circ/\text{s}$ at static compensation. Model Retrosigmoid Neurectomy using authentic 4-quadrant porus acousticus anatomy ("7-up, Coke down"), Koos tumor staging (I–IV), and continuous electrophysiological biotelemetry (ABR Wave V latency prolongation $\Delta\tau_{\text{ABR}}$ and facial nerve EMG neurotonic spike rate / voltage alarm ($\mu\text{V}$)).
- **Rationale:** Delivers authoritative otologic and neurotologic simulation fidelity for surgical planning and resident training without external static assets or performance degradation, maintaining 60fps WebGL execution and zero heap allocations.

### ADR-010: Diagnostic Caloric Thermal Convection & Minimum-Jerk vHIT Kinematics
- **Decision:** Model caloric convection through coupled 1D Fourier thermal diffusion ODE and hydrostatic buoyancy pressure in $+30^\circ$ supine posture rather than arbitrary timers. Model high-velocity head thrusts using 5th-order minimum-jerk kinematics with closed-form SO(3) quaternions and evaluate Curthoys area gain strictly over the physiological 40–80ms integration window.
- **Rationale:** Ensures complete physiological fidelity to Ewald's laws and the COWS rule without heuristic hacks, while maintaining 60fps performance and zero heap allocations across both continuous irrigation and discrete 120ms impulse trials.

### ADR-009: Pre-Allocated Scratch Buffers & Complete WebGL Resource Disposal
- **Decision:** Mandate pre-allocated static scratch arrays and objects (`SplineSampleRAS`, `Float32Array`, `scratchPinVector`) for all render loop operations across physics stepping and 2D pin projections. Enforce dedicated non-overlapping scratch buffers (`scratchSample` for canal center telemetry vs `particleScratchSample` for particle cloud interpolation) to prevent internal state corruption of `arcMm`, `centerRAS`, and `tangentRAS`. Pre-allocate fixed `acceptedBoxes` and filter structures inline in `computeProjectedPins()` to eliminate all heap allocations at 60fps. Enforce complete unbinding of DOM event listeners, container DOM detachment, and recursive Three.js geometry/material disposal on `DualStageScene.dispose()`.
- **Rationale:** Prevents GC micro-stutter and memory leaks during continuous 60fps clinical simulation, guarantees mathematical integrity across nested spline interpolations, and ensures seamless lifecycle management when mounting/unmounting WebGL scenes in modal workbenches.

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

### ADR-007: Procedural Photorealistic Iris Crypts & Microvascular Sclera for 3-DOF Cyclotorsion Tracking
- **Decision:** Generate multi-octave fibrous radial iris architecture with angular tortuosity (s32, s64, s128, s256), Crypts of Fuchs, Collarette zigzag ring, Dark Limbal Ring, and microvascular conjunctival vessel network directly into the 3D eye avatar texture (`assets/iemap/eye_avatar.glb` and `web/public/assets/iemap/eye_avatar.glb` at $273.4\text{ kB}$).
- **Rationale:** On a generic spherical eyeball or solid iris color, roll/cyclotorsion (rotation around the line of sight) is completely invisible. In posterior canal BPPV (Dix-Hallpike) and vertical canal pathology, the pathognomonic diagnostic sign is torsional nystagmus. High-contrast radial trabeculae and microvascular conjunctival landmarks make subtle cyclorotation immediately obvious to clinicians and students in both natural daylight mode and near-infrared VNG goggles mode without requiring external telemetry text overlays.

### ADR-008: Zero-Allocation 60fps Biotelemetry Streaming & Low-SPV VOR Gating
- **Decision:** Bridge the 60fps render loop directly to HUD telemetry (`onVestibularTelemetry`) using scalar/object mutation rather than reallocations, and lower the VOR slow-phase gate from `cupulaDeflection > 0.12` to `(cupulaDeflection > 0.08 || spvMag > 0.5) && spvMag > 0.1`. Synchronize high-speed vHIT ($350\text{ ms}$) kinematic playback to the 3D Eye Avatar via direct `setGazeAngles` and interactive playhead scrubbers.
- **Rationale:** Educational and clinical users require real-time feedback during BPPV sedimentation, Caloric irrigation ($3\dots 25^\circ/\text{s}$), and high-speed vHIT thrusts ($250^\circ/\text{s}$). Static gauges or silenced eye movements violate clinical expectations and degrade teaching utility.

---


## 3. Directory & File Memory Map

```
inner-ear-3d-lab/
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
│   ├── test_vestibular_engine.js# Stage 3 Step 2 physics & Ewald verification (72 tests)
│   ├── test_eye_avatar_vor.js   # Stage 3 Step 3 3D eye avatar & Listing VOR verifier (50 tests)
│   ├── test_vor_workbench.js    # Stage 3 Step 4 vestibular workbench & VORDrawer verifier (51 tests)
│   ├── test_diagnostic_vestibular.js # Stage 3 Phase 3B Caloric & vHIT verifier (51 tests)
│   ├── test_surgical_engine.js  # Stage 4 CI, Labyrinthectomy & Neurectomy verifier (56 tests)
│   ├── generate_multicanal_splines.py # Continuous 3D spline generator for Horizontal & Anterior canals
│   ├── export_eye_avatar_glb.py # CC0 sculpted eye extractor & cyclotorsion texture generator
│   └── verify_mvp_cdp.js        # Multi-viewport Chrome CDP automated test (Modes 1-5)
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
        │   ├── epleyPhysics.ts     # TypeScript BPPV kinematics & steps (legacy wrapper)
        │   ├── vestibularEngine.ts # Multi-canal BPPV Stokes & Steinhausen engine
        │   ├── diagnosticVestibularEngine.ts # Caloric thermal convection & vHIT kinematics engine
        │   └── surgicalEngine.ts   # Stage 4 CI insertion, deafferentation & neurotelemetry
        ├── render/
        │   ├── DualStageScene.ts # Core Three.js render loop & camera controller
        │   ├── eyeAvatar.ts      # 3D Eye Avatar & Listing's Law kinematic engine
        │   └── gate3Materials.ts # Custom GLSL shaders & analytic clipping
        └── ui/
            ├── AppHUD.ts         # DOM manager, search, floating inspector, bottom dock
            ├── AudiogramDrawer.ts# Interactive clinical audiogram drawer
            ├── CTSliceDrawer.ts  # Interactive 2D CT MPR canvas slice viewer
            ├── VORDrawer.ts      # Interactive 3D VOR eye avatar & VNG strip chart drawer
            └── SurgicalDrawer.ts # Interactive 2D endoscopic monitor & live biotelemetry drawer
```

