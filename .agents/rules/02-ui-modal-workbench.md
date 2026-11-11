---
trigger: glob
globs: "**/web/src/ui/**, **/web/src/style.css, **/web/index.html"
---

# Modal Workbench UI, Exclusivity & Responsive HUD Rules

1. **Anti-Cockpit 3D Stage Budget (`>= 85%` Resting Canvas):**
   - Never add persistent sidebars or docked telemetry chrome that reduces unobstructed resting 3D stage below `85%` across Desktop (`1440×900`, `1280×800`), Tablet (`768×1024`), and Mobile (`390×844`).
   - Verify no horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`) and zero overlap between `#inspector-card`, `.bottom-viz-bar`, open drawers, and `#gyro-flyout`.

2. **Strict 5-Drawer + Gyro Flyout Mutual Exclusivity:**
   - Keep `#parts-drawer`, `#audiogram-drawer`, `#ct-slice-drawer`, `#vor-drawer`, `#surgical-drawer`, and `#gyro-flyout` mutually exclusive across mode switches and drawer toggles.
   - Sync toggle chevron glyphs (`'▸'` collapsed, `'▾'` expanded) on every open/close path.
   - On mobile (`<= 640px`), toggle `.drawer-active` when any drawer or `#gyro-flyout` opens so `#inspector-card` is suppressed cleanly.

3. **Dynamic Dock Clearance & CSS Test Contracts:**
   - Maintain `syncDockClearance()` (`ResizeObserver` on `.bottom-viz-bar`) updating `--dock-clearance` on `#app` across mode, submode, procedure, and viewport changes.
   - Preserve standalone `.vor-drawer {`, `.gyro-flyout {`, and `.vestibular-dock-content {` CSS rule blocks (string-asserted by `scripts/test_vor_workbench.js`).

4. **Zero-Allocation Telemetry, Touch Forwarding & Accessibility:**
   - Update high-frequency vestibular/surgical readouts by mutating `.textContent` / `.style.width` on cached elements—never rebuild `innerHTML` per frame, and stop drawer `requestAnimationFrame` loops when closed.
   - Keep `.projected-pin` pointer forwarding (`pointerdown`, `pointermove`, `pointerup`, `pointercancel` with `pageX`/`pageY`) intact for `OrbitControls`.
   - Preserve `viewport-fit=cover`, `env(safe-area-inset-*)`, WCAG AA contrast (`#94a3b8`+ on dark canvases), and stable DOM IDs tested by `scripts/verify_mvp_cdp.js`.
   - Consult the `modern-web-guidance` skill before non-trivial DOM, popover, or responsive CSS layout changes.
