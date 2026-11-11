import { HeroSpecimen3D, type ProjectedPin } from './HeroSpecimen3D';
import {
  AUDIOGRAM_FREQUENCIES,
  AUDIOGRAM_PRESETS,
  CALORIC_CLINICAL_PRESETS,
  EPLEY_STEPS,
  IEMAP_STRUCTURES,
  MODE_DEFAULT_MESH,
  MODE_LABELS,
  MODE_LAB_TAB_LABELS,
  RADIOLOGY_PLANES,
  SCDS_PARAMETERS,
  STRUCTURE_BY_MESH,
  SYSTEM_GROUPS,
  VHITImpulseBuffer,
  calculateJongkees,
  compactFluidLabel,
  computeCIInsertionKinematics,
  computeCaloricConvection,
  computeLabyrinthectomyAblation,
  computeNeurectomyElectrophysiology,
  formatFrequencyHz,
  formatRAS,
  formatStructureHeadline,
  frequencyHzToSliderValue,
  getAcousticLandmark,
  getAnatomyHighlightPreset,
  getCompactNoteSentence,
  getDistanceApexMm,
  getLandmarkForDepth,
  getStructurePrimaryMetric,
  greenwoodPosition,
  sliderValueToFrequencyHz,
  type AudiogramPresetId,
  type CTWindowMode,
  type LabelDensity,
  type NoteState,
  type RadiologyPlaneId,
  type ReadingDepth,
  type ShowcaseMode,
  type SidebarTab,
  type StructureOntologyItem,
  type SurgicalProcedure,
  type SystemGroupId,
  type ThemePreference,
  type VestibularSubmode,
} from './showcaseData';

const THEME_STORAGE_KEY = 'ie3d-color-scheme';
const SVG_NS = 'http://www.w3.org/2000/svg';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing required showcase element #${id}`);
  }
  return el as T;
}

function updateRangeProgress(input: HTMLInputElement): void {
  const min = parseFloat(input.min || '0');
  const max = parseFloat(input.max || '100');
  const val = parseFloat(input.value || '0');
  const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
  input.style.setProperty('--slider-progress', `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`);
}

let displayTransitionSupported: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (displayTransitionSupported !== undefined) return displayTransitionSupported;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;display:none;transition:display 1s allow-discrete !important;';
  document.body.appendChild(probe);
  probe.offsetHeight;
  probe.style.display = 'block';
  displayTransitionSupported = getComputedStyle(probe).transitionProperty.includes('display');
  probe.remove();
  return displayTransitionSupported;
}

function supportsTopLayerExit(): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
  return CSS.supports('overlay', 'auto') && canTransitionDisplay();
}

function setupShowcase(): void {
  const appShell = byId<HTMLDivElement>('app-shell');
  const metaColorScheme = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Viewport & Stage DOM
  const canvasHost = byId<HTMLDivElement>('hero-canvas-host');
  const pinsLayer = byId<HTMLDivElement>('pins-layer');
  const bottomBar = byId<HTMLElement>('bottom-bar');
  const headerEl = document.querySelector<HTMLElement>('.lab-header');

  // Unified Note Sidebar DOM
  const noteSidebar = byId<HTMLElement>('note-sidebar');
  const noteCollapsedPill = byId<HTMLButtonElement>('note-collapsed-pill');
  const notePillDot = byId<HTMLSpanElement>('note-pill-dot');
  const notePillLabel = byId<HTMLSpanElement>('note-pill-label');
  const noteCard = byId<HTMLElement>('note-card');
  const noteSystemDot = byId<HTMLSpanElement>('note-system-dot');
  const noteSystemLabel = byId<HTMLSpanElement>('note-system-label');
  const noteTitle = byId<HTMLHeadingElement>('note-title');
  const noteCompactBody = byId<HTMLDivElement>('note-compact-body');
  const noteCompactLead = byId<HTMLParagraphElement>('note-compact-lead');
  const noteReadBtn = byId<HTMLButtonElement>('note-read-btn');
  const noteLabShortcutBtn = byId<HTMLButtonElement>('note-lab-shortcut-btn');
  const noteExpandToggleBtn = byId<HTMLButtonElement>('note-expand-toggle-btn');
  const noteCollapseBtn = byId<HTMLButtonElement>('note-collapse-btn');
  const noteScrollBody = byId<HTMLDivElement>('note-scroll-body');
  const tabNoteBtn = byId<HTMLButtonElement>('tab-note-btn');
  const tabLabBtn = byId<HTMLButtonElement>('tab-lab-btn');
  const sidebarPaneNote = byId<HTMLDivElement>('sidebar-pane-note');
  const sidebarPaneLab = byId<HTMLDivElement>('sidebar-pane-lab');

  // Note & Further Read Fields
  const inspSummary = byId<HTMLParagraphElement>('insp-summary');
  const inspDeepProse = byId<HTMLParagraphElement>('insp-deep-prose');
  const inspFluid = byId<HTMLSpanElement>('insp-fluid');
  const inspMetricKey = byId<HTMLSpanElement>('insp-metric-key');
  const inspMetricVal = byId<HTMLSpanElement>('insp-metric-val');
  const inspLatin = byId<HTMLElement>('insp-latin');
  const inspInnervation = byId<HTMLElement>('insp-innervation');
  const inspMorphometry = byId<HTMLElement>('insp-morphometry');
  const inspRasChip = byId<HTMLElement>('insp-ras-chip');
  const inspPearl = byId<HTMLElement>('insp-pearl');
  const btnIsolate = byId<HTMLButtonElement>('btn-isolate');
  const btnResetView = byId<HTMLButtonElement>('btn-reset-view');
  const furtherReadDetails = byId<HTMLDetailsElement>('further-read-details');

  // Header & Top-Layer Controls
  const themeToggleBtn = byId<HTMLButtonElement>('theme-toggle-btn');
  const settingsBtn = byId<HTMLButtonElement>('settings-btn');
  const settingsPopover = byId<HTMLDivElement>('settings-popover');
  const appearanceHint = byId<HTMLParagraphElement>('appearance-hint');
  const reportOpenBtn = byId<HTMLButtonElement>('report-open-btn');
  const popoverReportBtn = byId<HTMLButtonElement>('popover-report-btn');
  const reportDialog = byId<HTMLDialogElement>('report-dialog');
  const reportCloseBtn = byId<HTMLButtonElement>('report-close-btn');
  const reportDoneBtn = byId<HTMLButtonElement>('report-done-btn');
  const reportPrintBtn = byId<HTMLButtonElement>('report-print-btn');
  const repActivePart = byId<HTMLSpanElement>('rep-active-part');
  const repActiveMode = byId<HTMLSpanElement>('rep-active-mode');
  const searchInput = byId<HTMLInputElement>('search-input');
  const searchClearBtn = byId<HTMLButtonElement>('search-clear-btn');
  const searchDropdown = byId<HTMLDivElement>('search-dropdown');
  const headerSearchBtn = byId<HTMLButtonElement>('header-search-btn');

  // Bottom Stage Utilities
  const toolLabelsBtn = byId<HTMLButtonElement>('tool-labels-btn');
  const toolResetBtn = byId<HTMLButtonElement>('tool-reset-btn');

  // Mode Tabs & Panels
  const modeSwitcher = document.querySelector<HTMLElement>('.mode-switcher');
  const modePills = Array.from(document.querySelectorAll<HTMLButtonElement>('.mode-pill[data-mode]'));
  const dockPanels: Record<ShowcaseMode, HTMLElement> = {
    anatomy: byId('anatomy-dock-content'),
    hearing: byId('hearing-dock-content'),
    radiology: byId('radiology-dock-content'),
    vestibular: byId('vestibular-dock-content'),
    surgical: byId('surgical-dock-content'),
  };

  const labPanels: Record<ShowcaseMode, HTMLElement> = {
    anatomy: byId('lab-panel-parts'),
    hearing: byId('lab-panel-audiogram'),
    radiology: byId('lab-panel-ct'),
    vestibular: byId('lab-panel-vor'),
    surgical: byId('lab-panel-surgical'),
  };

  const dockLabTriggers: Record<ShowcaseMode, HTMLButtonElement> = {
    anatomy: byId<HTMLButtonElement>('parts-toggle-btn'),
    hearing: byId<HTMLButtonElement>('audiogram-toggle-btn'),
    radiology: byId<HTMLButtonElement>('ct-toggle-btn'),
    vestibular: byId<HTMLButtonElement>('vor-toggle-btn'),
    surgical: byId<HTMLButtonElement>('surg-toggle-btn'),
  };
  const gyroToggleBtn = byId<HTMLButtonElement>('gyro-toggle-btn');
  const gyroDetails = byId<HTMLDetailsElement>('gyro-details');

  // Mode-Specific Controls
  const bonePeelSlider = byId<HTMLInputElement>('bone-peel-slider');
  const bonePeelVal = byId<HTMLSpanElement>('bone-peel-val');
  const explodeSlider = byId<HTMLInputElement>('explode-slider');
  const explodeVal = byId<HTMLSpanElement>('explode-val');
  const mobileBonePeelSlider = byId<HTMLInputElement>('mobile-bone-peel-slider');
  const mobileBonePeelVal = byId<HTMLSpanElement>('mobile-bone-peel-val');
  const mobileExplodeSlider = byId<HTMLInputElement>('mobile-explode-slider');
  const mobileExplodeVal = byId<HTMLSpanElement>('mobile-explode-val');
  const partsFilterInput = byId<HTMLInputElement>('parts-filter-input');
  const partsList = byId<HTMLDivElement>('parts-list');

  const hearingFreqSlider = byId<HTMLInputElement>('hearing-freq-slider');
  const hearingFreqReadout = byId<HTMLSpanElement>('hearing-freq-readout');
  const audiogramSvg = document.getElementById('audiogram-svg') as SVGSVGElement | null;
  const audiogramCaption = byId<HTMLParagraphElement>('audiogram-caption');

  const radDepthSlider = byId<HTMLInputElement>('radiology-depth-slider');
  const radDepthReadout = byId<HTMLSpanElement>('radiology-depth-readout');
  const radScdsBtn = byId<HTMLButtonElement>('rad-scds-btn');
  const ctDrawerTitle = byId<HTMLHeadingElement>('ct-drawer-title');
  const ctDrawerSub = byId<HTMLParagraphElement>('ct-drawer-sub');
  const ctDepthBadge = byId<HTMLSpanElement>('ct-depth-badge');
  const ctLandmarkCaption = byId<HTMLParagraphElement>('ct-landmark-caption');
  const ctSliceCanvas = byId<HTMLCanvasElement>('ct-slice-canvas');

  const vestStepSlider = byId<HTMLInputElement>('vest-step-slider');
  const vestStepReadout = byId<HTMLSpanElement>('vest-step-readout');
  const gyroYawSlider = byId<HTMLInputElement>('gyro-yaw-slider');
  const gyroYawVal = byId<HTMLSpanElement>('gyro-yaw-val');
  const gyroPitchSlider = byId<HTMLInputElement>('gyro-pitch-slider');
  const gyroPitchVal = byId<HTMLSpanElement>('gyro-pitch-val');
  const gyroRollSlider = byId<HTMLInputElement>('gyro-roll-slider');
  const gyroRollVal = byId<HTMLSpanElement>('gyro-roll-val');
  const vorDrawerTitle = byId<HTMLHeadingElement>('vor-drawer-title');
  const vorDrawerSub = byId<HTMLParagraphElement>('vor-drawer-sub');
  const vorSpvTag = byId<HTMLSpanElement>('vor-spv-tag');
  const vorGainTag = byId<HTMLSpanElement>('vor-gain-tag');
  const vorUwTag = byId<HTMLSpanElement>('vor-uw-tag');
  const vorCaption = byId<HTMLParagraphElement>('vor-caption');
  const vorStripCanvas = byId<HTMLCanvasElement>('vor-strip-canvas');

  const surgParamSlider = byId<HTMLInputElement>('surg-param-slider');
  const surgParamLabel = byId<HTMLLabelElement>('surg-param-label');
  const surgParamReadout = byId<HTMLSpanElement>('surg-param-readout');
  const surgDrawerTitle = byId<HTMLHeadingElement>('surg-drawer-title');
  const surgDrawerSub = byId<HTMLParagraphElement>('surg-drawer-sub');
  const surgForceTag = byId<HTMLSpanElement>('surg-force-tag');
  const surgDbmTag = byId<HTMLSpanElement>('surg-dbm-tag');
  const surgRiskTag = byId<HTMLSpanElement>('surg-risk-tag');
  const surgCaption = byId<HTMLParagraphElement>('surg-caption');
  const surgicalCanvas = byId<HTMLCanvasElement>('surgical-canvas');

  // Application State
  let currentMode: ShowcaseMode = 'anatomy';
  let noteState: NoteState = 'compact';
  let sidebarTab: SidebarTab = 'note';
  let currentMeshName = 'mesh_david_cochlea';
  let currentSystemFilter: 'all' | SystemGroupId = 'all';
  let partsSearchQuery = '';
  let labelDensity: LabelDensity = 'key';
  let readingDepth: ReadingDepth = 'simple';
  let themePreference: ThemePreference = readStoredTheme();
  let resolvedTheme: 'light' | 'dark' = 'dark';

  let currentFreqHz = 1000;
  let currentAudioPreset: AudiogramPresetId = 'normal';

  let currentPlane: RadiologyPlaneId = 'poschl';
  let currentRadDepthMm = 1.2;
  let currentCtWindow: CTWindowMode = 'bone';
  let scdsActive = false;

  let vestSubmode: VestibularSubmode = 'bppv';
  let vestStepIdx = 1;
  let vestYawDeg = 45;
  let vestPitchDeg = -30;
  let vestRollDeg = 0;
  const vhitBuffer = new VHITImpulseBuffer();
  vhitBuffer.simulateTrial('normal', 'himp', false);

  let surgProc: SurgicalProcedure = 'cochlear_implant';
  let surgCiDepthMm = 18.0;
  let surgLabStep: 0 | 1 | 2 | 3 = 1;
  let surgNeurKoos: 0 | 1 | 2 | 3 | 4 = 1;

  let searchMatches: StructureOntologyItem[] = [];
  let searchHighlightIdx = -1;

  // Pre-allocated DOM Pin Pool (Zero per-frame node creation inside RAF)
  const pinNodes: HTMLButtonElement[] = IEMAP_STRUCTURES.map((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pin-chip';
    btn.hidden = true;
    btn.dataset.meshName = item.meshName;
    const dot = document.createElement('span');
    dot.className = 'pin-dot';
    dot.style.backgroundColor = item.colorHex;
    const lbl = document.createElement('span');
    lbl.textContent = item.shortLabel;
    btn.append(dot, lbl);
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      selectStructure(item.meshName, true);
    });
    pinsLayer.appendChild(btn);
    return btn;
  });

  const pinByMesh = new Map<string, ProjectedPin>();
  const pinHalfWidths = new Float32Array(pinNodes.length);
  const pinFallbackHalfW = new Float32Array(
    IEMAP_STRUCTURES.map((s) => Math.ceil(s.shortLabel.length * 4.4 + 22))
  );
  const placedPinRects = new Float32Array(pinNodes.length * 4);
  const keepOutZones: Array<{ l: number; t: number; r: number; b: number }> = [];
  let stageWidthPx = window.innerWidth;

  function refreshPinKeepOutZones(): void {
    stageWidthPx = canvasHost.clientWidth || window.innerWidth;
    keepOutZones.length = 0;
    const targets: Array<HTMLElement | null> = [
      headerEl,
      noteState === 'collapsed' ? noteCollapsedPill : noteCard,
      bottomBar,
    ];
    for (const el of targets) {
      if (!el || el.hidden) continue;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      keepOutZones.push({
        l: r.left - 12,
        t: r.top - 12,
        r: r.right + 12,
        b: r.bottom + 12,
      });
    }
  }

  function updatePinsDOM(pins: ReadonlyArray<ProjectedPin>, count: number): void {
    pinByMesh.clear();
    for (let i = 0; i < count; i++) {
      pinByMesh.set(pins[i].meshName, pins[i]);
    }
    const vw = stageWidthPx;
    let placedCount = 0;

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < pinNodes.length; i++) {
        const node = pinNodes[i];
        const meshName = node.dataset.meshName ?? '';
        const p = pinByMesh.get(meshName);
        if (!p) {
          if (pass === 0 && !node.hidden) node.hidden = true;
          continue;
        }
        if ((pass === 0) !== p.selected) continue;

        const estHalfW = pinHalfWidths[i] > 0 ? pinHalfWidths[i] : pinFallbackHalfW[i];
        const clampedX = Math.max(estHalfW + 10, Math.min(vw - estHalfW - 10, p.x));
        let blocked = false;
        for (let z = 0; z < keepOutZones.length; z++) {
          const box = keepOutZones[z];
          if (clampedX + estHalfW > box.l && clampedX - estHalfW < box.r && p.y + 4 > box.t && p.y - 30 < box.b) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          for (let k = 0; k < placedCount; k++) {
            const off = k * 4;
            if (
              clampedX + estHalfW + 8 > placedPinRects[off] &&
              clampedX - estHalfW - 8 < placedPinRects[off + 2] &&
              p.y + 6 > placedPinRects[off + 1] &&
              p.y - 30 < placedPinRects[off + 3]
            ) {
              blocked = true;
              break;
            }
          }
        }
        if (blocked) {
          if (!node.hidden) node.hidden = true;
          continue;
        }
        if (node.hidden) {
          node.hidden = false;
          if (pinHalfWidths[i] === 0) {
            pinHalfWidths[i] = Math.ceil(node.getBoundingClientRect().width * 0.5);
          }
        }
        const finalHalfW = pinHalfWidths[i] > 0 ? pinHalfWidths[i] : pinFallbackHalfW[i];
        const finalX = Math.max(finalHalfW + 10, Math.min(vw - finalHalfW - 10, p.x));
        const rOff = placedCount * 4;
        placedPinRects[rOff] = finalX - finalHalfW;
        placedPinRects[rOff + 1] = p.y - 28;
        placedPinRects[rOff + 2] = finalX + finalHalfW;
        placedPinRects[rOff + 3] = p.y;
        placedCount++;
        node.style.transform = `translate3d(${finalX.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
        node.classList.toggle('selected', p.selected);
      }
    }
  }

  // Instantiate 3D Specimen
  const scene3d = new HeroSpecimen3D(canvasHost, {
    onSelectStructure: (item) => {
      selectStructure(item.meshName, false);
    },
    onPinsUpdate: updatePinsDOM,
  });

  function updateStageFraming(): void {
    const vw = window.innerWidth;
    if (noteState !== 'expanded') {
      scene3d.setStageFraming(0, 0);
      return;
    }
    if (vw <= 720) {
      const sheetH = noteCard.getBoundingClientRect().height || Math.round(window.innerHeight * 0.48);
      scene3d.setStageFraming(0, Math.min(sheetH, window.innerHeight * 0.5));
      return;
    }
    const targetSidebarW =
      vw > 1080
        ? furtherReadDetails.open
          ? Math.min(476, vw - 32)
          : 388
        : furtherReadDetails.open
          ? Math.min(432, vw - 28)
          : Math.min(364, vw - 28);
    const leftInset = targetSidebarW + 16;
    scene3d.setStageFraming(vw > 1080 ? leftInset : leftInset * 0.85, 0);
  }

  // Dynamic Bottom Dock Clearance + Layout Geometry Updates
  const dockObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const h = Math.ceil(entry.contentRect.height + 20);
      appShell.style.setProperty('--dock-clearance', `${h}px`);
    }
    refreshPinKeepOutZones();
  });
  dockObserver.observe(bottomBar);

  let framingRafQueued = false;
  const scheduleGeometrySync = (): void => {
    refreshPinKeepOutZones();
    updateStageFraming();
    if (!framingRafQueued) {
      framingRafQueued = true;
      requestAnimationFrame(() => {
        framingRafQueued = false;
        refreshPinKeepOutZones();
        updateStageFraming();
      });
    }
  };
  window.addEventListener('resize', scheduleGeometrySync);
  noteCard.addEventListener('transitionend', refreshPinKeepOutZones);

  // =========================================================================
  // Theme Controller
  // =========================================================================
  function readStoredTheme(): ThemePreference {
    try {
      const v = localStorage.getItem(THEME_STORAGE_KEY);
      if (v === 'light' || v === 'dark') return v;
    } catch {
      // Ignore storage error
    }
    return 'system';
  }

  function applyTheme(pref: ThemePreference): void {
    themePreference = pref;
    try {
      if (pref === 'system') {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, pref);
      }
    } catch {
      // Ignore storage error
    }

    if (metaColorScheme) {
      metaColorScheme.content = pref === 'system' ? 'light dark' : pref;
    }

    resolvedTheme = pref === 'system' ? (darkMediaQuery.matches ? 'dark' : 'light') : pref;
    appShell.setAttribute('data-resolved-theme', resolvedTheme);

    appearanceHint.textContent =
      pref === 'system'
        ? `Following system preference (${resolvedTheme === 'dark' ? 'Dark' : 'Light'})`
        : `Manual ${pref === 'dark' ? 'Dark Glassroom' : 'Light Paper-Technical'} mode`;

    document.querySelectorAll<HTMLButtonElement>('[data-theme-pref]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.themePref === pref);
    });

    scene3d.setLightTheme(resolvedTheme === 'light');
    renderActive2DVisuals();
  }

  darkMediaQuery.addEventListener('change', () => {
    if (themePreference === 'system') {
      applyTheme('system');
    }
  });

  themeToggleBtn.addEventListener('click', () => {
    const nextTheme: ThemePreference = resolvedTheme === 'dark' ? 'light' : 'dark';
    const osMatchesNext = (nextTheme === 'dark') === darkMediaQuery.matches;
    applyTheme(osMatchesNext ? 'system' : nextTheme);
  });

  document.querySelectorAll<HTMLButtonElement>('[data-theme-pref]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = (btn.dataset.themePref as ThemePreference) || 'system';
      applyTheme(target);
    });
  });

  // =========================================================================
  // Unified Expandable Left Note Sidebar State Machine
  // =========================================================================
  function syncSidebarDOM(): void {
    const isExpanded = noteState === 'expanded';
    const isCollapsed = noteState === 'collapsed';
    const wide = isExpanded && sidebarTab === 'note' && furtherReadDetails.open;

    appShell.setAttribute('data-note-state', noteState);
    appShell.setAttribute('data-wide-read', String(wide));
    noteSidebar.setAttribute('data-note-state', noteState);
    noteSidebar.setAttribute('data-sidebar-tab', sidebarTab);
    noteSidebar.setAttribute('data-wide-read', String(wide));

    noteCollapsedPill.hidden = !isCollapsed;
    noteCard.hidden = isCollapsed;
    noteCompactBody.hidden = noteState !== 'compact';
    noteScrollBody.hidden = !isExpanded;

    sidebarPaneNote.hidden = !(isExpanded && sidebarTab === 'note');
    sidebarPaneLab.hidden = !(isExpanded && sidebarTab === 'lab');

    tabNoteBtn.classList.toggle('active', sidebarTab === 'note');
    tabNoteBtn.setAttribute('aria-selected', String(sidebarTab === 'note'));
    tabNoteBtn.tabIndex = sidebarTab === 'note' ? 0 : -1;

    tabLabBtn.classList.toggle('active', sidebarTab === 'lab');
    tabLabBtn.setAttribute('aria-selected', String(sidebarTab === 'lab'));
    tabLabBtn.tabIndex = sidebarTab === 'lab' ? 0 : -1;

    noteExpandToggleBtn.setAttribute('aria-expanded', String(isExpanded));
    noteExpandToggleBtn.setAttribute(
      'aria-label',
      isExpanded ? 'Return note sidebar to compact size' : 'Expand note sidebar for full reading'
    );

    (Object.keys(dockLabTriggers) as ShowcaseMode[]).forEach((m) => {
      const btn = dockLabTriggers[m];
      const activeHere = isExpanded && sidebarTab === 'lab' && currentMode === m;
      btn.setAttribute('aria-expanded', String(activeHere));
    });

    gyroToggleBtn.setAttribute(
      'aria-expanded',
      String(isExpanded && sidebarTab === 'lab' && currentMode === 'vestibular' && gyroDetails.open)
    );

    (Object.keys(labPanels) as ShowcaseMode[]).forEach((m) => {
      labPanels[m].hidden = m !== currentMode;
    });

    if (isExpanded && sidebarTab === 'lab') {
      requestAnimationFrame(() => {
        renderActive2DVisuals();
        scheduleGeometrySync();
      });
    } else {
      scheduleGeometrySync();
    }
  }

  function setNoteState(nextState: NoteState, nextTab?: SidebarTab): void {
    noteState = nextState;
    if (nextTab) {
      sidebarTab = nextTab;
    }
    syncSidebarDOM();
  }

  function toggleModeLabInSidebar(): void {
    if (noteState === 'expanded' && sidebarTab === 'lab') {
      setNoteState('compact', 'note');
    } else {
      setNoteState('expanded', 'lab');
    }
  }

  noteCollapsedPill.addEventListener('click', () => setNoteState('compact'));
  noteCollapseBtn.addEventListener('click', () => setNoteState('collapsed'));
  noteReadBtn.addEventListener('click', () => setNoteState('expanded', 'note'));
  noteLabShortcutBtn.addEventListener('click', () => setNoteState('expanded', 'lab'));
  noteExpandToggleBtn.addEventListener('click', () => {
    setNoteState(noteState === 'expanded' ? 'compact' : 'expanded');
  });

  tabNoteBtn.addEventListener('click', () => setNoteState('expanded', 'note'));
  tabLabBtn.addEventListener('click', () => setNoteState('expanded', 'lab'));

  [tabNoteBtn, tabLabBtn].forEach((tabBtn, idx, list) => {
    tabBtn.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault();
        const target = list[(idx + 1) % list.length];
        target.focus();
        setNoteState('expanded', (target.dataset.sidebarTab as SidebarTab) || 'note');
      }
    });
  });

  furtherReadDetails.addEventListener('toggle', () => {
    syncSidebarDOM();
  });

  gyroDetails.addEventListener('toggle', () => {
    syncSidebarDOM();
  });

  // Dock trigger bindings
  (Object.entries(dockLabTriggers) as Array<[ShowcaseMode, HTMLButtonElement]>).forEach(([, btn]) => {
    btn.addEventListener('click', () => toggleModeLabInSidebar());
  });

  gyroToggleBtn.addEventListener('click', () => {
    const alreadyShowingGyro =
      noteState === 'expanded' && sidebarTab === 'lab' && currentMode === 'vestibular' && gyroDetails.open;
    if (alreadyShowingGyro) {
      gyroDetails.open = false;
      syncSidebarDOM();
    } else {
      gyroDetails.open = true;
      setNoteState('expanded', 'lab');
      requestAnimationFrame(() => {
        gyroDetails.scrollIntoView({
          block: 'nearest',
          behavior: reducedMotionQuery.matches ? 'auto' : 'smooth',
        });
      });
    }
  });

  // =========================================================================
  // Structure Selection & Prose Rendering
  // =========================================================================
  function selectStructure(meshName: string, focusCamera: boolean): void {
    const item = STRUCTURE_BY_MESH[meshName];
    if (!item) return;
    currentMeshName = meshName;
    scene3d.selectStructure(meshName, focusCamera);

    const groupMeta = SYSTEM_GROUPS[item.systemGroup];
    noteSystemDot.style.backgroundColor = item.colorHex;
    notePillDot.style.backgroundColor = item.colorHex;
    noteSystemLabel.textContent = groupMeta.shortTitle;
    notePillLabel.textContent = `${item.shortLabel} · Open Note`;
    noteTitle.textContent = formatStructureHeadline(item);
    noteCompactLead.textContent = getCompactNoteSentence(item);

    if (readingDepth === 'simple') {
      inspSummary.textContent = item.patientSummary;
      inspDeepProse.textContent = item.physiologicalFunction;
    } else {
      inspSummary.textContent = item.physiologicalFunction;
      inspDeepProse.textContent = item.patientSummary;
    }

    inspFluid.textContent = compactFluidLabel(item.fluidCompartment);
    const metric = getStructurePrimaryMetric(item);
    inspMetricKey.textContent = metric.key;
    inspMetricVal.textContent = metric.value;

    inspLatin.textContent = `${item.latinName} · ${item.subGroup}`;
    inspInnervation.textContent = item.innervation;
    inspMorphometry.textContent = item.morphometry;
    inspRasChip.textContent = `${formatRAS(item.centroidRAS)} mm · ${item.meshName}`;
    inspPearl.textContent = item.clinicalPearl;

    repActivePart.textContent = `${item.displayName} (${formatRAS(item.centroidRAS)} mm)`;
    btnIsolate.textContent = scene3d.isIsolated() ? 'Restore All' : 'Isolate Part';

    if (noteState === 'collapsed' && focusCamera) {
      setNoteState('compact');
    } else {
      scheduleGeometrySync();
    }
    renderPartsList();
  }

  btnIsolate.addEventListener('click', () => {
    const isolated = scene3d.toggleIsolate(currentMeshName);
    btnIsolate.textContent = isolated ? 'Restore All' : 'Isolate Part';
  });

  btnResetView.addEventListener('click', () => {
    scene3d.resetCamera();
  });

  toolResetBtn.addEventListener('click', () => {
    scene3d.resetCamera();
  });

  function syncBonePeel(val: number): void {
    const rounded = Math.round(val);
    const valStr = String(rounded);
    const labelTxt = `${rounded}%`;
    const ariaTxt = `${rounded} percent opacity`;

    bonePeelSlider.value = valStr;
    bonePeelVal.textContent = labelTxt;
    bonePeelSlider.setAttribute('aria-valuetext', ariaTxt);
    updateRangeProgress(bonePeelSlider);

    mobileBonePeelSlider.value = valStr;
    mobileBonePeelVal.textContent = labelTxt;
    mobileBonePeelSlider.setAttribute('aria-valuetext', ariaTxt);
    updateRangeProgress(mobileBonePeelSlider);

    scene3d.setBonyPeel(val);
  }

  function syncExplode(val: number): void {
    const rounded = Math.round(val);
    const valStr = String(rounded);
    const labelTxt = `${rounded}%`;
    const ariaTxt = `${rounded} percent radial separation`;

    explodeSlider.value = valStr;
    explodeVal.textContent = labelTxt;
    explodeSlider.setAttribute('aria-valuetext', ariaTxt);
    updateRangeProgress(explodeSlider);

    mobileExplodeSlider.value = valStr;
    mobileExplodeVal.textContent = labelTxt;
    mobileExplodeSlider.setAttribute('aria-valuetext', ariaTxt);
    updateRangeProgress(mobileExplodeSlider);

    scene3d.setExplode(val);
  }

  toolLabelsBtn.addEventListener('click', () => {
    const order: LabelDensity[] = ['key', 'all', 'off'];
    const next = order[(order.indexOf(labelDensity) + 1) % order.length];
    setLabelDensity(next);
  });

  function setLabelDensity(density: LabelDensity): void {
    labelDensity = density;
    scene3d.setLabelDensity(density);
    toolLabelsBtn.classList.toggle('active', density !== 'off');
    toolLabelsBtn.setAttribute('aria-pressed', String(density !== 'off'));
    document.querySelectorAll<HTMLButtonElement>('[data-label-mode]').forEach((b) => {
      b.classList.toggle('active', b.dataset.labelMode === density);
    });
  }

  // =========================================================================
  // 5-Mode Tablist Navigation (ARIA Tablist + Arrow Keys)
  // =========================================================================
  function setMode(mode: ShowcaseMode): void {
    currentMode = mode;
    appShell.setAttribute('data-mode', mode);
    repActiveMode.textContent = MODE_LABELS[mode];

    const labLabel = MODE_LAB_TAB_LABELS[mode];
    tabLabBtn.textContent = labLabel;
    noteLabShortcutBtn.textContent = labLabel;

    modePills.forEach((pill) => {
      const active = pill.dataset.mode === mode;
      pill.classList.toggle('active', active);
      pill.setAttribute('aria-selected', String(active));
      pill.tabIndex = active ? 0 : -1;
      if (active) {
        pill.scrollIntoView({
          behavior: reducedMotionQuery.matches ? 'auto' : 'smooth',
          inline: 'nearest',
          block: 'nearest',
          container: 'nearest',
        } as ScrollIntoViewOptions);
      }
    });

    (Object.keys(dockPanels) as ShowcaseMode[]).forEach((k) => {
      dockPanels[k].hidden = k !== mode;
    });

    scene3d.setMode(mode);
    const defaultMesh = MODE_DEFAULT_MESH[mode];
    if (defaultMesh && STRUCTURE_BY_MESH[defaultMesh]) {
      selectStructure(defaultMesh, false);
    }

    if (noteState === 'expanded') {
      setNoteState('expanded', 'note');
    } else {
      setNoteState('compact', 'note');
    }
    syncModeSpecificScene();
  }

  modePills.forEach((pill, index) => {
    pill.addEventListener('click', () => {
      const m = (pill.dataset.mode as ShowcaseMode) || 'anatomy';
      setMode(m);
    });
    pill.addEventListener('keydown', (ev) => {
      let nextIdx = -1;
      if (ev.key === 'ArrowRight') nextIdx = (index + 1) % modePills.length;
      else if (ev.key === 'ArrowLeft') nextIdx = (index - 1 + modePills.length) % modePills.length;
      else if (ev.key === 'Home') nextIdx = 0;
      else if (ev.key === 'End') nextIdx = modePills.length - 1;
      if (nextIdx >= 0) {
        ev.preventDefault();
        const target = modePills[nextIdx];
        target.focus();
        setMode((target.dataset.mode as ShowcaseMode) || 'anatomy');
      }
    });
  });

  let modeScrollObserver: IntersectionObserver | null = null;
  if (
    modeSwitcher &&
    modeSwitcher.firstElementChild &&
    modeSwitcher.lastElementChild &&
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    !CSS.supports('animation-timeline', 'scroll()')
  ) {
    modeScrollObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === modeSwitcher.firstElementChild) {
            modeSwitcher.classList.toggle('more-start', entry.intersectionRatio < 1);
          } else if (entry.target === modeSwitcher.lastElementChild) {
            modeSwitcher.classList.toggle('more-end', entry.intersectionRatio < 1);
          }
        }
      },
      { root: modeSwitcher, threshold: 1, rootMargin: '1px' }
    );
    modeScrollObserver.observe(modeSwitcher.firstElementChild);
    modeScrollObserver.observe(modeSwitcher.lastElementChild);
  }

  function syncModeSpecificScene(): void {
    if (currentMode === 'hearing') {
      const loss = AUDIOGRAM_PRESETS[currentAudioPreset].highlightRangeX;
      scene3d.setHearingState(currentFreqHz, loss);
    } else if (currentMode === 'radiology') {
      scene3d.setRadiologyState(currentPlane, currentRadDepthMm, scdsActive);
    } else if (currentMode === 'vestibular') {
      scene3d.setVestibularState(vestSubmode, vestStepIdx, vestYawDeg, vestPitchDeg, vestRollDeg);
    } else if (currentMode === 'surgical') {
      scene3d.setSurgicalState(surgProc, surgCiDepthMm, surgLabStep);
    }
    renderActive2DVisuals();
  }

  // =========================================================================
  // Mode Dock & Sidebar Panel Handlers
  // =========================================================================
  document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const presetId = btn.dataset.preset ?? 'overview';
      document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      const preset = getAnatomyHighlightPreset(presetId);
      scene3d.applyPreset(preset.id);
      syncBonePeel(preset.bonyPeelPercent);
      syncExplode(preset.explodePercent);

      if (preset.defaultSelectedMesh) {
        selectStructure(preset.defaultSelectedMesh, false);
      }
    });
  });

  bonePeelSlider.addEventListener('input', () => syncBonePeel(parseFloat(bonePeelSlider.value)));
  mobileBonePeelSlider.addEventListener('input', () => syncBonePeel(parseFloat(mobileBonePeelSlider.value)));
  explodeSlider.addEventListener('input', () => syncExplode(parseFloat(explodeSlider.value)));
  mobileExplodeSlider.addEventListener('input', () => syncExplode(parseFloat(mobileExplodeSlider.value)));

  // 27 Parts Filter & List
  document.querySelectorAll<HTMLButtonElement>('[data-sys-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentSystemFilter = (btn.dataset.sysFilter as 'all' | SystemGroupId) || 'all';
      document.querySelectorAll<HTMLButtonElement>('[data-sys-filter]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      renderPartsList();
    });
  });

  partsFilterInput.addEventListener('input', () => {
    partsSearchQuery = partsFilterInput.value.trim().toLowerCase();
    renderPartsList();
  });

  function renderPartsList(): void {
    const frag = document.createDocumentFragment();
    const filtered = IEMAP_STRUCTURES.filter((s) => {
      if (currentSystemFilter !== 'all' && s.systemGroup !== currentSystemFilter) return false;
      if (!partsSearchQuery) return true;
      return (
        s.displayName.toLowerCase().includes(partsSearchQuery) ||
        s.shortLabel.toLowerCase().includes(partsSearchQuery) ||
        s.latinName.toLowerCase().includes(partsSearchQuery)
      );
    });
    for (const item of filtered) {
      const row = document.createElement('div');
      row.className = 'part-row';

      const selBtn = document.createElement('button');
      selBtn.type = 'button';
      selBtn.className = 'part-select-btn';
      const dot = document.createElement('span');
      dot.className = 'pin-dot';
      dot.style.backgroundColor = item.colorHex;
      const nameSpan = document.createElement('span');
      nameSpan.className = 'part-name';
      nameSpan.textContent = formatStructureHeadline(item);
      selBtn.append(dot, nameSpan);
      selBtn.addEventListener('click', () => {
        selectStructure(item.meshName, true);
      });

      const visState = scene3d.getStructureVisibility(item.meshName);
      const visBtn = document.createElement('button');
      visBtn.type = 'button';
      visBtn.className = 'part-vis-btn';
      visBtn.dataset.state = visState;
      visBtn.textContent = visState === 'visible' ? 'Show' : visState === 'ghost' ? 'Ghost' : 'Hide';
      visBtn.addEventListener('click', () => {
        const next = visState === 'visible' ? 'ghost' : visState === 'ghost' ? 'hidden' : 'visible';
        scene3d.setStructureVisibility(item.meshName, next);
        renderPartsList();
      });

      row.append(selBtn, visBtn);
      frag.appendChild(row);
    }
    partsList.replaceChildren(frag);
  }

  // Hearing Controls
  function setFrequencyHz(freqHz: number): void {
    currentFreqHz = Math.max(20, Math.min(20000, freqHz));
    const x = greenwoodPosition(currentFreqHz);
    const distMm = getDistanceApexMm(x);
    hearingFreqSlider.value = String(frequencyHzToSliderValue(currentFreqHz));
    updateRangeProgress(hearingFreqSlider);
    hearingFreqReadout.textContent = `${formatFrequencyHz(currentFreqHz)} · ${distMm.toFixed(1)} mm`;
    hearingFreqSlider.setAttribute('aria-valuetext', `${formatFrequencyHz(currentFreqHz)}`);

    const landmark = getAcousticLandmark(currentFreqHz);
    if (currentAudioPreset === 'normal') {
      audiogramCaption.textContent = `${landmark.shortTag} (${formatFrequencyHz(currentFreqHz)} · ${distMm.toFixed(1)} mm from apex).`;
    }

    document.querySelectorAll<HTMLButtonElement>('[data-octave]').forEach((b) => {
      const o = parseInt(b.dataset.octave || '0', 10);
      b.classList.toggle('active', Math.abs(currentFreqHz - o) / o < 0.08);
    });

    if (currentMode === 'hearing') {
      scene3d.setHearingState(currentFreqHz, AUDIOGRAM_PRESETS[currentAudioPreset].highlightRangeX);
    }
    if (noteState === 'expanded' && sidebarTab === 'lab' && currentMode === 'hearing') {
      renderAudiogramSvg();
    }
  }

  hearingFreqSlider.addEventListener('input', () => {
    setFrequencyHz(sliderValueToFrequencyHz(parseFloat(hearingFreqSlider.value)));
  });

  document.querySelectorAll<HTMLButtonElement>('[data-octave]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setFrequencyHz(parseInt(btn.dataset.octave || '1000', 10));
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-audio-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentAudioPreset = (btn.dataset.audioPreset as AudiogramPresetId) || 'normal';
      document.querySelectorAll<HTMLButtonElement>('[data-audio-preset]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      audiogramCaption.textContent = AUDIOGRAM_PRESETS[currentAudioPreset].caption;
      syncModeSpecificScene();
    });
  });

  // Radiology Controls
  document.querySelectorAll<HTMLButtonElement>('[data-plane]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentPlane = (btn.dataset.plane as RadiologyPlaneId) || 'poschl';
      document.querySelectorAll<HTMLButtonElement>('[data-plane]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      const def = RADIOLOGY_PLANES[currentPlane];
      radDepthSlider.min = String(Math.round(def.minDepthMm * 10));
      radDepthSlider.max = String(Math.round(def.maxDepthMm * 10));
      currentRadDepthMm = def.defaultDepthMm;
      radDepthSlider.value = String(Math.round(currentRadDepthMm * 10));
      updateRadDepthUI();
      syncModeSpecificScene();
    });
  });

  radDepthSlider.addEventListener('input', () => {
    currentRadDepthMm = parseFloat(radDepthSlider.value) / 10;
    updateRadDepthUI();
    syncModeSpecificScene();
  });

  function updateRadDepthUI(): void {
    updateRangeProgress(radDepthSlider);
    const sign = currentRadDepthMm >= 0 ? '+' : '';
    const txt = `${sign}${currentRadDepthMm.toFixed(1)} mm`;
    radDepthReadout.textContent = txt;
    ctDepthBadge.textContent = txt;
    radDepthSlider.setAttribute('aria-valuetext', `${txt}`);

    const def = RADIOLOGY_PLANES[currentPlane];
    ctDrawerTitle.textContent = `${def.title} MPR`;
    ctDrawerSub.textContent =
      currentCtWindow === 'bone'
        ? 'Bone Window W:4000 / L:+700 HU · Illustrative slice'
        : '3D FIESTA / T2 CISS CSF Contrast · Illustrative slice';
    const lm = getLandmarkForDepth(currentPlane, currentRadDepthMm);
    ctLandmarkCaption.textContent = scdsActive
      ? `SSCD 1.5 mm roof dehiscence at ${formatRAS(SCDS_PARAMETERS.apexRAS)} mm`
      : lm.label;
  }

  radScdsBtn.addEventListener('click', () => {
    scdsActive = !scdsActive;
    radScdsBtn.classList.toggle('active', scdsActive);
    radScdsBtn.setAttribute('aria-pressed', String(scdsActive));
    updateRadDepthUI();
    syncModeSpecificScene();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-ct-window]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentCtWindow = (btn.dataset.ctWindow as CTWindowMode) || 'bone';
      document.querySelectorAll<HTMLButtonElement>('[data-ct-window]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      updateRadDepthUI();
      renderCTSliceCanvas();
    });
  });

  // Vestibular & Gyro Controls
  document.querySelectorAll<HTMLButtonElement>('[data-vest-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      vestSubmode = (btn.dataset.vestSub as VestibularSubmode) || 'bppv';
      document.querySelectorAll<HTMLButtonElement>('[data-vest-sub]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      updateVestUI();
      syncModeSpecificScene();
    });
  });

  vestStepSlider.addEventListener('input', () => {
    vestStepIdx = Math.max(0, Math.min(4, parseInt(vestStepSlider.value, 10)));
    updateVestUI();
    syncModeSpecificScene();
  });

  function updateVestUI(): void {
    updateRangeProgress(vestStepSlider);
    if (vestSubmode === 'bppv') {
      const step = EPLEY_STEPS[vestStepIdx];
      vestStepReadout.textContent = `${vestStepIdx + 1}/5 · ${step.shortTitle.replace(/^\d+\.\s*/, '')}`;
      vestYawDeg = Math.max(-90, Math.min(90, step.targetYawDeg));
      vestPitchDeg = (step.targetReclineDeg ?? step.targetPitchDeg) > 60 ? -30 : 0;
      vestRollDeg = 0;
      syncGyroSliders();

      vorDrawerTitle.textContent = 'Bilateral VOR & BPPV Nystagmogram';
      vorDrawerSub.textContent = `Posterior canal φ = ${step.targetPhiDeg}° · Steinhausen model`;
      const activeSpv = vestStepIdx === 1 || vestStepIdx === 2 ? 24.0 : vestStepIdx === 3 ? 12.0 : 2.5;
      vorSpvTag.textContent = `SPV: ${activeSpv.toFixed(1)}°/s`;
      vorGainTag.textContent = 'vHIT: 0.96';
      vorUwTag.textContent = vestStepIdx === 4 ? 'Cleared: 100%' : 'R. Posterior';
      vorCaption.textContent = step.patientCaption;
    } else if (vestSubmode === 'caloric') {
      const conv = computeCaloricConvection(7.0, 35.0, 'right');
      const jong = calculateJongkees(
        CALORIC_CLINICAL_PRESETS.normal.r44,
        CALORIC_CLINICAL_PRESETS.normal.r30,
        CALORIC_CLINICAL_PRESETS.normal.l44,
        CALORIC_CLINICAL_PRESETS.normal.l30
      );
      vestStepReadout.textContent = 'R44°C Peak · COWS';
      vorDrawerTitle.textContent = 'Caloric Convection (COWS) & Jongkees';
      vorDrawerSub.textContent = 'Supine +30° horizontal canal · t_peak = 35 s';
      vorSpvTag.textContent = `SPV: ${conv.slowPhaseVelocity.toFixed(1)} °/s`;
      vorGainTag.textContent = `Beat: ${conv.fastPhaseBeatDirection}`;
      vorUwTag.textContent = `UW: ${jong.canalParesisPercent.toFixed(1)}%`;
      vorCaption.textContent =
        'Warm irrigation generates ampullopetal convective flow toward the utricle, provoking ipsilateral fast beats (COWS).';
    } else {
      const presets: Array<'normal' | 'acute_neuritis' | 'chronic_schwannoma' | 'bilateral_loss'> = [
        'normal',
        'normal',
        'acute_neuritis',
        'chronic_schwannoma',
        'bilateral_loss',
      ];
      const chosen = presets[vestStepIdx] ?? 'normal';
      vhitBuffer.simulateTrial(chosen, 'himp', false);
      vestStepReadout.textContent = `${chosen.replace('_', ' ')}`;
      vorDrawerTitle.textContent = 'vHIT High-Acceleration Impulse (HIMP)';
      vorDrawerSub.textContent = 'Curthoys 40–80 ms area gain · ω_peak = 250°/s';
      vorSpvTag.textContent = 'ω_peak: 250 °/s';
      vorGainTag.textContent = `Gain: ${vhitBuffer.calculatedGain.toFixed(2)}`;
      vorUwTag.textContent = vhitBuffer.overtSaccadePresent ? 'Saccade: Overt/Covert' : 'VOR Normal';
      vorCaption.textContent =
        '40–80 ms window integrates inverted eye velocity over head velocity before corrective catch-up saccades.';
    }
  }

  function syncGyroSliders(): void {
    gyroYawSlider.value = String(Math.round(vestYawDeg));
    gyroPitchSlider.value = String(Math.round(vestPitchDeg));
    gyroRollSlider.value = String(Math.round(vestRollDeg));
    gyroYawVal.textContent = `${vestYawDeg >= 0 ? '+' : ''}${Math.round(vestYawDeg)}°`;
    gyroPitchVal.textContent = `${vestPitchDeg >= 0 ? '+' : ''}${Math.round(vestPitchDeg)}°`;
    gyroRollVal.textContent = `${vestRollDeg >= 0 ? '+' : ''}${Math.round(vestRollDeg)}°`;
    updateRangeProgress(gyroYawSlider);
    updateRangeProgress(gyroPitchSlider);
    updateRangeProgress(gyroRollSlider);
  }

  [gyroYawSlider, gyroPitchSlider, gyroRollSlider].forEach((s) => {
    s.addEventListener('input', () => {
      vestYawDeg = parseFloat(gyroYawSlider.value);
      vestPitchDeg = parseFloat(gyroPitchSlider.value);
      vestRollDeg = parseFloat(gyroRollSlider.value);
      syncGyroSliders();
      syncModeSpecificScene();
    });
  });

  // Surgical Controls
  document.querySelectorAll<HTMLButtonElement>('[data-surg-proc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      surgProc = (btn.dataset.surgProc as SurgicalProcedure) || 'cochlear_implant';
      document.querySelectorAll<HTMLButtonElement>('[data-surg-proc]').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      if (surgProc === 'cochlear_implant') {
        surgParamLabel.textContent = 'CI Depth';
        surgParamSlider.min = '0';
        surgParamSlider.max = '28';
        surgParamSlider.step = '0.5';
        surgParamSlider.value = String(surgCiDepthMm);
      } else if (surgProc === 'labyrinthectomy') {
        surgParamLabel.textContent = 'Ablation Stage';
        surgParamSlider.min = '0';
        surgParamSlider.max = '3';
        surgParamSlider.step = '1';
        surgParamSlider.value = String(surgLabStep);
      } else {
        surgParamLabel.textContent = 'Koos Tumor Stage';
        surgParamSlider.min = '0';
        surgParamSlider.max = '4';
        surgParamSlider.step = '1';
        surgParamSlider.value = String(surgNeurKoos);
      }
      updateSurgicalUI();
      syncModeSpecificScene();
    });
  });

  surgParamSlider.addEventListener('input', () => {
    const val = parseFloat(surgParamSlider.value);
    if (surgProc === 'cochlear_implant') {
      surgCiDepthMm = val;
    } else if (surgProc === 'labyrinthectomy') {
      surgLabStep = Math.max(0, Math.min(3, Math.round(val))) as 0 | 1 | 2 | 3;
    } else {
      surgNeurKoos = Math.max(0, Math.min(4, Math.round(val))) as 0 | 1 | 2 | 3 | 4;
    }
    updateSurgicalUI();
    syncModeSpecificScene();
  });

  function updateSurgicalUI(): void {
    updateRangeProgress(surgParamSlider);
    if (surgProc === 'cochlear_implant') {
      const pitchSim = surgCiDepthMm > 24.5 ? (surgCiDepthMm - 24.0) * 5.0 : 0;
      const st = computeCIInsertionKinematics(surgCiDepthMm, 'lateral_wall', 'round_window', pitchSim, 0);
      surgParamReadout.textContent = `${st.insertionDepthMm.toFixed(1)} mm · ${Math.round(st.angularDepthDeg)}°`;
      surgDrawerTitle.textContent = 'Scala Tympani Lumen & Insertion Force';
      surgDrawerSub.textContent = '30 mN translocation guard · 28.0 mm straight carrier';
      surgForceTag.textContent = `Force: ${st.insertionForceMilliNewtons.toFixed(1)} mN`;
      surgDbmTag.textContent = `dBM: ${st.distanceToBasilarMembraneMm.toFixed(2)} mm`;
      surgRiskTag.textContent = st.translocationRisk.toUpperCase();
      surgRiskTag.dataset.severity = st.translocationRisk;
      surgCaption.textContent = `Active electrodes inside cochlea: ${st.activeElectrodesInCochlea}/22 along Scala Tympani spline.`;
    } else if (surgProc === 'labyrinthectomy') {
      const st = computeLabyrinthectomyAblation(surgLabStep, surgLabStep === 3 ? 24 : 0, surgLabStep > 0);
      surgParamReadout.textContent = `Stage ${st.step}/3 · τ = 72 h`;
      surgDrawerTitle.textContent = 'Transmastoid Labyrinthectomy & Compensation';
      surgDrawerSub.textContent = 'Acute vestibular deafferentation & central τ = 72 h decay';
      surgForceTag.textContent = `CN VIII: ${Math.round(st.vestibularFiringRateSpikesSec)} sp/s`;
      surgDbmTag.textContent = `SPV: ${st.spontaneousSPVDegSec.toFixed(1)}°/s`;
      surgRiskTag.textContent = `vHIT: ${st.vhitGain.toFixed(2)}`;
      delete surgRiskTag.dataset.severity;
      surgCaption.textContent =
        'Staged milling of Lateral, Superior & Posterior osseous canals followed by neuroepithelial curettage.';
    } else {
      const st = computeNeurectomyElectrophysiology(3, surgNeurKoos, 2.2, surgNeurKoos * 0.5, 'scissors', true);
      surgParamReadout.textContent = `Koos Grade ${st.koosStage} · CPA`;
      surgDrawerTitle.textContent = 'IAC 4-Quadrant & ABR / EMG Monitor';
      surgDrawerSub.textContent = 'Bill’s Bar & Falciform Crest cleavage plane telemetry';
      surgForceTag.textContent = `ABR V: ${st.abrWaveVLatencyMs.toFixed(2)} ms`;
      surgDbmTag.textContent = `EMG: ${st.facialEMGVoltageMicroVolts.toFixed(0)} μV`;
      surgRiskTag.textContent = `Traction: ${st.tractionRisk}`;
      delete surgRiskTag.dataset.severity;
      surgCaption.textContent =
        'Retrosigmoid cleavage plane preserves cochlear and facial nerve integrity during vestibular division transection.';
    }
  }

  // =========================================================================
  // 2D Clinical Plots (SVG Audiogram + Retina DPR Canvas 2D)
  // =========================================================================
  function getPlotTokens(): {
    bg: string;
    grid: string;
    text: string;
    accent: string;
    amber: string;
    crimson: string;
    green: string;
  } {
    const isLight = resolvedTheme === 'light';
    return {
      bg: isLight ? '#eaece9' : '#0c131a',
      grid: isLight ? 'rgba(20, 24, 28, 0.16)' : 'rgba(226, 236, 244, 0.14)',
      text: isLight ? '#38414a' : '#a8b6c4',
      accent: isLight ? '#0c667e' : '#2ec4b6',
      amber: isLight ? '#b45309' : '#e5a93c',
      crimson: isLight ? '#be123c' : '#f46b78',
      green: isLight ? '#15803d' : '#4ade80',
    };
  }

  function renderAudiogramSvg(): void {
    if (!audiogramSvg) return;
    const tok = getPlotTokens();
    const w = 360;
    const h = 225;
    const padL = 42;
    const padR = 16;
    const padT = 18;
    const padB = 32;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const svgChildren: SVGElement[] = [];
    const el = (tag: string, attrs: Record<string, string | number>): SVGElement => {
      const node = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
      return node;
    };

    const xForFreq = (f: number): number => {
      const idx = AUDIOGRAM_FREQUENCIES.indexOf(f as (typeof AUDIOGRAM_FREQUENCIES)[number]);
      const frac = idx >= 0 ? idx / (AUDIOGRAM_FREQUENCIES.length - 1) : Math.log2(f / 125) / 6;
      return padL + frac * plotW;
    };
    const yForDb = (db: number): number => padT + ((db + 10) / 130) * plotH;

    svgChildren.push(
      el('rect', {
        x: padL,
        y: yForDb(-10),
        width: plotW,
        height: yForDb(20) - yForDb(-10),
        fill: tok.accent,
        'fill-opacity': 0.08,
      })
    );

    for (let db = 0; db <= 120; db += 20) {
      const y = yForDb(db);
      svgChildren.push(el('line', { x1: padL, y1: y, x2: w - padR, y2: y, stroke: tok.grid, 'stroke-width': 1 }));
      const txt = el('text', {
        x: padL - 6,
        y: y + 4,
        'text-anchor': 'end',
        fill: tok.text,
        'font-size': 12,
        'font-family': 'ui-monospace, monospace',
      });
      txt.textContent = `${db}`;
      svgChildren.push(txt);
    }

    for (const f of AUDIOGRAM_FREQUENCIES) {
      const x = xForFreq(f);
      svgChildren.push(el('line', { x1: x, y1: padT, x2: x, y2: h - padB, stroke: tok.grid, 'stroke-width': 1 }));
      const txt = el('text', {
        x,
        y: h - 10,
        'text-anchor': 'middle',
        fill: tok.text,
        'font-size': 12,
        'font-family': 'ui-monospace, monospace',
      });
      txt.textContent = f >= 1000 ? `${f / 1000}k` : `${f}`;
      svgChildren.push(txt);
    }

    const xForContinuousFreq = (f: number): number => {
      const last = AUDIOGRAM_FREQUENCIES.length - 1;
      if (f <= AUDIOGRAM_FREQUENCIES[0]) return padL;
      if (f >= AUDIOGRAM_FREQUENCIES[last]) return padL + plotW;
      for (let i = 0; i < last; i++) {
        const f0 = AUDIOGRAM_FREQUENCIES[i];
        const f1 = AUDIOGRAM_FREQUENCIES[i + 1];
        if (f >= f0 && f <= f1) {
          const localT = Math.log2(f / f0) / Math.log2(f1 / f0);
          return padL + ((i + localT) / last) * plotW;
        }
      }
      return padL + plotW;
    };
    const curX = xForContinuousFreq(currentFreqHz);
    svgChildren.push(
      el('line', {
        x1: curX,
        y1: padT,
        x2: curX,
        y2: h - padB,
        stroke: tok.accent,
        'stroke-width': 1.5,
        'stroke-dasharray': '4 3',
      })
    );

    const profile = AUDIOGRAM_PRESETS[currentAudioPreset];
    const pts = profile.thresholdsDb.map((p) => `${xForFreq(p.freqHz).toFixed(1)},${yForDb(p.dbHl).toFixed(1)}`).join(' ');
    svgChildren.push(
      el('polyline', {
        points: pts,
        fill: 'none',
        stroke: tok.crimson,
        'stroke-width': 2.2,
      })
    );
    for (const p of profile.thresholdsDb) {
      svgChildren.push(
        el('circle', {
          cx: xForFreq(p.freqHz),
          cy: yForDb(p.dbHl),
          r: 4.2,
          fill: tok.bg,
          stroke: tok.crimson,
          'stroke-width': 2,
        })
      );
    }
    audiogramSvg.replaceChildren(...svgChildren);
  }

  function setupCanvas2D(canvas: HTMLCanvasElement, cssW: number, cssH: number): CanvasRenderingContext2D | null {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function renderCTSliceCanvas(): void {
    const w = 340;
    const h = 212;
    const ctx = setupCanvas2D(ctSliceCanvas, w, h);
    if (!ctx) return;

    const isMri = currentCtWindow === 'mri_t2';
    ctx.fillStyle = isMri ? '#070b10' : '#0b0e12';
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.52;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.ellipse(0, 0, 128, 78, -0.18, 0, Math.PI * 2);
    ctx.fillStyle = isMri ? '#16202a' : '#2d333b';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = isMri ? '#304050' : '#85909d';
    ctx.stroke();

    if (currentPlane === 'poschl' || currentPlane === 'stenvers') {
      ctx.beginPath();
      ctx.arc(-8, -6, 38, 0.25, Math.PI * 1.9);
      ctx.lineWidth = 9;
      ctx.strokeStyle = isMri ? '#7dd3fc' : '#f1f5f9';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-8, -6, 38, 0.25, Math.PI * 1.9);
      ctx.lineWidth = 4;
      ctx.strokeStyle = isMri ? '#ffffff' : '#0b0e12';
      ctx.stroke();

      if (scdsActive) {
        ctx.fillStyle = '#0b0e12';
        ctx.fillRect(-16, -49, 16, 10);
        ctx.strokeStyle = '#f46b78';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(-18, -51, 20, 13);
      }
    } else if (currentPlane === 'axial') {
      ctx.beginPath();
      ctx.arc(16, -6, 30, 0, Math.PI * 2);
      ctx.lineWidth = 7;
      ctx.strokeStyle = isMri ? '#e0f2fe' : '#e2e8f0';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-32, 18, 22, 0.2, Math.PI * 1.85);
      ctx.lineWidth = 6;
      ctx.strokeStyle = isMri ? '#bae6fd' : '#cbd5e1';
      ctx.stroke();
    } else {
      for (let t = 0; t < 3; t++) {
        ctx.beginPath();
        ctx.arc(-18, 8 - t * 14, 24 - t * 6, 0, Math.PI * 1.75);
        ctx.lineWidth = 5;
        ctx.strokeStyle = isMri ? '#bae6fd' : '#e2e8f0';
        ctx.stroke();
      }
    }

    const offsetPx = currentRadDepthMm * 4.2;
    ctx.strokeStyle = 'rgba(46, 196, 182, 0.72)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(-140, offsetPx * 0.25);
    ctx.lineTo(140, offsetPx * 0.25);
    ctx.stroke();
    ctx.restore();

    const orient = RADIOLOGY_PLANES[currentPlane].orientationLabels;
    ctx.fillStyle = '#a8b6c4';
    ctx.font = '600 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(orient.top, w / 2, 16);
    ctx.fillText(orient.bottom, w / 2, h - 8);
    ctx.textAlign = 'left';
    ctx.fillText(orient.left, 10, h / 2);
    ctx.textAlign = 'right';
    ctx.fillText(orient.right, w - 10, h / 2);
  }

  function renderVORCanvas(): void {
    const w = 340;
    const h = 190;
    const ctx = setupCanvas2D(vorStripCanvas, w, h);
    if (!ctx) return;
    const tok = getPlotTokens();

    ctx.fillStyle = tok.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = tok.grid;
    ctx.lineWidth = 1;
    for (let y = 32; y < h; y += 38) {
      ctx.beginPath();
      ctx.moveTo(12, y);
      ctx.lineTo(w - 12, y);
      ctx.stroke();
    }

    if (vestSubmode === 'vhit') {
      const winX1 = 16 + (40 / 350) * (w - 32);
      const winX2 = 16 + (80 / 350) * (w - 32);
      ctx.fillStyle = resolvedTheme === 'light' ? 'rgba(12, 102, 126, 0.14)' : 'rgba(46, 196, 182, 0.16)';
      ctx.fillRect(winX1, 14, winX2 - winX1, h - 38);

      const scaleX = (w - 32) / VHITImpulseBuffer.CAPACITY;
      const baseY = h - 32;
      const scaleY = (h - 56) / 300;

      ctx.beginPath();
      ctx.strokeStyle = tok.accent;
      ctx.lineWidth = 2;
      for (let i = 0; i < VHITImpulseBuffer.CAPACITY; i++) {
        const px = 16 + i * scaleX;
        const py = baseY - vhitBuffer.headVelArray[i] * scaleY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = tok.amber;
      ctx.lineWidth = 2;
      for (let i = 0; i < VHITImpulseBuffer.CAPACITY; i++) {
        const px = 16 + i * scaleX;
        const py = baseY - vhitBuffer.invertedEyeVelArray[i] * scaleY;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      ctx.fillStyle = tok.text;
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillText('Head (teal) vs Eye (amber) · 40–80 ms', 14, h - 10);
    } else {
      const spvMag = vestSubmode === 'caloric' ? 28 : vestStepIdx === 1 || vestStepIdx === 2 ? 24 : 6;
      ctx.beginPath();
      ctx.strokeStyle = tok.accent;
      ctx.lineWidth = 2;
      const midY = h * 0.48;
      const period = 52;
      for (let x = 16; x <= w - 16; x++) {
        const phase = ((x - 16) % period) / period;
        const saw = phase < 0.85 ? (phase / 0.85 - 0.5) * spvMag * 1.4 : ((1 - phase) / 0.15 - 0.5) * spvMag * 1.4;
        const py = midY - saw;
        if (x === 16) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      }
      ctx.stroke();

      ctx.fillStyle = tok.text;
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillText(
        vestSubmode === 'caloric' ? 'COWS Fast-Phase Nystagmogram Strip' : 'Dix-Hallpike / Epley Slow-Fast Trace',
        14,
        h - 12
      );
    }
  }

  function renderSurgicalCanvas(): void {
    const w = 340;
    const h = 190;
    const ctx = setupCanvas2D(surgicalCanvas, w, h);
    if (!ctx) return;
    const tok = getPlotTokens();

    ctx.fillStyle = tok.bg;
    ctx.fillRect(0, 0, w, h);

    const padL = 38;
    const padR = 16;
    const padT = 18;
    const padB = 28;
    const pw = w - padL - padR;
    const ph = h - padT - padB;

    if (surgProc === 'cochlear_implant') {
      const yThreshold = padT + (1 - 30 / 42) * ph;
      ctx.strokeStyle = tok.crimson;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, yThreshold);
      ctx.lineTo(w - padR, yThreshold);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.strokeStyle = tok.accent;
      ctx.lineWidth = 2.2;
      for (let d = 0; d <= 28; d += 0.5) {
        const pSim = d > 24.5 ? (d - 24.0) * 5.0 : 0;
        const kin = computeCIInsertionKinematics(d, 'lateral_wall', 'round_window', pSim, 0);
        const x = padL + (d / 28) * pw;
        const y = padT + (1 - Math.min(42, kin.insertionForceMilliNewtons) / 42) * ph;
        if (d === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const curX = padL + (surgCiDepthMm / 28) * pw;
      const curK = computeCIInsertionKinematics(
        surgCiDepthMm,
        'lateral_wall',
        'round_window',
        surgCiDepthMm > 24.5 ? (surgCiDepthMm - 24) * 5 : 0,
        0
      );
      const curY = padT + (1 - Math.min(42, curK.insertionForceMilliNewtons) / 42) * ph;
      ctx.fillStyle = curK.translocationRisk === 'breach' ? tok.crimson : tok.amber;
      ctx.beginPath();
      ctx.arc(curX, curY, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = tok.text;
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillText('30 mN Translocation Guard', padL + 6, yThreshold - 5);
      ctx.fillText('0 mm', padL, h - 8);
      ctx.fillText('28 mm (650°)', w - 98, h - 8);
    } else if (surgProc === 'labyrinthectomy') {
      ctx.beginPath();
      ctx.strokeStyle = tok.accent;
      ctx.lineWidth = 2.2;
      for (let hr = 0; hr <= 168; hr += 4) {
        const spv = 36 * Math.exp(-hr / 72);
        const x = padL + (hr / 168) * pw;
        const y = padT + (1 - spv / 40) * ph;
        if (hr === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = tok.text;
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillText('Compensation SPV(t) = 36·exp(-t/72h)', padL, h - 8);
    } else {
      ctx.beginPath();
      ctx.strokeStyle = tok.green;
      ctx.lineWidth = 2;
      const shift = surgNeurKoos * 9;
      for (let x = 0; x <= pw; x += 2) {
        const wave =
          Math.exp(-Math.pow((x - 45) / 8, 2)) * 24 +
          Math.exp(-Math.pow((x - 95) / 10, 2)) * 28 +
          Math.exp(-Math.pow((x - (165 + shift)) / 12, 2)) * (46 - surgNeurKoos * 6);
        const py = padT + ph * 0.78 - wave;
        if (x === 0) ctx.moveTo(padL + x, py);
        else ctx.lineTo(padL + x, py);
      }
      ctx.stroke();
      ctx.fillStyle = tok.text;
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillText(`ABR Wave V · Koos Stage ${surgNeurKoos}`, padL, h - 8);
    }
  }

  function renderActive2DVisuals(): void {
    if (noteState !== 'expanded' || sidebarTab !== 'lab') return;
    if (currentMode === 'hearing') renderAudiogramSvg();
    if (currentMode === 'radiology') renderCTSliceCanvas();
    if (currentMode === 'vestibular') renderVORCanvas();
    if (currentMode === 'surgical') renderSurgicalCanvas();
  }

  // =========================================================================
  // Search Combobox
  // =========================================================================
  function renderSearchMatches(query: string): void {
    const q = query.trim().toLowerCase();
    if (!q) {
      searchMatches = [];
      searchHighlightIdx = -1;
      searchDropdown.classList.remove('open');
      searchInput.setAttribute('aria-expanded', 'false');
      searchInput.removeAttribute('aria-activedescendant');
      searchDropdown.replaceChildren();
      return;
    }

    searchMatches = IEMAP_STRUCTURES.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        s.shortLabel.toLowerCase().includes(q) ||
        s.latinName.toLowerCase().includes(q) ||
        s.meshName.toLowerCase().includes(q)
    ).slice(0, 8);

    const frag = document.createDocumentFragment();
    searchMatches.forEach((item, idx) => {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.id = `search-opt-${idx}`;
      opt.role = 'option';
      opt.className = 'search-option';
      opt.setAttribute('aria-selected', String(idx === searchHighlightIdx));

      const t = document.createElement('span');
      t.className = 'search-opt-title';
      t.textContent = formatStructureHeadline(item);
      const m = document.createElement('span');
      m.className = 'search-opt-meta';
      m.textContent = `${SYSTEM_GROUPS[item.systemGroup].shortTitle} · ${formatRAS(item.centroidRAS)}`;
      opt.append(t, m);
      opt.addEventListener('click', () => pickSearchOption(item));
      frag.appendChild(opt);
    });

    searchDropdown.replaceChildren(frag);
    const hasResults = searchMatches.length > 0;
    searchDropdown.classList.toggle('open', hasResults);
    searchInput.setAttribute('aria-expanded', String(hasResults));
  }

  function pickSearchOption(item: StructureOntologyItem): void {
    searchInput.value = '';
    searchClearBtn.hidden = true;
    renderSearchMatches('');
    selectStructure(item.meshName, true);
    setNoteState('expanded', 'note');
  }

  searchInput.addEventListener('input', () => {
    const hasVal = searchInput.value.trim().length > 0;
    searchClearBtn.hidden = !hasVal;
    searchHighlightIdx = 0;
    renderSearchMatches(searchInput.value);
  });

  searchInput.addEventListener('keydown', (ev) => {
    if (searchMatches.length === 0) return;
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      searchHighlightIdx = (searchHighlightIdx + 1) % searchMatches.length;
      renderSearchMatches(searchInput.value);
      searchInput.setAttribute('aria-activedescendant', `search-opt-${searchHighlightIdx}`);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      searchHighlightIdx = (searchHighlightIdx - 1 + searchMatches.length) % searchMatches.length;
      renderSearchMatches(searchInput.value);
      searchInput.setAttribute('aria-activedescendant', `search-opt-${searchHighlightIdx}`);
    } else if (ev.key === 'Enter' && searchHighlightIdx >= 0) {
      ev.preventDefault();
      pickSearchOption(searchMatches[searchHighlightIdx]);
    } else if (ev.key === 'Escape') {
      renderSearchMatches('');
    }
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchClearBtn.hidden = true;
    renderSearchMatches('');
    searchInput.focus();
  });

  document.addEventListener('pointerdown', (ev) => {
    const target = ev.target as Node | null;
    if (target && !searchDropdown.contains(target) && target !== searchInput) {
      renderSearchMatches('');
    }
  });

  // =========================================================================
  // Native Popover Toggle Sync + Settings + Report Dialog
  // =========================================================================
  settingsPopover.addEventListener('toggle', (ev) => {
    const toggleEv = ev as ToggleEvent;
    settingsBtn.setAttribute('aria-expanded', String(toggleEv.newState === 'open'));
  });

  document.querySelectorAll<HTMLButtonElement>('[data-label-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLabelDensity((btn.dataset.labelMode as LabelDensity) || 'key');
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-reading-depth]').forEach((btn) => {
    btn.addEventListener('click', () => {
      readingDepth = (btn.dataset.readingDepth as ReadingDepth) || 'simple';
      document.querySelectorAll<HTMLButtonElement>('[data-reading-depth]').forEach((b) => {
        b.classList.toggle('active', b.dataset.readingDepth === readingDepth);
      });
      selectStructure(currentMeshName, false);
    });
  });

  headerSearchBtn.addEventListener('click', () => {
    setMode('anatomy');
    setNoteState('expanded', 'lab');
    requestAnimationFrame(() => partsFilterInput.focus());
  });

  function openReportDialog(): void {
    if (settingsPopover.matches(':popover-open')) {
      settingsPopover.hidePopover();
    }
    reportDialog.removeAttribute('data-closing');
    if (!reportDialog.open) {
      reportDialog.showModal();
    }
  }

  async function closeTopLayerDialog(dialog: HTMLDialogElement): Promise<void> {
    if (!dialog.open || dialog.hasAttribute('data-closing')) return;
    if (reducedMotionQuery.matches || supportsTopLayerExit()) {
      dialog.close();
      return;
    }
    dialog.setAttribute('data-closing', '');
    const animations = dialog.getAnimations({ subtree: true });
    await Promise.race([
      Promise.allSettled(animations.map((a) => a.finished)),
      new Promise<void>((resolve) => window.setTimeout(resolve, 2000)),
    ]);
    if (!dialog.hasAttribute('data-closing')) return;
    dialog.removeAttribute('data-closing');
    if (dialog.open) dialog.close();
  }

  reportOpenBtn.addEventListener('click', openReportDialog);
  popoverReportBtn.addEventListener('click', openReportDialog);
  reportCloseBtn.addEventListener('click', () => void closeTopLayerDialog(reportDialog));
  reportDoneBtn.addEventListener('click', () => void closeTopLayerDialog(reportDialog));
  reportPrintBtn.addEventListener('click', () => window.print());

  reportDialog.addEventListener('cancel', (ev) => {
    if (reducedMotionQuery.matches || supportsTopLayerExit()) return;
    ev.preventDefault();
    void closeTopLayerDialog(reportDialog);
  });

  if (!('closedBy' in HTMLDialogElement.prototype)) {
    reportDialog.addEventListener('click', (ev) => {
      if (ev.target !== reportDialog) return;
      const rect = reportDialog.getBoundingClientRect();
      const clickedInDialog =
        rect.top <= ev.clientY &&
        ev.clientY <= rect.top + rect.height &&
        rect.left <= ev.clientX &&
        ev.clientX <= rect.left + rect.width;
      if (!clickedInDialog) {
        void closeTopLayerDialog(reportDialog);
      }
    });
  }

  document.addEventListener('keydown', (ev) => {
    if (
      ev.key === 'Escape' &&
      noteState === 'expanded' &&
      !reportDialog.open &&
      !settingsPopover.matches(':popover-open') &&
      !searchDropdown.classList.contains('open')
    ) {
      setNoteState('compact', 'note');
    }
  });

  // =========================================================================
  // Initial Hydration
  // =========================================================================
  document.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(updateRangeProgress);
  applyTheme(themePreference);
  selectStructure(currentMeshName, false);
  setNoteState('compact', 'note');
  renderPartsList();
  setFrequencyHz(1000);
  updateRadDepthUI();
  updateVestUI();
  updateSurgicalUI();
  repActiveMode.textContent = MODE_LABELS[currentMode];
  scheduleGeometrySync();

  window.addEventListener('beforeunload', () => {
    window.removeEventListener('resize', scheduleGeometrySync);
    noteCard.removeEventListener('transitionend', refreshPinKeepOutZones);
    dockObserver.disconnect();
    modeScrollObserver?.disconnect();
    scene3d.dispose();
  });
}

setupShowcase();
