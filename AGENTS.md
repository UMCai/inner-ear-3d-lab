# AI Agent Guidelines (`AGENTS.md`)

> **Project:** Inner Ear 3D Lab (Gate 3 Medaium) · **Repo:** `inner-ear-3d-lab`  
> **Stack:** TypeScript, Three.js (GLSL), Vite, Web Audio API, Python 3, Blender 5.2.1 LTS

Scoped domain rules live in [`.agents/rules/`](.agents/rules/) (`01-webgl-shaders-perf.md`, `02-ui-modal-workbench.md`, `03-clinical-ras-biophysics.md`, `04-blender-iemap-pipeline.md`). Workflow playbooks and verification scripts live in the repo plugin [`.agents/plugins/inner-ear-lab/`](.agents/plugins/inner-ear-lab/).

---

## 1. Non-Negotiable Directives

1. **Zero-Clutter / Anti-Cockpit UI:** Preserve the "Modal Workbench" paradigm ([`docs/UI_DESIGN_SPEC.md`](docs/UI_DESIGN_SPEC.md)). No persistent telemetry sidebars; resting 3D stage area stays `>= 85%` across desktop, tablet, and mobile. Maintain strict 5-drawer + `#gyro-flyout` mutual exclusivity.
2. **60fps Zero-GC WebGL Loop:** Never allocate geometries, materials, arrays, or DOM fragments inside `requestAnimationFrame`. Mutate uniforms in [`web/src/render/gate3Materials.ts`](web/src/render/gate3Materials.ts) in-place, preserve `webglcontextlost`/`restored` handling and `.dispose()`, and keep `node_modules`/Vite chunks clean.
3. **Analytic GPU Clipping:** Never perform CPU mesh slicing; drive `uClipActive`, `uClipNormal`, and `uClipConstant` in GLSL.
4. **Medical & RAS Coordinate Rigor:** All stereotaxic geometry uses Right-Anterior-Superior (RAS) coordinates in mm (centroid origin `[4.5, 1.4, 0.5]`, Three.js `+X Right / +Y Anterior / +Z Superior`). Keep otologic equations faithful to implemented source constants (Greenwood, Ewald, Steinhausen/Stokes, Curthoys 40–80 ms, CI `28.0 mm` / `650°` / `>= 30 mN` breach, `tau = 72 h`).
5. **Dynamic Web Audio Only:** Synthesize tones, drill whine, EMG alarms, and rupture snaps dynamically via [`web/src/audio/ToneSynthesizer.ts`](web/src/audio/ToneSynthesizer.ts) (`masterGain -> safetyLimiter -> destination` with exponential ramps). Never commit binary audio files.
6. **Canonical Asset Single Source:** Author meshes/splines/GLBs only in `assets/iemap/` (or Blender generators in `src/` & `scripts/`). Sync into gitignored `web/public/assets/iemap/` via `npm run sync:assets`; never hand-edit `web/public/assets/` or `web/dist/`.

---

## 2. Five Clinical Modes & Module Map

| Mode (Header Order) | UI & Renderer Surface | Primary Domain Engine(s) |
| :--- | :--- | :--- |
| 1. `🏛️ Anatomy Atlas` | `AppHUD.ts`, `#parts-drawer` | [`web/src/data/ontology.ts`](web/src/data/ontology.ts), [`objLoader.ts`](web/src/data/objLoader.ts) (fetch + `BufferGeometry` parser, no IndexedDB cache) |
| 2. `🎵 Hearing & Tonotopy` | `#audiogram-drawer` (`AudiogramDrawer.ts`) | [`web/src/data/greenwoodEngine.ts`](web/src/data/greenwoodEngine.ts), [`ToneSynthesizer.ts`](web/src/audio/ToneSynthesizer.ts) |
| 3. `🩻 Virtual Radiology` | `#ct-slice-drawer` (`CTSliceDrawer.ts`) | [`web/src/data/radiologyEngine.ts`](web/src/data/radiologyEngine.ts), `gate3Materials.ts` clipping |
| 4. `🌀 Vestibular & VOR` | `#vor-drawer` (`VORDrawer.ts`), `#gyro-flyout` | [`canalPaths.ts`](web/src/data/canalPaths.ts) (spline cache), [`vestibularEngine.ts`](web/src/physics/vestibularEngine.ts), [`diagnosticVestibularEngine.ts`](web/src/physics/diagnosticVestibularEngine.ts), [`eyeAvatar.ts`](web/src/render/eyeAvatar.ts) |
| 5. `🔬 Surgical Suites` | `#surgical-drawer` (`SurgicalDrawer.ts`) | [`web/src/physics/surgicalEngine.ts`](web/src/physics/surgicalEngine.ts), `DualStageScene.ts`, `ToneSynthesizer.ts` |

---

## 3. Two-Tier Verification Matrix

**Fast Inner Loop (run during active edits):**
```bash
npm run typecheck                       # tsc -p web/tsconfig.json --noEmit (0 errors)
SKIP_NESTED_BUILD=1 node scripts/test_<domain>.js
python3 scripts/test_canal_paths.py     # All 3 canal splines + clearance checks
python3 src/physics/epley_simulator.py  # 5-step Epley Stokes sedimentation self-test
```

**Release & Cross-Viewport Verification (run before completing tasks):**
```bash
npm run sync:assets                     # Sync assets/iemap/ -> web/public/assets/iemap/
npm run verify                          # typecheck + test:fast + test:python + vite build
npm test                                # Full build + 7 Node test suites (392 assertions)
npm run test:cdp                        # Headless Chrome 4-viewport CDP + layout audit (writes to tmpdir)
# Optional video pipeline:
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/build_full_video.py
```

Update [`docs/MEMORY.md`](docs/MEMORY.md) and [`STATUS.md`](STATUS.md) when architectural decisions or clinical parameters change.
