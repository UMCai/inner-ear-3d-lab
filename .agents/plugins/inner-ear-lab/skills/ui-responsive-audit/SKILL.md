---
name: ui-responsive-audit
description: >-
  Audit responsive layout, Anti-Cockpit 3D canvas area (>= 85%), dock clearance, mutual drawer
  exclusivity, safe-area insets, and modern CSS compliance across desktop, tablet, and mobile in
  inner-ear-3d-lab. Use when modifying AppHUD.ts, drawer UIs, or web/src/style.css.
---

# Responsive Multi-Viewport HUD & Layout Audit

Verify that all 5 clinical modes and 6 modal overlays (`#parts-drawer`, `#audiogram-drawer`, `#ct-slice-drawer`, `#vor-drawer`, `#surgical-drawer`, `#gyro-flyout`) obey Anti-Cockpit layout invariants across all 4 viewports.

## 1. Automated 4-Viewport Geometric Audit

Run the upgraded production CDP harness (builds first if stale):
```bash
npm run build && npm run test:cdp
```

The harness validates these viewports in headless Chrome:
1. **Desktop High-Res:** `1440×900`
2. **Desktop Standard:** `1280×800`
3. **Tablet Portrait:** `768×1024`
4. **Mobile Handset:** `390×844`

Per-viewport assertions checked by `auditLayoutGeometry()`:
- `document.documentElement.scrollWidth <= window.innerWidth` (no horizontal overflow).
- `0` bounding-box overlaps between `.lab-header`, `.bottom-viz-bar`, `#inspector-card`, open `.open` drawers, and `#gyro-flyout`.
- Unobstructed resting 3D stage area `>= 85%` in Anatomy resting view.
- `0` console errors or uncaught page exceptions across Anatomy, Hearing, Radiology, Vestibular (BPPV/Caloric/vHIT), and Surgical Suites.

## 2. CSS & DOM Regression Checklist

- **Dynamic Dock Clearance:** Whenever `.bottom-viz-bar` wraps into multi-row toolbars (especially Tablet `768×1024` and Mobile `390×844` in Vestibular/Surgical modes), verify `syncDockClearance()` updates `--dock-clearance` on `#app` so drawers and `#inspector-card` remain bounded above the dock.
- **Tablet Narrow Split (`<= 960px`):** Keep `#inspector-card` left width + open right-side drawer width (`audiogram`, `ct-slice`, `vor`, `surgical`, `gyro-flyout`) within `calc(100vw - margin)` with at least `8px` horizontal separation.
- **Test String Contracts:** Keep `.vor-drawer {`, `.gyro-flyout {`, and `.vestibular-dock-content {` intact (`scripts/test_vor_workbench.js`).
- **Modern Web Guidance:** When introducing non-trivial CSS layout changes (popover/modal/container queries/scroll-contained panels), also invoke the `modern-web-guidance` skill for current browser compatibility patterns.
- **Visual Inspection:** Inspect generated PNGs under `$TMPDIR/inner-ear-cdp/` (never modify tracked `output/*.png` unless running `--update-baselines`).
