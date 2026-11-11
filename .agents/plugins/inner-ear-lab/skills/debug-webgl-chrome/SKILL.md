---
name: debug-webgl-chrome
description: >-
  Attach the repo-local inner-ear-chrome-devtools MCP server to a running Vite dev or preview server
  to inspect WebGL2 DualStageScene and eye_avatar.glb rendering, capture WebP screenshots, debug
  shader compilation or console errors, and profile per-frame GC allocations. Use when debugging
  live rendering, GLSL uniforms, context loss, or memory pressure in Chrome.
---

# Live WebGL2 & Chrome DevTools Debugging

Use `inner-ear-chrome-devtools` (`chrome-devtools-mcp`) against a live local Vite server when static build tests aren't enough to diagnose shader artifacts, missing GLTF/OBJ loads, pointer orbit bugs, or `requestAnimationFrame` GC pressure.

## 1. Ensure Assets & Start Local Server

1. Verify canonical assets are synced (`web/public/assets/iemap/` is gitignored):
   ```bash
   npm run sync:assets
   ```
2. Start the Vite dev server (or preview build on `:4173`):
   ```bash
   npm run dev
   # Expected URL: http://127.0.0.1:5173/
   ```
   If running as a background daemon during a live session, always remember its task ID and stop it when finished (`manage_task` `kill`).

## 2. Inspect Live Scene via `inner-ear-chrome-devtools`

1. Open `http://127.0.0.1:5173/` with `new_page` and note the returned numeric `pageId` (pass `pageId` to `evaluate_script`, `list_console_messages`, `list_network_requests`, and `take_screenshot`), waiting for the 27 IE-Map meshes + `eye_avatar.glb` to finish loading.
2. Check diagnostics first with `list_console_messages` and `list_network_requests`:
   - Confirm zero WebGL shader compile/link warnings (`gate3Materials.ts`) and zero JS exceptions.
   - Confirm zero `404` requests under `/assets/iemap/` (fixes come from running `npm run sync:assets`, never editing `web/public/`; ignore `/favicon.ico` 404 in dev mode if absent).
3. Capture visual verification via MCP `take_screenshot` (pre-configured for compact WebP `maxWidth=1440` with `--headless --isolated`).

## 3. Critical `DualStageScene.ts` WebGL Caveats

- **`preserveDrawingBuffer: false`:** `THREE.WebGLRenderer` intentionally keeps `preserveDrawingBuffer` false for 60fps performance. Calling `canvas.toDataURL()` inside `evaluate_script` between animation frames can return a blank transparent image—always capture pixels with `take_screenshot` or CDP `Page.captureScreenshot`, never `canvas.toDataURL()`.
- **Mirror Culling Flip (`uMirrored`):** When testing left-ear Caloric/vHIT (`scale.x = -1.0`), verify outward faces aren't inside-out by checking both `uMirrored` and `FrontSide`/`BackSide` toggling.
- **Transient Uniform Leakage:** Verify `uCaloricActive`, `uSurgicalDrillActive`, `uTranslocationBreach`, and `uClipActive` drop back to `0.0` immediately after switching back to `Anatomy Atlas`.
- **Context Loss Recovery:** Trigger/verify `webglcontextlost` (`event.preventDefault()`) and `webglcontextrestored` handling in `DualStageScene.ts` if modifying renderer initialization.

## 4. Profiling Frame Allocations & GC Leaks

1. Look for growing heap sawtooth patterns during continuous BPPV playback, Caloric irrigation, or CI auto-insertion.
2. Take baseline and post-animation heap snapshots (server supports memory debugging if enabled, or use Chrome `Performance` / `Memory` tooling) and eliminate any object/Vector3/array/DOM allocations inside `DualStageScene.animate()`, `EyeAvatarEngine.render()`, or `AppHUD.renderProjectedPins()`.
