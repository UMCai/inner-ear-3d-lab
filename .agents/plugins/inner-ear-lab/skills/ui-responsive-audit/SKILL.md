---
name: ui-responsive-audit
description: >-
  Audit responsive layout, Anti-Cockpit 3D canvas area (>= 85%), dock clearance, mutual drawer
  exclusivity, safe-area insets, and modern CSS compliance across desktop, tablet, and mobile in
  inner-ear-3d-lab. Use when modifying AppHUD.ts, drawer UIs, or web/src/style.css.
---

# Responsive Multi-Viewport HUD & Layout Audit

Verify that all 5 clinical modes, unified `#note-sidebar` states (`collapsed` → `compact` → `expanded` `[Note | Lab]` → `wide-read`), 5 `#sidebar-pane-lab` drawers, `#gyro-flyout`, `#settings-popover`, and `<dialog id="report-dialog">` obey Anti-Cockpit layout invariants across all 4 viewports in both Dark Glassroom and Light Paper-Technical themes.

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
- `0` bounding-box overlaps across `.lab-header`, `.bottom-viz-bar`, `#note-sidebar`, and `#gyro-flyout`.
- Unobstructed resting 3D stage area `>= 85%` in Anatomy resting view (`#note-collapsed-pill` / `#note-sidebar[data-note-state="collapsed"]`).
- `0` console errors or uncaught page exceptions across Anatomy, Hearing, Radiology, Vestibular (BPPV/Caloric/vHIT), and Surgical Suites.

## 2. CSS & DOM Regression Checklist

- **Dynamic Dock Clearance & Framing:** Whenever `.bottom-viz-bar` wraps into multi-row toolbars or `#note-sidebar` expands (`expanded` / `wide-read`), verify `syncDockClearance()` updates `--dock-clearance`, `--stage-left-gutter` / `--dock-shift-x` shift the dock cleanly, and `scene.setStageFraming(...)` shifts the 3D ear away from covered regions.
- **Native `<details>` & Popover Timing:** Allow ~40 ms after `.click()` on `#further-read-details > summary` for native `toggle` events before inspecting `data-wide-read`, and wait ~320 ms after switching into widened modes so `--dock-shift-x` transitions finish before measuring geometry.
- **Test String Contracts:** Keep `.vor-drawer {`, `.gyro-flyout {`, and `.vestibular-dock-content {` intact (`scripts/test_vor_workbench.js`).
- **Modern Web Guidance:** When introducing non-trivial CSS layout changes (popover/modal/container queries/scroll-contained panels), also invoke the `modern-web-guidance` skill for current browser compatibility patterns.
- **Visual Inspection:** Inspect generated PNGs under `$TMPDIR/inner-ear-cdp/` including `mvp_light_theme_desktop.png` (never modify tracked `output/*.png` unless running `--update-baselines`).
