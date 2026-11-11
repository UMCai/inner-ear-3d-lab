# UI/UX Design Specification: The "Modal Workbench" Paradigm

> **Project:** Inner Ear 3D Lab  
> **Status:** Active Implemented Architecture Spec (5 Modes)  
> **Target Audiences:** Medical Students, Otolaryngology (ENT) Residents, Neurology Residents, Audiologists  
> **Core Principle:** Laser-focused, zero-clutter 3D stage with contextual workbenches (Anti-Cockpit Design).

---

## 1. Design Vision & Anti-Cockpit Philosophy

Traditional medical and surgical software often falls into the **"Cockpit Trap"**: crowding the viewport with 50 permanent buttons, multiple persistent telemetry readouts, sidebars, dials, and nested sub-windows. This overwhelms students, exhausts residents, and shrinks the actual 3D model into a secondary box.

Our design philosophy enforces **Strict Simplicity Through Contextual Workbenches**:
1. **The 3D Stage is King (`>= 85%` Resting Canvas Area):** The authentic 27-mesh inner ear labyrinth is always the primary visual anchor across desktop (`1440×900`, `1280×800`), tablet (`768×1024`), and mobile (`390×844`). It is never obscured by permanent sidebars.
2. **One Cognitive Task at a Time:** Controls swap contextually inside Zone 4 when changing the active **Mode** or submode.
3. **Progressive Disclosure & Strict Mutual Exclusivity:** Detailed drawers (`#parts-drawer`, `#audiogram-drawer`, `#ct-slice-drawer`, `#vor-drawer`, `#surgical-drawer`, and `#gyro-flyout`) open on demand and enforce 1-at-a-time mutual exclusivity. On mobile (`<= 640px`), opening any drawer or flyout suppresses the floating inspector via `.drawer-active`.

---

## 2. Layout Structure & Zone Architecture

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ZONE 1: MINIMAL TOP HEADER                                                                                    │
│ [IE-MAP 3D] Inner Ear 3D Lab  [ 🏛️ Anatomy Atlas │ 🎵 Hearing │ 🩻 Virtual Radiology │ 🌀 Vestibular │ 🔬 Surgical ] [🔍] [⚙️] │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ZONE 2: FULL-BLEED 3D STAGE (Three.js WebGL2 60fps, z-index: 0)                                               │
│                                                                                                               │
│   ┌──────────────────────────┐                                                                                │
│   │ ZONE 3: FLOATING         │                                                                                │
│   │ PART INSPECTOR CARD      │                    [ 3D Labyrinth Center Stage ]                               │
│   │ (top-left, dismissible)  │                                                     ┌────────────────────────┐ │
│   └──────────────────────────┘                                                     │ Mutually Exclusive     │ │
│                                                                                    │ Bottom-Right Drawer /  │ │
│                                                                                    │ #gyro-flyout Zone      │ │
├────────────────────────────────────────────────────────────────────────────────────┴────────────────────────┴─┤
│ ZONE 4: CONTEXTUAL BOTTOM WORKBENCH DOCK (ResizeObserver syncs --dock-clearance)                              │
│ [ Context-aware mode subnavs, presets, sliders, and drawer toggles tailored to the active Mode ]              │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Zone Detailed Specifications

### Zone 1: Minimal Top Header (`height: 52px` desktop / `48px` tablet & mobile)
- **Brand Cluster (Left):**
  - Pill badge: `IE-MAP 3D`.
  - Title: `Inner Ear 3D Lab`.
  - Subtitle: `27-Part Anatomy Atlas`.
- **Mode Switcher (Center / Primary Navigation):**
  - Segmented pill container (`role="tablist"`) with **5 implemented modes**:
    1. `🏛️ Anatomy Atlas` (`#mode-anatomy-btn`): 27-part structural atlas, bone peeling, exploded view.
    2. `🎵 Hearing & Tonotopy` (`#mode-hearing-btn`): Greenwood frequency mapping (`20 Hz–20.7 kHz`), Web Audio synthesizer, interactive audiogram.
    3. `🩻 Virtual Radiology` (`#mode-radiology-btn`): Multiplanar reformatting (Pöschl, Stenvers, Axial, Coronal) and SCDS third-window simulation using analytic shader clipping.
    4. `🌀 Vestibular & VOR` (`#mode-vestibular-btn`): Unified vestibular lab with `BPPV` maneuvers, `Caloric` thermal convection + Jongkees calculator, and `vHIT` Curthoys head-impulse suite paired with the 3D Eye VOR drawer.
    5. `🔬 Surgical Suites` (`#mode-surgical-btn`): Cochlear implant insertion kinematics (`28.0 mm`, AOS perimodiolar, scalar translocation guard), transmastoid labyrinthectomy compensation ODE, and retrosigmoid IAC neurectomy with ABR/EMG neuro-monitoring.
- **Search & Settings (Right):**
  - Global part search input (`#search-input`, `🔍 Find an ear part...`) with keyboard navigation (`↑`/`↓`/`Enter`).
  - Single `⚙️` Settings button (`#settings-btn`) triggering `#settings-popover` (3D Labels `Off`/`Key`/`All`, Reading depth `Simple`/`Detailed`, master mute/volume, `About & Citations` modal).

---

### Zone 2: Full-Bleed 3D Stage (`100%` Viewport Area)
- **Zero Fixed Padding:** Canvas runs behind all floating chrome (`z-index: 0`).
- **Camera Dynamics:** OrbitControls with damping (`0.05`) and smooth fly-to camera tweens per preset, structure, radiology plane, maneuver, and surgical approach.
- **Occlusion-Aware 2D Pins Layer (`#pins-layer`):** Projected HTML pins with pointer capture forwarding to the WebGL canvas so touch/mouse orbiting never locks up over pins.

---

### Zone 3: Floating Part Inspector Card (`#inspector-card`)
- **Behavior:** Pinned upper-left below header, bounded dynamically above `--dock-clearance` so it never collides with Zone 4 regardless of dock wrapping height. Dismissible via `#inspector-close-btn`.
- **Content Hierarchy:** Category pill badge, English structure name, plain/detailed summary, `[ Isolate Part ]` + `[ Reset View ]` actions, mode-specific telemetry badges (fluid compartment, Greenwood frequency band, live CN VIII firing rate / Ewald law / clearance), and expandable `Medical Details` accordion (Latin term, CN VIII innervation, morphometry, clinical pearl).

---

### Zone 4: Contextual Bottom Workbench Dock (`.bottom-viz-bar`)
Dynamic `ResizeObserver` on `.bottom-viz-bar` updates `--dock-clearance` on `#app` so `#inspector-card`, all 5 modal drawers, and `#gyro-flyout` always clear the bottom dock cleanly across all viewports.

#### Dock State A: `🏛️ Anatomy Atlas`
- Preset chips (`Overview`, `Balance System`, `Hearing Snail`, `Exploded View`), `Outer Bone Shell` opacity slider, `Separate Parts` explode slider, and `[ ▸ Browse All 27 Parts ]` (`#parts-drawer`).

#### Dock State B: `🎵 Hearing & Tonotopy`
- Live logarithmic tone frequency slider (`20 Hz–20.7 kHz`), octave jump chips, Web Audio play/mute toggle, landmark badge, and `[ Interactive Audiogram ▾ ]` (`#audiogram-drawer`).

#### Dock State C: `🩻 Virtual Radiology`
- Plane selector (`Pöschl's (SSCD)`, `Stenvers' (Arch)`, `True Axial`, `True Coronal`), depth scrubber slider (e.g. `[-9, +9] mm` for Pöschl), anatomical landmark readout, flip-cut toggle, guide-plane toggle, SCDS scenario toggle, and `[ 2D CT Card ▾ ]` (`#ct-slice-drawer`).

#### Dock State D: `🌀 Vestibular & VOR`
- Subnav tabs (`🌀 BPPV` │ `🌡️ Caloric` │ `⚡ vHIT`):
  - **BPPV:** 6 clinical maneuvers (`Epley`, `Semont`, `Gufoni Geotropic`, `Gufoni Apogeotropic`, `Barbecue Roll`, `Yacovino`), step scrubber, hold countdown, play sequencer, `[ 🧭 3-Axis Gyro ]` (`#gyro-flyout`), crystal reset, and `[ 👁️ 3D VOR & VNG ▾ ]` (`#vor-drawer`).
  - **Caloric:** Right/Left `44°C / 30°C / 4°C` irrigations, Supine `+30°`, 40s countdown timer, Alexander gaze chips (`-30°`, `0°`, `+30°`), Jongkees UW%/DP% modal, and Claussen butterfly vestibulogram in `#vor-drawer`.
  - **vHIT:** `Horizontal` / `RALP` / `LARP` pairs, Left/Right direction, pathology presets, `HIMP`/`SHIMP`, slippage toggle, `Deliver Thrust`, and dual-trace 40–80 ms Curthoys plot in `#vor-drawer`.

#### Dock State E: `🔬 Surgical Suites`
- Subnav tabs (`Cochlear Implant`, `Labyrinthectomy`, `IAC Neurectomy`):
  - **CI:** `Lateral Wall` (`0–28.0 mm`) vs `Perimodiolar AOS` (`0–21.0 mm`), RW vs cochleostomy, depth/pitch/yaw controls, motorized auto-insertion, and `[ Endoscopy & Force ▾ ]` (`#surgical-drawer`).
  - **Labyrinthectomy:** 4 surgical resection steps, 70k RPM drill whine toggle, post-op central compensation timeline (`0–720 h`, $\tau = 72\text{ h}$).
  - **Neurectomy:** Koos tumor stages `0–IV`, traction force slider, cleavage plane toggle, EMG audio alarm, ABR Wave V & CN VII telemetry in `#surgical-drawer`.

---

## 4. Visual Identity & Design Tokens

| Token | Value | Clinical / Visual Purpose |
| :--- | :--- | :--- |
| `--bg-base` | `#071014` | Deep medical charcoal background for maximum 3D contrast. |
| `--panel-bg` | `rgba(13, 22, 28, 0.82)` | Frosted acrylic HUD panels (`backdrop-filter: blur(16px)`). |
| `--panel-border` | `rgba(82, 220, 242, 0.18)` | Subtle cyan boundary hairline. |
| `--accent-cyan` | `#52dcf2` | Active selection & clinical navigation highlight. |
| `--accent-warm` | `#f0aa62` | Otolith / warning / clinical pearl contrast accent. |
| `--text-primary` | `#f0f4f8` | High-contrast clinical typography (`Inter`). |
| `--text-muted` | `#8a9ba8` / `#94a3b8` (canvas ticks) | Secondary metadata & WCAG AA canvas axis labels. |
| `--dock-clearance` | Dynamic JS `px` | Computed bottom inset so drawers & inspector never collide with multi-row docks. |

---

## 5. Responsive Breakpoints & Anti-Overlap Contract

1. **Desktop (`1440×900`, `1280×800`):** Full labeled header pills, left inspector (`360px`), centered bottom dock (`<= 1340px`), right-docked modal drawers and `#gyro-flyout`.
2. **Tablet Portrait (`768×1024`):** Wrapped dock controls with bounded inspector width (`min(320px, calc(44vw - 16px))`) and right drawer width (`min(360px, calc(56vw - 20px))`) guaranteeing zero left/right collision when both are open.
3. **Mobile Handset (`390×844`):** `viewport-fit=cover` + `env(safe-area-inset-*)`, compact scrollable mode tabs, full-width bottom sheets bounded above `--dock-clearance`, horizontal scroll guard on multi-row surgical controls, and `.drawer-active` suppression of `#inspector-card`.
