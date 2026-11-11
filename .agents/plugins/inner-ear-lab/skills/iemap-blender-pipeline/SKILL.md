---
name: iemap-blender-pipeline
description: >-
  Update canonical IE-Map v1.0.0 meshes, regenerate semicircular canal RAS splines, export the 3D
  eye avatar GLB (< 300 kB), sync web runtime assets, or run headless Blender 5.2.1 LTS video/proof
  renders cleanly. Use when editing src/, scripts/*.py, or assets/iemap/.
---

# IE-Map Asset & Headless Blender Pipeline

Maintain `assets/iemap/` as the single canonical asset source and sync generated assets safely to the web client.

## 1. Asset Ownership & Sync Workflow

- **Edit only:** `src/`, `scripts/`, or canonical files inside `assets/iemap/` (`obj/`, `vtk/`, `fcsv/`, `*_canal_path.json`, `eye_avatar.glb`, `look-config.json`, `iemap_Metadata.json`).
- **Never edit directly:** `web/public/assets/iemap/` (gitignored mirror), `assets/iemap_bundle_extracted/`, `assets/iemap_source_bundle/`, or `web/dist/`.
- **Always sync after modifying `assets/iemap/`:**
  ```bash
  npm run sync:assets
  # runs: node scripts/sync_web_assets.mjs
  ```
- Note: Do **not** copy sculpted patient head OBJs into `web/public/assets/`. `scripts/export_web_assets.py` intentionally skips head OBJs to keep web runtime bundles lean.

## 2. Python Geometry, Splines & Physics Self-Tests

Run fast pure-Python verification without Blender first:
```bash
npm run test:python
# executes:
#   python3 scripts/test_canal_paths.py
#   python3 src/physics/epley_simulator.py
```

Key checks:
- `posterior_canal_path.json` (313 knots, `19.33 mm`), `horizontal_canal_path.json` (150 knots, `15.46 mm`), `anterior_canal_path.json` (150 knots, `19.19 mm`) stay strictly centered inside their respective IE-Map lumens with verified wall clearance.
- `epley_simulator.py` verifies Stokes sedimentation milestones across Steps 1–5 (`min_sep > 0.17 mm`, `0.291 mm` in Step 5).

## 3. Headless Blender 5.2.1 LTS Commands

All Blender scripts use repo-relative `Path(__file__).resolve().parent.parent` paths:
```bash
# Regenerate 3-canal centerlines / eye avatar GLB (< 300 kB budget, PD = 62.0 mm)
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/export_eye_avatar_glb.py

# Render Cycles CPU 4-sample zero-variance proof/editorial passes (2560x1080 -> 1920x1080)
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/render_proof_gate.py
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/build_full_video.py
```

After regenerating `eye_avatar.glb` or spline JSONs, run `npm run sync:assets`, check `ls -lh assets/iemap/eye_avatar.glb` (`< 300 kB`), and run `npm run test:python` + `npm run test:fast`.
