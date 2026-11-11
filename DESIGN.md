---
name: "Inner Ear 3D Lab"
description: "System-reactive Dual-Polarity Modal Workbench (Dark Glassroom + Light Paper-Technical) for stereotaxic 3D neurotology."
colors:
  mineral-teal: "#2ec4b6"
  deep-cyan-teal: "#0c667e"
  otolith-amber-dark: "#e5a93c"
  otolith-amber-light: "#b45309"
  cochlear-crimson-dark: "#f46b78"
  cochlear-crimson-light: "#be123c"
  vestibular-emerald-dark: "#4ade80"
  vestibular-emerald-light: "#15803d"
  obsidian-depth: "#0a1016"
  obsidian-panel: "rgba(15, 22, 29, 0.84)"
  obsidian-solid: "#111922"
  obsidian-trough: "#0c131a"
  paper-drafting: "#f5f5f3"
  paper-sheet: "rgba(255, 255, 255, 0.91)"
  paper-solid: "#ffffff"
  paper-trough: "#eaece9"
  chalk-ink: "#f1f5f9"
  graphite-ink: "#14181c"
  pewter-secondary: "#a8b6c4"
  slate-secondary: "#434c56"
  on-teal-dark: "#072221"
  on-cyan-light: "#ffffff"
typography:
  display:
    fontFamily: "'Avenir Next', 'Galvji', 'Seravek', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(1.375rem, 1.18rem + 0.45vw, 1.625rem)"
    fontWeight: 600
    lineHeight: 1.16
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Avenir Next', 'Galvji', 'Seravek', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(1.1875rem, 1.05rem + 0.3vw, 1.375rem)"
    fontWeight: 600
    lineHeight: 1.18
    letterSpacing: "-0.018em"
  title:
    fontFamily: "'Avenir Next', 'Galvji', 'Seravek', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "'Avenir Next', 'Galvji', 'Seravek', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.62
    letterSpacing: "0em"
  label:
    fontFamily: "'Avenir Next', 'Galvji', 'Seravek', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0em"
  mono:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.3
    fontFeature: "tnum"
rounded:
  xs: "5px"
  compact: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  gutter-mobile: "10px"
  gutter: "14px"
  panel-pad: "15px 18px"
  panel-pad-compact: "12px 14px"
  sidebar-compact: "280px"
  sidebar-expanded: "388px"
  sidebar-wide-read: "476px"
  header-height-mobile: "44px"
  header-height: "48px"
  dock-clearance: "78px"
components:
  button-primary:
    backgroundColor: "{colors.deep-cyan-teal}"
    textColor: "{colors.on-cyan-light}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "36px"
  button-primary-dark:
    backgroundColor: "{colors.mineral-teal}"
    textColor: "{colors.on-teal-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.paper-trough}"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "36px"
  button-secondary-dark:
    backgroundColor: "{colors.obsidian-trough}"
    textColor: "{colors.chalk-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "36px"
  mode-pill:
    backgroundColor: "transparent"
    textColor: "{colors.slate-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "30px"
  mode-pill-active:
    backgroundColor: "{colors.paper-solid}"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "30px"
  mode-pill-active-dark:
    backgroundColor: "{colors.obsidian-solid}"
    textColor: "{colors.chalk-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "30px"
  chip-filter:
    backgroundColor: "{colors.paper-trough}"
    textColor: "{colors.slate-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 11px"
    height: "30px"
  card-glass-dark:
    backgroundColor: "{colors.obsidian-panel}"
    textColor: "{colors.chalk-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "{spacing.panel-pad}"
  card-sheet-light:
    backgroundColor: "{colors.paper-sheet}"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "{spacing.panel-pad}"
  input-search:
    backgroundColor: "{colors.paper-trough}"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 6px 0 11px"
    height: "34px"
    width: "192px"
  pin-chip:
    backgroundColor: "{colors.paper-sheet}"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "5px 11px"
---

# Design System: Inner Ear 3D Lab

## Overview

**Creative North Star: "One-Side Expandable Stereotaxic Notebook"**

Inner Ear 3D Lab rejects crowded multi-pane surgical cockpits and fragmented corner popups in favor of an architectural full-bleed WebGL2 specimen stage paired with a **single unified left-hand Note & Lab Sidebar (`#note-sidebar`)**. Whether rendered in obsidian studio darkroom mode or warm drafting-paper light mode, the 27-part Right-Anterior-Superior (RAS) labyrinth occupies center stage (`>= 85%` unobstructed area at rest across desktop, tablet, and mobile), while deep reading and clinical lab charts expand cleanly inside that single left column and dynamically shift 3D camera framing (`camera.setViewOffset`) rightward into open space.

Both themes share identical spatial geometry, typographic hierarchy, and stereotaxic truth, switching polarity through native CSS `color-scheme` and `light-dark()` tokens with manual persistence and `@supports` fallbacks. Every surface—from AgX tone-mapped WebGL2 translucency (`RoomEnvironment` IBL) to custom geometric stroke icons, occluded 3D label pins, and canvas-rendered CT/VNG/surgical plots—maintains generous typography (`16px` note prose, `>= 13px` controls) without visual noise.

**Key Characteristics:**
- Anti-Cockpit `>= 85%` clear WebGL2 stage invariant enforced in resting compact mode across `1440×900`, `1280×800`, `768×1024`, and `390×844` viewports in both themes.
- Native OS + manual dual polarity pairing frosted dark glassroom surfaces with light technical drafting paper and `7px` corner L-brackets.
- One-Side Progressive Disclosure (`collapsed` corner pill → `compact` preview card `280px` → `expanded` `388px` Note/Lab reader → `476px` `Further Read` `<details>`; docking as a clean bottom sheet above `#bottom-bar` on mobile) paired with dynamic `setViewOffset` 3D camera panning and shifted `--dock-shift-x` clearance so zero UI elements overlap.
- Zero-GC WebGL2 loop synced in real time to resolved theme polarity so both bone shells and fluid membranes remain crisp against dark studio depth and warm daylight paper.

## Colors

A restrained dual-polarity technical palette where teal anchors orientation, clinical accents signal physiological states, and warm-paper or cool-obsidian neutrals frame the 3D labyrinth without competing against its anatomic hues.

### Primary
- **Mineral Teal** (`#2ec4b6`): Primary dark-mode accent for active workbench indicators, slider tracks, primary CTAs, expanded pill dots, and stereotaxic metadata readouts (`#072221` foreground ink on filled buttons).
- **Deep Cyan-Teal** (`#0c667e`): Primary light-mode accent calibrated for WCAG AA readability over white drafting paper (`#ffffff` foreground ink on filled buttons) and active mode borders.

### Secondary
- **Otolith Amber Dark** (`#e5a93c`) / **Otolith Amber Light** (`#b45309`): Vestibular highlight reserved for BPPV otolith canalith visualization, warm caloric convection cues, and ampullary structure tags.

### Tertiary
- **Cochlear Crimson Dark** (`#f46b78`) / **Cochlear Crimson Light** (`#be123c`): Clinical warning and audiologic convention accent driving Right Ear audiogram curves, `>= 30 mN` translocation breach pulses, and cochlear vascular cues.
- **Vestibular Emerald Dark** (`#4ade80`) / **Vestibular Emerald Light** (`#15803d`): Confirmation and otolith equilibrium state indicator used for safe CI clearance bands and utricular landmark dots.

### Neutral
- **Obsidian Depth** (`#0a1016`) / **Paper Drafting** (`#f5f5f3`): Base full-bleed canvas ground gradient backdrops behind the transparent AgX WebGL2 stage.
- **Obsidian Panel** (`rgba(15, 22, 29, 0.84)`) / **Paper Sheet** (`rgba(255, 255, 255, 0.91)`): Translucent workbench floating surfaces paired with frosted blur and subtle luminance hairlines.
- **Obsidian Solid** (`#111922`) / **Paper Solid** (`#ffffff`): Crisp high-contrast fills for active segmented pills, active top tabs, and range slider thumbs.
- **Obsidian Trough** (`#0c131a`) / **Paper Trough** (`#eaece9`): Recessed control beds for tab switcher wells, plot containers, search shells, RAS chips, and secondary button grounds.
- **Chalk Ink** (`#f1f5f9`) / **Graphite Ink** (`#14181c`): Primary headings, body controls, telemetry values, and clinical labels.
- **Pewter Secondary** (`#a8b6c4`) / **Slate Secondary** (`#434c56`): Subtitle metadata, axis labels, muted descriptions, and anatomical Latin captions.

### Named Rules
**The Polarity-Paired Canvas Rule.** Every surface, border, and WebGL2 material parameter resolves synchronously across light and dark via `light-dark()` and `meta[name="color-scheme"]`, never leaving dark chrome stranded over light paper or bright pastel membranes washed out on `#f5f5f3`.

**The Signal Rarity Rule.** Semantic hues (amber otoliths, crimson breach alerts and Right Ear audiogram markers, emerald clearance bands) appear strictly on anatomical markers, physiological thresholds, and active accents so surrounding chrome remains neutral.

## Typography

**Display & UI Font:** `'Avenir Next', 'Galvji', 'Seravek', -apple-system, BlinkMacSystemFont, sans-serif`
**Body Font:** `'Avenir Next', 'Galvji', 'Seravek', -apple-system, BlinkMacSystemFont, sans-serif`
**Label / Mono Font:** `ui-monospace, 'SF Mono', Menlo, Consolas, monospace`

**Character:** Geometric humanist sans paired with crisp system tabular monospace creates an authoritative biomedical instrument feel—clean enough for public showcase legibility and disciplined enough for millimeter RAS coordinates and kilohertz readouts.

### Hierarchy
- **Display** (`600`, `clamp(1.375rem, 1.18rem + 0.45vw, 1.625rem)`, `1.16`, `-0.02em`): Expanded `#note-title` anatomy/clinical reader heading (`22px`–`26px`), scaling down gently to `clamp(1.1875rem, 1.05rem + 0.3vw, 1.375rem)` (`19px`–`22px`) in the desktop resting compact card and `16px` (`1rem`) on `198px` mobile compact pills.
- **Headline** (`600`, `1.0625rem`, `1.25`, `-0.015em`): Mode-specific inline lab subheadings (`.lab-subhead-title`) and clinical panel headers (`1.3125rem` on modal report dialogs).
- **Title** (`600`, `1.1875rem` popover / `0.9375rem` brand bar, `1.25`, `-0.015em`): Top-layer settings title and header application mark.
- **Body** (`400`, `1rem`, `1.62`, `0em`): Expanded clinical lead note (`16px` readable editorial line length `<= 46ch`; `0.9375rem` / `15px` inside compact lead previews and `<details>` `Further Read` clinical deep-dive copy).
- **Label** (`600` / `500`, `0.8125rem`, `1.3`, `0em`): Mode tabs, dock pills, 3D pins, filter chips, sidebar `[Note | <Lab>]` tabs, and metric keys (`13px` interactive UI floor). Dense SVG/Canvas scientific axes render at `>= 12px` (`0.75rem`).
- **Mono** (`600`, `0.8125rem`–`0.875rem`, `1.3`, `tnum`): Brand mark (`IE-MAP 3D`), stereotaxic RAS coordinates, slider readouts, inline depth badges, and telemetry values.

### Named Rules
**The Minimum Legible Floor Rule.** Interactive UI controls, pills, 3D pins, buttons, and sidebar metadata stay at or above `13px` (`0.8125rem`) while expanded note body copy sets at `16px` (`1rem`)—Paired with `12px` minimum SVG/Canvas plot annotations—so nothing feels cramped beside sub-millimeter 3D structures.

**The Tabular Metric Rule.** Stereotaxic coordinates, Greenwood millimeter distances, Hounsfield/depth readouts, and angular slider values always render in `ui-monospace` with `font-variant-numeric: tabular-nums` so scrubbing sliders never jitters adjacent layout.

## Layout

Four streamlined spatial zones wrap the full-viewport `100dvw × 100dvh` WebGL2 stage while respecting device safe-area insets (`viewport-fit=cover` + `env(safe-area-inset-*)`) and centering both the 3D specimen and bottom dock inside the unobstructed canvas:

1. **Top Navigation Bar (`48px` desktop/tablet, `44px` mobile `<= 720px`):** Single horizontal bar pinning the `IE-MAP 3D` brand cluster on inline-start, centered 5-mode ARIA tablist (`Anatomy Atlas`, `Hearing & Tonotopy`, `Virtual Radiology`, `Vestibular & VOR`, `Surgical Suites`), desktop search combobox, tablet search icon trigger (`721px`–`1080px`), and compact utility cluster (`Report`, `Theme`, `Settings`).
2. **Full-Bleed Specimen Stage (`100dvw × 100dvh`):** Centered three-dimensional inner ear framed by a `1px` architectural hairline border (`6px` viewport inset) with `7px` corner L-brackets. Expanding `#note-sidebar` smoothly shifts `camera.setViewOffset` rightward (or upward above the mobile bottom reader sheet) so the 3D specimen always sits squarely inside the free stage.
3. **One-Side Expandable Note & Lab Sidebar (`#note-sidebar`, `14px` inset desktop, `10px` mobile):** Replaces fragmented corner cards and right-side rails with a single unified Glass/Paper column progressing through `collapsed` pill (`#note-collapsed-pill`) → `compact` preview card (`280px` desktop / `256px` tablet / `198px` mobile) → `expanded` `388px` Note/Lab reader (`364px` tablet; bottom reader sheet `<= 56dvh` mobile) → `476px` `wide-read` when opening native `<details id="further-read-details">` (`interpolate-size: allow-keywords`, inline `Patient | Clinical` tone switcher, Latin/Innervation/Morphometry/RAS/Pearl metadata).
4. **Contextual Bottom Workbench Dock & Stage Utilities (`#bottom-bar`):** Anchored capsule (`max-inline-size: min(860px, calc(100dvw - var(--stage-left-gutter) - 24px))`) whose `--dock-shift-x` centers it inside the open stage beside the expanded sidebar while trailing `.dock-stage-utils` (`Toggle 3D Labels`, `Reset View`) eliminate the need for a separate right-edge toolbar.

**Responsive Breakpoints (`1080px`, `900px`, & `720px`):**
- Below `1080px`: header brand subtitle and inline search hide (revealing the `header-search-trigger` icon button); secondary mode suffixes collapse (`Anatomy`, `Hearing`, `Radiology`, `Vestibular`, `Surgical`) with tightened pill padding; compact sidebar narrows to `256px`.
- Below `900px`: `#report-open-btn` collapses its text label into a square `32×32px` icon button so all 5 tablet mode tabs remain completely visible without clipping at `768px`.
- Below `720px`: header compresses to `44px`; resting compact card streamlines to `198×89px` (`85.3%` free 3D stage) hiding compact lead text; clicking `Read Note →` or a dock Lab button opens `#note-sidebar[data-note-state="expanded"]` as a scrollable bottom reader sheet docked cleanly above `#bottom-bar` with synced mobile `Bone Shell` and `Explode` sliders inside the `27 Parts` pane.

### Named Rules
**The Anti-Cockpit 85% Stage Rule.** Combined foreground chrome must leave at least `85%` of the viewport clear to the WebGL2 specimen on initial landing and resting states across `1440×900`, `1280×800`, `768×1024`, and `390×844` viewports.

**The Single-Sidebar Mutual Consolidation Rule.** All narrative reading, `<details>` deep reference (`Further Read` and `3-Axis Head Gyro`), and clinical lab views (`27 Parts`, `Audiogram`, `2D CT`, `VOR & Gyro`, `Force Trace`) share the single expandable `#note-sidebar` container—zero multi-corner floating drawers or right-edge strips.

## Elevation & Depth

Depth combines three mechanisms: frosted backdrop translucency over the WebGL2 canvas (`blur(18px) saturate(135%)`), three-tier layered neutral shadows tuned per polarity, and solid trough/active surface contrast rather than saturated glow halos.

### Shadow Vocabulary
- **Floating Surface Elevation** (`--shadow-floating`): Layered three-stop ambient + contact shadow anchoring floating glass panels (`0 1px 2px`, `0 6px 14px`, `0 16px 32px` at `6%–8%` ink opacity in light mode; `0 1px 2px`, `0 8px 20px`, `0 20px 40px` at `34%–38%` black opacity in dark mode).
- **Modal & Top-Layer Elevation** (`--shadow-modal`): Deeper three-stop spread separating settings popovers and modal clinical dialogs (`0 2px 6px`, `0 14px 32px`, `0 28px 56px` with `8%–14%` light / `45%–54%` dark alpha).
- **Active Pill Contact Lift**: Tight `0 1px 2px rgba(0, 0, 0, 0.12)` crispness raising active navigation pills and range thumbs cleanly off recessed trough beds.

### Named Rules
**The Flat-Action Rule.** Action buttons, filter chips, and dock controls stay shadow-free inside already elevated cards and docks, communicating hover and selection solely through `1px` border and fill shifts instead of stacking redundant drop shadows.

**The Masked Glass Edge Rule.** Frosted floating containers render a `1px` directional top-left sheen border via `mask-composite: exclude` pseudo-elements while falling back cleanly to system canvas high-contrast outlines under `forced-colors: active`.

## Shapes

Controlled, clinical geometry pairs generous architectural panel rounding (`16px`) with compact pill switches (`999px`) and `1px` drafting hairlines:

- **Containers & Overlays (`16px`):** Unified `#note-sidebar` (compact, expanded, wide-read, and mobile bottom sheet), settings popover, and report dialog use crisp `16px` outer radii.
- **Plot Troughs & Dropdowns (`12px`):** Search dropdown and recessed SVG/Canvas plot wells use `12px` corners.
- **Tactile Action Controls (`8px`):** Primary/secondary buttons, icon triggers, search fields inside drawers, and the `IE-MAP 3D` mark use `8px` corners; inline metric tags and segmented sub-buttons tighten to `6px` and `5px` RAS chips.
- **Capsule Navigation & 3D Pins (`999px`):** Mode tablist, sidebar `[Note | <Lab>]` switch, filter chips, bottom dock, range tracks, and floating anatomical pins share continuous pill contours.
- **Drafting Registration Brackets:** A full-bleed `1px` hairline frame encloses the specimen viewport (`6px` inset) punctuated by `7px × 7px` `1.5px`-stroke corner L-brackets evoking stereotaxic calibration glass.

### Named Rules
**The Hairline Divider Rule.** Internal card sections, telemetry metrics, and 27-part lists separate purely with `1px` horizontal rules rather than nesting shadowed sub-cards inside floating drawers.

## Components

### Buttons
Minimal flat controls built around `32px` hit-target heights (`28px` mobile dock triggers) with crisp `8px` or pill geometry and `140ms ease` transitions.
- **Shape:** Action buttons use `8px` (`--radius-sm`); bottom dock controls use continuous `999px` pill contours (`--radius-pill`).
- **Primary:** Solid `Deep Cyan-Teal` (`#0c667e`) with `#ffffff` ink in light mode or `Mineral Teal` (`#2ec4b6`) with `#072221` ink in dark mode, `0 11px` inline padding, `600` weight `0.75rem` label, zero shadow.
- **Secondary & Ghost:** Neutral trough fill (`#eaece9` light / `#0c131a` dark) with `1px` subtle border shifting to accent tint and border on hover; icon triggers mirror this exact `32×32px` footprint with custom `16×16px` `1.8px`-stroke geometric SVG paths.
- **Focus:** Universal `2px solid` primary accent outline with `2px` offset on `:focus-visible`.

### Chips
Compact pill filters and diagnostic metric tags keeping visual noise low.
- **Style:** `999px` radius (`28px` height, `0 9px` padding) on trough backgrounds with `1px` subtle borders for anatomical system and audiogram preset filters; `6px` rounded rectangular monospace tags for inline VOR/surgical KPI metrics.
- **State:** Selected chips shift cleanly to accent-tinted active backgrounds and accented `1px` borders with `600` weight foreground text.

### Cards / Containers
Translucent Modal Workbench surfaces designed to let dimly lit or subtle architectural space read gently behind foreground data.
- **Corner Style:** `16px` (`--radius-lg`) on inspector, drawers, gyro flyout, settings popover, and report modal; `12px` (`--radius-md`) on landing intro and plot troughs.
- **Background:** Frosted glass/sheet (`rgba(15, 22, 29, 0.82)` dark / `rgba(255, 255, 255, 0.90)` light) using `backdrop-filter: blur(18px) saturate(135%)` and masked `1px` gradient edge borders; elevated top-layer popovers and dialogs increase opacity to `94%–97%` for instant legibility over scrims.
- **Shadow Strategy:** `Floating Surface Elevation` on non-modal workbench containers; `Modal & Top-Layer Elevation` on popovers and `<dialog>` sheets.
- **Internal Padding:** `12px 14px` desktop resting compact card (`6px 10px` mobile), `15px 18px` expanded Note/Lab sidebar, and `20px 22px` modal report dialog.

### Inputs / Fields
Inline search comboboxes and cross-browser clinical range sliders engineered for keyboard and touch precision.
- **Search Inputs:** `32px`-tall trough-backed fields (`999px` radius in top bar; `8px` radius inside the 27-part drawer) pairing a leading `16px` search icon, `caret-color` tinted to primary accent, and keyboard-navigable dropdown results (`#search-dropdown`).
- **Range Sliders:** `4px` height dual-tone progress track (`linear-gradient` split dynamically at `--slider-progress` in WebKit alongside separate `::-moz-range-track` and `::-moz-range-progress` rules in Gecko) paired with a `13px` crisp solid-centered thumb ringed by `2px` primary accent.

### Navigation
Single-row ARIA tablist switching between the 5 clinical domains paired with a contextual bottom capsule dock.
- **Top Mode Bar:** Pill trough housing `28px`-tall horizontal buttons (`140ms ease` state transition) that lift onto solid `#ffffff` / `#111922` capsules when active (`aria-selected="true"`), adapting labels gracefully at `<= 1080px` without horizontal page overflow.
- **Bottom Workbench Dock:** Anchored capsule displaying only the controls relevant to the active clinical mode (guided presets, logarithmic Greenwood scrubber, oblique MPR plane toggles, vestibular maneuvers, or surgical insertion parameters).

### Signature Components
- **One-Side Expandable Note & Lab Sidebar (`#note-sidebar`):** Single Glass/Paper left rail switching fluidly between `collapsed` pill, `compact` resting preview card, `expanded` `388px` reader/lab tabs (`Note` | `27 Parts` / `Audiogram` / `2D CT` / `VOR & Gyro` / `Force Trace`), and `476px` `wide-read` when `<details id="further-read-details">` opens—pairing native CSS `interpolate-size: allow-keywords` transitions with live WebGL2 camera `setViewOffset` framing and bottom-dock `--dock-shift-x` clearance.
- **3D Stereotaxic Pin Chips:** Pre-allocated DOM pill badges (`5px 11px` padding, `999px` radius, `13px` type, `8px` system color dot + short anatomical label) projected each animation frame from 3D RAS bone/duct centroids, occluded cleanly behind foreground mesh raycasts, clamped strictly inside stage gutters, and suppressed behind open `#note-sidebar` and `#bottom-bar` keep-out rectangles.
- **Top-Layer Settings Popover & Clinical Report Dialog:** Native `popover="auto"` anchored cleanly below the settings button via CSS Anchor Positioning (`position-area: block-end span-inline-start` + `@supports` fixed fallback) and native modal `<dialog closedby="any">` featuring `@starting-style` + `allow-discrete` entry/exit transitions and dedicated `@media print` sheet formatting.

## Do's and Don'ts

### Do:
- **Do** protect at least `85%` clear WebGL2 canvas area in resting states across desktop (`1440×900`, `1280×800`), tablet (`768×1024`), and mobile (`390×844`) in both light and dark themes (`The Anti-Cockpit 85% Stage Rule`).
- **Do** resolve every CSS surface, shadow, and WebGL2 shader pigment synchronously via `color-scheme: light dark` and `light-dark()` with explicit `@supports not` fallbacks.
- **Do** maintain `16px` expanded note body copy and keep all UI controls, pills, pins, and telemetry at or above `13px` (`12px` minimum for SVG/Canvas plot axes) with tabular numerals on millimeter/frequency metrics.
- **Do** keep all expanded reading, `<details>` accordions (`Further Read`, `3-Axis Head Gyro`), and clinical lab views inside the single expandable `#note-sidebar` (docked as a mobile bottom sheet above `#bottom-bar`) while dynamically framing the 3D stage via `setViewOffset`.
- **Do** terminate custom linear-space GLSL shaders with Three.js `#include <tonemapping_fragment>` and `#include <colorspace_fragment>` under `AgXToneMapping`.

### Don't:
- **Don't** place eyebrows, uppercase category kickers, or badge ribbons above `<h1>` hero lockups.
- **Don't** stack persistent sidebars, duplicate drop shadows on buttons inside cards, or boxed sub-cards inside floating drawers.
- **Don't** replace custom geometric vector SVGs with Unicode emojis or external icon font dependencies in header/tool chrome.
- **Don't** allocate DOM pin nodes, Three.js vectors, geometries, or materials inside `requestAnimationFrame`.
- **Don't** ship global `*` CSS resets that leak into WebGL/canvas or third-party primitives.
