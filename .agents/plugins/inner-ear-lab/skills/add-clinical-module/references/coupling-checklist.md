# End-to-End Clinical Module Coupling Checklist

Read this checklist before declaring any new mode, clinical suite, shader effect, or modal drawer complete.

## 1. Domain Physics & Data (`web/src/physics/`, `web/src/data/`)
- [ ] All geometry respects RAS mm coordinates (`+X` Right, `+Y` Anterior, `+Z` Superior; centroid `[4.5, 1.4, 0.5]`).
- [ ] Module top-level imports cleanly in Node ESM (`node scripts/test_<domain>.js`) without DOM/window mocks unless strictly guarded (`typeof window !== 'undefined'`).
- [ ] Heavy telemetry loops write into pre-allocated `Float32Array` / scratch objects (`NystagmogramRingBuffer`, `VHITImpulseBuffer`, `scratchSample`).

## 2. Shaders & 3D Scene (`gate3Materials.ts`, `DualStageScene.ts`)
- [ ] New uniforms declared in `Gate3ShaderUniforms`, initialized in `createGate3Material`, and mutated via `.uniforms.<key>.value` (never recreating `ShaderMaterial`).
- [ ] Analytical clipping or spatial glow works cleanly in both Right ear (`uMirrored = 0.0`) and Left ear (`uMirrored = 1.0`, flipped winding) modes.
- [ ] Mode cleanup resets transient uniforms (`uTonotopyMode`, `uClipActive`, `uCaloricActive`, `uSurgicalDrillActive`, `uTranslocationBreach`) when switching away.
- [ ] Any dynamic mesh/geometry/material created on demand is tracked and disposed inside `DualStageScene.dispose()`.

## 3. Procedural Audio (`ToneSynthesizer.ts`)
- [ ] Resumes suspended `AudioContext` lazily on user gesture.
- [ ] Routes audio through `masterGain` (`getIsMuted()` / `setMasterVolume()`) and `safetyLimiter`.
- [ ] Uses exponential ramps from `0.0001` (`GAIN_FLOOR`), sample-accurate `.stop(...)`, and `.onended` node disconnection.

## 4. HUD, Mutual Exclusivity & CSS (`AppHUD.ts`, `web/src/ui/*.ts`, `style.css`)
- [ ] Top header pill / bottom dock subview swaps cleanly without stealing resting 3D stage below `85%`.
- [ ] Any drawer or flyout participates in mutual exclusivity (`closeAllDrawersExcept(...)`) and syncs its chevron (`'▸'` / `'▾'`).
- [ ] `updateMobileDrawerExclusivity()` detects the drawer/flyout and suppresses `#inspector-card` via `.drawer-active` at `<= 640px`.
- [ ] `syncDockClearance()` runs after switching into the mode/subview/procedure so `--dock-clearance` updates for wrapped docks.
- [ ] Preserves standalone `.vor-drawer {`, `.gyro-flyout {`, `.vestibular-dock-content {` blocks tested by `scripts/test_vor_workbench.js`.
- [ ] Canvas tick/axis text uses WCAG AA `#94a3b8` or lighter.

## 5. Tests & Documentation (`scripts/`, `STATUS.md`, `docs/MEMORY.md`)
- [ ] Unit/integration script in `scripts/test_*.js` checks `SKIP_NESTED_BUILD=1` before spawning Vite rebuilds.
- [ ] `scripts/verify_mvp_cdp.js` exercises the controls and calls `auditLayoutGeometry(...)` across all 4 viewports.
- [ ] `npm run verify`, `npm test`, and `npm run test:cdp` exit `0`.
- [ ] Authoritative clinical constants and milestones recorded in `STATUS.md` and `docs/MEMORY.md`.
