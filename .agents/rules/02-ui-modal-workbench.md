---
trigger: glob
globs: "**/web/src/ui/**, **/web/src/style.css, **/web/index.html"
---

# Modal Workbench UI, Dual Polarity & Responsive HUD Rules

1. **Anti-Cockpit 3D Stage Budget (`>= 85%` Resting Canvas):**
   - Preserve the unified left-hand `#note-sidebar` (`collapsed` pill → `compact` preview → `expanded` `[Note | Lab]` reader → `wide-read` via `<details id="further-read-details">`; bottom reader sheet on `<= 720px`) without re-introducing persistent sidebars or right-edge strips.
   - Resting unobstructed 3D stage must remain `>= 85%` across Desktop (`1440×900`, `1280×800`), Tablet (`768×1024`), and Mobile (`390×844`), with `document.documentElement.scrollWidth <= window.innerWidth` and zero bounding-box overlap across `.lab-header`, `.bottom-viz-bar`, `#note-sidebar`, and `#gyro-flyout`.

2. **Strict Mutual Exclusivity & Dual-Theme Polarity (`AppHUD.ts`, `hudChrome.ts`):**
   - Keep `#parts-drawer`, `#audiogram-drawer`, `#ct-slice-drawer`, `#vor-drawer`, and `#surgical-drawer` mutually exclusive inside `#sidebar-pane-lab`, and mutually exclusive with `#gyro-flyout` and expanded `#note-sidebar` (`openGyroFlyout()` collapses `expanded` → `compact`; `setNoteState()` closes active lab drawers when leaving `'expanded'` / `'lab'`).
   - Support both Dark Glassroom (`data-theme="dark"`) and Light Paper-Technical (`data-theme="light"`) via `color-scheme` + `light-dark()` tokens, `#settings-popover` (`[popover="auto"]`), and native `<dialog id="report-dialog">`.
   - Sync toggle chevron glyphs (`'▸'` collapsed, `'▾'` expanded) on every open/close path and allow async `<details>` `toggle` events (~40 ms in tests).

3. **Dynamic Stage Framing, Dock Clearance & CSS Test Contracts:**
   - Maintain `syncDockClearance()` (`ResizeObserver` on `.bottom-viz-bar` updating `--dock-clearance`), `--stage-left-gutter` / `--dock-shift-x` clearance, and `scene.setStageFraming(...)` camera `setViewOffset` shifts across mode, submode, sidebar state, and viewport changes.
   - Preserve standalone `.vor-drawer {`, `.gyro-flyout {`, and `.vestibular-dock-content {` CSS rule blocks (string-asserted by `scripts/test_vor_workbench.js`).

4. **Zero-Allocation Telemetry, Touch Forwarding & Accessibility:**
   - Update high-frequency vestibular/surgical readouts by mutating `.textContent` / `.style.width` on cached elements—never rebuild `innerHTML` per frame, and stop drawer `requestAnimationFrame` loops when collapsed or when `#sidebar-pane-lab` is hidden.
   - Keep `.projected-pin` pointer forwarding (`pointerdown`, `pointermove`, `pointerup`, `pointercancel` with `pageX`/`pageY`) and keep-out zone decluttering intact for `OrbitControls`.
   - Preserve `viewport-fit=cover`, `env(safe-area-inset-*)`, WCAG AA contrast (`#94a3b8`+ on dark canvases, deep ink/teal on light paper), and stable DOM IDs tested by `scripts/verify_mvp_cdp.js`.
   - Keep `web/showcase.html` and `web/src/showcase/*` compiling cleanly alongside production `web/index.html`.
   - Consult the `modern-web-guidance` skill before non-trivial DOM, popover, or responsive CSS layout changes.
