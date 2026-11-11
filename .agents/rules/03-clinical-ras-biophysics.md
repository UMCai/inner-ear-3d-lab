---
trigger: model_decision
description: "Clinical neurotology, RAS stereotaxic geometry, Greenwood tonotopy, temporal bone MPR, BPPV/vHIT/Caloric VOR physics, and cochlear implant/IAC surgical equations."
---

# Authoritative Clinical & RAS Biophysics Constants

Always cross-check math against the implemented TypeScript/Python engines rather than legacy documentation:

1. **RAS Stereotaxic Coordinate Frame (mm):**
   - Right labyrinth origin calibrated to `[4.5, 1.4, 0.5]` mm; `+X = Right (Lateral)`, `+Y = Anterior`, `+Z = Superior` (`camera.up = [0, 0, 1]`).

2. **Hearing & Tonotopy (`web/src/data/greenwoodEngine.ts`):**
   - Greenwood human formula: $F(x) = 165.4 \cdot (10^{2.1 x} - 0.88)$, spanning `19.848 Hz` (apex) to `20,678.07 Hz` (base) over `28.79 mm` and 100 `COCHLEA_SPLINE_KNOTS`.

3. **Virtual Radiology & SCDS (`web/src/data/radiologyEngine.ts`):**
   - Canonical planes centered around `[4.40, 2.01, -0.31]` mm: Pöschl (`[-9, +9] mm`, default `+1.2 mm`), Stenvers (`[-6, +6] mm` normalized to slider bounds), Axial, Coronal.
   - SCDS third-window defect: `1.5 mm` gap on `ls_Hsapiens_Sa` at `apexRAS = [3.85, 0.45, 4.30]` (`canalRoofApexRAS = [5.72, 1.28, 7.56]`).

4. **Vestibular BPPV & VOR (`web/src/physics/vestibularEngine.ts`, `diagnosticVestibularEngine.ts`):**
   - Stokes sedimentation: stiction `|g_proj| < 0.045`, `maxTerminalVelocityDegPerSec = 48.0`, lumen factors `1.0` (duct) / `0.35` (common crus) / `0.02` (utricle). Steinhausen: `kappa_drag = 2.2 s^-1`, `tau_return = 1.8 s`. Resting CN VIII firing: `90 sp/s` (`[10, 310] sp/s`).
   - Caloric: `T_peak = 35.0 s`, `tau_cupula = 12.0 s`, Alexander `k = 0.40`; Jongkees pathology `UW >= 25%`, `DP >= 30%`, bilateral sum `< 20 deg/s`.
   - vHIT: 5th-order minimum-jerk (`15°`, `120 ms`, peak `250°/s`, peak accel `6544.98°/s²`), Curthoys `40–80 ms` area gain, axes Horizontal `[0, 0, 1]`, RALP `[1/sqrt(2), -1/sqrt(2), 0]`, LARP `[1/sqrt(2), 1/sqrt(2), 0]`.

5. **Surgical Suites (`web/src/physics/surgicalEngine.ts`):**
   - **Cochlear Implant:** `28.0 mm` lateral wall / `21.0 mm` AOS perimodiolar (stylet release at `9.5 mm`), `650°` total spiral, 22 contacts (`1.1 mm` pitch). Optimal `< 15.0 mN` (with `d_BM >= 0.35 mm` and `hypot(pitch, yaw) < 8.0°`); caution when `d_BM < 0.35 mm`, `force >= 15.0 mN` (advisory force constant `28.0 mN`), or total angle `>= 8.0°`; translocation breach when `(force >= 30.0 mN && d_BM < 0.1 mm)` or `(pitch deviation >= 15.0° && depth >= 8.0 mm)`.
   - **Labyrinthectomy:** `70,000 RPM` drill, acute `SPV = 36.0°/s`, central compensation `SPV(t) = SPV_acute * exp(-t / 72.0 h)`.
   - **IAC Neurectomy:** `"7-up, Coke down"` 4-quadrant fundus, ABR baseline `5.7 ms` / `0.55 uV`, facial EMG alarm `>= 500.0 uV`.
