import {
  IEMAP_STRUCTURES,
  STRUCTURE_BY_MESH,
  SYSTEM_GROUPS,
  SystemGroupId,
  VisibilityState,
} from '../data/ontology';
import {
  DualStageScene,
  LabMode,
  LabelDensityMode,
  LabSceneSnapshot,
  ProjectedPin2D,
  ReadingDepth,
  RadiologyLabState,
} from '../render/DualStageScene';
import { ToneSynthesizer } from '../audio/ToneSynthesizer';
import { AudiogramDrawer } from './AudiogramDrawer';
import { CTSliceDrawer } from './CTSliceDrawer';
import { VORDrawer } from './VORDrawer';
import { SurgicalDrawer } from './SurgicalDrawer';
import {
  type SurgicalProcedure,
  type CIArrayType,
  type CIApproach,
  type KoosStage,
} from '../physics/surgicalEngine';
import {
  MANEUVER_PRESETS,
  type ManeuverId,
  type VestibularTelemetryState,
} from '../physics/vestibularEngine';
import {
  calculateJongkees,
  computeCaloricConvection,
  computeAlexanderModulation,
  CALORIC_CLINICAL_PRESETS,
  type CaloricIrrigationType,
  type VHITCanalPair,
  type VHITPathologyPreset,
  type VHITParadigm,
} from '../physics/diagnosticVestibularEngine';
import { getAcousticLandmark, getDistanceApexMm, greenwoodPosition } from '../data/greenwoodEngine';
import {
  RadiologyPlaneId,
  RADIOLOGY_PLANES,
  SCDS_PARAMETERS,
  getLandmarkForDepth,
} from '../data/radiologyEngine';
import {
  MODE_LABELS,
  MODE_LAB_TAB_LABELS,
  SVG_ICONS,
  THEME_STORAGE_KEY,
  buildLoadingOverlayHTML,
  buildReportDialogHTML,
  buildSettingsPopoverHTML,
  compactFluidLabel,
  formatRAS,
  formatStructureHeadline,
  getCompactNoteSentence,
  getStructurePrimaryMetric,
  supportsTopLayerExit,
  updateRangeProgress,
  type NoteState,
  type SidebarTab,
  type ThemePreference,
} from './hudChrome';

export class AppHUD {
  private root: HTMLElement;
  private scene: DualStageScene;
  private appShell!: HTMLElement;
  private canvasHost!: HTMLElement;
  private pinsLayer!: HTMLElement;
  private pinElements = new Map<string, HTMLElement>();
  private pinHalfWidths = new Map<string, number>();
  private activePinIdSet = new Set<string>();
  private placedPinRects = new Float32Array(256);
  private keepOutZones: Array<{ l: number; t: number; r: number; b: number }> = [];
  private stageWidthPx = 1280;
  private headerEl: HTMLElement | null = null;
  private framingRafQueued = false;

  // Theme Controller
  private metaColorScheme: HTMLMetaElement | null = null;
  private darkMediaQuery: MediaQueryList;
  private reducedMotionQuery: MediaQueryList;
  private themePreference: ThemePreference = 'system';
  private resolvedTheme: 'light' | 'dark' = 'dark';
  private themeToggleBtn!: HTMLButtonElement;
  private appearanceHint!: HTMLElement;

  // Cached Vestibular Telemetry Elements (Eliminates per-frame querySelector & innerHTML)
  private cachedCn8Val: HTMLElement | null = null;
  private cachedCn8BarFill: HTMLElement | null = null;
  private cachedEwaldText: HTMLElement | null = null;
  private cachedVestClearancePrefix: HTMLElement | null = null;
  private cachedVestClearanceVal: HTMLElement | null = null;
  private cachedVestStatusBadge: HTMLElement | null = null;

  // Header & Mode Switcher Elements
  private modeSwitcher: HTMLElement | null = null;
  private modePills: HTMLButtonElement[] = [];
  private modeScrollObserver: IntersectionObserver | null = null;

  private searchInput!: HTMLInputElement;
  private searchClearBtn!: HTMLButtonElement;
  private searchDropdown!: HTMLElement;
  private headerSearchBtn!: HTMLButtonElement;
  private reportOpenBtn!: HTMLButtonElement;
  private settingsBtn!: HTMLButtonElement;
  private settingsPopover!: HTMLElement;
  private settingsOpen = false;

  // Unified Expandable Note & Lab Sidebar
  private noteSidebar!: HTMLElement;
  private noteCollapsedPill!: HTMLButtonElement;
  private notePillDot!: HTMLElement;
  private notePillLabel!: HTMLElement;
  private noteCard!: HTMLElement;
  private noteSystemDot!: HTMLElement;
  private noteSystemLabel!: HTMLElement;
  private noteTitleEl!: HTMLElement;
  private noteCompactBody!: HTMLElement;
  private noteCompactLead!: HTMLElement;
  private noteReadBtn!: HTMLButtonElement;
  private noteLabShortcutBtn!: HTMLButtonElement;
  private noteExpandToggleBtn!: HTMLButtonElement;
  private noteCollapseBtn!: HTMLButtonElement;
  private noteScrollBody!: HTMLElement;
  private tabNoteBtn!: HTMLButtonElement;
  private tabLabBtn!: HTMLButtonElement;
  private sidebarPaneNote!: HTMLElement;
  private sidebarPaneLab!: HTMLElement;
  private noteLeadProse!: HTMLElement;
  private inspFluidEl!: HTMLElement;
  private inspMetricKeyEl!: HTMLElement;
  private inspMetricValEl!: HTMLElement;
  private btnIsolate!: HTMLButtonElement;
  private btnResetView!: HTMLButtonElement;
  private noteContextBoxes!: HTMLElement;
  private furtherReadDetails!: HTMLDetailsElement;
  private furtherReadHint!: HTMLElement;
  private inspDeepProse!: HTMLElement;
  private inspLatinEl!: HTMLElement;
  private inspInnervationEl!: HTMLElement;
  private inspMorphometryEl!: HTMLElement;
  private inspRasChipEl!: HTMLElement;
  private inspPearlEl!: HTMLElement;

  private noteState: NoteState = 'compact';
  private sidebarTab: SidebarTab = 'note';
  private isSwitchingDrawers = false;

  // Bottom Bar & Stage Utils
  private bottomBar!: HTMLElement;
  private bottomResizeObserver: ResizeObserver | null = null;
  private anatomyDockContent!: HTMLElement;
  private hearingDockContent!: HTMLElement;
  private radiologyDockContent!: HTMLElement;
  private vestibularDockContent!: HTMLElement;
  private surgicalDockContent!: HTMLElement;
  private toolLabelsBtn!: HTMLButtonElement;
  private toolResetBtn!: HTMLButtonElement;

  // Surgical Workbench Controls
  private surgicalDrawer!: SurgicalDrawer;
  private surgSubnavTabs: HTMLButtonElement[] = [];
  private surgSubviews = new Map<string, HTMLElement>();
  private activeSurgProcedure: SurgicalProcedure = 'cochlear_implant';

  // CI Controls
  private ciApproachChips: HTMLButtonElement[] = [];
  private ciArrayChips: HTMLButtonElement[] = [];
  private ciDepthSlider!: HTMLInputElement;
  private ciPitchSlider!: HTMLInputElement;
  private ciYawSlider!: HTMLInputElement;
  private ciDepthTitleEl!: HTMLElement;
  private ciForceBadgeEl!: HTMLElement;
  private ciRiskBadgeEl!: HTMLElement;
  private ciPitchValEl!: HTMLElement;
  private ciYawValEl!: HTMLElement;
  private ciAutoInsertBtn!: HTMLButtonElement;
  private ciRetractBtn!: HTMLButtonElement;
  private ciAutoInsertTimer: number | null = null;

  // Labyrinthectomy Controls
  private labyStepChips: HTMLButtonElement[] = [];
  private labyStepTitleEl!: HTMLElement;
  private labyDrillBadgeEl!: HTMLElement;
  private labySpvBadgeEl!: HTMLElement;
  private labyDrillToggleBtn!: HTMLButtonElement;
  private labyDrillTextEl!: HTMLElement;
  private labyCompSlider!: HTMLInputElement;
  private labyCompValEl!: HTMLElement;
  private labyAblateAllBtn!: HTMLButtonElement;

  // Neurectomy Controls
  private neurectomyStepChips: HTMLButtonElement[] = [];
  private neurectomyToolBtns: HTMLButtonElement[] = [];
  private neurectomyStepTitleEl!: HTMLElement;
  private neurectomyAbrBadgeEl!: HTMLElement;
  private neurectomyEmgBadgeEl!: HTMLElement;
  private neurectomyKoosSlider!: HTMLInputElement;
  private neurectomyKoosValEl!: HTMLElement;
  private neurectomyCleavageBtn!: HTMLButtonElement;

  // Anatomy Dock & Parts Lab Controls
  private boneSlider!: HTMLInputElement;
  private boneValEl!: HTMLElement;
  private explodeSlider!: HTMLInputElement;
  private explodeValEl!: HTMLElement;
  private mobileBoneSlider!: HTMLInputElement;
  private mobileBoneValEl!: HTMLElement;
  private mobileExplodeSlider!: HTMLInputElement;
  private mobileExplodeValEl!: HTMLElement;
  private presetButtons = new Map<string, HTMLButtonElement>();
  private partsToggleBtn!: HTMLButtonElement;
  private partsDrawer!: HTMLElement;
  private partsFilterInput!: HTMLInputElement;
  private partsFilterChips: HTMLButtonElement[] = [];
  private partsSystemFilter: 'all' | SystemGroupId = 'all';
  private partsSearchQuery = '';
  private partsDrawerOpen = false;

  // Hearing Workbench Dock Controls
  private tonePlayBtn!: HTMLButtonElement;
  private toneIconEl!: HTMLElement;
  private toneLabelEl!: HTMLElement;
  private hearingSlider!: HTMLInputElement;
  private hearingFreqReadout!: HTMLElement;
  private hearingLandmarkBadge!: HTMLElement;
  private octaveChips: HTMLButtonElement[] = [];
  private audiogramToggleBtn!: HTMLButtonElement;
  private audiogramArrowEl!: HTMLElement;

  // Radiology Workbench Dock Controls
  private planeChips: HTMLButtonElement[] = [];
  private radiologyDepthSlider!: HTMLInputElement;
  private radiologyDepthValEl!: HTMLElement;
  private radiologyLandmarkBadgeEl!: HTMLElement;
  private depthDecBtn!: HTMLButtonElement;
  private depthIncBtn!: HTMLButtonElement;
  private radiologyFlipBtn!: HTMLButtonElement;
  private radiologyGuideBtn!: HTMLButtonElement;
  private radiologyScdsBtn!: HTMLButtonElement;
  private radiologyCtToggleBtn!: HTMLButtonElement;
  private ctCardArrowEl!: HTMLElement;

  // Vestibular Workbench Dock Controls
  private vestSubmode: 'bppv' | 'caloric' | 'vhit' = 'bppv';
  private vestSubnavTabs: HTMLButtonElement[] = [];
  private vestSubviews: HTMLElement[] = [];
  private vestBppvSubview!: HTMLElement;
  private vestCaloricSubview!: HTMLElement;
  private vestVhitSubview!: HTMLElement;

  private vestProtocolChips: HTMLButtonElement[] = [];
  private vestStepTitleEl!: HTMLElement;
  private vestHoldTimerBadgeEl!: HTMLElement;
  private vestClearanceBadgeEl!: HTMLElement;
  private vestStepPrevBtn!: HTMLButtonElement;
  private vestStepNextBtn!: HTMLButtonElement;
  private vestPlayBtn!: HTMLButtonElement;
  private vestPlayIconEl!: HTMLElement;
  private vestStepSlider!: HTMLInputElement;
  private vestGyroToggleBtn!: HTMLButtonElement;
  private vestResetBtn!: HTMLButtonElement;
  private vestVorToggleBtn!: HTMLButtonElement;
  private vorArrowEl!: HTMLElement;

  // Diagnostic Vestibular Submodes & Controls
  private activeCaloricTemp: CaloricIrrigationType = 'R44';
  private caloricAlexanderGaze = 0;
  private isCaloricIrrigating = false;
  private caloricElapsedSec = 0;
  private caloricTimerInterval: ReturnType<typeof setInterval> | null = null;
  private caloricLastTickTime = 0;
  private caloricModalApplyBtn!: HTMLButtonElement;

  private caloricTempChips: HTMLButtonElement[] = [];
  private caloricPlayBtn!: HTMLButtonElement;
  private caloricPlayIconEl!: HTMLElement;
  private caloricTimerBadgeEl!: HTMLElement;
  private caloricSpvBadgeEl!: HTMLElement;
  private caloricStatusTitleEl!: HTMLElement;
  private caloricLateralityBadgeEl!: HTMLElement;
  private caloricPostureBtn!: HTMLButtonElement;
  private caloricGazeChips: HTMLButtonElement[] = [];
  private caloricAlexBadgeEl!: HTMLElement;
  private caloricJongkeesOpenBtn!: HTMLButtonElement;
  private caloricJongkeesModal!: HTMLElement;
  private caloricJongkeesCloseBtn!: HTMLButtonElement;
  private caloricPresetChips: HTMLButtonElement[] = [];
  private jongkeesR44Input!: HTMLInputElement;
  private jongkeesR30Input!: HTMLInputElement;
  private jongkeesL44Input!: HTMLInputElement;
  private jongkeesL30Input!: HTMLInputElement;
  private resultUwValEl!: HTMLElement;
  private resultDpValEl!: HTMLElement;
  private resultTotalValEl!: HTMLElement;
  private caloricInterpCardEl!: HTMLElement;
  private caloricVorToggleBtn!: HTMLButtonElement;
  private caloricVorArrowEl!: HTMLElement;

  // vHIT Controls & State
  private vhitPair: VHITCanalPair = 'horizontal';
  private vhitDirection: 1 | -1 = 1;
  private vhitPreset: VHITPathologyPreset = 'normal';
  private vhitParadigm: VHITParadigm = 'himp';
  private vhitSlippage = false;

  private vhitPairChips: HTMLButtonElement[] = [];
  private vhitDirLeftBtn!: HTMLButtonElement;
  private vhitDirRightBtn!: HTMLButtonElement;
  private vhitPresetChips: HTMLButtonElement[] = [];
  private vhitParadigmBtn!: HTMLButtonElement;
  private vhitSlippageBtn!: HTMLButtonElement;
  private vhitThrustBtn!: HTMLButtonElement;
  private vhitGainBadgeEl!: HTMLElement;
  private vhitSaccadeBadgeEl!: HTMLElement;
  private vhitStatusTitleEl!: HTMLElement;
  private vhitVorToggleBtn!: HTMLButtonElement;
  private vhitVorArrowEl!: HTMLElement;

  // Gyro Flyout Controls
  private gyroFlyout!: HTMLElement;
  private gyroCloseBtn!: HTMLButtonElement;
  private gyroYawSlider!: HTMLInputElement;
  private gyroPitchSlider!: HTMLInputElement;
  private gyroRollSlider!: HTMLInputElement;
  private gyroYawValEl!: HTMLElement;
  private gyroPitchValEl!: HTMLElement;
  private gyroRollValEl!: HTMLElement;

  // Lab Services
  private toneSynth = ToneSynthesizer.getInstance();
  private audiogramDrawer!: AudiogramDrawer;
  private ctSliceDrawer!: CTSliceDrawer;
  private vorDrawer!: VORDrawer;

  // Vestibular Sequencer & Hold Timer State
  private activeManeuverId: ManeuverId = 'epley';
  private currentStepIdx = 0;
  private isSequencerPlaying = false;
  private sequencerTimerId: number | null = null;
  private remainingHoldSec = 30;

  // Modals & Overlays
  private reportDialog!: HTMLDialogElement;
  private repActivePartEl!: HTMLElement;
  private repActiveModeEl!: HTMLElement;
  private aboutModalOpen = false;
  private loadingOverlay!: HTMLElement;
  private loadingFill!: HTMLElement;
  private loadingText!: HTMLElement;
  private loadingCount!: HTMLElement;

  private activeReadingDepth: ReadingDepth = 'simple';
  private activeLabelMode: LabelDensityMode = 'key';
  private lastRenderedMesh: string | null = '__init__';
  private lastRenderedDepth: ReadingDepth | null = null;
  private lastRenderedIsolated: boolean | null = null;
  private lastRenderedLabMode: LabMode | null = null;
  private activeSearchIndex = -1;

  private static readonly STORAGE_KEYS = {
    labelMode: 'gate3_label_mode',
    readingDepth: 'gate3_reading_depth',
  };

  constructor(root: HTMLElement) {
    this.root = root;
    this.darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.metaColorScheme = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    this.loadSavedPreferences();
    this.buildDOM();
    this.scene = new DualStageScene(this.canvasHost);
    this.scene.setVORDrawer(this.vorDrawer);
    this.scene.setSurgicalDrawer(this.surgicalDrawer);
    this.applyTheme(this.themePreference);
    this.renderPartsTree();

    this.scene.onStateChange((snap) => this.renderState(snap));
    this.scene.onPinsUpdate((pins) => this.renderProjectedPins(pins));
    this.scene.onStructurePicked((meshName) => this.handleStructurePicked(meshName));
    this.scene.onVestibularTelemetry((telem) => this.handleLiveVestibularTelemetry(telem));
    this.scene.onHearingToneRequest((freqHz) => {
      if (this.toneSynth.getIsPlaying()) {
        this.toneSynth.setFrequency(freqHz);
      }
      this.audiogramDrawer.setActiveFrequency(freqHz);
      this.syncFrequencyUI(freqHz, true);
    });

    this.root.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(updateRangeProgress);
    this.syncSidebarDOM();
  }

  public async init(): Promise<void> {
    this.scene.startRenderLoop();
    await this.scene.loadAllAssets();
    this.scene.setOverlays({
      labelMode: this.activeLabelMode,
      readingDepth: this.activeReadingDepth,
    });
    this.scene.setThemePolarity(this.resolvedTheme === 'light');
    this.renderState(this.scene.getSnapshot());
    this.scheduleGeometrySync();
  }

  private readStoredTheme(): ThemePreference {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // Ignore storage error
    }
    return 'system';
  }

  private loadSavedPreferences(): void {
    this.themePreference = this.readStoredTheme();
    try {
      const savedLabel = localStorage.getItem(AppHUD.STORAGE_KEYS.labelMode);
      if (savedLabel === 'off' || savedLabel === 'key' || savedLabel === 'all') {
        this.activeLabelMode = savedLabel;
      }
      const savedDepth = localStorage.getItem(AppHUD.STORAGE_KEYS.readingDepth);
      if (savedDepth === 'simple' || savedDepth === 'detailed') {
        this.activeReadingDepth = savedDepth;
      }
    } catch {
      // Ignore localStorage errors in private browsing
    }
  }

  private applyTheme(pref: ThemePreference): void {
    this.themePreference = pref;
    try {
      if (pref === 'system') {
        localStorage.removeItem(THEME_STORAGE_KEY);
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, pref);
      }
    } catch {
      // Ignore storage errors
    }

    if (this.metaColorScheme) {
      this.metaColorScheme.content = pref === 'system' ? 'light dark' : pref;
    }

    this.resolvedTheme = pref === 'system' ? (this.darkMediaQuery.matches ? 'dark' : 'light') : pref;
    if (this.appShell) {
      this.appShell.setAttribute('data-resolved-theme', this.resolvedTheme);
    }

    if (this.appearanceHint) {
      this.appearanceHint.textContent =
        pref === 'system'
          ? `Following system preference (${this.resolvedTheme === 'dark' ? 'Dark' : 'Light'})`
          : `Manual ${pref === 'dark' ? 'Dark Glassroom' : 'Light Paper-Technical'} mode`;
    }

    this.root.querySelectorAll<HTMLButtonElement>('[data-theme-pref]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.themePref === pref);
    });

    if (this.scene) {
      this.scene.setThemePolarity(this.resolvedTheme === 'light');
    }
  }

  private buildDOM(): void {
    this.root.innerHTML = `
      <div class="lab-shell" id="app-shell" data-mode="anatomy" data-note-state="compact" data-wide-read="false" data-resolved-theme="dark">
        <!-- 1. STREAMLINED SINGLE-ROW HEADER -->
        <header class="lab-header" role="banner">
          <div class="brand-cluster">
            <span class="brand-badge">IE-MAP 3D</span>
            <h1 class="brand-title">Inner Ear 3D Lab</h1>
          </div>

          <nav class="mode-switcher-shell" aria-label="Clinical Modes">
            <div class="mode-switcher" role="tablist">
              <button
                type="button"
                class="mode-pill active"
                id="mode-anatomy-btn"
                data-mode="anatomy"
                role="tab"
                aria-selected="true"
                aria-controls="anatomy-dock-content"
                title="3D Anatomy Atlas (27 Parts)"
              >
                ${SVG_ICONS.anatomy}
                <span class="mode-label">Anatomy<span class="mode-label-ext"> Atlas</span></span>
              </button>
              <button
                type="button"
                class="mode-pill"
                id="mode-hearing-btn"
                data-mode="hearing"
                role="tab"
                aria-selected="false"
                aria-controls="hearing-dock-content"
                title="Tonotopy &amp; Hearing Lab (Georg von Békésy Wave)"
              >
                ${SVG_ICONS.hearing}
                <span class="mode-label">Hearing<span class="mode-label-ext"> &amp; Tonotopy</span></span>
              </button>
              <button
                type="button"
                class="mode-pill"
                id="mode-radiology-btn"
                data-mode="radiology"
                role="tab"
                aria-selected="false"
                aria-controls="radiology-dock-content"
                title="Virtual Temporal Bone Radiology &amp; SCDS Simulation"
              >
                ${SVG_ICONS.radiology}
                <span class="mode-label"><span class="mode-label-ext">Virtual </span>Radiology</span>
              </button>
              <button
                type="button"
                class="mode-pill"
                id="mode-vestibular-btn"
                data-mode="vestibular"
                role="tab"
                aria-selected="false"
                aria-controls="vestibular-dock-content"
                title="Multi-Canal Vestibular Dynamics &amp; 3D VOR"
              >
                ${SVG_ICONS.vestibular}
                <span class="mode-label">Vestibular<span class="mode-label-ext"> &amp; VOR</span></span>
              </button>
              <button
                type="button"
                class="mode-pill"
                id="mode-surgical-btn"
                data-mode="surgical"
                role="tab"
                aria-selected="false"
                aria-controls="surgical-dock-content"
                title="Surgical Approaches &amp; Implant Simulations"
              >
                ${SVG_ICONS.surgical}
                <span class="mode-label">Surgical<span class="mode-label-ext"> Suites</span></span>
              </button>
            </div>
          </nav>

          <search class="search-container">
            <div class="search-input-shell">
              <span class="search-icon" aria-hidden="true">${SVG_ICONS.search}</span>
              <input
                type="text"
                class="search-input"
                id="search-input"
                placeholder="Find an ear part..."
                aria-label="Find an anatomical ear structure"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded="false"
                aria-controls="search-dropdown"
                autocomplete="off"
                spellcheck="false"
              />
              <button
                type="button"
                class="search-clear-btn"
                id="search-clear-btn"
                aria-label="Clear search"
                hidden
                style="display: none;"
              >${SVG_ICONS.close}</button>
            </div>
            <div class="search-dropdown glass-surface" id="search-dropdown" role="listbox" aria-label="Structure matches"></div>
          </search>

          <div class="header-actions">
            <button
              type="button"
              class="header-icon-btn header-search-trigger"
              id="header-search-btn"
              aria-label="Search 27 anatomical parts"
            >${SVG_ICONS.search}</button>

            <button
              type="button"
              class="header-report-btn"
              id="report-open-btn"
              aria-label="Open clinical summary report"
            >
              ${SVG_ICONS.report}
              <span class="header-btn-text">Report</span>
            </button>

            <button type="button" class="header-icon-btn" id="theme-toggle-btn" title="Switch color polarity">
              ${SVG_ICONS.sun}
              ${SVG_ICONS.moon}
              <span class="visually-hidden theme-text-to-light">Switch to light theme</span>
              <span class="visually-hidden theme-text-to-dark">Switch to dark theme</span>
            </button>

            <button
              type="button"
              class="header-icon-btn"
              id="settings-btn"
              popovertarget="settings-popover"
              title="Display &amp; Lab Settings"
              aria-label="Display &amp; Lab Settings"
              aria-expanded="false"
              aria-controls="settings-popover"
            >${SVG_ICONS.settings}</button>
          </div>
        </header>

        ${buildSettingsPopoverHTML(this.activeLabelMode, this.activeReadingDepth)}

        <!-- 2. FULL-BLEED 3D SPECIMEN STAGE -->
        <main class="specimen-stage" id="specimen-stage">
          <div class="stage-frame" aria-hidden="true">
            <span class="corner-bracket tl"></span>
            <span class="corner-bracket tr"></span>
            <span class="corner-bracket bl"></span>
            <span class="corner-bracket br"></span>
          </div>

          <div class="canvas-host" id="canvas-host" aria-label="Interactive 3D Inner Ear Labyrinth Viewport"></div>
          <div class="pins-layer" id="pins-layer" aria-hidden="true"></div>

          <!-- 3. UNIFIED EXPANDABLE LEFT NOTE & LAB SIDEBAR -->
          <aside
            class="note-sidebar"
            id="note-sidebar"
            data-note-state="compact"
            data-sidebar-tab="note"
            data-wide-read="false"
            aria-label="Specimen Note and Clinical Lab Sidebar"
          >
            <button type="button" class="note-collapsed-pill glass-surface" id="note-collapsed-pill" hidden>
              <span class="pill-dot" id="note-pill-dot"></span>
              <span id="note-pill-label">Labyrinth · Open Note</span>
            </button>

            <section class="note-card glass-surface" id="note-card" aria-labelledby="note-title">
              <div class="note-card-header">
                <div class="note-system-tag">
                  <span class="pill-dot" id="note-system-dot"></span>
                  <span id="note-system-label">Inner Ear Atlas</span>
                </div>

                <div class="note-header-controls">
                  <div class="note-tab-switch" id="note-tab-switch" role="tablist" aria-label="Sidebar View">
                    <button
                      type="button"
                      class="note-tab-btn active"
                      id="tab-note-btn"
                      data-sidebar-tab="note"
                      role="tab"
                      aria-selected="true"
                    >Note</button>
                    <button
                      type="button"
                      class="note-tab-btn"
                      id="tab-lab-btn"
                      data-sidebar-tab="lab"
                      role="tab"
                      aria-selected="false"
                    >Parts</button>
                  </div>
                  <button
                    type="button"
                    class="icon-close-btn note-size-btn"
                    id="note-expand-toggle-btn"
                    aria-expanded="false"
                    aria-label="Expand note sidebar for full reading"
                    title="Expand / compact note"
                  >
                    ${SVG_ICONS.expand}
                    ${SVG_ICONS.shrink}
                  </button>
                  <button
                    type="button"
                    class="icon-close-btn note-min-btn"
                    id="note-collapse-btn"
                    aria-label="Collapse note sidebar"
                    title="Minimize note to corner pill"
                  >${SVG_ICONS.collapse}</button>
                </div>
              </div>

              <h2 class="note-title" id="note-title">Inner Ear Labyrinth</h2>

              <div class="note-compact-body" id="note-compact-body">
                <p class="note-compact-lead" id="note-compact-lead">Click any inner ear structure in 3D or search above to inspect stereotaxic anatomy.</p>
                <div class="note-compact-actions">
                  <button type="button" class="primary-action-btn" id="note-read-btn">Read Note</button>
                  <button type="button" class="secondary-action-btn" id="note-lab-shortcut-btn">Parts</button>
                </div>
              </div>

              <div class="note-scroll-body" id="note-scroll-body" hidden>
                <div class="sidebar-pane" id="sidebar-pane-note">
                  <p class="note-lead-prose" id="insp-summary"></p>

                  <div class="note-metrics-strip">
                    <div class="telemetry-cell">
                      <span class="telemetry-key">Fluid</span>
                      <span class="telemetry-val" id="insp-fluid">—</span>
                    </div>
                    <div class="telemetry-cell">
                      <span class="telemetry-key" id="insp-metric-key">Geometry</span>
                      <span class="telemetry-val" id="insp-metric-val">—</span>
                    </div>
                  </div>

                  <div class="note-action-row">
                    <button type="button" class="primary-action-btn" id="btn-isolate">Isolate Part</button>
                    <button type="button" class="secondary-action-btn" id="btn-reset-view">Reset View</button>
                  </div>

                  <div id="note-context-boxes"></div>

                  <details class="further-read-details" id="further-read-details">
                    <summary class="further-read-summary">
                      <span class="further-read-label">Further Read</span>
                      <span class="further-read-hint" id="further-read-hint">Clinical Details · Patient</span>
                    </summary>
                    <div class="further-read-content">
                      <div class="depth-inline-row">
                        <span class="depth-inline-label">Tone</span>
                        <div class="segmented-control compact-seg" role="group" aria-label="Reading style">
                          <button type="button" class="segment-btn ${this.activeReadingDepth === 'simple' ? 'active' : ''}" data-reading-depth="simple">Patient</button>
                          <button type="button" class="segment-btn ${this.activeReadingDepth === 'detailed' ? 'active' : ''}" data-reading-depth="detailed">Clinical</button>
                        </div>
                      </div>
                      <p class="note-deep-prose" id="insp-deep-prose"></p>
                      <dl class="further-read-dl">
                        <div class="dl-pair">
                          <dt>Latin Name</dt>
                          <dd><em id="insp-latin">—</em></dd>
                        </div>
                        <div class="dl-pair">
                          <dt>Innervation</dt>
                          <dd id="insp-innervation">—</dd>
                        </div>
                        <div class="dl-pair">
                          <dt>Morphometry</dt>
                          <dd id="insp-morphometry">—</dd>
                        </div>
                        <div class="dl-pair">
                          <dt>RAS Centroid (mm)</dt>
                          <dd class="mono-dd" id="insp-ras-chip">—</dd>
                        </div>
                        <div class="dl-pair">
                          <dt>Clinical Pearl</dt>
                          <dd id="insp-pearl">—</dd>
                        </div>
                      </dl>
                    </div>
                  </details>
                </div>

                <!-- Re-Hosted Inline Lab Pane (5 Mutually Exclusive Drawers) -->
                <div class="sidebar-pane" id="sidebar-pane-lab" hidden>
                  <div class="parts-drawer" id="parts-drawer" role="region" aria-label="Anatomical Parts List">
                    <div class="parts-drawer-header">
                      <h2 class="parts-drawer-title">All 27 Anatomical Structures</h2>
                      <button type="button" class="drawer-close-btn" id="drawer-close-btn" aria-label="Close parts list">✕</button>
                    </div>
                    <div class="lab-filter-row" id="parts-filter-chips" role="group" aria-label="Filter by system">
                      <button type="button" class="chip-btn active" data-sys-filter="all">All (27)</button>
                      <button type="button" class="chip-btn" data-sys-filter="cochlear_system">Cochlea</button>
                      <button type="button" class="chip-btn" data-sys-filter="semicircular_ducts">Canals</button>
                      <button type="button" class="chip-btn" data-sys-filter="ampullae_cupulae">Ampullae</button>
                      <button type="button" class="chip-btn" data-sys-filter="otolith_vestibule">Otoliths</button>
                      <button type="button" class="chip-btn" data-sys-filter="bony_capsule">Bone</button>
                    </div>
                    <div class="lab-search-shell">
                      ${SVG_ICONS.search}
                      <input
                        type="text"
                        class="lab-search-input"
                        id="parts-filter-input"
                        placeholder="Filter 27 structures..."
                        aria-label="Filter 27 anatomical structures"
                        autocomplete="off"
                      />
                    </div>
                    <div class="mobile-parts-sliders" id="mobile-parts-sliders">
                      <div class="slider-control">
                        <div class="slider-label-row">
                          <label for="mobile-bone-peel-slider">Bone Peel</label>
                          <span class="slider-value" id="mobile-bone-val">80%</span>
                        </div>
                        <input type="range" id="mobile-bone-peel-slider" min="0" max="100" value="80" aria-label="Outer Bone Shell Opacity Peel" />
                      </div>
                      <div class="slider-control">
                        <div class="slider-label-row">
                          <label for="mobile-explode-slider">Separate</label>
                          <span class="slider-value" id="mobile-explode-val">0%</span>
                        </div>
                        <input type="range" id="mobile-explode-slider" min="0" max="100" value="0" aria-label="Separate Parts Radial Explode" />
                      </div>
                    </div>
                    <div class="parts-tree-body" id="parts-tree-body"></div>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </main>

        <!-- 4. CONTEXTUAL BOTTOM WORKBENCH DOCK -->
        <nav class="bottom-viz-bar glass-surface" id="bottom-bar" aria-label="Visualization Controls">
          <!-- 4A. Anatomy Dock Content -->
          <div class="anatomy-dock-content" id="anatomy-dock-content">
            <div class="preset-group" role="group" aria-label="Guided Anatomy Presets">
              <button type="button" class="preset-btn active" data-preset="overview" title="Full 27-part inner ear labyrinth">
                <span class="preset-label">Overview</span>
              </button>
              <button type="button" class="preset-btn" data-preset="balance_system" title="3 Semicircular canals and vestibule">
                <span class="preset-label">Balance</span>
              </button>
              <button type="button" class="preset-btn" data-preset="hearing_snail" title="Cochlea and internal scala chambers">
                <span class="preset-label">Hearing</span>
              </button>
              <button type="button" class="preset-btn" data-preset="exploded_view" title="Radial separation of all 27 parts">
                <span class="preset-label">Exploded</span>
              </button>
            </div>

            <div class="sliders-group">
              <div class="slider-item">
                <div class="slider-header">
                  <label for="bone-peel-slider">Outer Bone Shell</label>
                  <span class="slider-val" id="bone-val">80%</span>
                </div>
                <input
                  type="range"
                  id="bone-peel-slider"
                  min="0"
                  max="100"
                  value="80"
                  aria-label="Outer Bone Shell Opacity Peel"
                />
              </div>
              <div class="slider-item">
                <div class="slider-header">
                  <label for="explode-slider">Separate Parts</label>
                  <span class="slider-val" id="explode-val">0%</span>
                </div>
                <input
                  type="range"
                  id="explode-slider"
                  min="0"
                  max="100"
                  value="0"
                  aria-label="Separate Parts Radial Explode"
                />
              </div>
            </div>

            <div class="parts-toggle-wrap">
              <button
                type="button"
                class="parts-toggle-btn"
                id="parts-toggle-btn"
                aria-expanded="false"
                aria-controls="parts-drawer"
              >
                <span class="toggle-arrow" aria-hidden="true">▸</span>
                <span class="toggle-text">27 Parts</span>
                <span class="parts-badge">27</span>
              </button>
            </div>
          </div>

          <!-- 4B. Hearing Workbench Dock Content -->
          <div class="hearing-dock-content" id="hearing-dock-content" style="display: none;">
            <button
              type="button"
              class="tone-play-btn"
              id="tone-play-btn"
              aria-label="Play pure tone"
              title="Toggle pure-tone sound synthesis (Web Audio)"
            >
              <span class="tone-icon" id="tone-icon">▶</span>
              <span class="tone-label" id="tone-label">Play Tone</span>
            </button>

            <div class="hearing-slider-wrap">
              <div class="hearing-slider-header">
                <span class="hearing-slider-title">Frequency</span>
                <div class="hearing-readout-wrap">
                  <span class="hearing-freq-val" id="hearing-freq-readout">1000 Hz</span>
                  <span class="hearing-landmark-badge" id="hearing-landmark-badge">Vowel 1st Formant (19.4 mm)</span>
                </div>
              </div>
              <input
                type="range"
                class="hearing-freq-slider"
                id="hearing-freq-slider"
                min="0"
                max="1000"
                value="566"
                aria-label="Pure Tone Frequency (20 Hz to 20,000 Hz logarithmic)"
              />
            </div>

            <div class="octave-chips-group" role="group" aria-label="Audiometric Octave Steps">
              <button type="button" class="octave-chip" data-octave="125">125</button>
              <button type="button" class="octave-chip" data-octave="250">250</button>
              <button type="button" class="octave-chip" data-octave="500">500</button>
              <button type="button" class="octave-chip active" data-octave="1000">1k</button>
              <button type="button" class="octave-chip" data-octave="2000">2k</button>
              <button type="button" class="octave-chip" data-octave="4000">4k</button>
              <button type="button" class="octave-chip" data-octave="8000">8k</button>
            </div>

            <button
              type="button"
              class="audiogram-toggle-btn"
              id="audiogram-toggle-btn"
              aria-expanded="false"
              aria-controls="audiogram-drawer"
              title="Open Clinical Pure-Tone Audiogram Drawer"
            >
              <span class="audiogram-label">Audiogram</span>
              <span class="audiogram-arrow" id="audiogram-arrow">▸</span>
            </button>
          </div>

          <!-- 4C. Radiology Workbench Dock Content -->
          <div class="radiology-dock-content" id="radiology-dock-content" style="display: none;">
            <div class="radiology-plane-group" id="rad-plane-chips" role="group" aria-label="Radiological Slicing Planes">
              <button type="button" class="plane-chip active" data-plane="poschl" title="Pöschl's Oblique Sagittal (Parallel to SSC)">
                <span class="chip-label">Pöschl</span>
              </button>
              <button type="button" class="plane-chip" data-plane="stenvers" title="Stenvers' Oblique Coronal (Perpendicular to SSC)">
                <span class="chip-label">Stenvers</span>
              </button>
              <button type="button" class="plane-chip" data-plane="axial" title="True Axial Transverse MPR">
                <span class="chip-label">Axial</span>
              </button>
              <button type="button" class="plane-chip" data-plane="coronal" title="True Coronal Frontal MPR">
                <span class="chip-label">Coronal</span>
              </button>
            </div>

            <div class="radiology-depth-wrap">
              <div class="radiology-depth-header">
                <span class="depth-title">Slice Depth</span>
                <div class="depth-readout-cluster">
                  <span class="depth-val" id="radiology-depth-val">+1.2 mm</span>
                  <span class="depth-landmark-badge" id="radiology-landmark-badge">Superior Canal Osseous Halo (SSCD Gold Standard)</span>
                </div>
              </div>
              <div class="depth-slider-row">
                <button type="button" class="depth-bump-btn" id="depth-dec-btn" title="Step -0.5 mm">◀</button>
                <input
                  type="range"
                  class="radiology-depth-slider"
                  id="radiology-depth-slider"
                  min="-90"
                  max="90"
                  value="12"
                  aria-label="Radiology Slice Depth in Millimeters"
                />
                <button type="button" class="depth-bump-btn" id="depth-inc-btn" title="Step +0.5 mm">▶</button>
              </div>
            </div>

            <div class="radiology-actions-group">
              <button type="button" class="rad-action-btn" id="rad-flip-btn" title="Invert clipping half-space normal direction">
                <span class="rad-btn-text">Flip Cut</span>
              </button>
              <button type="button" class="rad-action-btn active" id="rad-guide-btn" title="Toggle 3D cutting plane quad">
                <span class="rad-btn-text">Guide</span>
              </button>
              <button type="button" class="rad-action-btn scds-toggle-btn" id="rad-scds-toggle-btn" title="Toggle Superior Canal Dehiscence Syndrome (1.5 mm defect)">
                <span class="rad-btn-text">SSCD Defect</span>
              </button>
              <button type="button" class="rad-action-btn ct-card-toggle-btn" id="rad-ct-toggle-btn" title="Toggle Synchronized 2D CT MPR Slice Drawer" aria-expanded="false" aria-controls="ct-slice-drawer">
                <span class="rad-btn-text">CT MPR</span>
                <span class="ct-card-arrow" id="ct-card-arrow">▸</span>
              </button>
            </div>
          </div>

          <!-- 4D. Vestibular & VOR Workbench Dock Content -->
          <div class="vestibular-dock-content" id="vestibular-dock-content" style="display: none;">
            <div class="vest-subnav-bar" id="vest-subnav-bar" role="tablist" aria-label="Diagnostic Vestibular Modalities">
              <button type="button" class="vest-subnav-tab active" data-submode="bppv" id="vest-subnav-bppv">BPPV Maneuvers</button>
              <button type="button" class="vest-subnav-tab" data-submode="caloric" id="vest-subnav-caloric">Caloric (COWS)</button>
              <button type="button" class="vest-subnav-tab" data-submode="vhit" id="vest-subnav-vhit">vHIT Impulse</button>
            </div>

            <div class="vest-subview vest-bppv-subview" id="vest-bppv-subview" style="display: flex;">
              <div class="vestibular-protocol-group" id="vest-protocol-chips" role="group" aria-label="BPPV Clinical Protocols">
                <button type="button" class="protocol-chip active" data-maneuver="epley" title="Epley Maneuver (Posterior Canal - 5 Steps)">
                  <span class="chip-badge">Post</span>
                  <span class="chip-label">Epley (5s)</span>
                </button>
                <button type="button" class="protocol-chip" data-maneuver="semont" title="Semont Liberatory Maneuver (Posterior Canal - 3 Steps)">
                  <span class="chip-badge">Post</span>
                  <span class="chip-label">Semont (3s)</span>
                </button>
                <button type="button" class="protocol-chip" data-maneuver="gufoni_geotropic" title="Gufoni Maneuver (Horizontal Geotropic - 4 Steps)">
                  <span class="chip-badge">Horiz</span>
                  <span class="chip-label">Gufoni Geo</span>
                </button>
                <button type="button" class="protocol-chip" data-maneuver="gufoni_apogeotropic" title="Gufoni Maneuver (Horizontal Apogeotropic - 4 Steps)">
                  <span class="chip-badge">Horiz</span>
                  <span class="chip-label">Gufoni Apo</span>
                </button>
                <button type="button" class="protocol-chip" data-maneuver="barbecue_roll" title="Lempert 360° Barbecue Roll (Horizontal - 5 Steps)">
                  <span class="chip-badge">Horiz</span>
                  <span class="chip-label">Barbecue 360°</span>
                </button>
                <button type="button" class="protocol-chip" data-maneuver="yacovino" title="Yacovino Maneuver (Anterior Canal - 4 Steps)">
                  <span class="chip-badge">Ant</span>
                  <span class="chip-label">Yacovino (4s)</span>
                </button>
              </div>

              <div class="vestibular-timeline-wrap">
                <div class="timeline-header">
                  <span class="timeline-title" id="vest-step-title">Step 1 of 5: Start Sitting Upright</span>
                  <div class="timeline-meta-cluster">
                    <span class="hold-timer-badge" id="vest-hold-timer-badge" title="Recommended Clinical Position Hold Timer">⏱️ 30s</span>
                    <span class="clearance-badge" id="vest-clearance-badge">0% Cleared</span>
                  </div>
                </div>
                <div class="timeline-slider-row">
                  <button type="button" class="timeline-btn" id="vest-step-prev-btn" title="Previous Step">◀</button>
                  <button type="button" class="timeline-btn play-btn" id="vest-play-btn" title="Auto-advance Maneuver with Timed Holds">
                    <span class="play-icon" id="vest-play-icon">▶</span>
                  </button>
                  <input
                    type="range"
                    class="vestibular-step-slider"
                    id="vest-step-slider"
                    min="0"
                    max="4"
                    value="0"
                    step="1"
                    aria-label="Clinical Maneuver Step Progress"
                  />
                  <button type="button" class="timeline-btn" id="vest-step-next-btn" title="Next Step">▶</button>
                </div>
              </div>

              <div class="vestibular-actions-group">
                <button type="button" class="vest-action-btn gyro-toggle-btn" id="vest-gyro-toggle-btn" title="Toggle 3-Axis Head Gyro Sliders" aria-expanded="false">
                  <span class="vest-btn-text">Head Gyro</span>
                </button>
                <button type="button" class="vest-action-btn reset-crystals-btn" id="vest-reset-btn" title="Reset Otoconia">
                  <span class="vest-btn-text">Reset</span>
                </button>
                <button type="button" class="vest-action-btn vor-toggle-btn" id="vest-vor-toggle-btn" title="Toggle 3D VOR Eye Avatar &amp; VNG Drawer" aria-expanded="false" aria-controls="vor-drawer">
                  <span class="vest-btn-text">VOR Eyes</span>
                  <span class="vor-arrow" id="vor-arrow">▸</span>
                </button>
              </div>
            </div>

            <div class="vest-subview vest-caloric-subview" id="vest-caloric-subview" style="display: none;">
              <div class="vestibular-protocol-group" id="caloric-temp-chips" role="group" aria-label="Caloric Irrigations">
                <button type="button" class="caloric-chip active" data-caloric-temp="R44" title="Right Warm 44°C">
                  <span class="chip-badge warm">Warm</span>
                  <span class="chip-label">R 44°C</span>
                </button>
                <button type="button" class="caloric-chip" data-caloric-temp="R30" title="Right Cold 30°C">
                  <span class="chip-badge cold">Cold</span>
                  <span class="chip-label">R 30°C</span>
                </button>
                <button type="button" class="caloric-chip" data-caloric-temp="L44" title="Left Warm 44°C">
                  <span class="chip-badge warm">Warm</span>
                  <span class="chip-label">L 44°C</span>
                </button>
                <button type="button" class="caloric-chip" data-caloric-temp="L30" title="Left Cold 30°C">
                  <span class="chip-badge cold">Cold</span>
                  <span class="chip-label">L 30°C</span>
                </button>
                <button type="button" class="caloric-chip" data-caloric-temp="Ice4" title="Ice Water 4°C">
                  <span class="chip-badge ice">Ice</span>
                  <span class="chip-label">Ice 4°C</span>
                </button>
              </div>

              <div class="vestibular-timeline-wrap">
                <div class="timeline-header">
                  <span class="timeline-title" id="caloric-status-title">COWS: Warm Same, Cold Opposite</span>
                  <div class="timeline-meta-cluster">
                    <span class="hold-timer-badge" id="caloric-timer-badge">⏱️ 0s / 40s</span>
                    <span class="clearance-badge" id="caloric-spv-badge">SPV: 0.0°/s</span>
                  </div>
                </div>
                <div class="timeline-slider-row caloric-row">
                  <button type="button" class="timeline-btn play-btn" id="caloric-play-btn" title="Start / Pause Caloric Irrigation (40s)">
                    <span class="play-icon" id="caloric-play-icon">▶</span>
                  </button>
                  <button type="button" class="vest-action-btn posture-btn" id="caloric-posture-btn" title="Align to Supine +30° Head Up Posture">
                    <span class="vest-btn-text">Supine +30°</span>
                  </button>
                  <div class="alexander-hud-group" role="group" aria-label="Alexander's Law Gaze Modulation">
                    <span class="alex-hud-lbl">Gaze:</span>
                    <button type="button" class="alex-gaze-chip" data-alex-gaze="-30">◀ -30°</button>
                    <button type="button" class="alex-gaze-chip active" data-alex-gaze="0">0°</button>
                    <button type="button" class="alex-gaze-chip" data-alex-gaze="30">+30° ▶</button>
                    <span class="alex-badge" id="caloric-alex-degree-badge">2nd Deg</span>
                  </div>
                </div>
              </div>

              <div class="vestibular-actions-group">
                <span class="caloric-laterality-tag" id="caloric-laterality-badge">Right Ear (Ipsilateral)</span>
                <button type="button" class="vest-action-btn" id="caloric-jongkees-open-btn" title="Open Interactive Jongkees Matrix Calculator">
                  <span class="vest-btn-text">Jongkees</span>
                </button>
                <button type="button" class="vest-action-btn vor-toggle-btn" id="caloric-vor-toggle-btn" title="Toggle 3D VOR &amp; VNG Drawer" aria-expanded="false" aria-controls="vor-drawer">
                  <span class="vest-btn-text">VOR Eyes</span>
                  <span class="vor-arrow" id="caloric-vor-arrow">▸</span>
                </button>
              </div>
            </div>

            <div class="vest-subview vest-vhit-subview" id="vest-vhit-subview" style="display: none;">
              <div class="vestibular-protocol-group" id="vhit-pair-chips" role="group" aria-label="vHIT Canal Pairs">
                <button type="button" class="vhit-pair-chip active" data-vhit-pair="horizontal" title="Horizontal Semicircular Canals (Yaw Impulse)">
                  <span class="chip-badge">Yaw</span>
                  <span class="chip-label">Horizontal</span>
                </button>
                <button type="button" class="vhit-pair-chip" data-vhit-pair="ralp" title="Right Anterior / Left Posterior (+45°)">
                  <span class="chip-badge">A/P</span>
                  <span class="chip-label">RALP</span>
                </button>
                <button type="button" class="vhit-pair-chip" data-vhit-pair="larp" title="Left Anterior / Right Posterior (-45°)">
                  <span class="chip-badge">A/P</span>
                  <span class="chip-label">LARP</span>
                </button>
                <button type="button" class="timeline-btn vhit-dir-btn" id="vhit-dir-left-btn" data-vhit-dir="-1" title="Thrust Head Left">◀ L</button>
                <button type="button" class="timeline-btn vhit-dir-btn active" id="vhit-dir-right-btn" data-vhit-dir="1" title="Thrust Head Right">R ▶</button>
              </div>

              <div class="vestibular-timeline-wrap">
                <div class="timeline-header">
                  <span class="timeline-title" id="vhit-status-title">Head Impulse (15°, 120ms)</span>
                  <div class="timeline-meta-cluster">
                    <span class="hold-timer-badge" id="vhit-gain-badge">Gain: 1.00</span>
                    <span class="clearance-badge" id="vhit-saccade-badge">Normal (No Saccades)</span>
                  </div>
                </div>
                <div class="timeline-slider-row vhit-presets-row">
                  <button type="button" class="vhit-preset-chip active" data-vhit-preset="normal">Normal</button>
                  <button type="button" class="vhit-preset-chip" data-vhit-preset="acute_neuritis">Neuritis</button>
                  <button type="button" class="vhit-preset-chip" data-vhit-preset="chronic_schwannoma">Schwannoma</button>
                  <button type="button" class="vhit-preset-chip" data-vhit-preset="bilateral_loss">Bilateral</button>
                  <button type="button" class="vhit-toggle-btn" id="vhit-paradigm-toggle-btn" title="Toggle HIMP vs SHIMP">HIMP</button>
                  <button type="button" class="vhit-toggle-btn" id="vhit-slippage-toggle-btn" title="Toggle Goggle Slippage Artifact">Slippage: Off</button>
                </div>
              </div>

              <div class="vestibular-actions-group">
                <button type="button" class="vest-action-btn vhit-deliver-thrust-btn" id="vhit-deliver-thrust-btn" title="Deliver 15° 120ms High-Acceleration Head Impulse">
                  <span class="vest-btn-text">Deliver Thrust</span>
                </button>
                <button type="button" class="vest-action-btn vor-toggle-btn" id="vhit-vor-toggle-btn" title="Toggle 3D VOR &amp; VNG Drawer" aria-expanded="false" aria-controls="vor-drawer">
                  <span class="vest-btn-text">VOR Eyes</span>
                  <span class="vor-arrow" id="vhit-vor-arrow">▸</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 4E. Surgical Suites Workbench Dock Content -->
          <div class="surgical-dock-content" id="surgical-dock-content" style="display: none;">
            <div class="surg-subnav-bar" id="surg-subnav-bar" role="tablist" aria-label="Surgical Procedures">
              <button type="button" class="surg-subnav-tab active" data-submode="ci" id="surg-subnav-ci">Cochlear Implant</button>
              <button type="button" class="surg-subnav-tab" data-submode="labyrinthectomy" id="surg-subnav-laby">Transmastoid Labyrinthectomy</button>
              <button type="button" class="surg-subnav-tab" data-submode="neurectomy" id="surg-subnav-neurectomy">Retrosigmoid Neurectomy &amp; CPA</button>
            </div>

            <div class="surg-subview surg-ci-subview" id="surg-ci-subview" style="display: flex;">
              <div class="surg-chip-group" role="group" aria-label="CI Hardware &amp; Approach">
                <button type="button" class="surg-chip active" id="ci-approach-rw" data-approach="round_window" title="Round Window Membrane Approach">
                  <span class="chip-badge">Approach</span>
                  <span class="chip-label">Round Window</span>
                </button>
                <button type="button" class="surg-chip" id="ci-approach-coch" data-approach="cochleostomy" title="Anteroinferior Cochleostomy">
                  <span class="chip-badge">Approach</span>
                  <span class="chip-label">Cochleostomy</span>
                </button>
                <button type="button" class="surg-chip active" id="ci-array-lateral" data-array="lateral_wall" title="Flexible Straight Lateral Wall Array (28mm)">
                  <span class="chip-badge">Array</span>
                  <span class="chip-label">Lateral Wall</span>
                </button>
                <button type="button" class="surg-chip" id="ci-array-peri" data-array="perimodiolar" title="Pre-Curved Perimodiolar AOS Array (21mm)">
                  <span class="chip-badge">Array</span>
                  <span class="chip-label">Perimodiolar</span>
                </button>
              </div>

              <div class="surg-timeline-wrap">
                <div class="timeline-header">
                  <span class="timeline-title" id="ci-depth-title">Insertion Depth: 0.0 mm (0.0°)</span>
                  <div class="timeline-meta-cluster">
                    <span class="hold-timer-badge" id="ci-force-badge">F: 0.0 mN</span>
                    <span class="clearance-badge" id="ci-risk-badge">OPTIMAL</span>
                  </div>
                </div>
                <div class="timeline-slider-row">
                  <button type="button" class="timeline-btn play-btn" id="ci-auto-insert-btn" title="Motorized Auto-Insert (0.5 mm/s)">
                    <span class="play-icon" id="ci-auto-icon">▶</span>
                  </button>
                  <button type="button" class="timeline-btn" id="ci-retract-btn" title="Full Retraction">↺</button>
                  <input
                    type="range"
                    class="surgical-slider"
                    id="ci-depth-slider"
                    min="0"
                    max="280"
                    value="0"
                    step="1"
                    aria-label="Electrode Insertion Depth in tenths of a mm"
                  />
                  <div class="ci-trajectory-sliders" title="Trajectory Deviation Angles">
                    <label class="ci-mini-lbl">Pitch: <span id="ci-pitch-val">0°</span></label>
                    <input type="range" class="mini-slider" id="ci-pitch-slider" min="-15" max="15" value="0" step="1" title="Pitch Angle Deviation (-15° to +15°)" />
                    <label class="ci-mini-lbl">Yaw: <span id="ci-yaw-val">0°</span></label>
                    <input type="range" class="mini-slider" id="ci-yaw-slider" min="-15" max="15" value="0" step="1" title="Yaw Angle Deviation (-15° to +15°)" />
                  </div>
                </div>
              </div>

              <div class="surg-actions-group">
                <button type="button" class="vest-action-btn surg-drawer-toggle-btn" id="ci-drawer-toggle-btn" title="Toggle Surgical Endoscopy &amp; Biotelemetry Drawer" aria-expanded="false" aria-controls="surgical-drawer">
                  <span class="vest-btn-text">Monitor</span>
                  <span class="surg-arrow" id="ci-surg-arrow">▸</span>
                </button>
              </div>
            </div>

            <div class="surg-subview surg-laby-subview" id="surg-laby-subview" style="display: none;">
              <div class="surg-chip-group" role="group" aria-label="Labyrinthectomy Steps">
                <button type="button" class="surg-chip active" data-laby-step="0">Step 1: Mastoidectomy</button>
                <button type="button" class="surg-chip" data-laby-step="1">Step 2: Canal Milling</button>
                <button type="button" class="surg-chip" data-laby-step="2">Step 3: Vestibulotomy</button>
                <button type="button" class="surg-chip" data-laby-step="3">Step 4: Curettage</button>
              </div>

              <div class="surg-timeline-wrap">
                <div class="timeline-header">
                  <span class="timeline-title" id="laby-step-title">Step 1: Cortical Mastoidectomy</span>
                  <div class="timeline-meta-cluster">
                    <span class="hold-timer-badge" id="laby-drill-badge">70,000 RPM</span>
                    <span class="clearance-badge" id="laby-spv-badge">SPV: 0.0°/s</span>
                  </div>
                </div>
                <div class="timeline-slider-row">
                  <button type="button" class="vest-action-btn drill-btn" id="laby-drill-toggle-btn" title="Toggle Otologic Drill (70,000 RPM)">
                    <span class="vest-btn-text" id="laby-drill-text">Drill: On</span>
                  </button>
                  <div class="compensation-row">
                    <label class="ci-mini-lbl">Comp Time: <span id="laby-comp-val">0h (Acute)</span></label>
                    <input type="range" class="surgical-slider" id="laby-comp-slider" min="0" max="720" value="0" step="6" title="Central Vestibular Compensation Hours (0 to 720h)" />
                  </div>
                  <button type="button" class="vest-action-btn ablate-btn" id="laby-ablate-all-btn" title="Complete Acute Deafferentation">
                    <span class="vest-btn-text">Ablate All</span>
                  </button>
                </div>
              </div>

              <div class="surg-actions-group">
                <button type="button" class="vest-action-btn surg-drawer-toggle-btn" id="laby-drawer-toggle-btn" title="Toggle Surgical Drawer" aria-expanded="false" aria-controls="surgical-drawer">
                  <span class="vest-btn-text">Monitor</span>
                  <span class="surg-arrow" id="laby-surg-arrow">▸</span>
                </button>
              </div>
            </div>

            <div class="surg-subview surg-neurectomy-subview" id="surg-neurectomy-subview" style="display: none;">
              <div class="surg-chip-group" role="group" aria-label="Neurectomy Steps">
                <button type="button" class="surg-chip active" data-neurectomy-step="0">Step 1: Craniotomy</button>
                <button type="button" class="surg-chip" data-neurectomy-step="1">Step 2: CPA Exposure</button>
                <button type="button" class="surg-chip" data-neurectomy-step="2">Step 3: Cleavage Plane</button>
                <button type="button" class="surg-chip" data-neurectomy-step="3">Step 4: Transection</button>
              </div>

              <div class="surg-timeline-wrap">
                <div class="timeline-header">
                  <span class="timeline-title" id="neurectomy-step-title">Step 1: Retrosigmoid Craniotomy</span>
                  <div class="timeline-meta-cluster">
                    <span class="hold-timer-badge" id="neurectomy-abr-badge">ABR V: 5.70 ms</span>
                    <span class="clearance-badge" id="neurectomy-emg-badge">EMG: 8 μV</span>
                  </div>
                </div>
                <div class="timeline-slider-row">
                  <div class="tool-btn-group" role="group" aria-label="Microsurgical Tools">
                    <button type="button" class="surg-tool-btn active" data-tool="scissors" title="Micro-Scissors">Scissors</button>
                    <button type="button" class="surg-tool-btn" data-tool="hook" title="Nerve Hook">Hook</button>
                    <button type="button" class="surg-tool-btn" data-tool="bipolar" title="Bipolar Coagulation">Bipolar</button>
                  </div>
                  <div class="koos-row">
                    <label class="ci-mini-lbl">Koos: <span id="neurectomy-koos-val">Stage 0</span></label>
                    <input type="range" class="mini-slider" id="neurectomy-koos-slider" min="0" max="4" value="0" step="1" title="Acoustic Neuroma Koos Staging (0 to IV)" />
                  </div>
                  <button type="button" class="vest-action-btn" id="neurectomy-cleavage-btn" title="Toggle Cleavage Plane Highlight">
                    <span class="vest-btn-text">Cleavage</span>
                  </button>
                </div>
              </div>

              <div class="surg-actions-group">
                <button type="button" class="vest-action-btn surg-drawer-toggle-btn" id="neurectomy-drawer-toggle-btn" title="Toggle Surgical Drawer" aria-expanded="false" aria-controls="surgical-drawer">
                  <span class="vest-btn-text">Monitor</span>
                  <span class="surg-arrow" id="neurectomy-surg-arrow">▸</span>
                </button>
              </div>
            </div>
          </div>

          <div class="dock-divider" aria-hidden="true"></div>
          <div class="dock-stage-utils" aria-label="Stage utilities">
            <button type="button" class="dock-icon-btn active" id="tool-labels-btn" title="Cycle 3D structure pins (Off / Key / All)" aria-label="Cycle 3D labels" aria-pressed="true">
              ${SVG_ICONS.labels}
            </button>
            <button type="button" class="dock-icon-btn" id="tool-reset-btn" title="Reset specimen camera view" aria-label="Reset camera view">
              ${SVG_ICONS.reset}
            </button>
          </div>
        </nav>

        <!-- Interactive 3-Axis Head Gyro Flyout Panel -->
        <div class="gyro-flyout glass-surface" id="gyro-flyout" style="display: none;" role="region" aria-label="3-Axis Head Orientation Gyro">
          <div class="gyro-header">
            <span class="gyro-title">3-DOF Head Orientation</span>
            <button type="button" class="gyro-close-btn" id="gyro-close-btn" aria-label="Close Gyro Controls">✕</button>
          </div>
          <div class="gyro-controls-body">
            <div class="gyro-slider-row">
              <span class="gyro-axis-label">Yaw (ψ):</span>
              <input type="range" class="gyro-slider" id="gyro-yaw-slider" min="-180" max="180" value="0" />
              <span class="gyro-val-badge" id="gyro-yaw-val">0°</span>
            </div>
            <div class="gyro-slider-row">
              <span class="gyro-axis-label">Pitch (θ):</span>
              <input type="range" class="gyro-slider" id="gyro-pitch-slider" min="-30" max="120" value="0" />
              <span class="gyro-val-badge" id="gyro-pitch-val">0°</span>
            </div>
            <div class="gyro-slider-row">
              <span class="gyro-axis-label">Roll (γ):</span>
              <input type="range" class="gyro-slider" id="gyro-roll-slider" min="-90" max="90" value="0" />
              <span class="gyro-val-badge" id="gyro-roll-val">0°</span>
            </div>
          </div>
        </div>

        <!-- Caloric Jongkees Bithermal Matrix Modal -->
        <div class="modal-backdrop caloric-modal-backdrop" id="caloric-jongkees-modal" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="jongkees-modal-title">
          <div class="modal-card caloric-modal-sheet">
            <div class="modal-header">
              <div class="modal-title-cluster">
                <span class="brand-badge">CALORIC LAB</span>
                <h2 id="jongkees-modal-title">Jongkees Bithermal Caloric Matrix</h2>
              </div>
              <button type="button" class="modal-close-btn" id="caloric-jongkees-close-btn" aria-label="Close dialog">✕</button>
            </div>
            <div class="modal-body caloric-modal-body">
              <p class="modal-lead">
                Bithermal caloric irrigation assesses unilateral weakness (canal paresis) and directional preponderance using peak slow-phase eye velocity (SPV °/s) per Jongkees (1962).
              </p>
              <div class="jongkees-presets-row" role="group" aria-label="Clinical Presets">
                <span class="jongkees-lbl">Presets:</span>
                <button type="button" class="jongkees-preset-btn active" data-preset="normal">Normal</button>
                <button type="button" class="jongkees-preset-btn" data-preset="right_uw">Right Paresis (70%)</button>
                <button type="button" class="jongkees-preset-btn" data-preset="left_uw">Left Paresis (51%)</button>
                <button type="button" class="jongkees-preset-btn" data-preset="dp_right">DP Right (48%)</button>
                <button type="button" class="jongkees-preset-btn" data-preset="bilateral">Bilateral Loss</button>
              </div>
              <div class="jongkees-grid">
                <div class="jongkees-ear-col right-ear">
                  <h4>Right Ear (AD)</h4>
                  <div class="input-field-group">
                    <label for="jongkees-r44">Warm 44°C SPV (°/s):</label>
                    <input type="number" id="jongkees-r44" min="0" max="100" step="0.5" value="22.0" />
                  </div>
                  <div class="input-field-group">
                    <label for="jongkees-r30">Cold 30°C SPV (°/s):</label>
                    <input type="number" id="jongkees-r30" min="0" max="100" step="0.5" value="20.0" />
                  </div>
                </div>
                <div class="jongkees-ear-col left-ear">
                  <h4>Left Ear (AS)</h4>
                  <div class="input-field-group">
                    <label for="jongkees-l44">Warm 44°C SPV (°/s):</label>
                    <input type="number" id="jongkees-l44" min="0" max="100" step="0.5" value="21.0" />
                  </div>
                  <div class="input-field-group">
                    <label for="jongkees-l30">Cold 30°C SPV (°/s):</label>
                    <input type="number" id="jongkees-l30" min="0" max="100" step="0.5" value="21.0" />
                  </div>
                </div>
              </div>
              <div class="jongkees-results-panel">
                <div class="jongkees-result-metric">
                  <span class="metric-title">Unilateral Weakness (UW)</span>
                  <span class="metric-val" id="jongkees-uw-val">2.4%</span>
                  <span class="metric-sub">Pathology: &ge; 25%</span>
                </div>
                <div class="jongkees-result-metric">
                  <span class="metric-title">Directional Preponderance (DP)</span>
                  <span class="metric-val" id="jongkees-dp-val">0.0%</span>
                  <span class="metric-sub">Pathology: &ge; 30%</span>
                </div>
                <div class="jongkees-result-metric">
                  <span class="metric-title">Total Caloric Response</span>
                  <span class="metric-val" id="jongkees-total-val">84.0°/s</span>
                  <span class="metric-sub">Hypofunction: &lt; 12°/s</span>
                </div>
              </div>
              <div class="caloric-interp-card" id="caloric-interp-card">
                <strong>Symmetric Vestibular Function:</strong> Bilateral horizontal canal caloric responses are within normative limits (UW &lt; 25%, DP &lt; 30%, Total &ge; 12°/s).
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" class="modal-confirm-btn" id="caloric-modal-apply-btn">Apply &amp; Close</button>
            </div>
          </div>
        </div>

        ${buildReportDialogHTML()}
        ${buildLoadingOverlayHTML()}
      </div>
    `;

    this.bindDOMReferences();
    this.attachEventListeners();
  }

  private bindDOMReferences(): void {
    this.appShell = this.root.querySelector('#app-shell') as HTMLElement;
    this.headerEl = this.root.querySelector('.lab-header') as HTMLElement | null;
    this.canvasHost = this.root.querySelector('#canvas-host') as HTMLElement;
    this.pinsLayer = this.root.querySelector('#pins-layer') as HTMLElement;

    this.modeSwitcher = this.root.querySelector('.mode-switcher') as HTMLElement | null;
    this.modePills = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.mode-pill'));

    this.searchInput = this.root.querySelector('#search-input') as HTMLInputElement;
    this.searchClearBtn = this.root.querySelector('#search-clear-btn') as HTMLButtonElement;
    this.searchDropdown = this.root.querySelector('#search-dropdown') as HTMLElement;
    this.headerSearchBtn = this.root.querySelector('#header-search-btn') as HTMLButtonElement;
    this.reportOpenBtn = this.root.querySelector('#report-open-btn') as HTMLButtonElement;
    this.themeToggleBtn = this.root.querySelector('#theme-toggle-btn') as HTMLButtonElement;
    this.settingsBtn = this.root.querySelector('#settings-btn') as HTMLButtonElement;
    this.settingsPopover = this.root.querySelector('#settings-popover') as HTMLElement;
    this.appearanceHint = this.root.querySelector('#appearance-hint') as HTMLElement;

    // Unified Note & Lab Sidebar
    this.noteSidebar = this.root.querySelector('#note-sidebar') as HTMLElement;
    this.noteCollapsedPill = this.root.querySelector('#note-collapsed-pill') as HTMLButtonElement;
    this.notePillDot = this.root.querySelector('#note-pill-dot') as HTMLElement;
    this.notePillLabel = this.root.querySelector('#note-pill-label') as HTMLElement;
    this.noteCard = this.root.querySelector('#note-card') as HTMLElement;
    this.noteSystemDot = this.root.querySelector('#note-system-dot') as HTMLElement;
    this.noteSystemLabel = this.root.querySelector('#note-system-label') as HTMLElement;
    this.noteTitleEl = this.root.querySelector('#note-title') as HTMLElement;
    this.noteCompactBody = this.root.querySelector('#note-compact-body') as HTMLElement;
    this.noteCompactLead = this.root.querySelector('#note-compact-lead') as HTMLElement;
    this.noteReadBtn = this.root.querySelector('#note-read-btn') as HTMLButtonElement;
    this.noteLabShortcutBtn = this.root.querySelector('#note-lab-shortcut-btn') as HTMLButtonElement;
    this.noteExpandToggleBtn = this.root.querySelector('#note-expand-toggle-btn') as HTMLButtonElement;
    this.noteCollapseBtn = this.root.querySelector('#note-collapse-btn') as HTMLButtonElement;
    this.noteScrollBody = this.root.querySelector('#note-scroll-body') as HTMLElement;
    this.tabNoteBtn = this.root.querySelector('#tab-note-btn') as HTMLButtonElement;
    this.tabLabBtn = this.root.querySelector('#tab-lab-btn') as HTMLButtonElement;
    this.sidebarPaneNote = this.root.querySelector('#sidebar-pane-note') as HTMLElement;
    this.sidebarPaneLab = this.root.querySelector('#sidebar-pane-lab') as HTMLElement;
    this.noteLeadProse = this.root.querySelector('#insp-summary') as HTMLElement;
    this.inspFluidEl = this.root.querySelector('#insp-fluid') as HTMLElement;
    this.inspMetricKeyEl = this.root.querySelector('#insp-metric-key') as HTMLElement;
    this.inspMetricValEl = this.root.querySelector('#insp-metric-val') as HTMLElement;
    this.btnIsolate = this.root.querySelector('#btn-isolate') as HTMLButtonElement;
    this.btnResetView = this.root.querySelector('#btn-reset-view') as HTMLButtonElement;
    this.noteContextBoxes = this.root.querySelector('#note-context-boxes') as HTMLElement;
    this.furtherReadDetails = this.root.querySelector('#further-read-details') as HTMLDetailsElement;
    this.furtherReadHint = this.root.querySelector('#further-read-hint') as HTMLElement;
    this.inspDeepProse = this.root.querySelector('#insp-deep-prose') as HTMLElement;
    this.inspLatinEl = this.root.querySelector('#insp-latin') as HTMLElement;
    this.inspInnervationEl = this.root.querySelector('#insp-innervation') as HTMLElement;
    this.inspMorphometryEl = this.root.querySelector('#insp-morphometry') as HTMLElement;
    this.inspRasChipEl = this.root.querySelector('#insp-ras-chip') as HTMLElement;
    this.inspPearlEl = this.root.querySelector('#insp-pearl') as HTMLElement;

    // Dock & Stage Utilities
    this.bottomBar = this.root.querySelector('#bottom-bar') as HTMLElement;
    this.anatomyDockContent = this.root.querySelector('#anatomy-dock-content') as HTMLElement;
    this.hearingDockContent = this.root.querySelector('#hearing-dock-content') as HTMLElement;
    this.radiologyDockContent = this.root.querySelector('#radiology-dock-content') as HTMLElement;
    this.vestibularDockContent = this.root.querySelector('#vestibular-dock-content') as HTMLElement;
    this.surgicalDockContent = this.root.querySelector('#surgical-dock-content') as HTMLElement;
    this.toolLabelsBtn = this.root.querySelector('#tool-labels-btn') as HTMLButtonElement;
    this.toolResetBtn = this.root.querySelector('#tool-reset-btn') as HTMLButtonElement;

    // Anatomy Dock & Parts List
    this.boneSlider = this.root.querySelector('#bone-peel-slider') as HTMLInputElement;
    this.boneValEl = this.root.querySelector('#bone-val') as HTMLElement;
    this.explodeSlider = this.root.querySelector('#explode-slider') as HTMLInputElement;
    this.explodeValEl = this.root.querySelector('#explode-val') as HTMLElement;
    this.mobileBoneSlider = this.root.querySelector('#mobile-bone-peel-slider') as HTMLInputElement;
    this.mobileBoneValEl = this.root.querySelector('#mobile-bone-val') as HTMLElement;
    this.mobileExplodeSlider = this.root.querySelector('#mobile-explode-slider') as HTMLInputElement;
    this.mobileExplodeValEl = this.root.querySelector('#mobile-explode-val') as HTMLElement;
    this.partsToggleBtn = this.root.querySelector('#parts-toggle-btn') as HTMLButtonElement;
    this.partsDrawer = this.root.querySelector('#parts-drawer') as HTMLElement;
    this.partsFilterInput = this.root.querySelector('#parts-filter-input') as HTMLInputElement;
    this.partsFilterChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('#parts-filter-chips [data-sys-filter]'));

    // Hearing Controls
    this.tonePlayBtn = this.root.querySelector('#tone-play-btn') as HTMLButtonElement;
    this.toneIconEl = this.root.querySelector('#tone-icon') as HTMLElement;
    this.toneLabelEl = this.root.querySelector('#tone-label') as HTMLElement;
    this.hearingSlider = this.root.querySelector('#hearing-freq-slider') as HTMLInputElement;
    this.hearingFreqReadout = this.root.querySelector('#hearing-freq-readout') as HTMLElement;
    this.hearingLandmarkBadge = this.root.querySelector('#hearing-landmark-badge') as HTMLElement;
    this.octaveChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-octave]'));
    this.audiogramToggleBtn = this.root.querySelector('#audiogram-toggle-btn') as HTMLButtonElement;
    this.audiogramArrowEl = this.root.querySelector('#audiogram-arrow') as HTMLElement;

    // Radiology Controls
    this.planeChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('#rad-plane-chips [data-plane]'));
    this.radiologyDepthSlider = this.root.querySelector('#radiology-depth-slider') as HTMLInputElement;
    this.radiologyDepthValEl = this.root.querySelector('#radiology-depth-val') as HTMLElement;
    this.radiologyLandmarkBadgeEl = this.root.querySelector('#radiology-landmark-badge') as HTMLElement;
    this.depthDecBtn = this.root.querySelector('#depth-dec-btn') as HTMLButtonElement;
    this.depthIncBtn = this.root.querySelector('#depth-inc-btn') as HTMLButtonElement;
    this.radiologyFlipBtn = this.root.querySelector('#rad-flip-btn') as HTMLButtonElement;
    this.radiologyGuideBtn = this.root.querySelector('#rad-guide-btn') as HTMLButtonElement;
    this.radiologyScdsBtn = this.root.querySelector('#rad-scds-toggle-btn') as HTMLButtonElement;
    this.radiologyCtToggleBtn = this.root.querySelector('#rad-ct-toggle-btn') as HTMLButtonElement;
    this.ctCardArrowEl = this.root.querySelector('#ct-card-arrow') as HTMLElement;

    // Vestibular Controls
    this.vestSubnavTabs = Array.from(this.root.querySelectorAll<HTMLButtonElement>('#vest-subnav-bar .vest-subnav-tab'));
    this.vestBppvSubview = this.root.querySelector('#vest-bppv-subview') as HTMLElement;
    this.vestCaloricSubview = this.root.querySelector('#vest-caloric-subview') as HTMLElement;
    this.vestVhitSubview = this.root.querySelector('#vest-vhit-subview') as HTMLElement;
    this.vestSubviews = [this.vestBppvSubview, this.vestCaloricSubview, this.vestVhitSubview];

    this.vestProtocolChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('#vest-protocol-chips [data-maneuver]'));
    this.vestStepTitleEl = this.root.querySelector('#vest-step-title') as HTMLElement;
    this.vestHoldTimerBadgeEl = this.root.querySelector('#vest-hold-timer-badge') as HTMLElement;
    this.vestClearanceBadgeEl = this.root.querySelector('#vest-clearance-badge') as HTMLElement;
    this.vestStepPrevBtn = this.root.querySelector('#vest-step-prev-btn') as HTMLButtonElement;
    this.vestStepNextBtn = this.root.querySelector('#vest-step-next-btn') as HTMLButtonElement;
    this.vestPlayBtn = this.root.querySelector('#vest-play-btn') as HTMLButtonElement;
    this.vestPlayIconEl = this.root.querySelector('#vest-play-icon') as HTMLElement;
    this.vestStepSlider = this.root.querySelector('#vest-step-slider') as HTMLInputElement;
    this.vestGyroToggleBtn = this.root.querySelector('#vest-gyro-toggle-btn') as HTMLButtonElement;
    this.vestResetBtn = this.root.querySelector('#vest-reset-btn') as HTMLButtonElement;
    this.vestVorToggleBtn = this.root.querySelector('#vest-vor-toggle-btn') as HTMLButtonElement;
    this.vorArrowEl = this.root.querySelector('#vor-arrow') as HTMLElement;

    // Caloric Controls
    this.caloricTempChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('#caloric-temp-chips [data-caloric-temp]'));
    this.caloricPlayBtn = this.root.querySelector('#caloric-play-btn') as HTMLButtonElement;
    this.caloricPlayIconEl = this.root.querySelector('#caloric-play-icon') as HTMLElement;
    this.caloricTimerBadgeEl = this.root.querySelector('#caloric-timer-badge') as HTMLElement;
    this.caloricSpvBadgeEl = this.root.querySelector('#caloric-spv-badge') as HTMLElement;
    this.caloricStatusTitleEl = this.root.querySelector('#caloric-status-title') as HTMLElement;
    this.caloricLateralityBadgeEl = this.root.querySelector('#caloric-laterality-badge') as HTMLElement;
    this.caloricPostureBtn = this.root.querySelector('#caloric-posture-btn') as HTMLButtonElement;
    this.caloricGazeChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-alex-gaze]'));
    this.caloricAlexBadgeEl = this.root.querySelector('#caloric-alex-degree-badge') as HTMLElement;
    this.caloricJongkeesOpenBtn = this.root.querySelector('#caloric-jongkees-open-btn') as HTMLButtonElement;
    this.caloricJongkeesModal = this.root.querySelector('#caloric-jongkees-modal') as HTMLElement;
    this.caloricJongkeesCloseBtn = this.root.querySelector('#caloric-jongkees-close-btn') as HTMLButtonElement;
    this.caloricModalApplyBtn = this.root.querySelector('#caloric-modal-apply-btn') as HTMLButtonElement;
    this.caloricPresetChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.jongkees-preset-btn'));
    this.jongkeesR44Input = this.root.querySelector('#jongkees-r44') as HTMLInputElement;
    this.jongkeesR30Input = this.root.querySelector('#jongkees-r30') as HTMLInputElement;
    this.jongkeesL44Input = this.root.querySelector('#jongkees-l44') as HTMLInputElement;
    this.jongkeesL30Input = this.root.querySelector('#jongkees-l30') as HTMLInputElement;
    this.resultUwValEl = this.root.querySelector('#jongkees-uw-val') as HTMLElement;
    this.resultDpValEl = this.root.querySelector('#jongkees-dp-val') as HTMLElement;
    this.resultTotalValEl = this.root.querySelector('#jongkees-total-val') as HTMLElement;
    this.caloricInterpCardEl = this.root.querySelector('#caloric-interp-card') as HTMLElement;
    this.caloricVorToggleBtn = this.root.querySelector('#caloric-vor-toggle-btn') as HTMLButtonElement;
    this.caloricVorArrowEl = this.root.querySelector('#caloric-vor-arrow') as HTMLElement;

    // vHIT Controls
    this.vhitPairChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('#vhit-pair-chips [data-vhit-pair]'));
    this.vhitDirLeftBtn = this.root.querySelector('#vhit-dir-left-btn') as HTMLButtonElement;
    this.vhitDirRightBtn = this.root.querySelector('#vhit-dir-right-btn') as HTMLButtonElement;
    this.vhitPresetChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-vhit-preset]'));
    this.vhitParadigmBtn = this.root.querySelector('#vhit-paradigm-toggle-btn') as HTMLButtonElement;
    this.vhitSlippageBtn = this.root.querySelector('#vhit-slippage-toggle-btn') as HTMLButtonElement;
    this.vhitThrustBtn = this.root.querySelector('#vhit-deliver-thrust-btn') as HTMLButtonElement;
    this.vhitGainBadgeEl = this.root.querySelector('#vhit-gain-badge') as HTMLElement;
    this.vhitSaccadeBadgeEl = this.root.querySelector('#vhit-saccade-badge') as HTMLElement;
    this.vhitStatusTitleEl = this.root.querySelector('#vhit-status-title') as HTMLElement;
    this.vhitVorToggleBtn = this.root.querySelector('#vhit-vor-toggle-btn') as HTMLButtonElement;
    this.vhitVorArrowEl = this.root.querySelector('#vhit-vor-arrow') as HTMLElement;

    // Gyro Flyout
    this.gyroFlyout = this.root.querySelector('#gyro-flyout') as HTMLElement;
    this.gyroCloseBtn = this.root.querySelector('#gyro-close-btn') as HTMLButtonElement;
    this.gyroYawSlider = this.root.querySelector('#gyro-yaw-slider') as HTMLInputElement;
    this.gyroPitchSlider = this.root.querySelector('#gyro-pitch-slider') as HTMLInputElement;
    this.gyroRollSlider = this.root.querySelector('#gyro-roll-slider') as HTMLInputElement;
    this.gyroYawValEl = this.root.querySelector('#gyro-yaw-val') as HTMLElement;
    this.gyroPitchValEl = this.root.querySelector('#gyro-pitch-val') as HTMLElement;
    this.gyroRollValEl = this.root.querySelector('#gyro-roll-val') as HTMLElement;

    // Surgical Workbench Controls
    this.surgSubnavTabs = Array.from(this.root.querySelectorAll<HTMLButtonElement>('#surg-subnav-bar .surg-subnav-tab'));
    const surgCiSubview = this.root.querySelector('#surg-ci-subview') as HTMLElement;
    const surgLabySubview = this.root.querySelector('#surg-laby-subview') as HTMLElement;
    const surgNeurSubview = this.root.querySelector('#surg-neurectomy-subview') as HTMLElement;
    this.surgSubviews.set('ci', surgCiSubview);
    this.surgSubviews.set('labyrinthectomy', surgLabySubview);
    this.surgSubviews.set('neurectomy', surgNeurSubview);

    this.ciApproachChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-approach]'));
    this.ciArrayChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-array]'));
    this.ciDepthSlider = this.root.querySelector('#ci-depth-slider') as HTMLInputElement;
    this.ciPitchSlider = this.root.querySelector('#ci-pitch-slider') as HTMLInputElement;
    this.ciYawSlider = this.root.querySelector('#ci-yaw-slider') as HTMLInputElement;
    this.ciDepthTitleEl = this.root.querySelector('#ci-depth-title') as HTMLElement;
    this.ciForceBadgeEl = this.root.querySelector('#ci-force-badge') as HTMLElement;
    this.ciRiskBadgeEl = this.root.querySelector('#ci-risk-badge') as HTMLElement;
    this.ciPitchValEl = this.root.querySelector('#ci-pitch-val') as HTMLElement;
    this.ciYawValEl = this.root.querySelector('#ci-yaw-val') as HTMLElement;
    this.ciAutoInsertBtn = this.root.querySelector('#ci-auto-insert-btn') as HTMLButtonElement;
    this.ciRetractBtn = this.root.querySelector('#ci-retract-btn') as HTMLButtonElement;

    this.labyStepChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-laby-step]'));
    this.labyStepTitleEl = this.root.querySelector('#laby-step-title') as HTMLElement;
    this.labyDrillBadgeEl = this.root.querySelector('#laby-drill-badge') as HTMLElement;
    this.labySpvBadgeEl = this.root.querySelector('#laby-spv-badge') as HTMLElement;
    this.labyDrillToggleBtn = this.root.querySelector('#laby-drill-toggle-btn') as HTMLButtonElement;
    this.labyDrillTextEl = this.root.querySelector('#laby-drill-text') as HTMLElement;
    this.labyCompSlider = this.root.querySelector('#laby-comp-slider') as HTMLInputElement;
    this.labyCompValEl = this.root.querySelector('#laby-comp-val') as HTMLElement;
    this.labyAblateAllBtn = this.root.querySelector('#laby-ablate-all-btn') as HTMLButtonElement;

    this.neurectomyStepChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-neurectomy-step]'));
    this.neurectomyToolBtns = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-tool]'));
    this.neurectomyStepTitleEl = this.root.querySelector('#neurectomy-step-title') as HTMLElement;
    this.neurectomyAbrBadgeEl = this.root.querySelector('#neurectomy-abr-badge') as HTMLElement;
    this.neurectomyEmgBadgeEl = this.root.querySelector('#neurectomy-emg-badge') as HTMLElement;
    this.neurectomyKoosSlider = this.root.querySelector('#neurectomy-koos-slider') as HTMLInputElement;
    this.neurectomyKoosValEl = this.root.querySelector('#neurectomy-koos-val') as HTMLElement;
    this.neurectomyCleavageBtn = this.root.querySelector('#neurectomy-cleavage-btn') as HTMLButtonElement;

    // Re-host 4 Modal Workbench Drawers inside #sidebar-pane-lab
    this.audiogramDrawer = new AudiogramDrawer(this.sidebarPaneLab);
    this.ctSliceDrawer = new CTSliceDrawer(this.sidebarPaneLab);
    this.vorDrawer = new VORDrawer(this.sidebarPaneLab);
    this.surgicalDrawer = new SurgicalDrawer(this.sidebarPaneLab);

    // Preset Buttons
    this.root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((btn) => {
      const id = btn.getAttribute('data-preset');
      if (id) {
        this.presetButtons.set(id, btn);
      }
    });

    // Dialog & Loading Overlay
    this.reportDialog = this.root.querySelector('#report-dialog') as HTMLDialogElement;
    this.repActivePartEl = this.root.querySelector('#rep-active-part') as HTMLElement;
    this.repActiveModeEl = this.root.querySelector('#rep-active-mode') as HTMLElement;
    this.loadingOverlay = this.root.querySelector('#loading-overlay') as HTMLElement;
    this.loadingFill = this.root.querySelector('#loading-fill') as HTMLElement;
    this.loadingText = this.root.querySelector('#loading-status-text') as HTMLElement;
    this.loadingCount = this.root.querySelector('#loading-count-text') as HTMLElement;
  }

  private attachEventListeners(): void {
    // 1. Search Bar & Dropdown
    this.searchInput.addEventListener('input', () => {
      const query = this.searchInput.value.trim();
      this.searchClearBtn.hidden = !query;
      this.searchClearBtn.style.display = query ? 'inline-flex' : 'none';
      this.activeSearchIndex = -1;
      this.renderSearchResults(query);
    });

    this.searchInput.addEventListener('focus', () => {
      const query = this.searchInput.value.trim();
      if (query) {
        this.renderSearchResults(query);
      }
    });

    this.searchInput.addEventListener('keydown', (ev) => {
      const items = Array.from(this.searchDropdown.querySelectorAll<HTMLElement>('.search-result-item'));
      if (ev.key === 'Escape') {
        this.closeSearchDropdown();
        this.searchInput.blur();
      } else if (ev.key === 'ArrowDown') {
        if (items.length > 0) {
          ev.preventDefault();
          this.activeSearchIndex = (this.activeSearchIndex + 1) % items.length;
          items.forEach((it, idx) => it.classList.toggle('highlighted', idx === this.activeSearchIndex));
          items[this.activeSearchIndex].scrollIntoView({ block: 'nearest' });
        }
      } else if (ev.key === 'ArrowUp') {
        if (items.length > 0) {
          ev.preventDefault();
          this.activeSearchIndex = (this.activeSearchIndex - 1 + items.length) % items.length;
          items.forEach((it, idx) => it.classList.toggle('highlighted', idx === this.activeSearchIndex));
          items[this.activeSearchIndex].scrollIntoView({ block: 'nearest' });
        }
      } else if (ev.key === 'Enter') {
        if (items.length > 0) {
          const targetItem =
            this.activeSearchIndex >= 0 && items[this.activeSearchIndex]
              ? items[this.activeSearchIndex]
              : items[0];
          targetItem.click();
        }
      }
    });

    this.searchClearBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      this.searchClearBtn.hidden = true;
      this.searchClearBtn.style.display = 'none';
      this.closeSearchDropdown();
      this.searchInput.focus();
    });

    this.headerSearchBtn?.addEventListener('click', () => {
      this.switchLabMode('anatomy');
      this.openPartsDrawer();
      requestAnimationFrame(() => this.partsFilterInput?.focus());
    });

    document.addEventListener('pointerdown', (ev) => {
      const target = ev.target as Node | null;
      if (target && !this.searchInput.contains(target) && !this.searchDropdown.contains(target)) {
        this.closeSearchDropdown();
      }
    });

    document.addEventListener('click', (ev) => {
      const target = ev.target as Node | null;
      if (target && !this.searchInput.contains(target) && !this.searchDropdown.contains(target)) {
        this.closeSearchDropdown();
      }
      if (
        this.settingsOpen &&
        target &&
        !this.settingsPopover.contains(target) &&
        !this.settingsBtn.contains(target)
      ) {
        this.closeSettingsPopover();
      }
    });

    // 2. Geometry Sync & Dock ResizeObserver
    window.addEventListener('resize', () => {
      this.scheduleGeometrySync();
    });

    if (typeof ResizeObserver !== 'undefined' && this.bottomBar) {
      this.bottomResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const h = Math.ceil(entry.contentRect.height + 20);
          this.appShell?.style.setProperty('--dock-clearance', `${h}px`);
        }
        this.syncDockClearance();
        this.scheduleGeometrySync();
      });
      this.bottomResizeObserver.observe(this.bottomBar);
    }
    this.syncDockClearance();

    this.noteCard?.addEventListener('transitionend', () => {
      this.refreshPinKeepOutZones();
    });

    // 3. Theme Polarity Listeners
    this.darkMediaQuery.addEventListener('change', () => {
      if (this.themePreference === 'system') {
        this.applyTheme('system');
      }
    });

    this.themeToggleBtn?.addEventListener('click', () => {
      const nextTheme: ThemePreference = this.resolvedTheme === 'dark' ? 'light' : 'dark';
      const osMatchesNext = (nextTheme === 'dark') === this.darkMediaQuery.matches;
      this.applyTheme(osMatchesNext ? 'system' : nextTheme);
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-theme-pref]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pref = (btn.dataset.themePref as ThemePreference) || 'system';
        this.applyTheme(pref);
      });
    });

    // 4. Settings Native Popover & Preferences
    this.settingsPopover?.addEventListener('toggle', (ev) => {
      const toggleEv = ev as ToggleEvent;
      const isOpen = toggleEv.newState === 'open';
      this.settingsOpen = isOpen;
      this.settingsBtn?.setAttribute('aria-expanded', String(isOpen));
    });

    const labelBtns = this.root.querySelectorAll<HTMLButtonElement>('[data-label-mode]');
    labelBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-label-mode') as LabelDensityMode;
        if (mode) {
          this.setLabelDensity(mode);
        }
      });
    });

    const depthBtns = this.root.querySelectorAll<HTMLButtonElement>('[data-reading-depth]');
    depthBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const depth = btn.getAttribute('data-reading-depth') as ReadingDepth;
        if (depth) {
          this.activeReadingDepth = depth;
          this.root.querySelectorAll<HTMLButtonElement>('[data-reading-depth]').forEach((b) => {
            b.classList.toggle('active', b.getAttribute('data-reading-depth') === depth);
          });
          this.scene.setReadingDepth(depth);
          try {
            localStorage.setItem(AppHUD.STORAGE_KEYS.readingDepth, depth);
          } catch {
            // ignore
          }
          this.renderInspectorCard(this.scene.getSnapshot().selectedMesh);
        }
      });
    });

    // 5. Report / Clinical Summary Top-Layer Dialog
    const aboutOpenBtn = this.root.querySelector('#about-open-btn') as HTMLButtonElement | null;
    aboutOpenBtn?.addEventListener('click', () => this.openAboutModal());
    this.reportOpenBtn?.addEventListener('click', () => this.openAboutModal());

    const aboutCloseBtn = this.root.querySelector('#about-close-btn') as HTMLButtonElement | null;
    aboutCloseBtn?.addEventListener('click', () => this.closeAboutModal());

    const aboutConfirmBtn = this.root.querySelector('#about-confirm-btn') as HTMLButtonElement | null;
    aboutConfirmBtn?.addEventListener('click', () => this.closeAboutModal());

    const reportPrintBtn = this.root.querySelector('#report-print-btn') as HTMLButtonElement | null;
    reportPrintBtn?.addEventListener('click', () => window.print());

    this.reportDialog?.addEventListener('cancel', (ev) => {
      if (this.reducedMotionQuery.matches || supportsTopLayerExit()) {
        this.aboutModalOpen = false;
        return;
      }
      ev.preventDefault();
      void this.closeTopLayerDialog(this.reportDialog);
    });

    this.reportDialog?.addEventListener('close', () => {
      this.aboutModalOpen = false;
    });

    if (this.reportDialog && !('closedBy' in HTMLDialogElement.prototype)) {
      this.reportDialog.addEventListener('click', (ev) => {
        if (ev.target !== this.reportDialog) return;
        const rect = this.reportDialog.getBoundingClientRect();
        const clickedInDialog =
          rect.top <= ev.clientY &&
          ev.clientY <= rect.top + rect.height &&
          rect.left <= ev.clientX &&
          ev.clientX <= rect.left + rect.width;
        if (!clickedInDialog) {
          this.closeAboutModal();
        }
      });
    }

    document.addEventListener('keydown', (ev) => {
      if (
        ev.key === 'Escape' &&
        this.noteState === 'expanded' &&
        !this.aboutModalOpen &&
        !(this.reportDialog && this.reportDialog.open) &&
        !(this.settingsPopover && this.settingsPopover.matches(':popover-open')) &&
        !this.searchDropdown.classList.contains('open') &&
        !(this.caloricJongkeesModal && this.caloricJongkeesModal.style.display === 'flex')
      ) {
        this.setNoteState('compact', 'note');
      }
    });

    // 6. Unified Note & Lab Sidebar State Listeners
    this.noteCollapsedPill?.addEventListener('click', () => this.setNoteState('compact'));
    this.noteCollapseBtn?.addEventListener('click', () => this.setNoteState('collapsed'));
    this.noteReadBtn?.addEventListener('click', () => this.setNoteState('expanded', 'note'));
    this.noteLabShortcutBtn?.addEventListener('click', () => this.openLabTabForCurrentMode());
    this.noteExpandToggleBtn?.addEventListener('click', () => {
      this.setNoteState(this.noteState === 'expanded' ? 'compact' : 'expanded');
    });

    this.tabNoteBtn?.addEventListener('click', () => this.setNoteState('expanded', 'note'));
    this.tabLabBtn?.addEventListener('click', () => this.openLabTabForCurrentMode());

    [this.tabNoteBtn, this.tabLabBtn].forEach((tabBtn, idx, list) => {
      tabBtn?.addEventListener('keydown', (ev) => {
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
          ev.preventDefault();
          const target = list[(idx + 1) % list.length];
          target?.focus();
          const nextTab = (target?.dataset.sidebarTab as SidebarTab) || 'note';
          if (nextTab === 'lab') {
            this.openLabTabForCurrentMode();
          } else {
            this.setNoteState('expanded', 'note');
          }
        }
      });
    });

    this.furtherReadDetails?.addEventListener('toggle', () => {
      this.syncSidebarDOM();
    });

    this.btnIsolate?.addEventListener('click', () => {
      const snap = this.scene.getSnapshot();
      if (snap.isIsolated) {
        this.scene.restoreAllVisibility();
      } else {
        this.scene.isolateSelected();
      }
    });

    this.btnResetView?.addEventListener('click', () => {
      this.scene.resetView();
    });

    // 7. Trailing Stage Utilities
    this.toolLabelsBtn?.addEventListener('click', () => {
      const order: LabelDensityMode[] = ['key', 'all', 'off'];
      const next = order[(order.indexOf(this.activeLabelMode) + 1) % order.length];
      this.setLabelDensity(next);
    });

    this.toolResetBtn?.addEventListener('click', () => {
      this.scene.resetView();
    });

    // 8. Anatomy Sliders & Parts Lab Filters
    this.boneSlider.addEventListener('input', () => {
      const val = parseInt(this.boneSlider.value, 10);
      this.syncBoneSliderUI(val);
      this.scene.setSliders({ bonyPeelPercent: val });
    });

    this.mobileBoneSlider?.addEventListener('input', () => {
      const val = parseInt(this.mobileBoneSlider.value, 10);
      this.syncBoneSliderUI(val);
      this.scene.setSliders({ bonyPeelPercent: val });
    });

    this.explodeSlider.addEventListener('input', () => {
      const val = parseInt(this.explodeSlider.value, 10);
      this.syncExplodeSliderUI(val);
      this.scene.setSliders({ explodePercent: val });
    });

    this.mobileExplodeSlider?.addEventListener('input', () => {
      const val = parseInt(this.mobileExplodeSlider.value, 10);
      this.syncExplodeSliderUI(val);
      this.scene.setSliders({ explodePercent: val });
    });

    this.presetButtons.forEach((btn, presetId) => {
      btn.addEventListener('click', () => {
        this.scene.applyDissectionPreset(presetId, true);
      });
    });

    this.partsToggleBtn.addEventListener('click', () => {
      this.togglePartsDrawer();
    });

    const drawerCloseBtn = this.root.querySelector('#drawer-close-btn') as HTMLButtonElement | null;
    drawerCloseBtn?.addEventListener('click', () => {
      this.closePartsDrawer();
    });

    this.partsFilterChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        this.partsSystemFilter = (chip.dataset.sysFilter as 'all' | SystemGroupId) || 'all';
        this.partsFilterChips.forEach((c) => c.classList.toggle('active', c === chip));
        this.renderPartsTree();
      });
    });

    this.partsFilterInput?.addEventListener('input', () => {
      this.partsSearchQuery = this.partsFilterInput.value.trim().toLowerCase();
      this.renderPartsTree();
    });

    // 9. Mode Switcher Tabs (Click + Roving Arrow Keys + Scroll Fade Fallback)
    this.modePills.forEach((pill, index) => {
      pill.addEventListener('click', () => {
        const mode = (pill.dataset.mode as LabMode) || 'anatomy';
        this.switchLabMode(mode);
      });
      pill.addEventListener('keydown', (ev) => {
        let nextIdx = -1;
        if (ev.key === 'ArrowRight') nextIdx = (index + 1) % this.modePills.length;
        else if (ev.key === 'ArrowLeft') nextIdx = (index - 1 + this.modePills.length) % this.modePills.length;
        else if (ev.key === 'Home') nextIdx = 0;
        else if (ev.key === 'End') nextIdx = this.modePills.length - 1;
        if (nextIdx >= 0) {
          ev.preventDefault();
          const target = this.modePills[nextIdx];
          target.focus();
          this.switchLabMode((target.dataset.mode as LabMode) || 'anatomy');
        }
      });
    });

    if (
      this.modeSwitcher &&
      this.modeSwitcher.firstElementChild &&
      this.modeSwitcher.lastElementChild &&
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      !CSS.supports('animation-timeline', 'scroll()')
    ) {
      this.modeScrollObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!this.modeSwitcher) continue;
            if (entry.target === this.modeSwitcher.firstElementChild) {
              this.modeSwitcher.classList.toggle('more-start', entry.intersectionRatio < 1);
            } else if (entry.target === this.modeSwitcher.lastElementChild) {
              this.modeSwitcher.classList.toggle('more-end', entry.intersectionRatio < 1);
            }
          }
        },
        { root: this.modeSwitcher, threshold: 1, rootMargin: '1px' }
      );
      this.modeScrollObserver.observe(this.modeSwitcher.firstElementChild);
      this.modeScrollObserver.observe(this.modeSwitcher.lastElementChild);
    }

    // 10. Hearing Workbench Listeners
    this.tonePlayBtn.addEventListener('click', () => {
      const isPlaying = !this.toneSynth.getIsPlaying();
      const currentFreq = this.scene.getSnapshot().hearingState.activeFrequency;
      if (isPlaying) {
        this.toneSynth.play(currentFreq);
      } else {
        this.toneSynth.pause();
      }
      this.scene.setHearingPlayback(isPlaying);
      this.updateTonePlayButton(isPlaying);
    });

    this.hearingSlider.addEventListener('input', () => {
      const val = parseFloat(this.hearingSlider.value);
      const freq = Math.round(20 * Math.pow(10, (val / 1000) * 3));
      updateRangeProgress(this.hearingSlider);
      this.handleFrequencyChange(freq, false);
    });

    this.octaveChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const freq = parseInt(chip.getAttribute('data-octave') || '1000', 10);
        this.handleFrequencyChange(freq, true);
      });
    });

    this.audiogramToggleBtn.addEventListener('click', () => {
      this.toggleAudiogramDrawer();
    });

    this.audiogramDrawer.onClose(() => {
      this.audiogramToggleBtn.classList.remove('open');
      this.audiogramToggleBtn.setAttribute('aria-expanded', 'false');
      this.audiogramArrowEl.textContent = '▸';
      if (!this.isSwitchingDrawers && this.noteState === 'expanded' && this.sidebarTab === 'lab') {
        this.setNoteState('compact', 'note');
      }
    });

    this.audiogramDrawer.onFrequencySelect((freqHz) => {
      this.handleFrequencyChange(freqHz, true);
    });

    this.audiogramDrawer.onPresetChange((presetId, lossSector) => {
      this.scene.setHearingLossSector(lossSector, presetId);
    });

    // 11. Radiology Workbench Listeners
    this.planeChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const planeId = chip.getAttribute('data-plane') as RadiologyPlaneId;
        if (planeId) {
          this.scene.setRadiologyPlane(planeId);
          this.syncRadiologyUI(this.scene.getRadiologyState());
        }
      });
    });

    this.radiologyDepthSlider.addEventListener('input', () => {
      const depthMm = parseFloat(this.radiologyDepthSlider.value) / 10;
      updateRangeProgress(this.radiologyDepthSlider);
      this.scene.setRadiologyDepth(depthMm);
      this.syncRadiologyDepthUI(depthMm);
    });

    this.depthDecBtn.addEventListener('click', () => {
      const cur = this.scene.getRadiologyState().sliceDepthMm;
      const next = Math.round((cur - 0.5) * 10) / 10;
      this.scene.setRadiologyDepth(next);
      this.syncRadiologyDepthUI(this.scene.getRadiologyState().sliceDepthMm);
    });

    this.depthIncBtn.addEventListener('click', () => {
      const cur = this.scene.getRadiologyState().sliceDepthMm;
      const next = Math.round((cur + 0.5) * 10) / 10;
      this.scene.setRadiologyDepth(next);
      this.syncRadiologyDepthUI(this.scene.getRadiologyState().sliceDepthMm);
    });

    this.radiologyFlipBtn.addEventListener('click', () => {
      const next = !this.scene.getRadiologyState().clipInverted;
      this.scene.setRadiologyClipInverted(next);
      this.radiologyFlipBtn.classList.toggle('active', next);
    });

    this.radiologyGuideBtn.addEventListener('click', () => {
      const next = !this.scene.getRadiologyState().showPlaneHelper;
      this.scene.setRadiologyPlaneHelperVisible(next);
      this.radiologyGuideBtn.classList.toggle('active', next);
    });

    this.radiologyScdsBtn.addEventListener('click', () => {
      const next = !this.scene.getRadiologyState().scdsActive;
      this.scene.setSCDSActive(next);
      this.radiologyScdsBtn.classList.toggle('active', next);
      if (this.audiogramDrawer) {
        this.audiogramDrawer.setActivePreset(next ? 'conductive_scds' : 'normal');
      }
      if (this.ctSliceDrawer) {
        const st = this.scene.getRadiologyState();
        this.ctSliceDrawer.update(st.activePlane, st.sliceDepthMm, st.scdsActive, st.windowMode);
      }
      this.renderInspectorCard(this.scene.getSelectedMesh());
    });

    this.radiologyCtToggleBtn.addEventListener('click', () => {
      this.toggleCTDrawer();
    });

    this.ctSliceDrawer.onClose(() => {
      this.radiologyCtToggleBtn.classList.remove('open');
      this.radiologyCtToggleBtn.setAttribute('aria-expanded', 'false');
      this.ctCardArrowEl.textContent = '▸';
      if (!this.isSwitchingDrawers && this.noteState === 'expanded' && this.sidebarTab === 'lab') {
        this.setNoteState('compact', 'note');
      }
    });

    this.ctSliceDrawer.onDepthChange((depthMm) => {
      this.scene.setRadiologyDepth(depthMm);
      this.syncRadiologyDepthUI(depthMm);
    });

    this.ctSliceDrawer.onWindowModeChange((mode) => {
      this.scene.setCTWindowMode(mode);
    });

    // 12. Vestibular Workbench & Diagnostic Modality Listeners
    this.vestSubnavTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const sub = tab.getAttribute('data-submode') as 'bppv' | 'caloric' | 'vhit';
        if (sub) {
          this.switchVestibularSubmode(sub);
        }
      });
    });

    this.vestProtocolChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const id = chip.getAttribute('data-maneuver') as ManeuverId;
        if (id) {
          this.selectManeuver(id);
        }
      });
    });

    this.vestStepSlider.addEventListener('input', () => {
      const idx = parseInt(this.vestStepSlider.value, 10);
      updateRangeProgress(this.vestStepSlider);
      this.pauseSequencer();
      this.goToStep(idx);
    });

    this.vestStepPrevBtn.addEventListener('click', () => {
      this.pauseSequencer();
      this.stepManeuver(-1);
    });

    this.vestStepNextBtn.addEventListener('click', () => {
      this.pauseSequencer();
      this.stepManeuver(1);
    });

    this.vestPlayBtn.addEventListener('click', () => {
      this.toggleSequencer();
    });

    this.vestResetBtn.addEventListener('click', () => {
      this.resetVestibular();
    });

    this.vestGyroToggleBtn.addEventListener('click', () => {
      this.toggleGyroFlyout();
    });

    this.gyroCloseBtn.addEventListener('click', () => {
      this.closeGyroFlyout();
    });

    const handleGyroInput = () => {
      const yaw = parseFloat(this.gyroYawSlider.value);
      const pitch = parseFloat(this.gyroPitchSlider.value);
      const roll = parseFloat(this.gyroRollSlider.value);
      this.setHeadOrientationUI(yaw, pitch, roll);
      this.scene.setHeadOrientation(yaw, pitch, roll);
    };
    this.gyroYawSlider.addEventListener('input', handleGyroInput);
    this.gyroPitchSlider.addEventListener('input', handleGyroInput);
    this.gyroRollSlider.addEventListener('input', handleGyroInput);

    this.vestVorToggleBtn.addEventListener('click', () => {
      this.toggleVORDrawer('nystagmogram');
    });

    // Caloric Listeners
    this.caloricTempChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const temp = chip.getAttribute('data-caloric-temp') as CaloricIrrigationType;
        if (temp) {
          this.selectCaloricTemp(temp);
        }
      });
    });

    this.caloricPlayBtn?.addEventListener('click', () => {
      this.toggleCaloricIrrigation();
    });

    this.caloricPostureBtn?.addEventListener('click', () => {
      this.alignCaloricPosture();
    });

    this.caloricGazeChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const gaze = parseInt(chip.getAttribute('data-alex-gaze') || '0', 10);
        this.selectCaloricAlexanderGaze(gaze);
      });
    });

    this.caloricJongkeesOpenBtn?.addEventListener('click', () => {
      this.openJongkeesModal();
    });

    this.caloricJongkeesCloseBtn?.addEventListener('click', () => {
      this.closeJongkeesModal();
    });

    this.caloricModalApplyBtn?.addEventListener('click', () => {
      this.recalculateJongkees();
      this.closeJongkeesModal();
      this.openVORDrawer('caloric');
    });

    this.caloricJongkeesModal?.addEventListener('click', (ev) => {
      if (ev.target === this.caloricJongkeesModal) {
        this.closeJongkeesModal();
      }
    });

    [this.jongkeesR44Input, this.jongkeesR30Input, this.jongkeesL44Input, this.jongkeesL30Input].forEach((inp) => {
      inp?.addEventListener('input', () => {
        this.recalculateJongkees();
      });
    });

    this.caloricPresetChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const preset = chip.getAttribute('data-preset') || 'normal';
        this.loadJongkeesPreset(preset);
      });
    });

    this.caloricVorToggleBtn?.addEventListener('click', () => {
      this.toggleVORDrawer('caloric');
    });

    // vHIT Listeners
    this.vhitPairChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const pair = chip.getAttribute('data-vhit-pair') as VHITCanalPair;
        if (pair) {
          this.selectVHITPair(pair);
        }
      });
    });

    this.vhitDirLeftBtn?.addEventListener('click', () => {
      this.selectVHITDirection(-1);
    });

    this.vhitDirRightBtn?.addEventListener('click', () => {
      this.selectVHITDirection(1);
    });

    this.vhitPresetChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const preset = chip.getAttribute('data-vhit-preset') as VHITPathologyPreset;
        if (preset) {
          this.selectVHITPreset(preset);
        }
      });
    });

    this.vhitParadigmBtn?.addEventListener('click', () => {
      this.toggleVHITParadigm();
    });

    this.vhitSlippageBtn?.addEventListener('click', () => {
      this.toggleVHITSlippage();
    });

    this.vhitThrustBtn?.addEventListener('click', () => {
      this.deliverVHITThrust();
    });

    this.vhitVorToggleBtn?.addEventListener('click', () => {
      this.toggleVORDrawer('vhit');
    });

    // VORDrawer Bi-directional Sync Callbacks
    this.vorDrawer.onDiagnosticModeChange((mode) => {
      if (mode === 'caloric' && this.vestSubmode !== 'caloric') {
        this.switchVestibularSubmode('caloric');
      } else if (mode === 'vhit' && this.vestSubmode !== 'vhit') {
        this.switchVestibularSubmode('vhit');
      } else if (mode === 'nystagmogram' && this.vestSubmode !== 'bppv') {
        this.switchVestibularSubmode('bppv');
      }
    });

    this.vorDrawer.onAlexanderGazeChange((gaze) => {
      this.selectCaloricAlexanderGaze(gaze);
    });

    this.vorDrawer.onClose(() => {
      this.syncVORDrawerButtons(false);
      if (!this.isSwitchingDrawers && this.noteState === 'expanded' && this.sidebarTab === 'lab') {
        this.setNoteState('compact', 'note');
      }
    });

    // 13. Surgical Suite Listeners
    this.surgSubnavTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const sub = tab.getAttribute('data-submode');
        if (sub === 'ci') {
          this.switchSurgicalProcedure('cochlear_implant');
        } else if (sub === 'labyrinthectomy') {
          this.switchSurgicalProcedure('labyrinthectomy');
        } else if (sub === 'neurectomy') {
          this.switchSurgicalProcedure('neurectomy');
        }
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('.surg-drawer-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.toggleSurgicalDrawer();
      });
    });

    this.surgicalDrawer.onClose(() => {
      this.syncSurgicalDrawerButtonUI(false);
      if (!this.isSwitchingDrawers && this.noteState === 'expanded' && this.sidebarTab === 'lab') {
        this.setNoteState('compact', 'note');
      }
    });

    this.ciApproachChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        this.ciApproachChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.applyCIParameters();
      });
    });

    this.ciArrayChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        this.ciArrayChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.applyCIParameters();
      });
    });

    [this.ciDepthSlider, this.ciPitchSlider, this.ciYawSlider].forEach((slider) => {
      slider?.addEventListener('input', () => {
        updateRangeProgress(slider);
        this.applyCIParameters();
      });
    });

    this.ciAutoInsertBtn?.addEventListener('click', () => {
      this.toggleCIAutoInsert();
    });

    this.ciRetractBtn?.addEventListener('click', () => {
      this.stopCIAutoInsert();
      this.ciDepthSlider.value = '0';
      this.ciPitchSlider.value = '0';
      this.ciYawSlider.value = '0';
      updateRangeProgress(this.ciDepthSlider);
      updateRangeProgress(this.ciPitchSlider);
      updateRangeProgress(this.ciYawSlider);
      this.applyCIParameters();
    });

    this.labyStepChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const step = parseInt(chip.getAttribute('data-laby-step') ?? '0', 10) as 0 | 1 | 2 | 3;
        this.selectLabyrinthectomyStep(step);
      });
    });

    this.labyDrillToggleBtn?.addEventListener('click', () => {
      this.toggleLabyDrill();
    });

    this.labyCompSlider?.addEventListener('input', () => {
      updateRangeProgress(this.labyCompSlider);
      const compHours = parseFloat(this.labyCompSlider.value);
      this.applyLabyrinthectomyParameters(compHours);
    });

    this.labyAblateAllBtn?.addEventListener('click', () => {
      this.selectLabyrinthectomyStep(3);
      this.labyCompSlider.value = '0';
      updateRangeProgress(this.labyCompSlider);
      this.applyLabyrinthectomyParameters(0);
    });

    this.neurectomyStepChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const step = parseInt(chip.getAttribute('data-neurectomy-step') ?? '0', 10) as 0 | 1 | 2 | 3;
        this.selectNeurectomyStep(step);
      });
    });

    this.neurectomyToolBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.neurectomyToolBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.applyNeurectomyParameters();
      });
    });

    this.neurectomyKoosSlider?.addEventListener('input', () => {
      updateRangeProgress(this.neurectomyKoosSlider);
      const stage = parseInt(this.neurectomyKoosSlider.value, 10);
      const romanStages = ['0', 'I', 'II', 'III', 'IV'];
      this.neurectomyKoosValEl.textContent = `Stage ${romanStages[stage] ?? stage}`;
      this.applyNeurectomyParameters();
    });

    this.neurectomyCleavageBtn?.addEventListener('click', () => {
      this.neurectomyCleavageBtn.classList.toggle('active');
      this.applyNeurectomyParameters();
    });
  }

  // ===========================================================================
  // SIDEBAR STATE MACHINE & 3D FRAMING SYNCHRONIZATION
  // ===========================================================================
  private closeAllLabDrawersSilently(): void {
    this.isSwitchingDrawers = true;
    try {
      if (this.partsDrawerOpen) this.closePartsDrawer();
      if (this.audiogramDrawer?.getIsOpen()) this.closeAudiogramDrawer();
      if (this.ctSliceDrawer?.getIsOpen()) this.closeCTDrawer();
      if (this.vorDrawer?.getIsOpen()) this.closeVORDrawer();
      if (this.surgicalDrawer?.getIsOpen()) this.closeSurgicalDrawer();
    } finally {
      this.isSwitchingDrawers = false;
    }
  }

  private setNoteState(nextState: NoteState, nextTab?: SidebarTab): void {
    this.noteState = nextState;
    if (nextTab) {
      this.sidebarTab = nextTab;
    }
    if (!this.isSwitchingDrawers && (this.noteState !== 'expanded' || this.sidebarTab !== 'lab')) {
      this.closeAllLabDrawersSilently();
    }
    this.syncSidebarDOM();
  }

  private openLabTabForCurrentMode(): void {
    const mode = this.scene ? this.scene.getSnapshot().labMode : 'anatomy';
    if (mode === 'hearing') {
      this.openAudiogramDrawer();
    } else if (mode === 'radiology') {
      this.openCTDrawer();
    } else if (mode === 'vestibular') {
      this.openVORDrawer();
    } else if (mode === 'surgical') {
      this.openSurgicalDrawer();
    } else {
      this.openPartsDrawer();
    }
  }

  private syncSidebarDOM(): void {
    if (!this.appShell || !this.noteSidebar) return;
    const isExpanded = this.noteState === 'expanded';
    const isCollapsed = this.noteState === 'collapsed';
    const wide = isExpanded && this.sidebarTab === 'note' && Boolean(this.furtherReadDetails?.open);

    this.appShell.setAttribute('data-note-state', this.noteState);
    this.appShell.setAttribute('data-wide-read', String(wide));
    this.noteSidebar.setAttribute('data-note-state', this.noteState);
    this.noteSidebar.setAttribute('data-sidebar-tab', this.sidebarTab);
    this.noteSidebar.setAttribute('data-wide-read', String(wide));

    this.noteCollapsedPill.hidden = !isCollapsed;
    this.noteCard.hidden = isCollapsed;
    this.noteCompactBody.hidden = this.noteState !== 'compact';
    this.noteScrollBody.hidden = !isExpanded;

    this.sidebarPaneNote.hidden = !(isExpanded && this.sidebarTab === 'note');
    this.sidebarPaneLab.hidden = !(isExpanded && this.sidebarTab === 'lab');

    this.tabNoteBtn.classList.toggle('active', this.sidebarTab === 'note');
    this.tabNoteBtn.setAttribute('aria-selected', String(this.sidebarTab === 'note'));
    this.tabNoteBtn.tabIndex = this.sidebarTab === 'note' ? 0 : -1;

    this.tabLabBtn.classList.toggle('active', this.sidebarTab === 'lab');
    this.tabLabBtn.setAttribute('aria-selected', String(this.sidebarTab === 'lab'));
    this.tabLabBtn.tabIndex = this.sidebarTab === 'lab' ? 0 : -1;

    this.noteExpandToggleBtn.setAttribute('aria-expanded', String(isExpanded));
    this.noteExpandToggleBtn.setAttribute(
      'aria-label',
      isExpanded ? 'Return note sidebar to compact size' : 'Expand note sidebar for full reading'
    );

    if (this.furtherReadHint) {
      this.furtherReadHint.textContent = `Clinical Details · ${this.activeReadingDepth === 'detailed' ? 'Clinical' : 'Patient'}`;
    }

    if (isExpanded && this.sidebarTab === 'lab' && this.ctSliceDrawer?.getIsOpen()) {
      requestAnimationFrame(() => {
        this.ctSliceDrawer.drawSlice();
        this.scheduleGeometrySync();
      });
    } else {
      this.scheduleGeometrySync();
    }
  }

  private updateStageFraming(): void {
    if (!this.scene) return;
    const vw = window.innerWidth;
    if (this.noteState !== 'expanded') {
      this.scene.setStageFraming(0, 0);
      return;
    }
    if (vw <= 720) {
      const sheetH = this.noteCard?.getBoundingClientRect().height || Math.round(window.innerHeight * 0.48);
      this.scene.setStageFraming(0, Math.min(sheetH, window.innerHeight * 0.5));
      return;
    }
    const wide = this.sidebarTab === 'note' && Boolean(this.furtherReadDetails?.open);
    const targetSidebarW =
      vw > 1080
        ? wide
          ? Math.min(476, vw - 32)
          : 388
        : wide
          ? Math.min(432, vw - 28)
          : Math.min(364, vw - 28);
    const leftInset = targetSidebarW + 16;
    this.scene.setStageFraming(vw > 1080 ? leftInset : leftInset * 0.85, 0);
  }

  private refreshPinKeepOutZones(): void {
    this.stageWidthPx = this.canvasHost?.clientWidth || window.innerWidth;
    this.keepOutZones.length = 0;
    const targets: Array<HTMLElement | null> = [
      this.headerEl,
      this.noteState === 'collapsed' ? this.noteCollapsedPill : this.noteCard,
      this.bottomBar,
      this.isGyroFlyoutOpen() ? this.gyroFlyout : null,
    ];
    for (const el of targets) {
      if (!el || el.hidden) continue;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      this.keepOutZones.push({
        l: r.left - 12,
        t: r.top - 12,
        r: r.right + 12,
        b: r.bottom + 12,
      });
    }
  }

  private scheduleGeometrySync(): void {
    this.refreshPinKeepOutZones();
    this.updateStageFraming();
    if (!this.framingRafQueued) {
      this.framingRafQueued = true;
      requestAnimationFrame(() => {
        this.framingRafQueued = false;
        this.refreshPinKeepOutZones();
        this.updateStageFraming();
      });
    }
  }

  private setLabelDensity(mode: LabelDensityMode): void {
    this.activeLabelMode = mode;
    this.scene?.setOverlays({ labelMode: mode });
    this.toolLabelsBtn?.classList.toggle('active', mode !== 'off');
    this.toolLabelsBtn?.setAttribute('aria-pressed', String(mode !== 'off'));
    this.root.querySelectorAll<HTMLButtonElement>('[data-label-mode]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-label-mode') === mode);
    });
    try {
      localStorage.setItem(AppHUD.STORAGE_KEYS.labelMode, mode);
    } catch {
      // ignore
    }
  }

  private syncBoneSliderUI(val: number): void {
    const str = String(val);
    const lbl = `${val}%`;
    if (this.boneSlider && document.activeElement !== this.boneSlider) {
      this.boneSlider.value = str;
    }
    if (this.boneValEl) this.boneValEl.textContent = lbl;
    if (this.mobileBoneSlider && document.activeElement !== this.mobileBoneSlider) {
      this.mobileBoneSlider.value = str;
    }
    if (this.mobileBoneValEl) this.mobileBoneValEl.textContent = lbl;
    updateRangeProgress(this.boneSlider);
    updateRangeProgress(this.mobileBoneSlider);
  }

  private syncExplodeSliderUI(val: number): void {
    const str = String(val);
    const lbl = `${val}%`;
    if (this.explodeSlider && document.activeElement !== this.explodeSlider) {
      this.explodeSlider.value = str;
    }
    if (this.explodeValEl) this.explodeValEl.textContent = lbl;
    if (this.mobileExplodeSlider && document.activeElement !== this.mobileExplodeSlider) {
      this.mobileExplodeSlider.value = str;
    }
    if (this.mobileExplodeValEl) this.mobileExplodeValEl.textContent = lbl;
    updateRangeProgress(this.explodeSlider);
    updateRangeProgress(this.mobileExplodeSlider);
  }

  // ===========================================================================
  // SEARCH DROPDOWN & MODALS
  // ===========================================================================
  private renderSearchResults(query: string): void {
    if (!query) {
      this.closeSearchDropdown();
      return;
    }

    const q = query.toLowerCase();
    const isV8Query =
      q === 'v8' ||
      q === 'cn8' ||
      q === 'cn viii' ||
      q === 'cnviii' ||
      q === 'viii' ||
      q === '8' ||
      q.includes('cranial nerve 8') ||
      q.includes('cranial nerve viii') ||
      q.includes('vestibulocochlear') ||
      q.includes('acoustic nerve') ||
      q.includes('vestibular nerve') ||
      q.includes('cochlear nerve') ||
      q === 'nerve';

    const matches = IEMAP_STRUCTURES.filter((item) => {
      const matchName = item.displayName.toLowerCase().includes(q);
      const matchLatin = item.latinName.toLowerCase().includes(q);
      const matchShort = item.shortLabel.toLowerCase().includes(q);
      const matchGroup = SYSTEM_GROUPS[item.systemGroup]?.title.toLowerCase().includes(q);
      const matchInnervation = item.innervation && item.innervation.toLowerCase().includes(q);
      const matchPearl = item.clinicalPearl && item.clinicalPearl.toLowerCase().includes(q);
      const matchV8 = isV8Query && Boolean(item.innervation && (item.innervation.includes('CN VIII') || item.innervation.includes('Nerve')));

      return matchName || matchLatin || matchShort || matchGroup || matchInnervation || matchPearl || matchV8;
    });

    if (matches.length === 0) {
      this.searchDropdown.innerHTML = `
        <div class="search-empty">
          <span>No matching ear structures found.</span>
        </div>
      `;
      this.searchDropdown.classList.add('open');
      this.searchInput.setAttribute('aria-expanded', 'true');
      return;
    }

    this.searchDropdown.innerHTML = matches
      .map((item) => {
        const groupMeta = SYSTEM_GROUPS[item.systemGroup];
        return `
          <div class="search-result-item" data-mesh="${item.meshName}" role="option">
            <div class="result-info">
              <span class="result-name">${item.displayName}</span>
              <span class="result-latin">${item.latinName}</span>
              ${item.innervation ? `<span class="result-innervation">⚡ ${item.innervation}</span>` : ''}
            </div>
            <span class="result-badge" style="background: ${groupMeta?.accentHex ?? '#52dcf2'}22; color: ${groupMeta?.accentHex ?? '#52dcf2'}; border-color: ${groupMeta?.accentHex ?? '#52dcf2'}55;">
              ${groupMeta?.shortTitle ?? 'Structure'}
            </span>
          </div>
        `;
      })
      .join('');

    this.searchDropdown.classList.add('open');
    this.searchInput.setAttribute('aria-expanded', 'true');

    const resultItems = this.searchDropdown.querySelectorAll<HTMLElement>('.search-result-item');
    resultItems.forEach((el) => {
      el.addEventListener('click', () => {
        const meshName = el.getAttribute('data-mesh');
        if (meshName) {
          this.scene.selectStructure(meshName, true);
          const item = STRUCTURE_BY_MESH[meshName];
          if (item) {
            this.searchInput.value = item.shortLabel;
            this.searchClearBtn.hidden = false;
            this.searchClearBtn.style.display = 'inline-flex';
          }
          this.closeSearchDropdown();
        }
      });
    });
  }

  private closeSearchDropdown(): void {
    this.searchDropdown.classList.remove('open');
    this.searchInput.setAttribute('aria-expanded', 'false');
    this.activeSearchIndex = -1;
  }

  private closeSettingsPopover(): void {
    this.settingsOpen = false;
    if (this.settingsPopover?.matches(':popover-open')) {
      this.settingsPopover.hidePopover();
    }
    this.settingsBtn?.setAttribute('aria-expanded', 'false');
  }

  private async closeTopLayerDialog(dialog: HTMLDialogElement): Promise<void> {
    if (!dialog.open || dialog.hasAttribute('data-closing')) return;
    if (this.reducedMotionQuery.matches || supportsTopLayerExit()) {
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

  private openAboutModal(): void {
    if (this.settingsPopover?.matches(':popover-open')) {
      this.settingsPopover.hidePopover();
    }
    const snap = this.scene?.getSnapshot();
    if (snap) {
      const sel = snap.selectedMesh ? STRUCTURE_BY_MESH[snap.selectedMesh] : null;
      if (this.repActivePartEl) {
        this.repActivePartEl.textContent = sel
          ? `${sel.displayName} (${formatRAS(sel.centroidRAS)} mm)`
          : 'Inner Ear Labyrinth';
      }
      if (this.repActiveModeEl) {
        this.repActiveModeEl.textContent = MODE_LABELS[snap.labMode];
      }
    }
    if (this.reportDialog) {
      this.reportDialog.removeAttribute('data-closing');
      if (!this.reportDialog.open) {
        this.reportDialog.showModal();
      }
    }
    this.aboutModalOpen = true;
  }

  private closeAboutModal(): void {
    this.aboutModalOpen = false;
    if (this.reportDialog?.open) {
      void this.closeTopLayerDialog(this.reportDialog);
    }
  }

  // ===========================================================================
  // 5-DRAWER MUTUAL EXCLUSIVITY & INLINE LAB PANE CONTROLLERS
  // ===========================================================================
  private togglePartsDrawer(): void {
    this.closeVORDrawer();
    if (this.partsDrawerOpen && this.noteState === 'expanded' && this.sidebarTab === 'lab') {
      this.closePartsDrawer();
    } else {
      this.openPartsDrawer();
    }
  }

  private openPartsDrawer(): void {
    this.isSwitchingDrawers = true;
    try {
      this.closeAudiogramDrawer();
      this.closeCTDrawer();
      this.closeVORDrawer();
      this.closeSurgicalDrawer();
      this.closeGyroFlyout();
    } finally {
      this.isSwitchingDrawers = false;
    }

    this.partsDrawerOpen = true;
    this.partsDrawer.classList.add('open');
    this.partsToggleBtn.classList.add('open');
    this.partsToggleBtn.setAttribute('aria-expanded', 'true');
    const arrowEl = this.partsToggleBtn.querySelector('.toggle-arrow');
    if (arrowEl) {
      arrowEl.textContent = '▾';
    }
    this.setNoteState('expanded', 'lab');
    this.renderPartsTree();
  }

  private closePartsDrawer(): void {
    if (!this.partsDrawerOpen) return;
    this.partsDrawerOpen = false;
    this.partsDrawer.classList.remove('open');
    this.partsToggleBtn.classList.remove('open');
    this.partsToggleBtn.setAttribute('aria-expanded', 'false');
    const arrowEl = this.partsToggleBtn.querySelector('.toggle-arrow');
    if (arrowEl) {
      arrowEl.textContent = '▸';
    }
    if (!this.isSwitchingDrawers && this.noteState === 'expanded' && this.sidebarTab === 'lab') {
      this.setNoteState('compact', 'note');
    }
  }

  private toggleAudiogramDrawer(): void {
    if (this.audiogramDrawer.getIsOpen() && this.noteState === 'expanded' && this.sidebarTab === 'lab') {
      this.closeAudiogramDrawer();
    } else {
      this.openAudiogramDrawer();
    }
  }

  private openAudiogramDrawer(): void {
    this.isSwitchingDrawers = true;
    try {
      if (this.partsDrawerOpen) {
        this.closePartsDrawer();
      }
      if (this.ctSliceDrawer && this.ctSliceDrawer.getIsOpen()) {
        this.closeCTDrawer();
      }
      if (this.vorDrawer && this.vorDrawer.getIsOpen()) {
        this.closeVORDrawer();
      }
      if (this.surgicalDrawer && this.surgicalDrawer.getIsOpen()) {
        this.closeSurgicalDrawer();
      }
      this.closeGyroFlyout();
    } finally {
      this.isSwitchingDrawers = false;
    }

    this.setNoteState('expanded', 'lab');
    this.audiogramDrawer.open();
    this.audiogramToggleBtn.classList.add('open');
    this.audiogramToggleBtn.setAttribute('aria-expanded', 'true');
    this.audiogramArrowEl.textContent = '▾';
  }

  private closeAudiogramDrawer(): void {
    if (this.audiogramDrawer && this.audiogramDrawer.getIsOpen()) {
      this.audiogramDrawer.close();
    }
    this.audiogramToggleBtn.classList.remove('open');
    this.audiogramToggleBtn.setAttribute('aria-expanded', 'false');
    this.audiogramArrowEl.textContent = '▸';
    if (!this.isSwitchingDrawers && this.noteState === 'expanded' && this.sidebarTab === 'lab') {
      this.setNoteState('compact', 'note');
    }
  }

  private toggleCTDrawer(): void {
    if (this.ctSliceDrawer.getIsOpen() && this.noteState === 'expanded' && this.sidebarTab === 'lab') {
      this.closeCTDrawer();
    } else {
      this.openCTDrawer();
    }
  }

  public openCTDrawer(): void {
    this.isSwitchingDrawers = true;
    try {
      if (this.partsDrawerOpen) {
        this.closePartsDrawer();
      }
      if (this.audiogramDrawer && this.audiogramDrawer.getIsOpen()) {
        this.closeAudiogramDrawer();
      }
      if (this.vorDrawer && this.vorDrawer.getIsOpen()) {
        this.closeVORDrawer();
      }
      if (this.surgicalDrawer && this.surgicalDrawer.getIsOpen()) {
        this.closeSurgicalDrawer();
      }
      this.closeGyroFlyout();
    } finally {
      this.isSwitchingDrawers = false;
    }

    this.setNoteState('expanded', 'lab');
    this.ctSliceDrawer.open();
    this.radiologyCtToggleBtn.classList.add('open');
    this.radiologyCtToggleBtn.setAttribute('aria-expanded', 'true');
    this.ctCardArrowEl.textContent = '▾';
    requestAnimationFrame(() => this.ctSliceDrawer.drawSlice());
  }

  private closeCTDrawer(): void {
    if (this.ctSliceDrawer && this.ctSliceDrawer.getIsOpen()) {
      this.ctSliceDrawer.close();
    }
    this.radiologyCtToggleBtn.classList.remove('open');
    this.radiologyCtToggleBtn.setAttribute('aria-expanded', 'false');
    this.ctCardArrowEl.textContent = '▸';
    if (!this.isSwitchingDrawers && this.noteState === 'expanded' && this.sidebarTab === 'lab') {
      this.setNoteState('compact', 'note');
    }
  }

  private syncVORDrawerButtons(isOpen: boolean): void {
    const btns = [this.vestVorToggleBtn, this.caloricVorToggleBtn, this.vhitVorToggleBtn];
    for (const b of btns) {
      if (b) {
        b.classList.toggle('open', isOpen);
        b.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      }
    }
    const arrows = [this.vorArrowEl, this.caloricVorArrowEl, this.vhitVorArrowEl];
    for (const a of arrows) {
      if (a) {
        a.textContent = isOpen ? '▾' : '▸';
      }
    }
  }

  private toggleVORDrawer(targetMode?: 'nystagmogram' | 'caloric' | 'vhit'): void {
    const mode = targetMode || (this.vestSubmode === 'bppv' ? 'nystagmogram' : this.vestSubmode);
    const isOpen = this.vorDrawer.getIsOpen() && this.noteState === 'expanded' && this.sidebarTab === 'lab';

    if (!isOpen) {
      this.openVORDrawer(mode);
    } else {
      const currentMode = this.vorDrawer.getDiagnosticViewMode();
      if (mode !== currentMode) {
        this.vorDrawer.setDiagnosticViewMode(mode);
        this.syncVORDrawerButtons(true);
      } else {
        this.closeVORDrawer();
      }
    }
  }

  private openVORDrawer(targetMode?: 'nystagmogram' | 'caloric' | 'vhit'): void {
    this.isSwitchingDrawers = true;
    try {
      if (this.partsDrawerOpen) {
        this.closePartsDrawer();
      }
      if (this.audiogramDrawer && this.audiogramDrawer.getIsOpen()) {
        this.closeAudiogramDrawer();
      }
      if (this.ctSliceDrawer && this.ctSliceDrawer.getIsOpen()) {
        this.closeCTDrawer();
      }
      if (this.surgicalDrawer && this.surgicalDrawer.getIsOpen()) {
        this.closeSurgicalDrawer();
      }
      this.closeGyroFlyout();
    } finally {
      this.isSwitchingDrawers = false;
    }

    const mode = targetMode || (this.vestSubmode === 'bppv' ? 'nystagmogram' : this.vestSubmode);
    this.setNoteState('expanded', 'lab');
    this.vorDrawer.setDiagnosticViewMode(mode);
    this.vorDrawer.open();
    this.syncVORDrawerButtons(true);
  }

  private closeVORDrawer(): void {
    if (this.vorDrawer && this.vorDrawer.getIsOpen()) {
      this.vorDrawer.close();
    }
    this.syncVORDrawerButtons(false);
    if (!this.isSwitchingDrawers && this.noteState === 'expanded' && this.sidebarTab === 'lab') {
      this.setNoteState('compact', 'note');
    }
  }

  private toggleSurgicalDrawer(): void {
    if (this.surgicalDrawer.getIsOpen() && this.noteState === 'expanded' && this.sidebarTab === 'lab') {
      this.closeSurgicalDrawer();
    } else {
      this.openSurgicalDrawer();
    }
  }

  private openSurgicalDrawer(): void {
    this.isSwitchingDrawers = true;
    try {
      if (this.partsDrawerOpen) {
        this.closePartsDrawer();
      }
      if (this.audiogramDrawer && this.audiogramDrawer.getIsOpen()) {
        this.closeAudiogramDrawer();
      }
      if (this.ctSliceDrawer && this.ctSliceDrawer.getIsOpen()) {
        this.closeCTDrawer();
      }
      if (this.vorDrawer && this.vorDrawer.getIsOpen()) {
        this.closeVORDrawer();
      }
      this.closeGyroFlyout();
    } finally {
      this.isSwitchingDrawers = false;
    }

    this.setNoteState('expanded', 'lab');
    this.surgicalDrawer.open();
    this.syncSurgicalDrawerButtonUI(true);
  }

  private closeSurgicalDrawer(): void {
    if (this.surgicalDrawer && this.surgicalDrawer.getIsOpen()) {
      this.surgicalDrawer.close();
    }
    this.syncSurgicalDrawerButtonUI(false);
    if (!this.isSwitchingDrawers && this.noteState === 'expanded' && this.sidebarTab === 'lab') {
      this.setNoteState('compact', 'note');
    }
  }

  private syncSurgicalDrawerButtonUI(isOpen: boolean): void {
    const toggleBtns = this.root.querySelectorAll<HTMLButtonElement>('.surg-drawer-toggle-btn');
    toggleBtns.forEach((btn) => {
      btn.classList.toggle('open', isOpen);
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      const arrow = btn.querySelector('.surg-arrow');
      if (arrow) {
        arrow.textContent = isOpen ? '▾' : '▸';
      }
    });
  }

  private syncDockClearance(): void {
    if (!this.bottomBar || typeof window === 'undefined') return;
    const rect = this.bottomBar.getBoundingClientRect();
    if (rect.height > 0 && window.innerHeight > 0) {
      const clearancePx = Math.max(76, Math.ceil(window.innerHeight - rect.top + 10));
      this.appShell?.style.setProperty('--dock-clearance', `${clearancePx}px`);
    }
  }

  // ===========================================================================
  // RADIOLOGY & CLINICAL MODE SWITCHER
  // ===========================================================================
  private syncRadiologyDepthUI(depthMm: number): void {
    const snap = this.scene.getSnapshot();
    const planeId = snap.radiologyState.activePlane;
    const sign = depthMm > 0 ? '+' : '';
    this.radiologyDepthValEl.textContent = `${sign}${depthMm.toFixed(1)} mm`;
    const lm = getLandmarkForDepth(planeId, depthMm);
    this.radiologyLandmarkBadgeEl.textContent = lm.label;
    if (document.activeElement !== this.radiologyDepthSlider) {
      this.radiologyDepthSlider.value = String(Math.round(depthMm * 10));
      updateRangeProgress(this.radiologyDepthSlider);
    }
    if (this.ctSliceDrawer) {
      this.ctSliceDrawer.update(
        planeId,
        depthMm,
        snap.radiologyState.scdsActive,
        snap.radiologyState.windowMode
      );
    }
  }

  public syncRadiologyUI(radState: RadiologyLabState): void {
    this.planeChips.forEach((chip) => {
      chip.classList.toggle('active', chip.getAttribute('data-plane') === radState.activePlane);
    });

    const plane = RADIOLOGY_PLANES[radState.activePlane];
    this.radiologyDepthSlider.min = String(Math.round(plane.minDepthMm * 10));
    this.radiologyDepthSlider.max = String(Math.round(plane.maxDepthMm * 10));

    this.radiologyFlipBtn.classList.toggle('active', radState.clipInverted);
    this.radiologyGuideBtn.classList.toggle('active', radState.showPlaneHelper);
    this.radiologyScdsBtn.classList.toggle('active', radState.scdsActive);

    this.syncRadiologyDepthUI(radState.sliceDepthMm);
  }

  public switchLabMode(mode: LabMode): void {
    if (mode !== 'vestibular') {
      this.scene.setLabyrinthLaterality('right');
    }

    if (this.appShell) {
      this.appShell.setAttribute('data-mode', mode);
    }
    if (this.repActiveModeEl) {
      this.repActiveModeEl.textContent = MODE_LABELS[mode];
    }
    const labLabel = MODE_LAB_TAB_LABELS[mode];
    if (this.tabLabBtn) this.tabLabBtn.textContent = labLabel;
    if (this.noteLabShortcutBtn) this.noteLabShortcutBtn.textContent = labLabel;

    this.modePills.forEach((pill) => {
      const active = pill.dataset.mode === mode;
      pill.classList.toggle('active', active);
      pill.setAttribute('aria-selected', String(active));
      pill.tabIndex = active ? 0 : -1;
      if (active) {
        pill.scrollIntoView({
          behavior: this.reducedMotionQuery.matches ? 'auto' : 'smooth',
          inline: 'nearest',
          block: 'nearest',
        });
      }
    });

    this.isSwitchingDrawers = true;
    try {
      if (this.partsDrawerOpen) this.closePartsDrawer();
      if (this.audiogramDrawer?.getIsOpen()) this.closeAudiogramDrawer();
      if (this.ctSliceDrawer?.getIsOpen()) this.closeCTDrawer();
      if (this.vorDrawer?.getIsOpen()) this.closeVORDrawer();
      if (this.surgicalDrawer?.getIsOpen()) this.closeSurgicalDrawer();
      this.closeGyroFlyout();
    } finally {
      this.isSwitchingDrawers = false;
    }

    if (mode !== 'surgical') {
      this.stopCIAutoInsert();
      this.toneSynth.stopDrill();
      this.toneSynth.stopEMGAlarm();
    }
    if (mode !== 'vestibular') {
      this.stopCaloricIrrigation();
      this.pauseSequencer();
    }
    if (mode !== 'hearing' && this.toneSynth.getIsPlaying()) {
      this.toneSynth.pause();
      this.scene.setHearingPlayback(false);
      this.updateTonePlayButton(false);
    }

    if (mode === 'surgical') {
      this.stopCaloricIrrigation();
      this.anatomyDockContent.style.display = 'none';
      this.hearingDockContent.style.display = 'none';
      this.radiologyDockContent.style.display = 'none';
      this.vestibularDockContent.style.display = 'none';
      this.surgicalDockContent.style.display = 'flex';
      this.scene.setLabMode('surgical');
      this.syncSurgicalUI();
      this.renderInspectorCard(this.scene.getSelectedMesh());
    } else if (mode === 'vestibular') {
      this.pauseSequencer();
      this.anatomyDockContent.style.display = 'none';
      this.hearingDockContent.style.display = 'none';
      this.radiologyDockContent.style.display = 'none';
      this.surgicalDockContent.style.display = 'none';
      this.vestibularDockContent.style.display = 'flex';
      this.scene.setLabMode('vestibular');
      this.syncVestibularUI();
      this.renderInspectorCard(this.scene.getSelectedMesh());
    } else if (mode === 'radiology') {
      this.anatomyDockContent.style.display = 'none';
      this.hearingDockContent.style.display = 'none';
      this.vestibularDockContent.style.display = 'none';
      this.surgicalDockContent.style.display = 'none';
      this.radiologyDockContent.style.display = 'flex';
      this.scene.setLabMode('radiology');
      this.syncRadiologyUI(this.scene.getSnapshot().radiologyState);
    } else if (mode === 'hearing') {
      this.anatomyDockContent.style.display = 'none';
      this.radiologyDockContent.style.display = 'none';
      this.vestibularDockContent.style.display = 'none';
      this.surgicalDockContent.style.display = 'none';
      this.hearingDockContent.style.display = 'flex';
      this.scene.setLabMode('hearing');
      this.syncFrequencyUI(this.scene.getSnapshot().hearingState.activeFrequency, true);
    } else {
      this.hearingDockContent.style.display = 'none';
      this.radiologyDockContent.style.display = 'none';
      this.vestibularDockContent.style.display = 'none';
      this.surgicalDockContent.style.display = 'none';
      this.anatomyDockContent.style.display = 'flex';
      this.scene.setLabMode('anatomy');
    }

    if (this.noteState === 'expanded') {
      this.setNoteState('expanded', 'note');
    } else {
      this.setNoteState('compact', 'note');
    }
    this.syncDockClearance();
  }

  // ===========================================================================
  // SURGICAL SIMULATION WORKBENCH HELPERS
  // ===========================================================================
  private switchSurgicalProcedure(proc: SurgicalProcedure): void {
    this.activeSurgProcedure = proc;
    const submodeMap: Record<SurgicalProcedure, string> = {
      cochlear_implant: 'ci',
      labyrinthectomy: 'labyrinthectomy',
      neurectomy: 'neurectomy',
    };
    const sub = submodeMap[proc];

    this.surgSubnavTabs.forEach((tab) => {
      const isTarget = tab.getAttribute('data-submode') === sub;
      tab.classList.toggle('active', isTarget);
      tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    this.surgSubviews.forEach((el, key) => {
      el.style.display = key === sub ? 'flex' : 'none';
    });

    if (proc !== 'cochlear_implant') {
      this.stopCIAutoInsert();
    }
    if (proc !== 'labyrinthectomy') {
      this.toneSynth.stopDrill();
    }
    if (proc !== 'neurectomy') {
      this.toneSynth.stopEMGAlarm();
    }

    this.scene.setSurgicalProcedure(proc);
    this.scene.flyToSurgicalProcedure(proc);

    if (proc === 'cochlear_implant') {
      this.scene.selectStructure('mesh_david_cochlea', false);
    } else if (proc === 'labyrinthectomy') {
      this.scene.selectStructure('ls_Hsapiens_Sl', false);
    } else if (proc === 'neurectomy') {
      this.scene.selectStructure('ls_Hsapiens_Sv', false);
    }

    this.syncSurgicalUI();
    this.renderInspectorCard(this.scene.getSelectedMesh());
    this.syncDockClearance();
  }

  private applyCIParameters(): void {
    const depthMm = parseFloat(this.ciDepthSlider.value) / 10.0;
    const pitchDev = parseFloat(this.ciPitchSlider.value);
    const yawDev = parseFloat(this.ciYawSlider.value);

    const activeApproachChip = this.ciApproachChips.find((c) => c.classList.contains('active'));
    const approach = (activeApproachChip?.getAttribute('data-approach') as CIApproach) || 'round_window';

    const activeArrayChip = this.ciArrayChips.find((c) => c.classList.contains('active'));
    const arrayType = (activeArrayChip?.getAttribute('data-array') as CIArrayType) || 'lateral_wall';

    const prevCiState = this.scene.getSurgicalState().ciState;
    const ciState = this.scene.updateCIArray(depthMm, arrayType, approach, pitchDev, yawDev);

    if (ciState.isRuptured && !prevCiState.isRuptured) {
      this.toneSynth.triggerRuptureSnap();
      if (this.audiogramDrawer) {
        this.audiogramDrawer.setActivePreset('acoustic_trauma');
      }
    } else if (!ciState.isRuptured && prevCiState.isRuptured) {
      if (this.audiogramDrawer) {
        this.audiogramDrawer.setActivePreset('normal');
      }
    }

    this.ciDepthTitleEl.textContent = `Insertion Depth: ${ciState.insertionDepthMm.toFixed(1)} mm (${ciState.angularDepthDeg.toFixed(1)}°)`;
    this.ciForceBadgeEl.textContent = `F: ${ciState.insertionForceMilliNewtons.toFixed(1)} mN`;
    this.ciRiskBadgeEl.textContent = ciState.translocationRisk.toUpperCase();

    this.ciRiskBadgeEl.classList.remove('optimal', 'caution', 'breach');
    if (ciState.translocationRisk === 'optimal') {
      this.ciRiskBadgeEl.classList.add('optimal');
      this.ciRiskBadgeEl.style.color = '#34d399';
    } else if (ciState.translocationRisk === 'caution') {
      this.ciRiskBadgeEl.classList.add('caution');
      this.ciRiskBadgeEl.style.color = '#fbbf24';
    } else {
      this.ciRiskBadgeEl.classList.add('breach');
      this.ciRiskBadgeEl.style.color = '#f87171';
    }

    this.ciPitchValEl.textContent = `${Math.round(pitchDev)}°`;
    this.ciYawValEl.textContent = `${Math.round(yawDev)}°`;

    this.renderInspectorCard(this.scene.getSelectedMesh());
  }

  private toggleCIAutoInsert(): void {
    if (this.ciAutoInsertTimer !== null) {
      this.stopCIAutoInsert();
    } else {
      this.startCIAutoInsert();
    }
  }

  private startCIAutoInsert(): void {
    if (this.ciAutoInsertTimer !== null) return;
    this.ciAutoInsertBtn.classList.add('active');
    const icon = this.ciAutoInsertBtn.querySelector('.play-icon');
    if (icon) icon.textContent = '⏸';

    this.ciAutoInsertTimer = window.setInterval(() => {
      let currentVal = parseInt(this.ciDepthSlider.value, 10);
      const maxVal = parseInt(this.ciDepthSlider.max, 10);
      if (currentVal >= maxVal) {
        this.stopCIAutoInsert();
        return;
      }
      currentVal = Math.min(maxVal, currentVal + 1);
      this.ciDepthSlider.value = String(currentVal);
      updateRangeProgress(this.ciDepthSlider);
      this.applyCIParameters();
    }, 200);
  }

  private stopCIAutoInsert(): void {
    if (this.ciAutoInsertTimer !== null) {
      window.clearInterval(this.ciAutoInsertTimer);
      this.ciAutoInsertTimer = null;
    }
    if (this.ciAutoInsertBtn) {
      this.ciAutoInsertBtn.classList.remove('active');
      const icon = this.ciAutoInsertBtn.querySelector('.play-icon');
      if (icon) icon.textContent = '▶';
    }
  }

  private selectLabyrinthectomyStep(step: 0 | 1 | 2 | 3): void {
    this.labyStepChips.forEach((chip) => {
      const s = parseInt(chip.getAttribute('data-laby-step') ?? '0', 10);
      chip.classList.toggle('active', s === step);
    });

    const stepTitles = [
      'Step 1: Cortical Mastoidectomy',
      'Step 2: Canal Milling (LSC/SSC/PSC)',
      'Step 3: Vestibulotomy (Ampullary Openings)',
      'Step 4: Neuroepithelial Curettage (Complete Ablation)',
    ];
    this.labyStepTitleEl.textContent = stepTitles[step];

    const compHours = parseFloat(this.labyCompSlider.value);
    this.applyLabyrinthectomyParameters(compHours);
  }

  private toggleLabyDrill(): void {
    const isCurrentlyActive = this.labyDrillToggleBtn.classList.contains('active');
    const nextActive = !isCurrentlyActive;
    this.labyDrillToggleBtn.classList.toggle('active', nextActive);
    this.labyDrillTextEl.textContent = nextActive ? 'Drill: Off' : 'Drill: On';
    this.labyDrillBadgeEl.textContent = nextActive ? '70,000 RPM' : '0 RPM';

    if (nextActive) {
      this.toneSynth.startDrill(70000);
    } else {
      this.toneSynth.stopDrill();
    }

    const compHours = parseFloat(this.labyCompSlider.value);
    this.applyLabyrinthectomyParameters(compHours);
  }

  private applyLabyrinthectomyParameters(compHours: number): void {
    const activeChip = this.labyStepChips.find((c) => c.classList.contains('active'));
    const step = parseInt(activeChip?.getAttribute('data-laby-step') ?? '0', 10) as 0 | 1 | 2 | 3;
    const drillActive = this.labyDrillToggleBtn.classList.contains('active');

    const labyState = this.scene.updateLabyrinthectomy(step, compHours, drillActive);

    if (labyState.neuroepitheliumAblated) {
      if (this.audiogramDrawer && this.audiogramDrawer.getActivePresetId() !== 'labyrinthectomy_anacusis') {
        this.audiogramDrawer.setActivePreset('labyrinthectomy_anacusis');
      }
    } else if (step === 0 && this.audiogramDrawer && this.audiogramDrawer.getActivePresetId() === 'labyrinthectomy_anacusis') {
      this.audiogramDrawer.setActivePreset('normal');
    }

    const phase = compHours === 0 ? 'Acute' : compHours < 72 ? 'Early Comp' : compHours < 168 ? 'Subacute' : 'Compensated';
    this.labyCompValEl.textContent = `${compHours}h (${phase})`;
    this.labySpvBadgeEl.textContent = `SPV: ${labyState.spontaneousSPVDegSec.toFixed(1)}°/s`;

    this.renderInspectorCard(this.scene.getSelectedMesh());
  }

  private selectNeurectomyStep(step: 0 | 1 | 2 | 3): void {
    this.neurectomyStepChips.forEach((chip) => {
      const s = parseInt(chip.getAttribute('data-neurectomy-step') ?? '0', 10);
      chip.classList.toggle('active', s === step);
    });

    const stepTitles = [
      'Step 1: Retrosigmoid Craniotomy',
      'Step 2: Cerebellopontine Angle (CPA) Exposure',
      'Step 3: Vestibular-Cochlear Cleavage Plane',
      'Step 4: Selective Vestibular Nerve Transection',
    ];
    this.neurectomyStepTitleEl.textContent = stepTitles[step];
    this.applyNeurectomyParameters();
  }

  private applyNeurectomyParameters(): void {
    const activeChip = this.neurectomyStepChips.find((c) => c.classList.contains('active'));
    const step = parseInt(activeChip?.getAttribute('data-neurectomy-step') ?? '0', 10) as 0 | 1 | 2 | 3;

    const koos = parseInt(this.neurectomyKoosSlider.value, 10) as KoosStage;

    const activeToolBtn = this.neurectomyToolBtns.find((b) => b.classList.contains('active'));
    const tool = (activeToolBtn?.getAttribute('data-tool') as 'scissors' | 'hook' | 'bipolar') || 'scissors';

    const cleavage = this.neurectomyCleavageBtn.classList.contains('active');

    const toolProximity = step === 3 ? 0.2 : step === 2 ? 0.8 : step === 1 ? 2.5 : 5.0;
    const tractionGrams = step >= 2 ? (koos > 0 ? koos * 0.8 : 0.4) : 0.0;

    const neuState = this.scene.updateNeurectomy(step, koos, toolProximity, tractionGrams, tool, cleavage);

    if (neuState.vestibularNerveTransected && neuState.cochlearNervePreserved) {
      if (this.audiogramDrawer && (this.audiogramDrawer.getActivePresetId() === 'acoustic_trauma' || this.audiogramDrawer.getActivePresetId() === 'labyrinthectomy_anacusis')) {
        this.audiogramDrawer.setActivePreset('normal');
      }
    }

    this.neurectomyAbrBadgeEl.textContent = `ABR V: ${neuState.abrWaveVLatencyMs.toFixed(2)} ms`;
    this.neurectomyEmgBadgeEl.textContent = `EMG: ${neuState.facialEMGVoltageMicroVolts.toFixed(0)} μV`;

    if (neuState.isEMGAlarmActive || neuState.facialEMGVoltageMicroVolts >= 500) {
      this.toneSynth.triggerEMGAlarm(180);
    } else {
      this.toneSynth.stopEMGAlarm();
    }

    this.renderInspectorCard(this.scene.getSelectedMesh());
  }

  private syncSurgicalUI(): void {
    const surg = this.scene.getSurgicalState();
    if (surg.activeProcedure === 'cochlear_implant') {
      this.applyCIParameters();
    } else if (surg.activeProcedure === 'labyrinthectomy') {
      const compHours = parseFloat(this.labyCompSlider.value);
      this.applyLabyrinthectomyParameters(compHours);
    } else if (surg.activeProcedure === 'neurectomy') {
      this.applyNeurectomyParameters();
    }
  }

  // ===========================================================================
  // VESTIBULAR WORKBENCH & CLINICAL MANEUVERS HELPERS
  // ===========================================================================
  private selectManeuver(maneuverId: ManeuverId): void {
    this.activeManeuverId = maneuverId;
    this.vestProtocolChips.forEach((chip) => {
      chip.classList.toggle('active', chip.getAttribute('data-maneuver') === maneuverId);
    });

    const eng = this.scene.getVestibularEngine();
    if (eng) {
      eng.setManeuver(maneuverId);
    }

    const targetCanal = eng?.getCanal() || 'posterior';
    if (targetCanal === 'posterior') {
      this.scene.selectStructure('ls_Hsapiens_Sp', false);
    } else if (targetCanal === 'horizontal') {
      this.scene.selectStructure('ls_Hsapiens_Sl', false);
    } else {
      this.scene.selectStructure('ls_Hsapiens_Sa', false);
    }

    const steps = MANEUVER_PRESETS[maneuverId] || [];
    this.vestStepSlider.min = '0';
    this.vestStepSlider.max = String(Math.max(0, steps.length - 1));
    this.pauseSequencer();
    this.goToStep(0);
  }

  private goToStep(stepIdx: number): void {
    const steps = MANEUVER_PRESETS[this.activeManeuverId] || [];
    const clamped = Math.max(0, Math.min(steps.length - 1, stepIdx));
    this.currentStepIdx = clamped;
    this.vestStepSlider.value = String(clamped);
    updateRangeProgress(this.vestStepSlider);

    const eng = this.scene.getVestibularEngine();
    if (eng) {
      eng.setStepIndex(clamped);
    }

    const preset = steps[clamped];
    if (preset) {
      this.setHeadOrientationUI(preset.targetYawDeg, preset.targetPitchDeg, preset.targetRollDeg);
      this.scene.setHeadOrientation(preset.targetYawDeg, preset.targetPitchDeg, preset.targetRollDeg);

      this.vestStepTitleEl.textContent = preset.clinicalTitle || preset.shortTitle;
      this.remainingHoldSec = preset.durationSec || 30;
      this.vestHoldTimerBadgeEl.textContent = `⏱️ ${this.remainingHoldSec}s`;

      const telem = eng ? eng.getTelemetry(preset.targetYawDeg, preset.targetPitchDeg, preset.targetRollDeg) : null;
      const clearance = telem ? telem.clearancePercent : 0;
      this.vestClearanceBadgeEl.textContent = `${clearance}% Cleared`;
      this.renderInspectorCard(this.scene.getSelectedMesh());
    }
  }

  private stepManeuver(delta: number): void {
    this.goToStep(this.currentStepIdx + delta);
  }

  private toggleSequencer(): void {
    if (this.isSequencerPlaying) {
      this.pauseSequencer();
    } else {
      this.startSequencer();
    }
  }

  private startSequencer(): void {
    const initialSteps = MANEUVER_PRESETS[this.activeManeuverId] || [];
    if (this.currentStepIdx >= initialSteps.length - 1 && this.remainingHoldSec <= 0) {
      this.goToStep(0);
    }

    this.isSequencerPlaying = true;
    this.vestPlayIconEl.textContent = '⏸';
    this.vestPlayBtn.classList.add('playing');

    if (this.sequencerTimerId !== null) {
      clearInterval(this.sequencerTimerId);
    }

    this.sequencerTimerId = window.setInterval(() => {
      if (this.remainingHoldSec > 0) {
        this.remainingHoldSec--;
        this.vestHoldTimerBadgeEl.textContent = `⏱️ ${this.remainingHoldSec}s`;
      } else {
        const steps = MANEUVER_PRESETS[this.activeManeuverId] || [];
        if (this.currentStepIdx < steps.length - 1) {
          this.goToStep(this.currentStepIdx + 1);
        } else {
          this.pauseSequencer();
        }
      }
    }, 1000);
  }

  private pauseSequencer(): void {
    this.isSequencerPlaying = false;
    this.vestPlayIconEl.textContent = '▶';
    this.vestPlayBtn.classList.remove('playing');
    if (this.sequencerTimerId !== null) {
      clearInterval(this.sequencerTimerId);
      this.sequencerTimerId = null;
    }
  }

  private resetVestibular(): void {
    this.pauseSequencer();
    this.scene.resetVestibularCrystals();
    this.goToStep(0);
  }

  private isGyroFlyoutOpen(): boolean {
    return this.gyroFlyout
      ? this.gyroFlyout.classList.contains('open') || this.gyroFlyout.style.display !== 'none'
      : false;
  }

  private toggleGyroFlyout(): void {
    if (this.isGyroFlyoutOpen()) {
      this.closeGyroFlyout();
    } else {
      this.openGyroFlyout();
    }
  }

  private openGyroFlyout(): void {
    this.isSwitchingDrawers = true;
    try {
      if (this.partsDrawerOpen) {
        this.closePartsDrawer();
      }
      if (this.audiogramDrawer && this.audiogramDrawer.getIsOpen()) {
        this.closeAudiogramDrawer();
      }
      if (this.ctSliceDrawer && this.ctSliceDrawer.getIsOpen()) {
        this.closeCTDrawer();
      }
      if (this.vorDrawer && this.vorDrawer.getIsOpen()) {
        this.closeVORDrawer();
      }
      if (this.surgicalDrawer && this.surgicalDrawer.getIsOpen()) {
        this.closeSurgicalDrawer();
      }
    } finally {
      this.isSwitchingDrawers = false;
    }
    if (this.noteState === 'expanded') {
      this.setNoteState('compact', 'note');
    }
    this.gyroFlyout.classList.add('open');
    this.gyroFlyout.style.display = 'flex';
    this.vestGyroToggleBtn.classList.add('active');
    this.vestGyroToggleBtn.setAttribute('aria-expanded', 'true');
    this.scheduleGeometrySync();
  }

  private closeGyroFlyout(): void {
    if (this.gyroFlyout) {
      this.gyroFlyout.classList.remove('open');
      this.gyroFlyout.style.display = 'none';
    }
    if (this.vestGyroToggleBtn) {
      this.vestGyroToggleBtn.classList.remove('active');
      this.vestGyroToggleBtn.setAttribute('aria-expanded', 'false');
    }
    this.scheduleGeometrySync();
  }

  private setHeadOrientationUI(yaw: number, pitch: number, roll: number): void {
    this.gyroYawSlider.value = String(yaw);
    this.gyroPitchSlider.value = String(pitch);
    this.gyroRollSlider.value = String(roll);
    updateRangeProgress(this.gyroYawSlider);
    updateRangeProgress(this.gyroPitchSlider);
    updateRangeProgress(this.gyroRollSlider);
    this.gyroYawValEl.textContent = `${Math.round(yaw)}°`;
    this.gyroPitchValEl.textContent = `${Math.round(pitch)}°`;
    this.gyroRollValEl.textContent = `${Math.round(roll)}°`;
  }

  public syncVestibularUI(): void {
    if (this.vestSubmode === 'bppv') {
      this.selectManeuver(this.activeManeuverId);
    } else if (this.vestSubmode === 'caloric') {
      this.selectCaloricTemp(this.activeCaloricTemp);
    } else if (this.vestSubmode === 'vhit') {
      this.selectVHITPreset(this.vhitPreset);
    }
  }

  // ===========================================================================
  // DIAGNOSTIC VESTIBULAR MODALITY METHODS (Caloric COWS & vHIT)
  // ===========================================================================
  public switchVestibularSubmode(submode: 'bppv' | 'caloric' | 'vhit'): void {
    this.vestSubmode = submode;
    this.scene.setVestibularSubmode(submode);

    this.vestSubnavTabs.forEach((tab) => {
      const isTarget = tab.getAttribute('data-submode') === submode;
      tab.classList.toggle('active', isTarget);
      tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    if (this.vestBppvSubview) this.vestBppvSubview.style.display = submode === 'bppv' ? 'flex' : 'none';
    if (this.vestCaloricSubview) this.vestCaloricSubview.style.display = submode === 'caloric' ? 'flex' : 'none';
    if (this.vestVhitSubview) this.vestVhitSubview.style.display = submode === 'vhit' ? 'flex' : 'none';

    if (submode !== 'vhit') {
      this.scene.cancelVHITThrust();
      if (this.vhitThrustBtn) {
        this.vhitThrustBtn.disabled = false;
        this.vhitThrustBtn.classList.remove('impulsing');
      }
    }

    if (submode === 'caloric') {
      this.vorDrawer.setDiagnosticViewMode('caloric');
      const ear = this.activeCaloricTemp.startsWith('L') ? 'left' : 'right';
      this.scene.setLabyrinthLaterality(ear);
      this.scene.selectStructure('ls_Hsapiens_Sl', false);
      this.selectCaloricTemp(this.activeCaloricTemp);
    } else if (submode === 'vhit') {
      this.stopCaloricIrrigation();
      this.caloricElapsedSec = 0;
      this.scene.setLabyrinthLaterality('right');
      this.vorDrawer.setDiagnosticViewMode('vhit');
      this.updateVHITReadout();
    } else {
      this.stopCaloricIrrigation();
      this.caloricElapsedSec = 0;
      this.scene.setLabyrinthLaterality('right');
      this.vorDrawer.setDiagnosticViewMode('nystagmogram');
      this.selectManeuver(this.activeManeuverId);
    }
    this.syncDockClearance();
  }

  public selectCaloricTemp(temp: CaloricIrrigationType): void {
    this.stopCaloricIrrigation();
    this.activeCaloricTemp = temp;

    this.caloricTempChips.forEach((chip) => {
      chip.classList.toggle('active', chip.getAttribute('data-caloric-temp') === temp);
    });

    const isLeft = temp.startsWith('L');
    this.scene.setLabyrinthLaterality(isLeft ? 'left' : 'right');
    if (this.caloricLateralityBadgeEl) {
      this.caloricLateralityBadgeEl.textContent = isLeft
        ? 'Left Ear (Contralateral Mirrored)'
        : 'Right Ear (Ipsilateral)';
    }

    this.caloricElapsedSec = 0;
    if (this.caloricTimerBadgeEl) {
      this.caloricTimerBadgeEl.textContent = '⏱️ 0s / 40s';
    }
    if (this.caloricSpvBadgeEl) {
      this.caloricSpvBadgeEl.textContent = 'SPV: 0.0°/s';
    }
    this.scene.setCaloricUniforms(false, 0, 0, 0);

    const isWarm = temp === 'R44' || temp === 'L44';
    const isIce = temp === 'Ice4';
    if (this.caloricStatusTitleEl) {
      this.caloricStatusTitleEl.textContent = isIce
        ? 'Ice 4°C: Strong Ampullofugal Inhibition -> Opposite Fast Phase'
        : isWarm
        ? `Warm 44°C: Ampullopetal Excitation -> ${isLeft ? 'Left' : 'Right'} (Same) Fast Phase`
        : `Cold 30°C: Ampullofugal Inhibition -> ${isLeft ? 'Right' : 'Left'} (Opposite) Fast Phase`;
    }

    this.selectCaloricAlexanderGaze(this.caloricAlexanderGaze);
  }

  public toggleCaloricIrrigation(): void {
    if (this.isCaloricIrrigating) {
      this.stopCaloricIrrigation();
    } else {
      this.startCaloricIrrigation();
    }
  }

  public startCaloricIrrigation(restart = false): void {
    this.stopCaloricIrrigation();
    this.isCaloricIrrigating = true;

    if (restart || this.caloricElapsedSec >= 40.0) {
      this.caloricElapsedSec = 0;
    }

    if (this.caloricPlayBtn) {
      this.caloricPlayBtn.classList.add('playing');
    }
    if (this.caloricPlayIconEl) {
      this.caloricPlayIconEl.textContent = '⏸';
    }

    const deltaTIrr =
      this.activeCaloricTemp === 'R44' || this.activeCaloricTemp === 'L44'
        ? 7.0
        : this.activeCaloricTemp === 'R30' || this.activeCaloricTemp === 'L30'
        ? -7.0
        : -33.0;

    const ear = this.activeCaloricTemp.startsWith('L') ? 'left' : 'right';

    this.caloricLastTickTime = performance.now();
    this.caloricTimerInterval = setInterval(() => {
      if (!this.isCaloricIrrigating) {
        if (this.caloricTimerInterval) {
          clearInterval(this.caloricTimerInterval);
          this.caloricTimerInterval = null;
        }
        return;
      }

      const now = performance.now();
      const dt = Math.max(0.01, Math.min(0.5, (now - this.caloricLastTickTime) / 1000.0));
      this.caloricLastTickTime = now;
      this.caloricElapsedSec += dt;

      if (this.caloricElapsedSec >= 40.0) {
        this.caloricElapsedSec = 40.0;
        this.completeCaloricIrrigation();
        return;
      }

      const conv = computeCaloricConvection(deltaTIrr, this.caloricElapsedSec, ear);
      const beatSign =
        conv.fastPhaseBeatDirection === 'Left-Beating'
          ? -1
          : conv.fastPhaseBeatDirection === 'Right-Beating'
          ? 1
          : 0;

      const alex = computeAlexanderModulation(
        conv.slowPhaseVelocity,
        this.caloricAlexanderGaze,
        beatSign
      );

      this.scene.setCaloricUniforms(
        true,
        conv.deltaT,
        Math.min(1.0, this.caloricElapsedSec / 40.0),
        this.caloricElapsedSec
      );
      this.scene.setCaloricSimulationState(true, conv, alex.modulatedSPV);
      this.vorDrawer.setCaloricActiveIrrigation(this.activeCaloricTemp, alex.modulatedSPV);

      if (this.caloricTimerBadgeEl) {
        this.caloricTimerBadgeEl.textContent = `⏱️ ${this.caloricElapsedSec.toFixed(1)}s / 40s`;
      }
      if (this.caloricSpvBadgeEl) {
        this.caloricSpvBadgeEl.textContent = `SPV: ${alex.modulatedSPV.toFixed(1)}°/s (${conv.fastPhaseBeatDirection})`;
      }
      if (this.caloricAlexBadgeEl) {
        this.caloricAlexBadgeEl.textContent = `${alex.clinicalDegree}`;
      }
      if (this.caloricStatusTitleEl) {
        this.caloricStatusTitleEl.textContent = `COWS: ${conv.flowDirection.toUpperCase()} | ${conv.fastPhaseBeatDirection} (${conv.beatDirectionDescription})`;
      }
    }, 100);
  }

  public completeCaloricIrrigation(): void {
    this.isCaloricIrrigating = false;
    if (this.caloricTimerInterval) {
      clearInterval(this.caloricTimerInterval);
      this.caloricTimerInterval = null;
    }
    if (this.caloricPlayBtn) {
      this.caloricPlayBtn.classList.remove('playing');
    }
    if (this.caloricPlayIconEl) {
      this.caloricPlayIconEl.textContent = '▶';
    }
    this.scene.setCaloricUniforms(false, 0, 0, 0);
    this.scene.setCaloricSimulationState(false, null);
    this.vorDrawer.setCaloricActiveIrrigation(null, 0);
    if (this.caloricTimerBadgeEl) {
      this.caloricTimerBadgeEl.textContent = '⏱️ 40.0s / 40s (Complete)';
    }

    const deltaTIrr =
      this.activeCaloricTemp === 'R44' || this.activeCaloricTemp === 'L44'
        ? 7.0
        : this.activeCaloricTemp === 'R30' || this.activeCaloricTemp === 'L30'
        ? -7.0
        : -33.0;
    const ear = this.activeCaloricTemp.startsWith('L') ? 'left' : 'right';
    const conv = computeCaloricConvection(deltaTIrr, 40.0, ear);
    const peakSPV = Math.round(conv.slowPhaseVelocity);

    if (this.activeCaloricTemp === 'R44' && this.jongkeesR44Input) {
      this.jongkeesR44Input.value = String(peakSPV);
    } else if (this.activeCaloricTemp === 'R30' && this.jongkeesR30Input) {
      this.jongkeesR30Input.value = String(peakSPV);
    } else if (this.activeCaloricTemp === 'L44' && this.jongkeesL44Input) {
      this.jongkeesL44Input.value = String(peakSPV);
    } else if (this.activeCaloricTemp === 'L30' && this.jongkeesL30Input) {
      this.jongkeesL30Input.value = String(peakSPV);
    }
    this.recalculateJongkees();

    this.selectCaloricAlexanderGaze(this.caloricAlexanderGaze);
  }

  public stopCaloricIrrigation(): void {
    this.isCaloricIrrigating = false;
    if (this.caloricTimerInterval) {
      clearInterval(this.caloricTimerInterval);
      this.caloricTimerInterval = null;
    }
    if (this.caloricPlayBtn) {
      this.caloricPlayBtn.classList.remove('playing');
    }
    if (this.caloricPlayIconEl) {
      this.caloricPlayIconEl.textContent = '▶';
    }
    this.scene?.setCaloricUniforms(false, 0, 0, 0);
    this.scene?.setCaloricSimulationState(false, null);
    this.vorDrawer?.setCaloricActiveIrrigation(null, 0);
  }

  public alignCaloricPosture(): void {
    this.scene.flyToCaloricPosture();
    this.scene.setHeadOrientation(0, 60, 0);
    this.setHeadOrientationUI(0, 60, 0);
  }

  public selectCaloricAlexanderGaze(gazeDeg: number): void {
    this.caloricAlexanderGaze = gazeDeg;
    this.caloricGazeChips.forEach((chip) => {
      chip.classList.toggle('active', parseInt(chip.getAttribute('data-alex-gaze') || '0', 10) === gazeDeg);
    });
    this.vorDrawer.setAlexanderGaze(gazeDeg, false);

    const deltaTIrr =
      this.activeCaloricTemp === 'R44' || this.activeCaloricTemp === 'L44'
        ? 7.0
        : this.activeCaloricTemp === 'R30' || this.activeCaloricTemp === 'L30'
        ? -7.0
        : -33.0;
    const ear = this.activeCaloricTemp.startsWith('L') ? 'left' : 'right';

    const evalSec = this.caloricElapsedSec > 0 ? this.caloricElapsedSec : 40.0;
    const conv = computeCaloricConvection(deltaTIrr, evalSec, ear);
    const beatSign =
      conv.fastPhaseBeatDirection === 'Left-Beating'
        ? -1
        : conv.fastPhaseBeatDirection === 'Right-Beating'
        ? 1
        : 0;
    const alex = computeAlexanderModulation(conv.slowPhaseVelocity, gazeDeg, beatSign);
    if (this.caloricAlexBadgeEl) {
      this.caloricAlexBadgeEl.textContent = `${alex.clinicalDegree}`;
    }

    if (this.isCaloricIrrigating) {
      this.scene.setCaloricSimulationState(true, conv, alex.modulatedSPV);
      this.vorDrawer.setCaloricActiveIrrigation(this.activeCaloricTemp, alex.modulatedSPV);
      if (this.caloricSpvBadgeEl) {
        this.caloricSpvBadgeEl.textContent = `SPV: ${alex.modulatedSPV.toFixed(1)}°/s (${conv.fastPhaseBeatDirection})`;
      }
    } else if (this.caloricElapsedSec >= 40.0) {
      if (this.caloricSpvBadgeEl) {
        this.caloricSpvBadgeEl.textContent = `SPV: ${alex.modulatedSPV.toFixed(1)}°/s (${conv.fastPhaseBeatDirection})`;
      }
    } else if (this.caloricElapsedSec > 0) {
      if (this.caloricSpvBadgeEl) {
        this.caloricSpvBadgeEl.textContent = `SPV: ${alex.modulatedSPV.toFixed(1)}°/s (${conv.fastPhaseBeatDirection}) (Paused)`;
      }
    } else {
      if (this.caloricSpvBadgeEl) {
        this.caloricSpvBadgeEl.textContent = 'SPV: 0.0°/s';
      }
    }
  }

  public openJongkeesModal(): void {
    if (this.caloricJongkeesModal) {
      this.caloricJongkeesModal.style.display = 'flex';
      this.recalculateJongkees();
    }
  }

  public closeJongkeesModal(): void {
    if (this.caloricJongkeesModal) {
      this.caloricJongkeesModal.style.display = 'none';
    }
  }

  public recalculateJongkees(): void {
    const r44 = parseFloat(this.jongkeesR44Input?.value || '22');
    const r30 = parseFloat(this.jongkeesR30Input?.value || '20');
    const l44 = parseFloat(this.jongkeesL44Input?.value || '21');
    const l30 = parseFloat(this.jongkeesL30Input?.value || '21');

    const res = calculateJongkees(r44, r30, l44, l30);
    this.vorDrawer.setCaloricData(r44, r30, l44, l30);

    if (this.resultUwValEl) {
      this.resultUwValEl.textContent = `${res.canalParesisPercent.toFixed(1)}%`;
      this.resultUwValEl.classList.toggle('pathologic', res.pareticEar !== 'symmetric');
    }
    if (this.resultDpValEl) {
      this.resultDpValEl.textContent = `${res.directionalPreponderancePercent.toFixed(1)}%`;
      this.resultDpValEl.classList.toggle('pathologic', res.preponderanceDirection !== 'symmetric');
    }
    if (this.resultTotalValEl) {
      this.resultTotalValEl.textContent = `${res.totalResponseDegPerSec.toFixed(1)}°/s`;
      this.resultTotalValEl.classList.toggle('pathologic', res.isBilateralWeakness);
    }
    if (this.caloricInterpCardEl) {
      this.caloricInterpCardEl.textContent = res.clinicalInterpretation;
    }
  }

  public loadJongkeesPreset(presetKey: string): void {
    this.caloricPresetChips.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-preset') === presetKey);
    });

    type PresetName = keyof typeof CALORIC_CLINICAL_PRESETS;
    let mappedKey: PresetName = 'normal';
    if (presetKey === 'right_uw') mappedKey = 'right_neuritis';
    else if (presetKey === 'left_uw') mappedKey = 'left_schwannoma';
    else if (presetKey === 'dp_right') mappedKey = 'directional_preponderance';
    else if (presetKey === 'bilateral') mappedKey = 'bilateral_gentamicin';
    else if (presetKey in CALORIC_CLINICAL_PRESETS) mappedKey = presetKey as PresetName;

    const presetData = CALORIC_CLINICAL_PRESETS[mappedKey];
    if (presetData) {
      if (this.jongkeesR44Input) this.jongkeesR44Input.value = String(presetData.r44);
      if (this.jongkeesR30Input) this.jongkeesR30Input.value = String(presetData.r30);
      if (this.jongkeesL44Input) this.jongkeesL44Input.value = String(presetData.l44);
      if (this.jongkeesL30Input) this.jongkeesL30Input.value = String(presetData.l30);
      this.recalculateJongkees();
    }
  }

  public selectVHITPair(pair: VHITCanalPair): void {
    this.vhitPair = pair;
    this.vhitPairChips.forEach((chip) => {
      chip.classList.toggle('active', chip.getAttribute('data-vhit-pair') === pair);
    });

    let branchLabel = 'CN VIII SVN';
    if (pair === 'ralp') {
      branchLabel = 'CN VIII Post IVN / Ant SVN';
    } else if (pair === 'larp') {
      branchLabel = 'CN VIII Ant SVN / Post IVN';
    }
    const label = pair === 'horizontal' ? 'Horizontal (Yaw)' : pair.toUpperCase();
    if (this.vhitStatusTitleEl) {
      this.vhitStatusTitleEl.textContent = `Head Impulse (${label}, 15°, 120ms) · ${branchLabel}`;
    }
    this.updateVHITReadout();
  }

  public selectVHITDirection(dir: 1 | -1): void {
    this.vhitDirection = dir;
    if (this.vhitDirLeftBtn) this.vhitDirLeftBtn.classList.toggle('active', dir === -1);
    if (this.vhitDirRightBtn) this.vhitDirRightBtn.classList.toggle('active', dir === 1);
    this.updateVHITReadout();
  }

  public updateVHITReadout(): void {
    this.vorDrawer.simulateVHIT(this.vhitPreset, this.vhitParadigm, this.vhitSlippage);
    const buf = this.vorDrawer.getVHITBuffer();
    const gain = buf.calculatedGain;
    const saccadesList: string[] = [];
    if (buf.covertSaccadePresent) saccadesList.push('Covert (75ms)');
    if (buf.overtSaccadePresent) saccadesList.push('Overt (180ms)');
    if (buf.shimpSaccadePresent) saccadesList.push('SHIMP Anti-Comp (180ms)');

    if (this.vhitGainBadgeEl) {
      this.vhitGainBadgeEl.textContent = `Gain: ${gain.toFixed(2)}`;
    }
    if (this.vhitSaccadeBadgeEl) {
      if (saccadesList.length === 0) {
        this.vhitSaccadeBadgeEl.textContent = 'Normal (No Saccades)';
      } else {
        this.vhitSaccadeBadgeEl.textContent = saccadesList.join(' + ');
      }
    }
  }

  public selectVHITPreset(preset: VHITPathologyPreset): void {
    this.vhitPreset = preset;
    this.vhitPresetChips.forEach((chip) => {
      chip.classList.toggle('active', chip.getAttribute('data-vhit-preset') === preset);
    });
    this.updateVHITReadout();
  }

  public toggleVHITParadigm(): void {
    this.vhitParadigm = this.vhitParadigm === 'himp' ? 'shimp' : 'himp';
    if (this.vhitParadigmBtn) {
      this.vhitParadigmBtn.textContent = this.vhitParadigm.toUpperCase();
      this.vhitParadigmBtn.title =
        this.vhitParadigm === 'himp'
          ? 'HIMP: Target is Earth-fixed (catch-up saccades indicate hypofunction)'
          : 'SHIMP: Target is Head-fixed (catch-up saccades indicate normal function)';
    }
    this.updateVHITReadout();
  }

  public toggleVHITSlippage(): void {
    this.vhitSlippage = !this.vhitSlippage;
    if (this.vhitSlippageBtn) {
      this.vhitSlippageBtn.textContent = this.vhitSlippage ? 'Slippage: On' : 'Slippage: Off';
      this.vhitSlippageBtn.classList.toggle('active', this.vhitSlippage);
    }
    this.updateVHITReadout();
  }

  public deliverVHITThrust(): void {
    if (this.vhitThrustBtn && this.vhitThrustBtn.disabled) return;
    if (this.vhitThrustBtn) {
      this.vhitThrustBtn.disabled = true;
      this.vhitThrustBtn.classList.add('impulsing');
    }

    this.scene.triggerVHITThrust(this.vhitPair, this.vhitDirection, () => {
      if (this.vhitThrustBtn) {
        this.vhitThrustBtn.disabled = false;
        this.vhitThrustBtn.classList.remove('impulsing');
      }
    });

    this.vorDrawer.setDiagnosticViewMode('vhit');
    this.updateVHITReadout();

    if (!this.vorDrawer.getIsOpen()) {
      this.openVORDrawer();
    }
  }

  private handleFrequencyChange(freq: number, updateSlider: boolean): void {
    this.scene.setHearingFrequency(freq, true);
    if (this.toneSynth.getIsPlaying()) {
      this.toneSynth.setFrequency(freq);
    }
    this.audiogramDrawer.setActiveFrequency(freq);
    this.syncFrequencyUI(freq, updateSlider);
  }

  private syncFrequencyUI(freq: number, updateSlider = true): void {
    this.hearingFreqReadout.textContent = `${Math.round(freq)} Hz`;
    const landmark = getAcousticLandmark(freq);
    const x = greenwoodPosition(freq);
    const apexDist = getDistanceApexMm(x);
    this.hearingLandmarkBadge.textContent = `${landmark.shortTag} (${apexDist.toFixed(1)} mm)`;

    if (updateSlider && document.activeElement !== this.hearingSlider) {
      const val = Math.round((Math.log10(Math.max(20, freq) / 20) / 3) * 1000);
      this.hearingSlider.value = String(val);
      updateRangeProgress(this.hearingSlider);
    }

    this.octaveChips.forEach((chip) => {
      const octaveVal = parseInt(chip.getAttribute('data-octave') || '0', 10);
      chip.classList.toggle('active', Math.abs(octaveVal - freq) < 15);
    });
  }

  private updateTonePlayButton(isPlaying: boolean): void {
    this.tonePlayBtn.classList.toggle('playing', isPlaying);
    this.toneIconEl.textContent = isPlaying ? '⏸' : '▶';
    this.toneLabelEl.textContent = isPlaying ? 'Pause Tone' : 'Play Tone';
  }

  private handleLiveVestibularTelemetry(telem: VestibularTelemetryState): void {
    if (!telem) return;

    if (this.vestClearanceBadgeEl && this.vestSubmode === 'bppv') {
      const clearanceVal = typeof telem.clearancePercent === 'number' ? telem.clearancePercent : 0;
      this.vestClearanceBadgeEl.textContent = `${clearanceVal.toFixed(0)}% Cleared`;
    }

    if (this.cachedCn8Val && this.cachedCn8BarFill) {
      const firingRate = typeof telem.afferentSpikesPerSec === 'number' ? telem.afferentSpikesPerSec : 90;
      const clampedRate = Math.max(10, Math.min(310, firingRate));
      const firingPercent = ((clampedRate - 10) / (310 - 10)) * 100;

      let firingClass = 'rate-resting';
      let fillClass = 'fill-resting';
      if (firingRate > 140) {
        firingClass = 'rate-excitation';
        fillClass = 'fill-excitation';
      } else if (firingRate < 50) {
        firingClass = 'rate-inhibition';
        fillClass = 'fill-inhibition';
      }

      this.cachedCn8Val.textContent = `${firingRate.toFixed(0)} sp/s`;
      this.cachedCn8Val.className = `cn8-val ${firingClass}`;

      this.cachedCn8BarFill.style.width = `${firingPercent.toFixed(1)}%`;
      this.cachedCn8BarFill.className = `cn8-bar-fill ${fillClass}`;

      if (this.cachedEwaldText && telem.ewaldLawActive) {
        this.cachedEwaldText.textContent = telem.ewaldLawActive;
      }
      if (this.cachedVestClearancePrefix && this.cachedVestClearanceVal) {
        if (this.vestSubmode === 'bppv') {
          const cp = typeof telem.clearancePercent === 'number' ? telem.clearancePercent : 0;
          this.cachedVestClearancePrefix.textContent = 'Clearance: ';
          this.cachedVestClearanceVal.textContent = `${cp.toFixed(0)}%`;
        } else if (this.vestSubmode === 'caloric') {
          this.cachedVestClearancePrefix.textContent = 'Modality: ';
          this.cachedVestClearanceVal.textContent = 'COWS Caloric';
        } else {
          this.cachedVestClearancePrefix.textContent = 'Modality: ';
          this.cachedVestClearanceVal.textContent = 'vHIT (CN VIII)';
        }
      }
      if (this.cachedVestStatusBadge) {
        if (this.vestSubmode === 'bppv') {
          const cp = typeof telem.clearancePercent === 'number' ? telem.clearancePercent : 0;
          if (cp >= 99) {
            this.cachedVestStatusBadge.textContent = 'Cleared (Crystals in Utricle)';
            this.cachedVestStatusBadge.className = 'vest-status-badge sensation-cleared';
          } else if (telem.patientSensation && telem.patientSensation.includes('Spinning')) {
            this.cachedVestStatusBadge.textContent = 'Spinning Vertigo (Crystals Moving)';
            this.cachedVestStatusBadge.className = 'vest-status-badge sensation-spinning';
          } else {
            this.cachedVestStatusBadge.textContent = 'Calm (No Spinning)';
            this.cachedVestStatusBadge.className = 'vest-status-badge sensation-calm';
          }
        } else if (this.vestSubmode === 'caloric') {
          this.cachedVestStatusBadge.textContent = telem.patientSensation || 'Caloric Convection Active';
          const horizSpv = telem.slowPhaseVelocityDegPerSec?.horizontal ?? 0;
          this.cachedVestStatusBadge.className =
            horizSpv !== 0 ? 'vest-status-badge sensation-spinning' : 'vest-status-badge sensation-calm';
        } else {
          this.cachedVestStatusBadge.textContent = telem.patientSensation || 'Target Fixed (Visual Fixation)';
          this.cachedVestStatusBadge.className = telem.fastPhaseBeatDirection.includes('Saccade')
            ? 'vest-status-badge sensation-spinning'
            : 'vest-status-badge sensation-calm';
        }
      }
    }
  }

  // ===========================================================================
  // UNIFIED SPECIMEN NOTE CARD RENDER (Zero Content Loss, Compact vs Expanded)
  // ===========================================================================
  private renderInspectorCard(selectedMesh: string | null): void {
    this.cachedCn8Val = null;
    this.cachedCn8BarFill = null;
    this.cachedEwaldText = null;
    this.cachedVestClearancePrefix = null;
    this.cachedVestClearanceVal = null;
    this.cachedVestStatusBadge = null;

    if (!selectedMesh) {
      this.noteSystemDot.style.backgroundColor = 'var(--accent-primary)';
      this.notePillDot.style.backgroundColor = 'var(--accent-primary)';
      this.noteSystemLabel.textContent = 'Inner Ear Atlas';
      this.notePillLabel.textContent = 'Labyrinth · Open Note';
      this.noteTitleEl.textContent = 'Inner Ear Labyrinth';
      this.noteCompactLead.textContent = 'Click any inner ear structure in 3D or search above to inspect stereotaxic anatomy.';
      this.noteLeadProse.textContent = 'Select any structure in the 27-part IE-Map v1.0.0 labyrinth to view RAS morphometry, fluid compartments, and clinical notes.';
      this.inspFluidEl.textContent = 'Endolymph & Perilymph';
      this.inspMetricKeyEl.textContent = 'Ontology';
      this.inspMetricValEl.textContent = '27 Anatomical Structures';
      this.noteContextBoxes.innerHTML = '';
      this.inspDeepProse.textContent = 'CANONICAL RAS frame centered near labyrinth centroid [4.5, 1.4, 0.5] mm.';
      this.inspLatinEl.textContent = 'Labyrinthus osseus et membranaceus';
      this.inspInnervationEl.textContent = 'Vestibulocochlear nerve (CN VIII)';
      this.inspMorphometryEl.textContent = '20 mm rostrocaudal span';
      this.inspRasChipEl.textContent = '[+4.5, +1.4, +0.5] mm';
      this.inspPearlEl.textContent = 'Select a structure to highlight clinical correlations.';
      if (this.repActivePartEl) this.repActivePartEl.textContent = 'Inner Ear Labyrinth';
      return;
    }

    const item = STRUCTURE_BY_MESH[selectedMesh];
    if (!item) return;

    const prevMesh = this.noteCard.getAttribute('data-active-mesh');
    if (prevMesh !== selectedMesh) {
      if (this.noteScrollBody) this.noteScrollBody.scrollTop = 0;
      this.noteCard.setAttribute('data-active-mesh', selectedMesh);
    }

    const groupMeta = SYSTEM_GROUPS[item.systemGroup];
    const snap = this.scene.getSnapshot();
    const isIsolated = snap.isIsolated;

    this.noteSystemDot.style.backgroundColor = item.colorHex;
    this.notePillDot.style.backgroundColor = item.colorHex;
    this.noteSystemLabel.textContent = groupMeta?.shortTitle ?? 'Structure';
    this.notePillLabel.textContent = `${item.shortLabel} · Open Note`;
    this.noteTitleEl.textContent = formatStructureHeadline(item);
    this.noteCompactLead.textContent = getCompactNoteSentence(item);

    if (this.activeReadingDepth === 'detailed') {
      this.noteLeadProse.textContent = item.physiologicalFunction;
      this.inspDeepProse.textContent = item.patientSummary;
    } else {
      this.noteLeadProse.textContent = item.patientSummary;
      this.inspDeepProse.textContent = item.physiologicalFunction;
    }

    this.inspFluidEl.textContent = compactFluidLabel(item.fluidCompartment);
    const primaryMetric = getStructurePrimaryMetric(item);
    this.inspMetricKeyEl.textContent = primaryMetric.label;
    this.inspMetricValEl.textContent = primaryMetric.value;

    this.inspLatinEl.textContent = `${item.latinName} · ${item.subGroup}`;
    this.inspInnervationEl.textContent = item.innervation;
    this.inspMorphometryEl.textContent = item.morphometry;
    this.inspRasChipEl.textContent = `${formatRAS(item.centroidRAS)} mm · ${item.meshName}`;
    this.inspPearlEl.textContent = item.clinicalPearl;
    if (this.furtherReadHint) {
      this.furtherReadHint.textContent = `Clinical Details · ${this.activeReadingDepth === 'detailed' ? 'Clinical' : 'Patient'}`;
    }

    if (this.btnIsolate) {
      this.btnIsolate.textContent = isIsolated ? 'Show All Parts' : 'Isolate Part';
      this.btnIsolate.classList.toggle('active', isIsolated);
    }
    if (this.repActivePartEl) {
      this.repActivePartEl.textContent = `${item.displayName} (${formatRAS(item.centroidRAS)} mm)`;
    }

    const showSCDSBox =
      (snap.radiologyState.scdsActive && snap.labMode === 'radiology') ||
      (snap.radiologyState.scdsActive && item.meshName === 'ls_Hsapiens_Sa') ||
      (snap.labMode === 'radiology' && (item.meshName === 'ls_Hsapiens_Sa' || item.meshName === 'segT2_th1.07_Otsu'));

    let surgBoxHtml = '';
    if (snap.labMode === 'surgical') {
      const surgState = this.scene.getSurgicalState();
      let badgeHtml = '<span class="surg-safety-badge safe">SAFE</span>';
      let title = 'Cochlear Implant Suite';
      let metricsHtml = '';

      if (surgState.activeProcedure === 'cochlear_implant') {
        title = 'Cochlear Implant Navigation';
        const ci = surgState.ciState;
        if (ci.isRuptured || ci.translocationRisk === 'breach') {
          badgeHtml = '<span class="surg-safety-badge danger">BREACH DETECTED</span>';
        } else if (ci.translocationRisk === 'caution') {
          badgeHtml = '<span class="surg-safety-badge warning">HIGH FORCE</span>';
        } else {
          badgeHtml = '<span class="surg-safety-badge safe">INTRA-SCALAR SAFE</span>';
        }
        metricsHtml = `
          <div>Depth: <strong>${ci.insertionDepthMm.toFixed(1)} mm</strong></div>
          <div>Force: <strong>${ci.insertionForceMilliNewtons.toFixed(1)} mN</strong></div>
          <div>Dist to BM: <strong>${ci.distanceToBasilarMembraneMm.toFixed(2)} mm</strong></div>
          <div>Angle: <strong>${ci.angularDepthDeg.toFixed(0)}°</strong></div>
        `;
      } else if (surgState.activeProcedure === 'labyrinthectomy') {
        title = 'Transmastoid Labyrinthectomy';
        const laby = surgState.labyState;
        badgeHtml =
          laby.step === 3
            ? '<span class="surg-safety-badge warning">DEAFFERENTATED</span>'
            : '<span class="surg-safety-badge safe">RESECTION IN PROGRESS</span>';
        metricsHtml = `
          <div>Step: <strong>${laby.step + 1} / 4</strong></div>
          <div>Drill: <strong>${laby.isDrillActive ? '70k RPM' : 'OFF'}</strong></div>
          <div>Resting Firing: <strong>${laby.vestibularFiringRateSpikesSec.toFixed(0)} sp/s</strong></div>
          <div>Paralytic SPV: <strong>${laby.spontaneousSPVDegSec.toFixed(1)}°/s</strong></div>
        `;
      } else {
        title = 'Retrosigmoid Neurectomy (IAC)';
        const neu = surgState.neurectomyState;
        if (neu.tractionRisk === 'CRITICAL' || neu.facialEMGVoltageMicroVolts >= 500) {
          badgeHtml = '<span class="surg-safety-badge danger">EMG DISCHARGE</span>';
        } else if (neu.tractionRisk === 'WARNING') {
          badgeHtml = '<span class="surg-safety-badge warning">CN VII TRACTION</span>';
        } else {
          badgeHtml = '<span class="surg-safety-badge safe">CN VII PRESERVED</span>';
        }
        const latencyShift = Math.max(0, neu.abrWaveVLatencyMs - 5.7);
        metricsHtml = `
          <div>ABR Wave V: <strong>${neu.abrWaveVLatencyMs.toFixed(2)} ms</strong></div>
          <div>Latency Shift: <strong>+${latencyShift.toFixed(2)} ms</strong></div>
          <div>Facial EMG: <strong>${neu.facialEMGVoltageMicroVolts.toFixed(0)} μV</strong></div>
          <div>Koos Stage: <strong>Grade ${neu.koosStage}</strong></div>
        `;
      }

      surgBoxHtml = `
        <div class="surgical-inspector-box">
          <div class="electrophys-header">
            <span class="ep-icon">🔬</span>
            <span class="ep-title">${title}</span>
            ${badgeHtml}
          </div>
          <div class="surg-metrics-grid">
            ${metricsHtml}
          </div>
          <button type="button" class="surg-inspector-monitor-btn" id="surg-view-monitor-btn">
            🔬 Open Surgical Telemetry &amp; Lumen Drawer
          </button>
        </div>
      `;
    }

    const isVestibularPart =
      item.systemGroup === 'semicircular_ducts' ||
      item.systemGroup === 'ampullae_cupulae' ||
      item.systemGroup === 'otolith_vestibule';
    const showVestibularBox = snap.labMode === 'vestibular' || isVestibularPart;

    let vestBoxHtml = '';
    if (showVestibularBox) {
      const vestEngine = this.scene.getVestibularEngine();
      const head = this.scene.getHeadOrientation();
      const telem = vestEngine ? vestEngine.getTelemetry(head.yaw, head.pitch, head.roll) : null;
      const currPreset = vestEngine ? vestEngine.getCurrentPreset() : null;

      let canalTitle = 'Posterior Semicircular Canal';
      let canalPlane = 'LARP Plane — 45° Oblique · CN VIII Inferior Division';
      let ewaldLaw = "Ewald's 3rd Law: Ampullofugal flow excites posterior canal";

      let canalId = 'posterior';
      if (item.meshName.includes('Hsapiens_Sl')) {
        canalId = 'horizontal';
      } else if (item.meshName.includes('Hsapiens_Sa')) {
        canalId = 'anterior';
      } else if (item.meshName.includes('Hsapiens_Sp')) {
        canalId = 'posterior';
      } else if (telem?.canalId) {
        canalId = telem.canalId;
      }

      if (canalId === 'horizontal') {
        canalTitle = 'Horizontal Semicircular Canal';
        canalPlane = 'Axial Plane — 30° Oblique · CN VIII Superior Division';
        ewaldLaw = "Ewald's 2nd Law: Ampullopetal excitation (horizontal canal)";
      } else if (canalId === 'anterior') {
        canalTitle = 'Anterior (Superior) Semicircular Canal';
        canalPlane = 'RALP Plane — 45° Oblique · CN VIII Superior Division';
        ewaldLaw = "Ewald's 3rd Law: Ampullofugal flow excites anterior canal";
      }

      let firingRate = typeof telem?.afferentSpikesPerSec === 'number' ? telem.afferentSpikesPerSec : 90;
      if (telem?.ewaldLawActive && this.vestSubmode === 'bppv') {
        ewaldLaw = telem.ewaldLawActive;
      }

      const caloricSim = this.scene.getCaloricSimulationState();
      if (this.isCaloricIrrigating && caloricSim && caloricSim.active) {
        firingRate = caloricSim.afferentFiringRate;
        ewaldLaw = caloricSim.isAmpullopetal
          ? "Ewald's 2nd Law: Ampullopetal excitation (horizontal canal)"
          : "Ewald's 2nd Law: Ampullofugal inhibition (horizontal canal)";
      }

      const clampedRate = Math.max(10, Math.min(310, firingRate));
      const firingPercent = ((clampedRate - 10) / (310 - 10)) * 100;
      let firingClass = 'rate-resting';
      let firingFillClass = 'fill-resting';
      if (firingRate > 150) {
        firingClass = 'rate-excitation';
        firingFillClass = 'fill-excitation';
      } else if (firingRate < 45) {
        firingClass = 'rate-inhibition';
        firingFillClass = 'fill-inhibition';
      }
      const clearancePercent = typeof telem?.clearancePercent === 'number' ? telem.clearancePercent : 0;
      let sensationText = 'Calm (No Spinning)';
      let sensationBadgeClass = 'sensation-calm';
      if (clearancePercent >= 99) {
        sensationText = 'Cleared (Crystals in Utricle)';
        sensationBadgeClass = 'sensation-cleared';
      } else if (telem?.patientSensation && telem.patientSensation.includes('Spinning')) {
        sensationText = 'Spinning Vertigo (Crystals Moving)';
        sensationBadgeClass = 'sensation-spinning';
      }

      const pearlText = currPreset?.clinicalPearl || item.clinicalPearl;

      vestBoxHtml = `
        <div class="vestibular-telemetry-box">
          <div class="vest-box-header">
            <span class="vest-box-icon">🌀</span>
            <div class="vest-title-group">
              <span class="vest-title">${canalTitle}</span>
              <span class="vest-sub">${canalPlane}</span>
            </div>
          </div>

          <div class="vest-metrics-grid">
            <div class="vest-metric-item cn8-gauge-wrap">
              <div class="cn8-header">
                <span class="cn8-label">CN VIII Afferent Firing Rate</span>
                <span class="cn8-val ${firingClass}">${firingRate.toFixed(0)} sp/s</span>
              </div>
              <div class="cn8-bar-track">
                <div class="cn8-bar-baseline" title="Resting baseline: 90 sp/s" style="left: 26.67%;"></div>
                <div class="cn8-bar-fill ${firingFillClass}" style="width: ${firingPercent.toFixed(1)}%;"></div>
              </div>
              <div class="cn8-scale-labels">
                <span>10 (Inh)</span>
                <span>90 (Rest)</span>
                <span>310 (Exc)</span>
              </div>
            </div>

            <div class="ewald-law-banner">
              <span class="ewald-icon">⚖️</span>
              <span class="ewald-text">${ewaldLaw}</span>
            </div>

            <div class="vest-status-row">
              <div class="vest-status-badge ${sensationBadgeClass}">
                ${sensationText}
              </div>
              <div class="vest-clearance-pill">
                ${
                  this.vestSubmode === 'bppv'
                    ? `<span class="vest-clearance-prefix">Clearance: </span><strong class="vest-clearance-val">${clearancePercent.toFixed(0)}%</strong>`
                    : this.vestSubmode === 'caloric'
                    ? `<span class="vest-clearance-prefix">Modality: </span><strong class="vest-clearance-val">COWS Caloric</strong>`
                    : `<span class="vest-clearance-prefix">Modality: </span><strong class="vest-clearance-val">vHIT (CN VIII)</strong>`
                }
              </div>
            </div>

            ${
              pearlText
                ? `
              <div class="vest-pearl-row">
                <span class="vest-pearl-label">Clinical Pearl:</span>
                <span class="vest-pearl-desc">${pearlText}</span>
              </div>
            `
                : ''
            }
          </div>

          <div class="vest-box-actions">
            <button type="button" class="vest-view-vor-btn" id="vest-view-vor-btn">
              👁️ View 3D VOR &amp; VNG Eyes
            </button>
          </div>
        </div>
      `;
    }

    const electroBoxHtml =
      item.endocochlearPotential || item.characteristicFrequencyRange || item.ionicComposition
        ? `
        <div class="electrophys-box">
          <div class="electrophys-header">
            <span class="ep-icon">⚡</span>
            <span class="ep-title">Electrophysiology &amp; Tonotopy</span>
          </div>
          <div class="electrophys-grid">
            ${
              item.endocochlearPotential
                ? `
              <div class="ep-stat">
                <span class="ep-stat-label">Endocochlear Potential</span>
                <span class="ep-stat-val ${item.endocochlearPotential.includes('+80') ? 'val-high-ep' : ''}">${item.endocochlearPotential}</span>
              </div>
            `
                : ''
            }
            ${
              item.characteristicFrequencyRange
                ? `
              <div class="ep-stat">
                <span class="ep-stat-label">Tuned Frequency</span>
                <span class="ep-stat-val">${item.characteristicFrequencyRange}</span>
              </div>
            `
                : ''
            }
            ${
              item.ionicComposition
                ? `
              <div class="ep-stat ep-stat-wide">
                <span class="ep-stat-label">Ionic Environment</span>
                <span class="ep-stat-val">${item.ionicComposition}</span>
              </div>
            `
                : ''
            }
          </div>
        </div>
      `
        : '';

    const scdsBoxHtml = showSCDSBox
      ? `
        <div class="scds-biomechanics-box">
          <div class="scds-box-header">
            <span class="scds-icon">⚡</span>
            <div class="scds-title-group">
              <span class="scds-title">SSCD Third-Window Biomechanics</span>
              <span class="scds-sub">Minor's Syndrome · Arcuate Eminence Defect (1.5 mm)</span>
            </div>
          </div>
          <div class="scds-triad-grid">
            <div class="scds-triad-item">
              <div class="triad-item-header">
                <span class="triad-icon">🔊</span>
                <span class="triad-name">Tullio Phenomenon</span>
              </div>
              <p class="triad-desc">${SCDS_PARAMETERS.triad.tullio}</p>
            </div>
            <div class="scds-triad-item">
              <div class="triad-item-header">
                <span class="triad-icon">💨</span>
                <span class="triad-name">Hennebert's Sign</span>
              </div>
              <p class="triad-desc">${SCDS_PARAMETERS.triad.hennebert}</p>
            </div>
            <div class="scds-triad-item">
              <div class="triad-item-header">
                <span class="triad-icon">👁️</span>
                <span class="triad-name">Autophony &amp; Hyperacusis</span>
              </div>
              <p class="triad-desc">${SCDS_PARAMETERS.triad.autophony}</p>
            </div>
          </div>
          <button type="button" class="scds-audiogram-btn" id="scds-view-audiogram-btn">
            📊 View Classic SSCD Conductive Audiogram Profile
          </button>
        </div>
      `
      : '';

    this.noteContextBoxes.innerHTML = `${surgBoxHtml}${vestBoxHtml}${electroBoxHtml}${scdsBoxHtml}`;

    this.cachedCn8Val = this.noteContextBoxes.querySelector('.cn8-val') as HTMLElement | null;
    this.cachedCn8BarFill = this.noteContextBoxes.querySelector('.cn8-bar-fill') as HTMLElement | null;
    this.cachedEwaldText = this.noteContextBoxes.querySelector('.ewald-text') as HTMLElement | null;
    this.cachedVestClearancePrefix = this.noteContextBoxes.querySelector('.vest-clearance-prefix') as HTMLElement | null;
    this.cachedVestClearanceVal = this.noteContextBoxes.querySelector('.vest-clearance-val') as HTMLElement | null;
    this.cachedVestStatusBadge = this.noteContextBoxes.querySelector('.vest-status-badge') as HTMLElement | null;

    const surgMonitorBtn = this.noteContextBoxes.querySelector('#surg-view-monitor-btn');
    surgMonitorBtn?.addEventListener('click', () => {
      if (snap.labMode !== 'surgical') {
        this.switchLabMode('surgical');
      }
      this.openSurgicalDrawer();
    });

    const vestViewVorBtn = this.noteContextBoxes.querySelector('#vest-view-vor-btn');
    vestViewVorBtn?.addEventListener('click', () => {
      if (snap.labMode !== 'vestibular') {
        this.switchLabMode('vestibular');
      }
      this.openVORDrawer();
    });

    const scdsAudioBtn = this.noteContextBoxes.querySelector('#scds-view-audiogram-btn');
    scdsAudioBtn?.addEventListener('click', () => {
      this.switchLabMode('hearing');
      this.audiogramDrawer.setActivePreset('conductive_scds');
      this.openAudiogramDrawer();
    });

    this.scheduleGeometrySync();
  }

  // ===========================================================================
  // PARTS TREE RENDER (Inside #sidebar-pane-lab)
  // ===========================================================================
  private renderPartsTree(): void {
    const treeBody = this.partsDrawer?.querySelector('#parts-tree-body') as HTMLElement | null;
    if (!treeBody) return;

    const allGroups: SystemGroupId[] = [
      'cochlear_system',
      'semicircular_ducts',
      'ampullae_cupulae',
      'otolith_vestibule',
      'bony_capsule',
    ];
    const groups = this.partsSystemFilter === 'all' ? allGroups : [this.partsSystemFilter];
    const q = this.partsSearchQuery;
    const snap = this.scene ? this.scene.getSnapshot() : null;

    treeBody.innerHTML = groups
      .map((groupId) => {
        const groupMeta = SYSTEM_GROUPS[groupId];
        const groupItems = IEMAP_STRUCTURES.filter((item) => {
          if (item.systemGroup !== groupId) return false;
          if (!q) return true;
          return (
            item.displayName.toLowerCase().includes(q) ||
            item.latinName.toLowerCase().includes(q) ||
            item.shortLabel.toLowerCase().includes(q)
          );
        });
        if (groupItems.length === 0) return '';

        const rowsHtml = groupItems
          .map((item) => {
            const isHidden = snap ? snap.visibilityMap[item.meshName] === 'hidden' : false;
            const isSelected = snap ? snap.selectedMesh === item.meshName : false;

            return `
              <div class="part-row ${isSelected ? 'selected' : ''}" data-mesh="${item.meshName}">
                <button
                  type="button"
                  class="eye-toggle-btn ${isHidden ? 'hidden-state' : ''}"
                  data-eye-mesh="${item.meshName}"
                  title="${isHidden ? 'Show part' : 'Hide part'}"
                  aria-label="Toggle ${item.shortLabel}"
                >${isHidden ? '🚫' : '👁️'}</button>
                <div class="part-labels" data-click-mesh="${item.meshName}">
                  <span class="part-row-title">${item.displayName}</span>
                  <span class="part-row-latin">${item.latinName}</span>
                </div>
              </div>
            `;
          })
          .join('');

        return `
          <div class="system-group-card">
            <div class="system-group-header">
              <span class="group-color-dot" style="background: ${groupMeta.accentHex};"></span>
              <h3 class="system-group-title">${groupMeta.title}</h3>
              <span class="group-count">(${groupItems.length})</span>
            </div>
            <div class="system-group-list">
              ${rowsHtml}
            </div>
          </div>
        `;
      })
      .join('');

    const eyeBtns = treeBody.querySelectorAll<HTMLButtonElement>('[data-eye-mesh]');
    eyeBtns.forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const meshName = btn.getAttribute('data-eye-mesh');
        if (!meshName) return;

        const currentVis = this.scene.getSnapshot().visibilityMap[meshName];
        const nextVis: VisibilityState = currentVis === 'hidden' ? 'visible' : 'hidden';
        this.scene.setStructureVisibility(meshName, nextVis);
      });
    });

    const clickRows = treeBody.querySelectorAll<HTMLElement>('.part-row');
    clickRows.forEach((row) => {
      row.addEventListener('click', () => {
        const meshName = row.getAttribute('data-mesh');
        if (meshName) {
          if (window.innerWidth <= 720) {
            this.closePartsDrawer();
          }
          this.scene.selectStructure(meshName, true);
        }
      });
    });
  }

  private handleStructurePicked(meshName: string): void {
    if (meshName !== this.lastRenderedMesh) {
      this.lastRenderedMesh = meshName;
      this.renderInspectorCard(meshName);
      if (this.noteState === 'collapsed') {
        this.setNoteState('compact');
      }
    }
  }

  // ===========================================================================
  // 3D PROJECTED PINS RENDER (Zero-GC Keep-Out Zone Decluttering)
  // ===========================================================================
  private renderProjectedPins(pins: ProjectedPin2D[]): void {
    const activeIds = this.activePinIdSet;
    activeIds.clear();
    for (let i = 0; i < pins.length; i++) {
      activeIds.add(pins[i].id);
    }
    const selectedMesh = this.scene.getSelectedMesh();

    for (const [id, el] of this.pinElements.entries()) {
      if (!activeIds.has(id)) {
        el.remove();
        this.pinElements.delete(id);
        this.pinHalfWidths.delete(id);
      }
    }

    const vw = this.stageWidthPx || window.innerWidth;
    let placedCount = 0;

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < pins.length; i++) {
        const pin = pins[i];
        const isSelected = selectedMesh === pin.meshName;
        if ((pass === 0) !== isSelected) continue;

        let el = this.pinElements.get(pin.id);
        if (!el) {
          const pinEl = document.createElement('div');
          el = pinEl;
          pinEl.className = 'projected-pin';
          pinEl.id = `pin-${pin.id}`;
          pinEl.innerHTML = `
            <span class="pin-dot" style="background: ${pin.colorHex};"></span>
            <span class="pin-text">${pin.label}</span>
          `;
          let pointerDownX = 0;
          let pointerDownY = 0;
          let pointerMoved = false;
          let activePointerId: number | null = null;

          const forwardEvent = (type: string, ev: PointerEvent) => {
            const canvas = this.scene.getDomElement();
            if (!canvas) return;
            const synth = new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              composed: true,
              pointerId: ev.pointerId,
              pointerType: ev.pointerType,
              clientX: ev.clientX,
              clientY: ev.clientY,
              screenX: ev.screenX,
              screenY: ev.screenY,
              button: ev.button,
              buttons: ev.buttons,
              ctrlKey: ev.ctrlKey,
              shiftKey: ev.shiftKey,
              altKey: ev.altKey,
              metaKey: ev.metaKey,
            });
            canvas.dispatchEvent(synth);
          };

          pinEl.addEventListener('pointerdown', (ev) => {
            ev.stopPropagation();
            pointerDownX = ev.clientX;
            pointerDownY = ev.clientY;
            pointerMoved = false;
            activePointerId = ev.pointerId;
            try {
              pinEl.setPointerCapture(ev.pointerId);
            } catch {
              // ignore
            }
            forwardEvent('pointerdown', ev);
          });

          pinEl.addEventListener('pointermove', (ev) => {
            if (activePointerId === ev.pointerId) {
              const dist = Math.hypot(ev.clientX - pointerDownX, ev.clientY - pointerDownY);
              if (dist > 6) {
                pointerMoved = true;
              }
              forwardEvent('pointermove', ev);
            }
          });

          const endPointer = (ev: PointerEvent, type: 'pointerup' | 'pointercancel') => {
            if (activePointerId === ev.pointerId) {
              activePointerId = null;
              try {
                if (pinEl.hasPointerCapture(ev.pointerId)) {
                  pinEl.releasePointerCapture(ev.pointerId);
                }
              } catch {
                // ignore
              }
              forwardEvent(type, ev);
              if (type === 'pointerup' && !pointerMoved) {
                this.scene.selectStructure(pin.meshName, true);
              }
            }
          };

          pinEl.addEventListener('pointerup', (ev) => {
            ev.stopPropagation();
            endPointer(ev, 'pointerup');
          });

          pinEl.addEventListener('pointercancel', (ev) => {
            ev.stopPropagation();
            endPointer(ev, 'pointercancel');
          });

          pinEl.addEventListener('wheel', (ev) => {
            const canvas = this.scene.getDomElement();
            if (!canvas) return;
            canvas.dispatchEvent(
              new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                deltaX: ev.deltaX,
                deltaY: ev.deltaY,
                deltaZ: ev.deltaZ,
                deltaMode: ev.deltaMode,
                clientX: ev.clientX,
                clientY: ev.clientY,
              })
            );
          }, { passive: true });

          this.pinsLayer.appendChild(pinEl);
          this.pinElements.set(pin.id, pinEl);
          this.pinHalfWidths.set(pin.id, Math.ceil(pinEl.getBoundingClientRect().width * 0.5) || Math.ceil(pin.label.length * 4.2 + 22));
        }

        if (!pin.visible) {
          el.style.display = 'none';
          continue;
        }

        const knownHalfW = this.pinHalfWidths.get(pin.id) || Math.ceil(pin.label.length * 4.2 + 22);
        const clampedX = Math.max(knownHalfW + 10, Math.min(vw - knownHalfW - 10, pin.screenX));

        let blocked = false;
        for (let z = 0; z < this.keepOutZones.length; z++) {
          const box = this.keepOutZones[z];
          if (
            clampedX + knownHalfW > box.l &&
            clampedX - knownHalfW < box.r &&
            pin.screenY + 14 > box.t &&
            pin.screenY - 14 < box.b
          ) {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          for (let k = 0; k < placedCount; k++) {
            const off = k * 4;
            if (
              clampedX + knownHalfW + 8 > this.placedPinRects[off] &&
              clampedX - knownHalfW - 8 < this.placedPinRects[off + 2] &&
              pin.screenY + 14 > this.placedPinRects[off + 1] &&
              pin.screenY - 14 < this.placedPinRects[off + 3]
            ) {
              blocked = true;
              break;
            }
          }
        }

        if (blocked) {
          el.style.display = 'none';
          continue;
        }

        el.style.display = 'flex';
        const measuredHalfW = this.pinHalfWidths.get(pin.id) || knownHalfW;
        const finalX = Math.max(measuredHalfW + 10, Math.min(vw - measuredHalfW - 10, pin.screenX));

        if (placedCount * 4 + 3 < this.placedPinRects.length) {
          const rOff = placedCount * 4;
          this.placedPinRects[rOff] = finalX - measuredHalfW;
          this.placedPinRects[rOff + 1] = pin.screenY - 14;
          this.placedPinRects[rOff + 2] = finalX + measuredHalfW;
          this.placedPinRects[rOff + 3] = pin.screenY + 14;
          placedCount++;
        }

        el.style.transform = `translate(${Math.round(finalX)}px, ${Math.round(pin.screenY)}px) translate(-50%, -50%)`;
        el.classList.toggle('selected-pin', isSelected);
      }
    }
  }

  // ===========================================================================
  // REACTIVE SCENE STATE RENDER
  // ===========================================================================
  private renderState(snap: LabSceneSnapshot): void {
    if (snap.isLoaded) {
      this.loadingOverlay.classList.add('fade-out');
      this.loadingOverlay.style.display = 'none';
    } else {
      this.loadingOverlay.style.display = 'flex';
      this.loadingFill.style.width = `${snap.loadingProgress}%`;
      this.loadingText.textContent = snap.loadingItemLabel;
      this.loadingCount.textContent = `${snap.loadingCompletedCount} / ${snap.loadingTotalCount}`;
      this.loadingOverlay.setAttribute('aria-valuenow', String(snap.loadingProgress));
    }

    if (document.activeElement !== this.boneSlider && document.activeElement !== this.mobileBoneSlider) {
      this.syncBoneSliderUI(snap.bonyPeelPercent);
    }
    if (document.activeElement !== this.explodeSlider && document.activeElement !== this.mobileExplodeSlider) {
      this.syncExplodeSliderUI(snap.explodePercent);
    }

    this.presetButtons.forEach((btn, presetId) => {
      btn.classList.toggle('active', snap.activePresetId === presetId);
    });

    if (
      snap.selectedMesh !== this.lastRenderedMesh ||
      snap.readingDepth !== this.lastRenderedDepth
    ) {
      this.lastRenderedMesh = snap.selectedMesh;
      this.lastRenderedDepth = snap.readingDepth;
      this.lastRenderedIsolated = snap.isIsolated;
      this.renderInspectorCard(snap.selectedMesh);

      if (document.activeElement !== this.searchInput) {
        if (snap.selectedMesh) {
          const struct = STRUCTURE_BY_MESH[snap.selectedMesh];
          if (struct) {
            this.searchInput.value = struct.shortLabel;
            this.searchClearBtn.hidden = false;
            this.searchClearBtn.style.display = 'inline-flex';
          }
        } else {
          this.searchInput.value = '';
          this.searchClearBtn.hidden = true;
          this.searchClearBtn.style.display = 'none';
        }
      }
    } else if (snap.isIsolated !== this.lastRenderedIsolated) {
      this.lastRenderedIsolated = snap.isIsolated;
      if (this.btnIsolate) {
        this.btnIsolate.textContent = snap.isIsolated ? 'Show All Parts' : 'Isolate Part';
        this.btnIsolate.classList.toggle('active', snap.isIsolated);
      }
    }

    const partRows = this.root.querySelectorAll<HTMLElement>('.part-row');
    partRows.forEach((row) => {
      const mesh = row.getAttribute('data-mesh');
      if (mesh) {
        row.classList.toggle('selected', snap.selectedMesh === mesh);
        const eyeBtn = row.querySelector<HTMLButtonElement>('.eye-toggle-btn');
        if (eyeBtn) {
          const isHidden = snap.visibilityMap[mesh] === 'hidden';
          eyeBtn.classList.toggle('hidden-state', isHidden);
          eyeBtn.textContent = isHidden ? '🚫' : '👁️';
          eyeBtn.title = isHidden ? 'Show part' : 'Hide part';
        }
      }
    });

    if (snap.labMode !== this.lastRenderedLabMode) {
      this.lastRenderedLabMode = snap.labMode;
      this.appShell?.setAttribute('data-mode', snap.labMode);
      this.modePills.forEach((pill) => {
        const active = pill.dataset.mode === snap.labMode;
        pill.classList.toggle('active', active);
        pill.setAttribute('aria-selected', String(active));
        pill.tabIndex = active ? 0 : -1;
      });
      this.anatomyDockContent.style.display = snap.labMode === 'anatomy' ? 'flex' : 'none';
      this.hearingDockContent.style.display = snap.labMode === 'hearing' ? 'flex' : 'none';
      this.radiologyDockContent.style.display = snap.labMode === 'radiology' ? 'flex' : 'none';
      this.vestibularDockContent.style.display = snap.labMode === 'vestibular' ? 'flex' : 'none';
      this.surgicalDockContent.style.display = snap.labMode === 'surgical' ? 'flex' : 'none';
    }

    if (snap.labMode === 'hearing') {
      this.syncFrequencyUI(snap.hearingState.activeFrequency, true);
      this.updateTonePlayButton(snap.hearingState.isPlaying);
      this.audiogramDrawer.setActiveFrequency(snap.hearingState.activeFrequency);
    }
  }

  public getActiveSurgicalProcedure(): SurgicalProcedure {
    return this.activeSurgProcedure;
  }

  public getIsAboutModalOpen(): boolean {
    return this.aboutModalOpen;
  }

  public getVestSubviews(): HTMLElement[] {
    return this.vestSubviews;
  }
}
