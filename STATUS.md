# Project Status: Epley Maneuver for Right-Ear Posterior-Canal BPPV (Gate 3 Redesign)

## Current Phase: Complete — Authentic IE-Map & Realistic Sculpted Head Ingested, Verified & Rendered

### Completed Milestones
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
