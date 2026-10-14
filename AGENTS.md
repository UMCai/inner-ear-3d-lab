# AI Agent Guidelines (`AGENTS.md`)

> **Project:** Inner Ear 3D Lab (Gate 3 Medaium)  
> **Repository:** `radiant-darwin`  
> **Scope:** WebGL 3D Anatomy & Clinical Simulation Platform  
> **Tech Stack:** TypeScript, Three.js, Vite, Web Audio API, Python 3, Blender 5.2.1 LTS

---

## 1. Core Directives for All AI Agents

When contributing to this repository, you must adhere to these non-negotiable principles:

1. **Preserve the "Zero-Clutter / Anti-Cockpit" UI:**
   - Never add persistent telemetry sidebars, nested sub-windows, or fixed toolbars that steal space from the 3D canvas.
   - All new features must conform to the **"Modal Workbench"** paradigm outlined in [`docs/UI_DESIGN_SPEC.md`](file:///Users/umcai/Documents/antigravity/radiant-darwin/docs/UI_DESIGN_SPEC.md). The 3D stage commands 85%+ of the screen.
2. **Maintain 60fps WebGL Performance:**
   - Never instantiate new geometries, materials, or large object allocations inside the `requestAnimationFrame` render loop.
   - Do not perform CPU-based mesh slicing; utilize the analytic GPU shader clipping uniforms in [`web/src/render/gate3Materials.ts`](file:///Users/umcai/Documents/antigravity/radiant-darwin/web/src/render/gate3Materials.ts).
3. **Medical & Anatomical Rigor:**
   - All spatial calculations must respect the Right-Anterior-Superior (RAS) stereotaxic coordinate frame in millimeters.
   - Ensure medical copy adheres to authoritative otologic and neurotologic standards (e.g., Greenwood frequency function, Ewald's laws, Stokes gravity sedimentation).
4. **Zero External Audio Bloat:**
   - Synthesize tones dynamically using native browser Web Audio oscillators (`AudioContext`). Never commit large multi-megabyte static sound files.

---

## 2. Repository Layout & Module Boundaries

| Directory | Primary Technology | Responsibility |
| :--- | :--- | :--- |
| `web/src/render/` | Three.js, GLSL Shaders | Single-stage canvas renderer, camera tweening, occlusion-aware pins, custom Gate 3 shaders. |
| `web/src/ui/` | TypeScript, Vanilla DOM | Responsive HUD, search bar, floating inspector, contextual bottom workbench, modal sheets. |
| `web/src/data/` | TypeScript | 27-part anatomical ontology, morphometry, Latin terms, OBJ buffer loaders, Slicer markups. |
| `web/src/physics/`| TypeScript | BPPV canalithiasis kinematics, Epley/Gufoni step presets, gravity rotation matrices. |
| `assets/iemap/` | OBJ, VTK, GLB, JSON | 27 authentic IE-Map v1.0.0 meshes, smooth canal splines, and Slicer fiducials. |
| `docs/` | Markdown | UI design specifications, clinical expansion pillars, memory, and ADRs. |
| `src/` & `scripts/`| Python 3, Blender | Headless Blender render pipeline for Gate 3 editorial video generation. |

---

## 3. TypeScript & Three.js Coding Standards

### TypeScript
- Use strict typing. Avoid `any` at all costs. Define precise interfaces for scene snapshots, presets, and uniforms.
- Keep components modular. Separate rendering concerns (`DualStageScene.ts`) from DOM/HUD management (`AppHUD.ts`).

### Three.js Best Practices
- **Shared Geometries & Buffers:** Cache parsed OBJ buffers via `objLoader.ts`. Do not duplicate geometry across state changes.
- **Shader Uniform Updates:** Update material uniforms in-place via `.value` mutation rather than re-creating shader materials:
  ```typescript
  material.uniforms.uOpacity.value = targetOpacity;
  material.uniforms.uHighlight.value = isHovered ? 1.0 : 0.0;
  ```
- **Disposal:** If meshes or textures are dynamically detached, call `.dispose()` on geometry and materials to prevent WebGL context memory leaks.

### Web Audio API Guidelines
- Instantiate a single, shared `AudioContext` lazily on first user interaction (pointerdown / click) to comply with browser autoplay policies:
  ```typescript
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  ```
- Always apply an exponential or linear ramp on the `GainNode` to prevent audible speaker clicks/pops during tone start and stop:
  ```typescript
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(targetGain, now + 0.05);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  ```

---

## 4. Build, Development & Verification Commands

```bash
# 1. Start Web Development Server (Vite @ http://127.0.0.1:5173/)
cd web && npm run dev

# 2. Compile & Validate Web TypeScript Bundle (Must pass with 0 errors)
cd web && npm run build

# 3. Preview Production Web Build
cd web && npm run preview

# 4. (Optional) Run Blender Headless Video Render Pass
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/build_full_video.py

# 5. (Optional) Run Python BPPV Physics Self-Test
python3 src/physics/epley_simulator.py
```

---

## 5. Verification Checklist for Changes

Before finalizing any task, verify:
- [ ] `cd web && npm run build` completes cleanly with **0 TypeScript and Vite errors**.
- [ ] Responsive layout remains unbroken across desktop (`1440×900`), tablet (`768×1024`), and mobile (`390×844`).
- [ ] 3D canvas maintains 60fps orbit/pan/zoom responsiveness.
- [ ] No regression in core anatomy tools (search bar, bone peeling slider, exploded view slider, 27-parts drawer).
- [ ] [`docs/MEMORY.md`](file:///Users/umcai/Documents/antigravity/radiant-darwin/docs/MEMORY.md) and [`STATUS.md`](file:///Users/umcai/Documents/antigravity/radiant-darwin/STATUS.md) are updated if new milestones or architectural changes occur.
