---
name: verify-clinical-sim
description: >-
  Run targeted fast-loop TypeScript, Node ESM, Python physics, or full headless Chrome CDP release
  verification across inner-ear-3d-lab without redundant builds or dirty screenshot diffs. Use when
  verifying edits to physics engines, shaders, HUD layouts, canal splines, or before finishing work.
---

# Verify Clinical Simulation & Repo Build

Use this two-tier verification ladder so inner-loop iterations stay seconds-fast while release checks prove end-to-end correctness.

## 1. Domain-to-Test Selector

Run only the affected domain script during active edits, then escalate to `npm run verify` / `npm test`:

| Area Modified | Fast Targeted Command |
| :--- | :--- |
| TypeScript syntax / types | `npm run typecheck` |
| Cochlea / Greenwood / Tonotopy | `SKIP_NESTED_BUILD=1 node scripts/test_hearing_engine.js` |
| Radiology MPR planes / SCDS | `SKIP_NESTED_BUILD=1 node scripts/test_radiology_engine.js` |
| BPPV multi-canal physics | `SKIP_NESTED_BUILD=1 node scripts/test_vestibular_engine.js` |
| 3D Eye Avatar / Listing's VOR | `SKIP_NESTED_BUILD=1 node scripts/test_eye_avatar_vor.js` |
| VOR Drawer / Gyro / Exclusivity | `SKIP_NESTED_BUILD=1 node scripts/test_vor_workbench.js` |
| Caloric COWS / Jongkees / vHIT | `SKIP_NESTED_BUILD=1 node scripts/test_diagnostic_vestibular.js` |
| Surgical CI / Lab / Neurectomy | `SKIP_NESTED_BUILD=1 node scripts/test_surgical_engine.js` |
| Canal JSON splines / Epley py | `npm run test:python` |
| All Node suites (no rebuilds) | `bash .agents/plugins/inner-ear-lab/skills/verify-clinical-sim/scripts/verify_fast.sh` or `npm run verify` |

## 2. Fast Pre-Check Helper Script

Execute [verify_fast.sh](./scripts/verify_fast.sh) (optionally pass a domain token: `hearing`, `radiology`, `vestibular`, `eye`, `workbench`, `diagnostic`, `surgical`, `python`):

```bash
bash .agents/plugins/inner-ear-lab/skills/verify-clinical-sim/scripts/verify_fast.sh
bash .agents/plugins/inner-ear-lab/skills/verify-clinical-sim/scripts/verify_fast.sh surgical
```

## 3. Full Release & Multi-Viewport CDP Audit

Before finalizing changes that touch UI, WebGL shaders, shaders uniforms, audio, or assets:

1. Sync canonical IE-Map assets if modified: `npm run sync:assets`
2. Run unified check + production Vite build: `npm run verify`
3. Run built integration suite (392 assertions): `npm test`
4. Run 4-viewport headless Chrome CDP + geometric overlap audit:
   ```bash
   npm run test:cdp
   ```
   - By default `scripts/verify_mvp_cdp.js` writes screenshots into OS temp (`tmpdir()/inner-ear-cdp`) so tracked `output/*.png` files stay clean in `git status`.
   - Pass `--update-baselines` (`node scripts/verify_mvp_cdp.js --update-baselines`) **only** when intentionally updating tracked visual baselines in `output/`.

## 4. Expected Pass Criteria

- `npm run typecheck`: exits `0` with 0 TS errors (`noUnusedLocals` / `noUnusedParameters` enabled).
- `npm test`: exits `0`, `7/7` Node suites (`392` assertions) passing.
- `npm run test:python`: all canal clearance checks and 5-step Epley kinematics pass.
- `npm run test:cdp`: exits `0`, zero console errors across `1440×900`, `1280×800`, `768×1024`, `390×844`, `0 overlaps`, `scrollWidth <= vw`, and `>= 85%` resting 3D stage area.
