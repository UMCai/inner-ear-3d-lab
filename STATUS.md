# Project Status: Inner Ear 3D Lab (Gate 3 Medaium)

## Current Phase: Active — Stage 3 (Multi-Canal Vestibular Dynamics & 3D VOR Eye Avatar) In Progress
### Current Milestone: Stage 3 — Step 4 (Contextual Vestibular Workbench & VORDrawer) Complete & Verified

### WebGL Inner Ear 3D Lab Milestones
- [x] **Stage 3 — Step 4: Contextual Vestibular Workbench & VORDrawer (`web/src/ui/VORDrawer.ts`, `web/src/ui/AppHUD.ts`, `web/src/render/DualStageScene.ts`) (Complete & Verified)**:
  - Contextual Vestibular Dock: Ingests 6 clinical protocols (Epley, Semont, Gufoni Geotropic, Gufoni Apogeotropic, Lempert 360° Barbecue Roll, Yacovino), step scrubber ($0\dots N-1$), hold timer badge countdown, clearance percentage badge, play sequencer auto-advance engine, 3-axis gyro flyout (Yaw $\pm 180^\circ$, Pitch $-30^\circ\dots 120^\circ$, Roll $\pm 90^\circ$), crystal reset, and VOR eyes toggle.
  - Docked Clinical VNG Drawer: Dual-canvas modal card ($360\text{ px}$ width, $\ge 85\%$ stage command) mounting 3D Eye Avatar canvas ($360\times 220$ logical, $720\times 440$ physical) and rolling 3-channel Nystagmogram strip chart canvas ($360\times 110$ logical, $720\times 220$ physical), Listing's law conjugate yaw/pitch with active cyclotorsion, pupil crosshairs $\oplus$, corneal Purkinje glints $\ast$, live degree pills (H, V, T, SPV, beat direction token), near-infrared VNG toggle, and zero-allocation strip chart (Cyan H, Lime V, Amber T) reading from `NystagmogramRingBuffer` with red saccade tick flags.
  - 3D Scene Vestibular Engine & Otoconia: 5-particle amber otoconial cloud mesh group (`r=0.135 mm` sphere with `0.22 mm` outer halo glow), vestibular camera fly-to ($[21.5, -11.5, 7.2] \to [4.5, 1.5, 0.2]$), selective anatomical ghosting (Cochlea and Bony Capsule dimmed to 15% opacity with `depthWrite: false`), 60fps physics stepping ODE, and telemetry forwarding.
  - Floating Inspector Card Vestibular Telemetry: Displays canal/spatial plane badge, CN VIII primary afferent firing rate gauge ($10\dots 310\text{ sp/s}$ with $90\text{ sp/s}$ baseline marker and excitation/inhibition color coding), Ewald's law banner, patient sensation badge, clearance %, clinical pearl, and `[ 👁️ View 3D VOR & VNG Eyes ]` button.
  - Strict 4-Drawer Mutual Exclusivity: Mutual exclusivity across `VORDrawer`, `CTSliceDrawer`, `AudiogramDrawer`, and `PartsDrawer`.
  - Automated Deep Verification Suite: Standalone Node.js ESM test suite `scripts/test_vor_workbench.js` with 51 assertions across 7 test suites passing 100%, integrated into root `package.json` (`npm run test:workbench` and `npm test` passing all 5 test suites).
- [x] **Stage 3 — Step 3: 3D Eye Avatar & VOR Kinematics Engine (`web/src/render/eyeAvatar.ts`) (Complete & Verified)**:
  - Scene Graph & Asset Pipeline: Three.js GLTFLoader pipeline ingesting `assets/iemap/eye_avatar.glb` ($274.9\text{ kB}$), traversing and caching nodes (`EyeAvatarRoot`, `EyePivot_R`, `EyePivot_L`, `Iris_R`, `Iris_L`, `PupilBacking_R`, `PupilBacking_L`, `Sclera_R`, `Sclera_L`, and cornea meshes). Anterior perspective camera placed at $[0.0, 0.0, -0.22\text{ m}]$ looking toward $[0, 0, 0]$ with `camera.up.set(0, 1, 0)` matching the $-Z$ optical axis.
  - 3-DOF Listing's Law Kinematics: Analytical single-axis Listing plane rotation ($\mathbf{u} = [\theta_v/\Theta, -\psi_h/\Theta, 0]$, $q_z \equiv 0$) with active vestibular cyclotorsion around $-Z$ ($\mathbf{q}_{\text{torsion}} = [0, 0, -\sin(\phi_t/2), \cos(\phi_t/2)]$).
  - Bilateral Cyclovergent Coupling: Right extorsion ($+\phi_t$ temporal) and Left intorsion ($+\phi_t$ nasal) tilting both upper iris poles toward patient right ($+X$) during upbeat-right torsional nystagmus, conjugate horizontal yaw, conjugate vertical pitch.
  - Sawtooth Nystagmus Waveform & Neural Integrator: Peripheral slow drift integration from `VestibularTelemetryState.slowPhaseVelocityDegPerSec`, central ballistic saccadic burst generator ($400\text{–}700^\circ/\text{s}$, $25\text{–}40\text{ ms}$, anti-parallel reset with $-10\%$ overshoot), retinal slip threshold ($3.0^\circ\text{–}6.0^\circ$), inter-saccadic timeout ($200\text{–}350\text{ ms}$), and brainstem neural integrator elastic leak ($\tau_{\text{leak}} = 0.8\text{ s}$).
  - Infrared VNG Mode & P-CR Telemetry: Monochromatic NIR shader toggle ($850\text{–}940\text{ nm}$ luminance with high-contrast pupil isolation), 3D-to-2D pupil centroid projection $\oplus$, and closed-form paraxial Purkinje glint reflection $\ast$ on corneal sphere ($R_c = 7.8\text{ mm}$, virtual IR source at $[0.02, 0.04, -0.20\text{ m}]$).
  - 60fps Zero-Allocation Ring Buffer: `NystagmogramRingBuffer` using pre-allocated typed arrays (`Float32Array(600)`, `Uint8Array(600)`) with scalar `push(time, h, v, t, spv, isFastPhase)` method and pre-allocated static scratch math buffers generating 0 per-frame heap allocations.
  - Deep Verification Suite: Standalone Node.js ESM test suite `scripts/test_eye_avatar_vor.js` with 50 assertions across 7 test suites passing 100% (GLTF integrity, Listing's law, bilateral VOR, sawtooth dynamics, NIR telemetry, ring buffer, build integrity), integrated into root `package.json` (`npm run test:eye-avatar` and `npm test` passing all 4 suites).
- [x] **Stage 3 — Step 2: Multi-Canal BPPV Physics Engine (`web/src/physics/vestibularEngine.ts`) (Complete & Verified)**:
  - 3-DOF Head Kinematics: Analytical orthonormal $R_{\text{head}}(\psi, \theta, \gamma) \in SO(3)$ with strict right-ear down ($\gamma = +90^\circ$) and left-ear down ($\gamma = -90^\circ$) lateral roll.
  - Multi-Canal Semicircular Dynamics: Continuous 3D Stokes sedimentation across all 3 canals (Posterior, Horizontal, Anterior) with stiction deadzone ($|g_{\text{proj}}| < 0.045$), terminal velocity bounding ($\le 48.0^\circ/\text{s}$), and 5-particle cloud tracking with utricular fan-out.
  - Steinhausen Cupular Plunger Model: Two-phase ODE with active drag coupling ($\kappa_{\text{drag}} = 2.2\text{ s}^{-1}$), passive elastic restoration ($\tau_{\text{return}} = 1.8\text{ s}$), and lumen-narrowing factors (duct: 1.0, crus: 0.35, utricle: 0.02).
  - Ewald's 2nd & 3rd Laws Neurophysiology: CN VIII primary afferent firing rate ($10\dots 310\text{ sp/s}$, resting $90\text{ sp/s}$) respecting canal-specific polarities and $2.75\times$ physiological asymmetry, driving 3D slow-phase eye velocity and fast-phase nystagmus vectors.
  - 6 Clinical Maneuvers & Presets: Epley (5 steps), Semont (3 steps), Gufoni Geotropic (4 steps), Gufoni Apogeotropic (4 steps), Lempert 360° Barbecue Roll (5 steps), and Yacovino (4 steps).
  - Backward Compatibility: Drop-in `RealtimeEpleySimulator` wrapper matching all static helpers, formulas, and legacy types.
  - Automated Deep Verification: Standalone Node.js ESM test suite `scripts/test_vestibular_engine.js` passing 100% (72/72 assertions across 8 suites), integrated into root `npm test` and `test:vestibular`, with clean production build (`npm run build`, 0 errors).

- [x] **Stage 3 — Step 1: Geometric & Asset Foundation (Complete & Verified)**:
  - Generated continuous 3D centerline splines for all 3 semicircular canals: `horizontal_canal_path.json` ($150$ knots, $15.46\text{ mm}$, mean clearance $0.234\text{ mm}$) and `anterior_canal_path.json` ($150$ knots, $19.19\text{ mm}$, mean clearance $0.270\text{ mm}$), linking seamlessly to Common Crus and Utricle.
  - Exported authentic bilateral 3D eye avatar `assets/iemap/eye_avatar.glb` ($274.9\text{ kB}$) with physiological $PD = 62.0\text{ mm}$, $24.0\text{ mm}$ globe diameter, transparent cornea dome, and $32$ procedural high-contrast radial iris crypts for unmistakable cyclotorsion tracking.
  - Built TypeScript data loaders and continuous 3D interpolation in `web/src/data/canalPaths.ts`.
  - Verified 100% pass in `scripts/test_canal_paths.py` (all tests passing) and `npm run build` (0 errors).

- [x] **Stage 0: Pure 3D Anatomy Lab MVP**:
  - Ingested 27 authentic IE-Map v1.0.0 surface meshes in RAS millimeter coordinates.
  - Built single-stage 60fps Three.js canvas, Gate 3 rim-lit shaders with backface culling, bone peel slider ($0\text{–}100\%$), exploded view slider ($0\text{–}100\%$), 27-part ontology with Latin names and clinical pearls.
- [x] **Stage 1: Audio-Visual Tonotopy Engine & Hearing Lab**:
  - Donald D. Greenwood auditory place-frequency engine ($F(x) = 165.4 \cdot (10^{2.1 x} - 0.88)$ Hz) and inverse $x(F)$ with 100-knot 3D RAS spline table ($28.79\text{ mm}$ length).
  - High-performance continuous segment orthogonal projection attribute generator ($<5\text{ ms}$, zero memory leaks).
  - Web Audio API zero-asset tone synthesizer with shared `AudioContext`, click-free exponential gain envelope ($50\text{ ms}$ attack/decay, floor $0.0001$), pitch gliding ($35\text{ ms}$), and safety limiter compressor.
  - Interactive Clinical Pure-Tone Audiogram drawer ($-10\text{ to }120\text{ dB HL}$, $125\text{ to }8{,}000\text{ Hz}$, right ear red circle $\bigcirc$ markers), 4 clinical presets, speech banana phoneme overlay, and drawer mutual exclusivity.
  - Dynamic tonotopy shader with 7-stop perceptual rainbow heatmap, von Békésy asymmetric traveling wave simulation, and audiogram pathology crimson desaturation mask.
  - Mode switcher (`[ 🏛️ Anatomy Atlas ] [ 🎵 Hearing & Tonotopy ]`), contextual bottom dock morphing to Hearing Workbench, and electrophysiology badges.
  - Automated verification: `scripts/test_hearing_engine.js` (100% pass across 7 suites) and `scripts/verify_mvp_cdp.js` (100% pass across 4 viewports with 0 errors).
- [x] **Stage 2: Virtual Temporal Bone Radiology & SCDS Third-Window (Complete & Verified)**:
  - Exposed GPU fragment shader analytic half-space clipping uniforms (`uClipActive`, `uClipNormal`, `uClipConstant`) across all 27 meshes in `DualStageScene.ts`.
  - Implemented `web/src/data/radiologyEngine.ts`: 4 canonical clinical planes (Pöschl, Stenvers, Axial, Coronal) with right-handed orthonormal triads, continuous 100% landmark dictionary (0 gaps), GPU clip constant calculation, and SCDS defect definitions.
  - Implemented `web/src/ui/CTSliceDrawer.ts`: Synchronized 2D CT MPR Canvas slice viewer with Bone Window ($W:4000, L:+700\text{ HU}$) and T2 MRI CISS modes, orientation tokens, 5 mm scale bar, interactive drag scrubbing, and SCDS defect caliper.
  - Integrated Mode 3 `[ 🩻 Virtual Radiology ]` into Top Header switcher and contextual bottom dock in `AppHUD.ts` and `style.css` (plane chips, depth slider, landmark readout, flip cut, guide plane, SCDS toggle, CT card toggle).
  - Implemented SCDS Third-Window Biomechanics box in Floating Inspector with Tullio phenomenon, Hennebert's sign, autophony, and link to SCDS audiogram preset in `AudiogramDrawer.ts`.
  - Enforced strict drawer mutual exclusivity (CT drawer, Audiogram drawer, 27-Parts drawer).
  - Verified 100% pass across: `test_radiology_engine.js` (52/52 tests), `test_hearing_engine.js` (7/7 suites), `npm run build` (0 errors), and `verify_mvp_cdp.js` across all 4 viewports with 0 console errors and generated visual screenshots.

### Headless Blender Editorial Video Milestones (Phase 0)
- [x] **Authentic IE-Map v1.0.0 Asset Ingestion (`src/anatomy/prepare_iemap.py`, `src/anatomy/export_glb_and_preview.py`)**:
  - Ingested 27 authentic IE-Map v1.0.0 surface meshes directly from `assets/iemap_bundle_extracted/iemap-right-labyrinth-asset-v1/` into `assets/iemap/obj/*.obj` and `assets/iemap/vtk/*.vtk`.
  - Ingested the verified smooth posterior canal route `assets/posterior_path_smooth.json` (300 nodes, 14.92 mm inside `ls_Hsapiens_Sp`, 0.25–0.31 mm clearance) smoothly extended through `CCp` and `utricle` into `assets/iemap/posterior_canal_path.json` (313 samples, 19.33 mm total length).
  - Centroid calibrated at `[4.5, 1.4, 0.5]` mm; generated `assets/iemap/look-config.json`, `assets/iemap/iemap_Metadata.json`, `assets/iemap/iemap_right_labyrinth.glb`, and 4 Slicer fiducial sets (`assets/iemap/fcsv/*.fcsv`).
  - Visually verified `build/proof/iemap_3d_verification.png`.
- [x] **3D Vestibular Kinematics & Stokes Gravity Sedimentation Verification (`src/physics/epley_simulator.py`)**:
  - Validated 5 enlarged warm amber canalith particles (`Schematic_canalith_01..05`, `r=0.135 mm`) along the continuous 313-point 3D spline (`Sp -> CCp -> Utricle`).
  - Calibrated physical and clinical milestone knot anchors (`-84.0°` dependent base, `+30.0°` posterolateral apex, `+110.0°` superior arch, `+165.0°` common crus, `+186.0°` utricle exit).
  - All 5 clinical step milestones and particle clearance assertions (`min_sep > 0.17 mm`, `0.291 mm` in Step 5) pass `src/physics/epley_simulator.py` self-test.
- [x] **Authentic CC0 Sculpted Head, Right Ear Ring & Embedded Labyrinth Integration (`src/render/blender_scene_builder.py`)**:
  - Replaced procedural head geometry with `append_authentic_sculpted_head()` loading `GEO-head_sculpting_realistic`, eye meshes (`sclera.L/R`, `iris.L/R`), and `Right_ear_locator_ring` from `assets/iemap-realistic-head-context-candidate.blend`.
  - Applied cylindrical neck tapering to `GEO-head_sculpting_realistic` below anatomical neck line ($z < 0.135$ local, $r \le 0.072$) to cleanly eliminate shoulder bust flare clipping across all head yaw/pitch rotations (Step 1 $45^\circ$ turn, Step 3 $90^\circ$ contralateral turn, Step 4 $135^\circ$ shoulder roll).
  - Calibrated `AuthenticHeadRoot` in `NeckPivot` space: rotation `(0.0, 0.0, -math.pi / 2.0)`, scale `S = 6.2`, location offset `(0.017 * S, -0.025 * S, 0.1514 * S - 0.36)` seating the neck column cleanly into the open tunic collar.
  - Sized and placed the 3D Right Labyrinth stage at `scale = 0.44` and `origin = (6.00, 0.0, 0.70)`, bounding all 27 authentic IE-Map meshes within $px \in [1531, 2376]$ (>250 px buffer from midline $x = 1280$, >180 px from right edge), completely eliminating stage bleed and boundary slicing.
  - Removed top capping disc in `build_contoured_torso_mesh` so the tunic collar remains open without chin clipping.
  - Aligned embedded 3D labyrinth at `(0.0, 0.0, 0.0)` under `AuthenticHeadRoot` with scale `0.001` (coincident with `Right_ear_locator_ring`), and toggle eye hiding during Shot 1 cutaway mode.
  - Added dynamic projection methods `project_patient_right_ear()`, `project_patient_embedded_ear()`, and `project_patient_nose()`. Re-anchored Step 3 "Rotate Head 90° Left" callout to `nose_main`.
- [x] **Full 8-Shot Timeline, Audio Mix & Subtitles (`src/audio/build_audio.py`)**:
  - 8-shot timeline manifest (`build/audio/timeline_manifest.json`, `110.20s`, `3,306 frames @ 30fps`), stereo narration mix (`build/audio/full_narration_mix.wav`), and synchronized subtitles (`output/epley_maneuver_right_bppv.srt`).
  - Corrected medical copy: exact posterior-canal entry pathophysiology and conditional resolution status.
- [x] **Full End-to-End Blender Pass, HUD Compositing & Video Encoding (`scripts/build_full_video.py`, `scripts/render_proof_gate.py`)**:
  - Rendered 399 unique 3D dual-stage poses in headless Blender 5.2.1 LTS (`CYCLES` CPU) and projected all 1,653 frame coordinates.
  - Composited all Gate 3 editorial frames (`1920x1080`) in parallel with Dynamic Role Swap, temporally staged pill labels, and lower-third overlay.
  - Encoded `output/epley_maneuver_right_bppv.mp4` (`1920x1080`, `30 fps`, `110.20s`, `H.264 High@L4.1`, `AAC stereo`).
  - Generated and visually verified QA contact sheets `build/qa/review-contact-1080p.png` and `build/qa/review-small-screen-640x360.png`.
  - Fixed obsolete import in `scripts/render_proof_gate.py`, updated authentic RAS landmarks, and validated `proof_gate_step1_to_step2.mp4`.
