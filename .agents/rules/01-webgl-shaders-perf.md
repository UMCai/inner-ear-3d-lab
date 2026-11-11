---
trigger: glob
globs: "**/web/src/render/**, **/web/src/physics/**, **/web/src/audio/**, **/web/src/data/**"
---

# WebGL Shaders, Zero-GC Loops & Node-Safe Runtime Rules

1. **Zero Heap Allocations Inside `requestAnimationFrame`:**
   - In [`DualStageScene.ts`](../../web/src/render/DualStageScene.ts) and [`eyeAvatar.ts`](../../web/src/render/eyeAvatar.ts), never allocate `THREE.Vector3`, `THREE.Quaternion`, arrays (`.map`, `.filter`), `Set`, DOM nodes, or spread objects (`{ ... }`) inside active render or physics ticks.
   - Reuse pre-allocated scratch buffers: `scratchPinVector`, `tempNDC`, `pinCandidates`, `activeCandidates`, `qVHITTmp`, `ciCenterPointsTmp`, `scratchSample` / `particleScratchSample`, `NystagmogramRingBuffer` (`Float32Array(600)`), and `VHITImpulseBuffer` (`Float32Array(350)`).

2. **GPU Shader Uniform Discipline (`gate3Materials.ts`):**
   - Never rebuild `ShaderMaterial` per frame or mode switch; mutate `.uniforms.<name>.value` in-place.
   - Drive cross-sections strictly via analytic GPU clipping (`uClipActive`, `uClipNormal`, `uClipConstant`), never CPU geometry booleans.
   - When mirroring laterality (`labyrinthRoot.scale.x = -1.0`), update `uMirrored` and swap `THREE.FrontSide`/`THREE.BackSide` culling synchronously.
   - Reset transient mode uniforms (`uTonotopyMode`, `uLossMaskActive`, `uClipActive`, `uCaloricActive`, `uSurgicalDrillActive`, `uTranslocationBreach`) when leaving their mode.

3. **Node ESM Test Compatibility:**
   - `web/src/data/*`, `web/src/physics/*`, and top-level `web/src/render/eyeAvatar.ts` are imported directly by `node scripts/test_*.js` without a DOM. Never execute unguarded `window`, `document`, or `localStorage` calls at module top level.
   - `objLoader.ts` parses fetched OBJ text into `THREE.BufferGeometry` on demand (no IndexedDB cache); `canalPaths.ts` caches loaded canal splines in memory.

4. **WebGL Lifecycle & Web Audio Safety:**
   - Preserve `webglcontextlost` (`event.preventDefault()`) / `webglcontextrestored` listeners and full `.dispose()` cleanup across geometries, materials, OrbitControls, and pointer handlers.
   - Route all Web Audio in [`ToneSynthesizer.ts`](../../web/src/audio/ToneSynthesizer.ts) through `masterGain -> safetyLimiter -> destination` with exponential ramps from `GAIN_FLOOR = 0.0001` and `osc.stop(...)` + disconnect on `onended`.
