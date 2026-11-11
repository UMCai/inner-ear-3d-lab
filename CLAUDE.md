# Claude Code Project Reference (`CLAUDE.md`)

> **Project:** Inner Ear 3D Lab (Gate 3 Medaium) · **Repo:** `inner-ear-3d-lab`  
> **Frameworks:** Three.js (GLSL), TypeScript, Vite, Web Audio API, Python 3, Blender 5.2.1 LTS  
> **Canonical Guidelines:** [`AGENTS.md`](AGENTS.md) · **UI Spec:** [`docs/UI_DESIGN_SPEC.md`](docs/UI_DESIGN_SPEC.md)

---

## 1. Quick Reference & Portable Commands

```bash
# Development & Asset Sync
npm run sync:assets                 # Copy canonical assets/iemap/ -> web/public/assets/iemap/
npm run dev                         # Vite dev server on http://127.0.0.1:5173/

# Fast Inner-Loop Verification
npm run typecheck                   # tsc -p web/tsconfig.json --noEmit
npm run test:fast                   # All 7 Node test suites (single pre-check without nested rebuilds)
npm run test:python                 # canal path spline tests + Epley physics self-test

# Full Build & Headless Chrome QA
npm run verify                      # typecheck + test:fast + test:python + production vite build
npm test                            # Production build + all 7 Node test suites (392 assertions)
npm run test:cdp                    # 4-viewport headless Chrome CDP + geometric overlap/canvas% checks

# Headless Blender Editorial Video Pipeline
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/build_full_video.py
```

---

## 2. Architecture & Clinical Ground Rules

1. **Modal Workbench & Mutual Exclusivity:** Protect the 3D stage (`>= 85%` resting viewport area). Top header switches the 5 active modes (`🏛️ Anatomy Atlas`, `🎵 Hearing & Tonotopy`, `🩻 Virtual Radiology`, `🌀 Vestibular & VOR`, `🔬 Surgical Suites`); only one bottom dock subview and at most one drawer/flyout (`#parts-drawer`, `#audiogram-drawer`, `#ct-slice-drawer`, `#vor-drawer`, `#surgical-drawer`, `#gyro-flyout`) may stay open at once.
2. **Zero-GC 60fps WebGL & Analytic Clipping:** Never allocate inside `requestAnimationFrame` in [`web/src/render/DualStageScene.ts`](web/src/render/DualStageScene.ts) or [`web/src/render/eyeAvatar.ts`](web/src/render/eyeAvatar.ts). Mutate uniforms in-place in [`web/src/render/gate3Materials.ts`](web/src/render/gate3Materials.ts).
3. **RAS Stereotaxic & Biophysic Accuracy:** Right labyrinth RAS mm frame calibrated to centroid `[4.5, 1.4, 0.5]`; Greenwood tonotopy ($A=165.4, a=2.1, k=0.88$); Ewald + Steinhausen + Curthoys 40–80 ms VOR; CI `28.0 mm` / `650°` / `>= 30 mN` breach and `tau = 72 h` labyrinthectomy compensation.

---

## 3. Key Source Files

- **Rendering & Audio:** [`DualStageScene.ts`](web/src/render/DualStageScene.ts), [`gate3Materials.ts`](web/src/render/gate3Materials.ts), [`eyeAvatar.ts`](web/src/render/eyeAvatar.ts), [`ToneSynthesizer.ts`](web/src/audio/ToneSynthesizer.ts)
- **Data & Loaders:** [`ontology.ts`](web/src/data/ontology.ts), [`objLoader.ts`](web/src/data/objLoader.ts), [`canalPaths.ts`](web/src/data/canalPaths.ts), [`greenwoodEngine.ts`](web/src/data/greenwoodEngine.ts), [`radiologyEngine.ts`](web/src/data/radiologyEngine.ts)
- **Clinical Physics:** [`vestibularEngine.ts`](web/src/physics/vestibularEngine.ts), [`diagnosticVestibularEngine.ts`](web/src/physics/diagnosticVestibularEngine.ts), [`surgicalEngine.ts`](web/src/physics/surgicalEngine.ts)
- **UI & Drawers:** [`AppHUD.ts`](web/src/ui/AppHUD.ts), [`AudiogramDrawer.ts`](web/src/ui/AudiogramDrawer.ts), [`CTSliceDrawer.ts`](web/src/ui/CTSliceDrawer.ts), [`VORDrawer.ts`](web/src/ui/VORDrawer.ts), [`SurgicalDrawer.ts`](web/src/ui/SurgicalDrawer.ts), [`style.css`](web/src/style.css)
