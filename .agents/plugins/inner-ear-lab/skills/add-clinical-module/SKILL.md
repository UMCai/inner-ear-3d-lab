---
name: add-clinical-module
description: >-
  Follow the full vertical coupling checklist when adding or extending a clinical mode, surgical
  suite, vestibular test, shader uniform, or drawer in inner-ear-3d-lab. Use whenever wiring a
  feature across physics engines, DualStageScene, shaders, ToneSynthesizer, AppHUD, styles, and tests.
---

# Add or Extend a Clinical Simulation Module

Changes in `inner-ear-3d-lab` span up to six tightly coupled layers. Follow [coupling-checklist.md](./references/coupling-checklist.md) so no layer drifts out of sync.

## High-Level Wiring Sequence

1. **Pure Node-Safe Engine (`web/src/physics/` or `web/src/data/`):**
   - Implement RAS mm kinematics, physiological ODEs, and constants with zero top-level browser globals (`window`, `document`, `localStorage`) so `node scripts/test_*.js` can import TypeScript directly.
2. **GLSL Shader & Scene State (`gate3Materials.ts`, `DualStageScene.ts`):**
   - Add typed uniforms to `Gate3ShaderUniforms`, expose scene methods, reuse pre-allocated buffers in `requestAnimationFrame`, and cleanly reset transient mode uniforms on mode transitions.
3. **Procedural Web Audio (`ToneSynthesizer.ts`):**
   - Route any new acoustic cues through `masterGain -> safetyLimiter -> audioCtx.destination` with `GAIN_FLOOR = 0.0001` ramps and `.onended` disconnect cleanup.
4. **Drawer, Unified Sidebar Exclusivity & Dock Clearance (`AppHUD.ts`, `hudChrome.ts`, `web/src/ui/*.ts`, `style.css`):**
   - Host any new drawer inside `#sidebar-pane-lab` alongside the single mutual-exclusivity controller (`#parts-drawer`, `#audiogram-drawer`, `#ct-slice-drawer`, `#vor-drawer`, `#surgical-drawer`, plus `#gyro-flyout`), sync chevron arrows (`'▸'`/`'▾'`), close drawers cleanly when leaving `'expanded'` / `'lab'`, update `--dock-shift-x` / `setStageFraming()`, and call `syncDockClearance()`.
   - Mutate cached `.textContent` / `.style.width` on telemetry updates; stop drawer `requestAnimationFrame` loops when collapsed or hidden.
5. **Dual-Layer Verification:**
   - Write/extend deterministic unit assertions in `scripts/test_<domain>.js` (supporting `SKIP_NESTED_BUILD=1`), update `scripts/verify_mvp_cdp.js` `auditLayoutGeometry(...)`, run `npm run verify`, and update `STATUS.md` + `docs/MEMORY.md`.
