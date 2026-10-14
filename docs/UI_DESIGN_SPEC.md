# UI/UX Design Specification: The "Modal Workbench" Paradigm

> **Project:** Inner Ear 3D Lab  
> **Status:** Approved Architecture Spec  
> **Target Audiences:** Medical Students, Otolaryngology (ENT) Residents, Neurology Residents, Audiologists  
> **Core Principle:** Laser-focused, zero-clutter 3D stage with contextual workbenches (Anti-Cockpit Design).

---

## 1. Design Vision & Anti-Cockpit Philosophy

Traditional medical and surgical software often falls into the **"Cockpit Trap"**: crowding the viewport with 50 permanent buttons, multiple persistent telemetry readouts, sidebars, dials, and nested sub-windows. This overwhelms students, exhausts residents, and shrinks the actual 3D model into a secondary box.

Our design philosophy enforces **Strict Simplicity Through Contextual Workbenches**:
1. **The 3D Stage is King (85%+ Canvas Area):** The authentic 27-mesh inner ear labyrinth is always the primary visual anchor. It is never obscured by permanent sidebars or intrusive dialogs.
2. **One Cognitive Task at a Time:** Users never need to adjust BPPV gravity angles while evaluating cochlear frequency tonotopy. Controls are contextually swapped based on the active **Mode**.
3. **Progressive Disclosure:** Advanced data (Latin etymology, CN VIII branch innervation, clinical pearls, audiograms) lives one tap away in floating, dismissible cards or pull-up drawers—never permanently cluttering the primary canvas.

---

## 2. Layout Structure & Zone Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ZONE 1: MINIMAL TOP HEADER                                                             │
│ [IE-MAP 3D] Inner Ear Lab    [ 🧬 Anatomy │ 🎧 Hearing │ 🌀 Vestibular │ 🩻 CT Slicing ]   [⚙️] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ZONE 2: FULL-BLEED 3D STAGE (Three.js WebGL 60fps)                                     │
│                                                                                        │
│                                                                                        │
│   ┌──────────────────────────┐                                                         │
│   │ ZONE 3: FLOATING         │                                                         │
│   │ PART INSPECTOR CARD      │             [ 3D Labyrinth Center Stage ]               │
│   │ (Appears on click/hover) │                                                         │
│   └──────────────────────────┘                                                         │
│                                                                                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ZONE 4: CONTEXTUAL BOTTOM WORKBENCH DOCK                                               │
│ [ Context-aware presets, sliders, and tool drawers tailored to the active Mode ]       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Zone Detailed Specifications

### Zone 1: Minimal Top Header (`height: 64px`)
- **Brand Cluster (Left):**
  - Pill badge: `IE-MAP 3D` (Cyan `#52dcf2` border and glow).
  - Title: `Inner Ear 3D Lab`.
  - Subtitle: `27-Part Anatomy Atlas` (swaps to active mode label on smaller screens).
- **Mode Switcher (Center / Primary Navigation):**
  - Segmented pill container with 4 modes:
    1. `🧬 Anatomy`: The core 27-part structural atlas, bone peeling, exploded view.
    2. `🎧 Hearing`: Tonotopic frequency mapping ($20\text{ Hz}\to 20\text{ kHz}$), Web Audio sine synthesizer, interactive audiogram.
    3. `🌀 Vestibular`: Semicircular canal kinematics, BPPV maneuvers (Epley, Gufoni, Roll), VOR eye reflex.
    4. `🩻 CT Slicing`: Multiplanar reformatting (Pöschl, Stenvers, Axial, Coronal) using analytic shader clipping.
  - Active state: Cyan accent highlight with subtle organic glow.
- **Search & Settings (Right):**
  - Global part search input (`🔍 Find an ear part...`) with fuzzy matching and keyboard navigation (`↑`/`↓`/`Enter`).
  - Single `⚙️` Settings button triggering a popover:
    - 3D Label density: `Off` | `Key Landmarks` | `All`.
    - Reading depth: `Simple (Patient)` | `Detailed (Medical)`.
    - `About & Citations` modal trigger.

---

### Zone 2: Full-Bleed 3D Stage (100% Viewport Area)
- **Zero Fixed Padding:** Canvas runs behind all UI elements (`z-index: 0`).
- **Camera Dynamics:** Silky smooth OrbitControls with inertia damping (`dampingFactor: 0.05`). Smooth fly-to interpolation when parts or presets are selected.
- **Occlusion-Aware 2D Pins Layer:** Screen-projected HTML pins that smoothly fade out when an anatomical structure rotates behind opaque bone, preventing label collisions.

---

### Zone 3: Floating Part Inspector Card
- **Behavior:** Appears pinned to the upper-left (`top: 80px, left: 24px`) when an anatomical part is clicked or searched. Dismissible with `✕` or clicking open stage.
- **Visual Style:** Translucent frosted acrylic (`rgba(13, 22, 28, 0.85)` with `backdrop-filter: blur(16px)`), subtle `1px` border (`rgba(82, 220, 242, 0.2)`).
- **Content Hierarchy:**
  1. **Category Pill Badge:** e.g. `BALANCE LOOP`, `HEARING SNAIL`, `FLUID SPACE`, `CRANIAL NERVE`.
  2. **Structure Title:** English clinical name (e.g., `Posterior Semicircular Duct`).
  3. **Plain-Language Summary:** 1–2 sentences explaining what the part does in everyday terms.
  4. **Quick Action Bar:**
     - `[ 🎯 Isolate Part ]`: Ghosts all other 26 structures, framing the selected part.
     - `[ ↺ Reset View ]`: Restores standard view.
  5. **Contextual Badge:**
     - In *Anatomy*: Fluid compartment (`Endolymph +80mV` vs `Perilymph 0mV`).
     - In *Hearing*: Greenwood characteristic frequency range (e.g. `500 Hz – 1,200 Hz`).
     - In *Vestibular*: Kinematic plane and Ewald's flow law.
  6. **Expandable `▾ Medical Details` Accordion:**
     - Latin Nomenclature (`ductus semicircularis posterior`).
     - Innervation (e.g., `Posterior ampullary nerve ← Inferior vestibular nerve ← CN VIII`).
     - Morphometry & Dimensions (e.g. `Radius = 3.2 mm, lumen diameter = 0.42 mm`).
     - High-Yield Clinical Pearl (e.g., *Site of 85–90% of all BPPV cases due to gravity-dependent orientation*).

---

### Zone 4: Contextual Bottom Workbench Dock
The bottom dock (`bottom: 24px`) dynamically morphs its toolset whenever the user switches modes in Zone 1.

#### Dock State A: `🧬 Anatomy Mode` (Current Baseline)
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [ Overview ]  [ Balance System ]  [ Hearing Snail ]  [ Exploded View ]                 │
│                                                                                        │
│ Outer Bone Shell: [──●─────] 80%     Separate Parts: [●──────────] 0%                  │
│                                                                [ ▸ Browse All 27 Parts ]│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Dock State B: `🎧 Hearing & Tonotopy Mode` (Phase 1 Build)
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [ 🔊 Live Tone ]: [ 20 Hz ───────●────────────────────── 20,000 Hz ] (4,000 Hz · Consonants)
│                                                                                        │
│ Presets: [ Normal Hearing ] [ Presbycusis (High Loss) ] [ 4kHz Noise Notch ] [ Low Loss ]│
│                                                         [ 📊 Interactive Audiogram ▾ ] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Live Tone Slider:** Logarithmic slider mapping $20\text{ Hz}$ to $20{,}000\text{ Hz}$. Dragging it glides a synthesized sine wave and drives a glowing 3D coordinate marker along the cochlear basilar membrane.
- **Audiogram Drawer:** Tapping `[ 📊 Interactive Audiogram ]` slides up an elegant $125\text{ Hz}\to 8\text{ kHz}$ audiogram grid over the bottom-right corner. Selecting presets immediately projects the corresponding cellular damage region onto the 3D cochlea.

#### Dock State C: `🌀 Vestibular Lab Mode` (Phase 2 Build)
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Maneuver: [ Dix-Hallpike ] [ Epley (Posterior) ] [ Gufoni (Horizontal) ] [ Caloric COWS ]│
│                                                                                        │
│ Scrubber: [ ◀ Prev ]  Step 2 of 5: Supine + 30° Neck Extension  [ Next ▶ ]   [ ▶ Play ] │
│                                                                   [ 👁️ 3D Eye VOR Inset ]│
└────────────────────────────────────────────────────────────────────────────────────────┘
```
- Real-time particle sedimentation inside the active canal.
- Linked patient head recline/yaw orientation card in the upper right.

#### Dock State D: `🩻 CT Slicing Mode` (Phase 3 Build)
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Plane: [ Pöschl's (SSCD) ]  [ Stenvers' (Arch) ]  [ True Axial ]  [ True Coronal ]     │
│                                                                                        │
│ Slice Depth: [──────●──────] +1.4 mm                                [ 🩻 2D CT Card ▾ ]│
└────────────────────────────────────────────────────────────────────────────────────────┘
```
- Leverages the existing analytic clipping plane in `gate3Materials.ts`.
- Slices bone and labyrinth in real-time with zero performance drop.

---

## 4. Visual Identity & Design Tokens

| Token | Value | Clinical / Visual Purpose |
| :--- | :--- | :--- |
| `--bg-base` | `#071014` | Deep medical charcoal; maximum contrast for glowing anatomy. |
| `--panel-bg` | `rgba(13, 22, 28, 0.82)` | Frosted glass for floating HUD cards. |
| `--panel-border`| `rgba(82, 220, 242, 0.18)` | Subtle technical boundary without harsh contrast. |
| `--accent-cyan` | `#52dcf2` | Primary active accent (Medaium Cyan); indicates selected structures. |
| `--accent-warm` | `#f0aa62` | Pathological / sensory accent; used for otoliths and high-yield pearls. |
| `--text-primary`| `#f0f4f8` | High-contrast readability for clinical terms. |
| `--text-muted`  | `#8a9ba8` | Secondary metadata (Latin names, units, frequencies). |
| `--font-sans`   | `'Inter', sans-serif` | Clean, highly legible typographic system. |
| `--font-mono`   | `'JetBrains Mono', monospace` | Technical values, Hz, dB HL, coordinate readouts. |

---

## 5. Responsive Breakpoint Rules

1. **Desktop (`≥ 1200px`)**:
   - Full top header with branded title, search, and labeled mode pills.
   - Inspector card docked at top-left (`width: 340px`).
   - Bottom dock centered with generous hit targets.
2. **Tablet (`768px – 1199px`)**:
   - Mode pills display compact icon + short text (`🧬 Anatomy`, `🎧 Hearing`).
   - Inspector card slightly compact (`width: 300px`).
   - Touch targets expand to minimum `44px` height.
3. **Mobile (`< 768px`)**:
   - Top mode switcher transforms into a clean horizontal swipe pill bar or dropdown.
   - Inspector card collapses into a swipeable bottom sheet (`max-height: 48vh`).
   - Audiogram and 27-Parts drawer open as full-screen modal sheets with a top drag handle.
