# Claude Code Project Reference (`CLAUDE.md`)

> **Project:** Inner Ear 3D Lab  
> **Repository:** `radiant-darwin`  
> **Key Frameworks:** Three.js, TypeScript, Vite, Web Audio API, Python 3 / Blender 5.2.1 LTS  
> **Primary Specification:** [`docs/UI_DESIGN_SPEC.md`](file:///Users/umcai/Documents/antigravity/radiant-darwin/docs/UI_DESIGN_SPEC.md)

---

## 1. Quick Reference & Common Commands

```bash
# Web application (Single-Stage Three.js WebGL)
cd web && npm run dev       # Starts Vite dev server on http://localhost:5173
cd web && npm run build     # Compiles TypeScript and builds production bundle in web/dist/
cd web && npm run preview   # Serves web/dist/ for local inspection

# Python Pipeline (Blender & Physics)
python3 src/anatomy/prepare_iemap.py        # Ingests authentic IE-Map meshes and splines
python3 src/physics/epley_simulator.py      # Runs 5-step Stokes gravity sedimentation test
/Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/build_full_video.py  # Render pass
```

---

## 2. Core Architecture & Workflow Rules

1. **Anti-Cockpit Philosophy:**
   - Always protect the 3D stage. Do not add permanent sidebars, telemetry dials, or intrusive popups.
   - Use the **Modal Workbench** system: top header selects Mode (`🧬 Anatomy`, `🎧 Hearing`, `🌀 Vestibular`, `🩻 CT`), and the bottom dock contextually swaps controls.
2. **WebGL Performance Rule:**
   - Keep the render loop in [`web/src/render/DualStageScene.ts`](file:///Users/umcai/Documents/antigravity/radiant-darwin/web/src/render/DualStageScene.ts) lean. No memory allocations or GC pressure inside `requestAnimationFrame`.
   - Update shaders in-place via existing uniforms in [`web/src/render/gate3Materials.ts`](file:///Users/umcai/Documents/antigravity/radiant-darwin/web/src/render/gate3Materials.ts).
3. **Medical Accuracy:**
   - All spatial meshes use Right-Anterior-Superior (RAS) stereotaxic coordinates with origin calibrated at `[4.5, 1.4, 0.5]` mm.
   - Frequency tonotopy follows the Donald D. Greenwood human formula ($A=165.4, a=2.1, k=0.88$).
4. **Permanent Documentation & Memory:**
   - Always record important architectural decisions in [`docs/MEMORY.md`](file:///Users/umcai/Documents/antigravity/radiant-darwin/docs/MEMORY.md).
   - Refer to [`docs/CLINICAL_PILLARS.md`](file:///Users/umcai/Documents/antigravity/radiant-darwin/docs/CLINICAL_PILLARS.md) for clinical and physiological specifications.

---

## 3. Key Source Files

- [`web/src/render/DualStageScene.ts`](file:///Users/umcai/Documents/antigravity/radiant-darwin/web/src/render/DualStageScene.ts): Three.js scene, camera controls, mesh loading, raycasting, and pin projection.
- [`web/src/render/gate3Materials.ts`](file:///Users/umcai/Documents/antigravity/radiant-darwin/web/src/render/gate3Materials.ts): GLSL shaders, rim lighting, ghost translucency, and analytic clipping plane.
- [`web/src/ui/AppHUD.ts`](file:///Users/umcai/Documents/antigravity/radiant-darwin/web/src/ui/AppHUD.ts): Reactive UI manager, search, floating inspector card, and bottom dock.
- [`web/src/data/ontology.ts`](file:///Users/umcai/Documents/antigravity/radiant-darwin/web/src/data/ontology.ts): 27-part anatomy metadata, Latin names, CN VIII innervation, fluid compartments, and clinical pearls.
- [`web/src/physics/epleyPhysics.ts`](file:///Users/umcai/Documents/antigravity/radiant-darwin/web/src/physics/epleyPhysics.ts): 5-step BPPV kinematics and gravity rotation math.
