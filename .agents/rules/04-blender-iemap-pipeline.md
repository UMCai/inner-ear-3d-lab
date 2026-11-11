---
trigger: glob
globs: "**/src/**, **/scripts/*.py, **/assets/**"
---

# Canonical IE-Map Assets & Headless Blender Pipeline Rules

1. **Single Canonical Asset Directory (`assets/iemap/`):**
   - Treat `assets/iemap/` as the single source of truth for the 27 IE-Map OBJs/VTK meshes, `iemap_Metadata.json`, `look-config.json`, FCSV markups, 3 semicircular canal JSON splines, and `eye_avatar.glb`.
   - Never manually edit `web/public/assets/iemap/` (gitignored synced mirror), `web/dist/`, `assets/iemap_bundle_extracted/`, or `assets/iemap_source_bundle/`.
   - Always run `node scripts/sync_web_assets.mjs` (or `npm run sync:assets`) after modifying files under `assets/iemap/`. Never copy unused sculpted head OBJs into `web/public/assets/`.

2. **Portable Paths & Headless Blender 5.2.1 LTS:**
   - Derive repository paths via `Path(__file__).resolve().parent.parent` in Python scripts—never hardcode `/Users/...` or absolute workspace directories.
   - Invoke Blender headlessly (`CYCLES` CPU 4-sample zero-variance shading):
     `/Applications/Blender.app/Contents/MacOS/Blender -b -P <script.py>`

3. **Editorial Video & Avatar Budgets:**
   - Preserve dual-stage calibration in `blender_scene_builder.py` (`2560x1080` internal stage -> `1920x1080`, `labyrinth_scale = 0.44`, `origin = (6.00, 0.0, 0.70)`, neck collar taper below `z < 0.135`).
   - Keep `assets/iemap/eye_avatar.glb` strictly `< 300 kB` with clinical `PD = 62.0 mm` and `24.0 mm` globe diameter.
   - Validate canal spline geometry and BPPV kinematics via `python3 scripts/test_canal_paths.py` and `python3 src/physics/epley_simulator.py`.
