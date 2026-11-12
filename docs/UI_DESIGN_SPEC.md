# UI/UX Design Specification: Dual-Theme Editorial Specimen & Modal Workbench

> **Project:** Inner Ear 3D Lab  
> **Status:** Active Implemented Phase 2 Architecture (`web/index.html`, `AppHUD.ts`, `hudChrome.ts`, `DualStageScene.ts`) + Phase 1 Showcase (`web/showcase.html`)  
> **Target Audiences:** Medical Students, Otolaryngology (ENT) Residents, Neurology Residents, Audiologists  
> **Core Principle:** Full-bleed AgX specimen stage (`>= 85%` resting area) paired with one unified expandable `#note-sidebar` and contextual bottom workbenches (Anti-Cockpit Design).

---

## 1. Design Vision & Anti-Cockpit Philosophy

Traditional medical and surgical software falls into the **"Cockpit Trap"**: crowding the viewport with persistent multi-corner telemetry cards, fixed sidebars, dials, and overlapping windows. Phase 2 consolidates all narrative reading and clinical plots into a **single left-hand expandable container (`#note-sidebar`)** backed by dual-polarity **Dark Glassroom** (`#0a1016` obsidian frosted glass) and **Light Paper-Technical** (`#f5f5f3` drafting surface with corner L-brackets):

1. **The 3D Stage is King (`>= 85%` Resting Canvas Area):** Verified at `91.0%` (`1440×900`), `89.4%` (`1280×800`), `85.9%` (`768×1024`), and `86.7%` (`390×844`) with zero horizontal overflow or overlaps.
2. **One Cognitive Task at a Time:** Controls swap contextually inside `#bottom-bar` when switching clinical modes or vestibular/surgical subviews.
3. **One-Side Progressive Disclosure & Strict Mutual Exclusivity:**
   - `#note-sidebar` progresses cleanly across `collapsed` pill (`#note-collapsed-pill`) → `compact` preview card → `expanded` (`388px` `[ Note | <Lab> ]`) → `wide-read` (`476px`) via native `<details id="further-read-details">` (on mobile `<= 720px`, `expanded` docks as a scrollable bottom reader sheet above `#bottom-bar`).
   - All 5 Lab drawers (`#parts-drawer`, `#audiogram-drawer`, `#ct-slice-drawer`, `#vor-drawer`, `#surgical-drawer`) live inside `#sidebar-pane-lab` and enforce 1-at-a-time mutual exclusivity with each other, with `#gyro-flyout`, and with expanded reading states.

---

## 2. Layout Structure & Zone Architecture

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ZONE 1: MINIMAL TOP HEADER (48px desktop/tablet, 44px mobile)                                                 │
│ [IE-MAP 3D] Inner Ear 3D Lab  [ Anatomy Atlas | Hearing | Virtual Radiology | Vestibular | Surgical ] [🔍][📄][◐][⚙️] │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ZONE 2: FULL-BLEED 3D STAGE (100dvw x 100dvh, AgX + RoomEnvironment IBL, alpha-transparent WebGL2 canvas)    │
│                                                                                                               │
│   ┌───────────────────────────────────┐                                                                       │
│   │ ZONE 3: UNIFIED #note-sidebar     │                                                                       │
│   │ • collapsed -> compact ->         │                 [ Dynamic setViewOffset 3D Labyrinth Stage ]           │
│   │   expanded [Note | Lab] ->        │                   (shifts cleanly right / up when expanded)           │
│   │   wide-read (<details>)           │                                                                       │
│   │ • Hosts all 5 clinical drawers    │                                                                       │
│   └───────────────────────────────────┘                                                                       │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ZONE 4: CONTEXTUAL BOTTOM WORKBENCH DOCK (#bottom-bar, --dock-clearance + --dock-shift-x + Stage Utilities)   │
│ [ Mode subnavs, presets, sliders & Lab drawer trigger ] [ Labels | Reset ]   (+ floating #gyro-flyout)        │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Zone Detailed Specifications

### Zone 1: Minimal Top Header (`48px` desktop/tablet, `44px` mobile `<= 720px`)
- **Brand Cluster (Left):** `IE-MAP 3D` pill badge + `Inner Ear 3D Lab` title (subtitle collapses cleanly below `1080px`).
- **Mode Switcher (`role="tablist"`):** 5 implemented clinical modes (`Anatomy Atlas`, `Hearing & Tonotopy`, `Virtual Radiology`, `Vestibular & VOR`, `Surgical Suites`) with full ARIA keyboard navigation (`ArrowLeft`/`ArrowRight`/`Home`/`End`).
- **Search & Utilities (Right):** Global 27-part search combobox (`#search-input`, tablet icon trigger `#header-search-btn`), Clinical Report modal button (`#report-open-btn` opening `<dialog id="report-dialog">`), Light/Dark quick toggle (`#theme-toggle-btn`), and Settings button (`#settings-btn` opening top-layer `#settings-popover` `[popover="auto"]`).

---

### Zone 2: Full-Bleed 3D Stage (`100dvw × 100dvh`)
- **AgX + IBL Compositing:** `THREE.AgXToneMapping` (`exposure = 1.06`), `RoomEnvironment` PMREM reflections, and alpha-transparent background allowing CSS obsidian radial depth (`#0a1016`) or warm drafting paper (`#f5f5f3`) with `1px` architectural hairlines and `7px` corner L-brackets.
- **Dynamic Camera Framing (`setStageFraming`):** Smooth `camera.setViewOffset` pan keeping the 3D inner ear centered inside the unobstructed viewport beside open sidebars or above mobile sheets.
- **Occlusion-Aware 2D Pins Layer (`#pins-layer`):** Pre-allocated keep-out decluttering zones avoiding overlap with `#header`, `#note-sidebar`, `#bottom-bar`, and `#gyro-flyout`, with pointer capture forwarding to `OrbitControls`.

---

### Zone 3: Unified `#note-sidebar` & `#sidebar-pane-lab`
- **Compact State (`280px` desktop / `256px` tablet / `198px` mobile):** Category badge, English headline, one-line summary, and direct `[ Read Note → ]` + `[ <Lab> ]` actions plus collapse pill trigger (`#note-collapse-btn` → `#note-collapsed-pill`).
- **Expanded Note Pane (`#sidebar-pane-note`, `388px`, `476px` when `wide-read`):** Plain/clinical summary (`16px` readable editorial body), `[ Isolate Part ]` + `[ Reset View ]` actions, mode-specific telemetry cards (Endocochlear Potential, Greenwood band, SCDS third-window biomechanics, live CN VIII firing rate / Ewald / clearance gauge), and native `<details id="further-read-details">` with inline `Patient | Clinical` reading depth switcher.
- **Expanded Lab Pane (`#sidebar-pane-lab`):** Mutually exclusive host for:
  - `#parts-drawer` (27-part anatomical tree, system filters, eye toggles)
  - `#audiogram-drawer` (`AudiogramDrawer.ts` pure-tone SVG grid, speech banana, presets)
  - `#ct-slice-drawer` (`CTSliceDrawer.ts` Retina 2D CT/MRI MPR viewer)
  - `#vor-drawer` (`VORDrawer.ts` 3D `EyeAvatarEngine`, 3-lead nystagmogram, Claussen caloric butterfly, vHIT dual-trace plots)
  - `#surgical-drawer` (`SurgicalDrawer.ts` 2D endoscopy monitor + CI force / compensation / ABR+EMG plots)

---

### Zone 4: Contextual Bottom Workbench Dock (`#bottom-bar`)
Dynamic `ResizeObserver` updates `--dock-clearance` on `#app` and `--stage-left-gutter` / `--dock-shift-x` shifts the centered dock into free canvas space beside expanded sidebars. Trailing `.dock-stage-utils` provides quick `[ 3D Labels ]` (`Off`/`Key`/`All`) and `[ Reset View ]` triggers across every mode. Mode 4 (`BPPV`) also pairs with floating `[ 🧭 Gyro ]` (`#gyro-flyout`), which automatically returns expanded `#note-sidebar` to `compact` for unobstructed 3-axis head control.

---

## 4. Dual-Polarity Design Tokens (`Dark Glassroom` & `Light Paper-Technical`)

| Role | Dark Glassroom (`data-theme="dark"`) | Light Paper-Technical (`data-theme="light"`) |
| :--- | :--- | :--- |
| Canvas Backdrop | `#0a1016` (Obsidian Depth) | `#f5f5f3` (Warm Drafting Paper + corner L-brackets) |
| Floating Panel | `rgba(15, 22, 29, 0.84)` + blur | `rgba(255, 255, 255, 0.91)` + layered neutral shadow |
| Control Trough | `#0c131a` | `#eaece9` |
| Primary Ink / Secondary | `#f1f5f9` / `#a8b6c4` | `#14181c` / `#434c56` |
| Primary Accent | `#2ec4b6` (Mineral Teal) | `#0c667e` (Deep Cyan-Teal) |
| Signal Accents | `#e5a93c` Amber · `#f46b78` Crimson · `#4ade80` Emerald | `#b45309` Amber · `#be123c` Crimson · `#15803d` Emerald |

Full design-system token spec is documented in [`DESIGN.md`](../DESIGN.md) and [`.impeccable/design.json`](../.impeccable/design.json).
