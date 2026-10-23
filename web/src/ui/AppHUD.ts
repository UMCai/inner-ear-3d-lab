import {
  DISSECTION_PRESETS,
  IEMAP_STRUCTURES,
  LAB_PRESETS,
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
  type CIInsertionState,
  type LabyrinthectomyState,
  type NeurectomyState,
} from '../physics/surgicalEngine';
import {
  MANEUVER_PRESETS,
  type ManeuverId,
  type VestibularStepPreset,
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
  CTWindowMode,
  RADIOLOGY_PLANES,
  RADIOLOGY_LANDMARKS,
  SCDS_PARAMETERS,
  getLandmarkForDepth,
} from '../data/radiologyEngine';

export class AppHUD {
  private root: HTMLElement;
  private scene: DualStageScene;
  private canvasHost!: HTMLElement;
  private pinsLayer!: HTMLElement;
  private pinElements = new Map<string, HTMLElement>();

  // Mode Switcher Elements
  private modeAnatomyBtn!: HTMLButtonElement;
  private modeHearingBtn!: HTMLButtonElement;
  private modeRadiologyBtn!: HTMLButtonElement;
  private modeVestibularBtn!: HTMLButtonElement;

  // Header Elements
  private searchInput!: HTMLInputElement;
  private searchClearBtn!: HTMLButtonElement;
  private searchDropdown!: HTMLElement;
  private settingsBtn!: HTMLButtonElement;
  private settingsPopover!: HTMLElement;
  private settingsOpen = false;

  // Floating Inspector Card Elements
  private inspectorCard!: HTMLElement;
  private medDetailsAccordionExpanded = false;

  // Bottom Bar Elements
  private bottomBar!: HTMLElement;
  private anatomyDockContent!: HTMLElement;
  private hearingDockContent!: HTMLElement;
  private radiologyDockContent!: HTMLElement;
  private vestibularDockContent!: HTMLElement;
  private surgicalDockContent!: HTMLElement;
  private modeSurgicalBtn!: HTMLButtonElement;
  private surgicalDrawer!: SurgicalDrawer;

  // Surgical Workbench Controls
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

  // Anatomy Dock Controls
  private boneSlider!: HTMLInputElement;
  private boneValEl!: HTMLElement;
  private explodeSlider!: HTMLInputElement;
  private explodeValEl!: HTMLElement;
  private presetButtons = new Map<string, HTMLButtonElement>();
  private partsToggleBtn!: HTMLButtonElement;
  private partsDrawer!: HTMLElement;
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
  private aboutModal!: HTMLElement;
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
    medDetailsOpen: 'gate3_med_details_open',
    partsDrawerOpen: 'gate3_parts_drawer_open',
  };

  constructor(root: HTMLElement) {
    this.root = root;
    this.loadSavedPreferences();
    this.buildDOM();
    this.scene = new DualStageScene(this.canvasHost);
    this.scene.setVORDrawer(this.vorDrawer);
    this.scene.setSurgicalDrawer(this.surgicalDrawer);
    this.renderPartsTree();

    this.scene.onStateChange((snap) => this.renderState(snap));
    this.scene.onPinsUpdate((pins) => this.renderProjectedPins(pins));
    this.scene.onStructurePicked((meshName) => this.handleStructurePicked(meshName));
    this.scene.onHearingToneRequest((freqHz) => {
      if (this.toneSynth.getIsPlaying()) {
        this.toneSynth.setFrequency(freqHz);
      }
      this.audiogramDrawer.setActiveFrequency(freqHz);
      this.syncFrequencyUI(freqHz, true);
    });

    window.addEventListener('resize', () => {
      // Recompute responsive pin boundaries on window resize
    });
  }

  public async init(): Promise<void> {
    this.scene.startRenderLoop();
    await this.scene.loadAllAssets();
    this.scene.setOverlays({
      labelMode: this.activeLabelMode,
      readingDepth: this.activeReadingDepth,
    });
    this.renderState(this.scene.getSnapshot());
  }

  private loadSavedPreferences(): void {
    try {
      const savedLabel = localStorage.getItem(AppHUD.STORAGE_KEYS.labelMode);
      if (savedLabel === 'off' || savedLabel === 'key' || savedLabel === 'all') {
        this.activeLabelMode = savedLabel;
      }
      const savedDepth = localStorage.getItem(AppHUD.STORAGE_KEYS.readingDepth);
      if (savedDepth === 'simple' || savedDepth === 'detailed') {
        this.activeReadingDepth = savedDepth;
      }
      this.medDetailsAccordionExpanded =
        localStorage.getItem(AppHUD.STORAGE_KEYS.medDetailsOpen) === 'true';
      this.partsDrawerOpen =
        localStorage.getItem(AppHUD.STORAGE_KEYS.partsDrawerOpen) === 'true';
    } catch {
      // Ignore localStorage errors in private browsing
    }
  }

  private buildDOM(): void {
    this.root.innerHTML = `
      <div class="lab-shell">
        <!-- 1. FULL-SCREEN 3D CANVAS & PINS LAYER -->
        <main class="canvas-host" id="canvas-host">
          <div class="pins-layer" id="pins-layer" aria-hidden="true"></div>
        </main>

        <!-- 2. MINIMAL TOP HEADER -->
        <header class="lab-header" role="banner">
          <div class="brand-cluster">
            <span class="brand-badge">IE-MAP 3D</span>
            <div class="title-group">
              <h1 class="brand-title">Inner Ear 3D Lab</h1>
              <span class="brand-sub">27-Part Anatomy Atlas</span>
            </div>
          </div>

          <!-- Lab Mode Switcher -->
          <nav class="mode-switcher" role="tablist" aria-label="Lab Modes">
            <button
              type="button"
              class="mode-pill active"
              id="mode-anatomy-btn"
              role="tab"
              aria-selected="true"
              aria-controls="anatomy-dock-content"
              title="3D Anatomy Atlas (27 Parts)"
            >
              <span class="mode-icon">🏛️</span>
              <span class="mode-label">Anatomy Atlas</span>
            </button>
            <button
              type="button"
              class="mode-pill"
              id="mode-hearing-btn"
              role="tab"
              aria-selected="false"
              aria-controls="hearing-dock-content"
              title="Tonotopy & Hearing Lab (Georg von Békésy Wave)"
            >
              <span class="mode-icon">🎵</span>
              <span class="mode-label">Hearing &amp; Tonotopy</span>
            </button>
            <button
              type="button"
              class="mode-pill"
              id="mode-radiology-btn"
              role="tab"
              aria-selected="false"
              aria-controls="radiology-dock-content"
              title="Virtual Temporal Bone Radiology &amp; SCDS Simulation"
            >
              <span class="mode-icon">🩻</span>
              <span class="mode-label">Virtual Radiology</span>
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
              <span class="mode-icon">🌀</span>
              <span class="mode-label">Vestibular &amp; VOR</span>
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
              <span class="mode-icon">🔬</span>
              <span class="mode-label">Surgical Suites</span>
            </button>
          </nav>

          <!-- Quick Search Bar -->
          <div class="search-container">
            <div class="search-input-shell">
              <span class="search-icon" aria-hidden="true">🔍</span>
              <input
                type="text"
                class="search-input"
                id="search-input"
                placeholder="Find an ear part..."
                aria-label="Find an ear part"
                autocomplete="off"
                spellcheck="false"
              />
              <button
                type="button"
                class="search-clear-btn"
                id="search-clear-btn"
                aria-label="Clear search"
                style="display: none;"
              >✕</button>
            </div>
            <div class="search-dropdown" id="search-dropdown" role="listbox"></div>
          </div>

          <!-- Header Controls: Single Settings Button -->
          <div class="header-actions">
            <button
              type="button"
              class="header-icon-btn"
              id="settings-btn"
              title="Settings & Lab Options"
              aria-label="Settings"
              aria-expanded="false"
            >⚙️</button>

            <!-- Settings Popover Menu -->
            <div class="settings-popover" id="settings-popover" role="dialog" aria-label="Settings Menu">
              <div class="popover-header">
                <h3>Settings &amp; Options</h3>
                <button type="button" class="popover-close-btn" id="popover-close-btn" aria-label="Close settings">✕</button>
              </div>

              <!-- 3D Label Density Segmented Control -->
              <div class="popover-section">
                <label class="popover-label" id="label-mode-heading">3D Part Labels</label>
                <div class="segmented-control" role="group" aria-labelledby="label-mode-heading">
                  <button type="button" class="segment-btn ${this.activeLabelMode === 'off' ? 'active' : ''}" data-label-mode="off">Off</button>
                  <button type="button" class="segment-btn ${this.activeLabelMode === 'key' ? 'active' : ''}" data-label-mode="key">Key</button>
                  <button type="button" class="segment-btn ${this.activeLabelMode === 'all' ? 'active' : ''}" data-label-mode="all">All</button>
                </div>
              </div>

              <!-- Reading Depth Segmented Control -->
              <div class="popover-section">
                <label class="popover-label" id="reading-depth-heading">Reading Depth</label>
                <div class="segmented-control" role="group" aria-labelledby="reading-depth-heading">
                  <button type="button" class="segment-btn ${this.activeReadingDepth === 'simple' ? 'active' : ''}" data-reading-depth="simple">Simple</button>
                  <button type="button" class="segment-btn ${this.activeReadingDepth === 'detailed' ? 'active' : ''}" data-reading-depth="detailed">Detailed</button>
                </div>
              </div>

              <div class="popover-divider"></div>

              <!-- About & Citations Trigger -->
              <div class="popover-section">
                <button type="button" class="popover-action-btn" id="about-open-btn">
                  <span class="btn-icon">ℹ️</span>
                  <span>About &amp; Citations</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <!-- 3. FLOATING PART INSPECTOR CARD -->
        <aside class="inspector-card" id="inspector-card" aria-label="Structure Inspector"></aside>

        <!-- 4. COMPACT BOTTOM VISUALIZATION BAR / WORKBENCH -->
        <nav class="bottom-viz-bar" id="bottom-bar" aria-label="Visualization Controls">
          <!-- 4A. Anatomy Dock Content -->
          <div class="anatomy-dock-content" id="anatomy-dock-content">
            <!-- 4 Guided Presets -->
            <div class="preset-group" role="group" aria-label="Guided Anatomy Presets">
              <button type="button" class="preset-btn active" data-preset="overview" title="Full 27-part inner ear labyrinth">
                <span class="preset-icon">🌐</span>
                <span class="preset-label">Overview</span>
              </button>
              <button type="button" class="preset-btn" data-preset="balance_system" title="3 Semicircular canals and vestibule">
                <span class="preset-icon">⚖️</span>
                <span class="preset-label">Balance System</span>
              </button>
              <button type="button" class="preset-btn" data-preset="hearing_snail" title="Cochlea and internal scala chambers">
                <span class="preset-icon">🐚</span>
                <span class="preset-label">Hearing Snail</span>
              </button>
              <button type="button" class="preset-btn" data-preset="exploded_view" title="Radial separation of all 27 parts">
                <span class="preset-icon">💥</span>
                <span class="preset-label">Exploded View</span>
              </button>
            </div>

            <!-- 2 Visual Sliders -->
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

            <!-- Collapsible 27 Parts Toggle -->
            <div class="parts-toggle-wrap">
              <button
                type="button"
                class="parts-toggle-btn ${this.partsDrawerOpen ? 'open' : ''}"
                id="parts-toggle-btn"
                aria-expanded="${this.partsDrawerOpen ? 'true' : 'false'}"
                aria-controls="parts-drawer"
              >
                <span class="toggle-arrow" aria-hidden="true">${this.partsDrawerOpen ? '▾' : '▸'}</span>
                <span class="toggle-text">Browse All 27 Parts</span>
                <span class="parts-badge">27</span>
              </button>
            </div>
          </div>

          <!-- 4B. Hearing Workbench Dock Content -->
          <div class="hearing-dock-content" id="hearing-dock-content" style="display: none;">
            <!-- Play / Pause Pure-Tone Button -->
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

            <!-- Logarithmic Frequency Slider & Metric Readout -->
            <div class="hearing-slider-wrap">
              <div class="hearing-slider-header">
                <span class="hearing-slider-title">Stimulus Frequency</span>
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

            <!-- Standard Audiometric Octave Chips -->
            <div class="octave-chips-group" role="group" aria-label="Audiometric Octave Steps">
              <button type="button" class="octave-chip" data-octave="125">125</button>
              <button type="button" class="octave-chip" data-octave="250">250</button>
              <button type="button" class="octave-chip" data-octave="500">500</button>
              <button type="button" class="octave-chip active" data-octave="1000">1k</button>
              <button type="button" class="octave-chip" data-octave="2000">2k</button>
              <button type="button" class="octave-chip" data-octave="4000">4k</button>
              <button type="button" class="octave-chip" data-octave="8000">8k</button>
            </div>

            <!-- Clinical Audiogram Drawer Toggle Button -->
            <button
              type="button"
              class="audiogram-toggle-btn"
              id="audiogram-toggle-btn"
              aria-expanded="false"
              aria-controls="audiogram-drawer"
              title="Open Clinical Pure-Tone Audiogram Drawer"
            >
              <span class="audiogram-icon">📊</span>
              <span class="audiogram-label">Audiogram</span>
              <span class="audiogram-arrow" id="audiogram-arrow">▸</span>
            </button>
          </div>

          <!-- 4C. Radiology Workbench Dock Content -->
          <div class="radiology-dock-content" id="radiology-dock-content" style="display: none;">
            <!-- 4 Canonical Plane Selection Chips -->
            <div class="radiology-plane-group" id="rad-plane-chips" role="group" aria-label="Radiological Slicing Planes">
              <button type="button" class="plane-chip active" data-plane="poschl" title="Pöschl's Oblique Sagittal (Parallel to SSC)">
                <span class="chip-icon">📐</span>
                <span class="chip-label">Pöschl (SSCD)</span>
              </button>
              <button type="button" class="plane-chip" data-plane="stenvers" title="Stenvers' Oblique Coronal (Perpendicular to SSC)">
                <span class="chip-icon">📐</span>
                <span class="chip-label">Stenvers (Arch)</span>
              </button>
              <button type="button" class="plane-chip" data-plane="axial" title="True Axial Transverse MPR (Lateral Canal Signet Ring)">
                <span class="chip-icon">📐</span>
                <span class="chip-label">True Axial</span>
              </button>
              <button type="button" class="plane-chip" data-plane="coronal" title="True Coronal Frontal MPR (Cochlear Modiolus 2.5 Turns)">
                <span class="chip-icon">📐</span>
                <span class="chip-label">True Coronal</span>
              </button>
            </div>

            <!-- Continuous Depth Slider & Live Landmark Badge -->
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

            <!-- Action & Scenario Buttons -->
            <div class="radiology-actions-group">
              <button
                type="button"
                class="rad-action-btn"
                id="rad-flip-btn"
                title="Invert clipping half-space normal direction"
              >
                <span class="rad-btn-icon">⇄</span>
                <span class="rad-btn-text">Flip Cut</span>
              </button>

              <button
                type="button"
                class="rad-action-btn active"
                id="rad-guide-btn"
                title="Toggle 3D semi-transparent cutting plane quad"
              >
                <span class="rad-btn-icon">📐</span>
                <span class="rad-btn-text">Guide Plane</span>
              </button>

              <button
                type="button"
                class="rad-action-btn scds-toggle-btn"
                id="rad-scds-toggle-btn"
                title="Toggle Superior Canal Dehiscence Syndrome (1.5 mm apical defect &amp; third-window leak)"
              >
                <span class="rad-btn-icon">⚡</span>
                <span class="rad-btn-text">SCDS Defect</span>
              </button>

              <button
                type="button"
                class="rad-action-btn ct-card-toggle-btn"
                id="rad-ct-toggle-btn"
                title="Toggle Synchronized 2D CT MPR Slice Drawer"
              >
                <span class="rad-btn-icon">🩻</span>
                <span class="rad-btn-text">2D CT Card</span>
                <span class="ct-card-arrow" id="ct-card-arrow">▸</span>
              </button>
            </div>
          </div>

          <!-- 4D. Vestibular & VOR Workbench Dock Content -->
          <div class="vestibular-dock-content" id="vestibular-dock-content" style="display: none;">
            <!-- Subnav Bar: Switch between BPPV Maneuvers, Caloric (COWS), and vHIT -->
            <div class="vest-subnav-bar" id="vest-subnav-bar" role="tablist" aria-label="Diagnostic Vestibular Modalities">
              <button type="button" class="vest-subnav-tab active" data-submode="bppv" id="vest-subnav-bppv">🌀 BPPV Maneuvers</button>
              <button type="button" class="vest-subnav-tab" data-submode="caloric" id="vest-subnav-caloric">🌡️ Caloric (COWS)</button>
              <button type="button" class="vest-subnav-tab" data-submode="vhit" id="vest-subnav-vhit">⚡ vHIT Test</button>
            </div>

            <!-- Subview 1: BPPV Maneuvers (Existing BPPV Controls) -->
            <div class="vest-subview vest-bppv-subview" id="vest-bppv-subview" style="display: flex;">
              <!-- 1. Protocol Selector Chips (Grouped by Canal) -->
              <div class="vestibular-protocol-group" id="vest-protocol-chips" role="group" aria-label="BPPV Clinical Protocols">
                <button type="button" class="protocol-chip active" data-maneuver="epley" title="Epley Maneuver (Posterior Canal Canalithiasis - 5 Steps)">
                  <span class="chip-badge">Post</span>
                  <span class="chip-label">Epley (5s)</span>
                </button>
                <button type="button" class="protocol-chip" data-maneuver="semont" title="Semont Liberatory Maneuver (Posterior Canal - 3 Steps)">
                  <span class="chip-badge">Post</span>
                  <span class="chip-label">Semont (3s)</span>
                </button>
                <button type="button" class="protocol-chip" data-maneuver="gufoni_geotropic" title="Gufoni Maneuver (Horizontal Canal Geotropic - 4 Steps)">
                  <span class="chip-badge">Horiz</span>
                  <span class="chip-label">Gufoni Geo</span>
                </button>
                <button type="button" class="protocol-chip" data-maneuver="gufoni_apogeotropic" title="Gufoni Maneuver (Horizontal Canal Apogeotropic - 4 Steps)">
                  <span class="chip-badge">Horiz</span>
                  <span class="chip-label">Gufoni Apo</span>
                </button>
                <button type="button" class="protocol-chip" data-maneuver="barbecue_roll" title="Lempert 360° Barbecue Roll (Horizontal Canal - 5 Steps)">
                  <span class="chip-badge">Horiz</span>
                  <span class="chip-label">Barbecue 360°</span>
                </button>
                <button type="button" class="protocol-chip" data-maneuver="yacovino" title="Yacovino Maneuver (Anterior Canal - 4 Steps)">
                  <span class="chip-badge">Ant</span>
                  <span class="chip-label">Yacovino (4s)</span>
                </button>
              </div>

              <!-- 2. Timeline Step Scrubber & Sequence Controls -->
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

              <!-- 3. Actions & Modals: 3-Axis Gyro, Reset, VOR Eyes Toggle -->
              <div class="vestibular-actions-group">
                <button
                  type="button"
                  class="vest-action-btn gyro-toggle-btn"
                  id="vest-gyro-toggle-btn"
                  title="Toggle Interactive 3-Axis Head Gyro Sliders"
                  aria-expanded="false"
                >
                  <span class="vest-btn-icon">🕹️</span>
                  <span class="vest-btn-text">Head Gyro</span>
                </button>

                <button
                  type="button"
                  class="vest-action-btn reset-crystals-btn"
                  id="vest-reset-btn"
                  title="Reset Otoconia to Initial Cupular Resting Position"
                >
                  <span class="vest-btn-icon">⚡</span>
                  <span class="vest-btn-text">Reset</span>
                </button>

                <button
                  type="button"
                  class="vest-action-btn vor-toggle-btn"
                  id="vest-vor-toggle-btn"
                  title="Toggle Docked 3D VOR Eye Avatar &amp; Clinical VNG Drawer"
                  aria-expanded="false"
                  aria-controls="vor-drawer"
                >
                  <span class="vest-btn-icon">👁️</span>
                  <span class="vest-btn-text">VOR Eyes</span>
                  <span class="vor-arrow" id="vor-arrow">▸</span>
                </button>
              </div>
            </div>

            <!-- Subview 2: Caloric Testing Suite (COWS & Alexander's Law) -->
            <div class="vest-subview vest-caloric-subview" id="vest-caloric-subview" style="display: none;">
              <!-- 1. Irrigation Ear & Temperature Selector -->
              <div class="vestibular-protocol-group" id="caloric-temp-chips" role="group" aria-label="Caloric Irrigations">
                <button type="button" class="caloric-chip active" data-caloric-temp="R44" title="Right Warm 44°C (Ampullopetal excitation -> Fast phase Right/Same)">
                  <span class="chip-badge warm">🔴 Warm</span>
                  <span class="chip-label">R 44°C</span>
                </button>
                <button type="button" class="caloric-chip" data-caloric-temp="R30" title="Right Cold 30°C (Ampullofugal inhibition -> Fast phase Left/Opposite)">
                  <span class="chip-badge cold">🔵 Cold</span>
                  <span class="chip-label">R 30°C</span>
                </button>
                <button type="button" class="caloric-chip" data-caloric-temp="L44" title="Left Warm 44°C (Ampullopetal excitation -> Fast phase Left/Same)">
                  <span class="chip-badge warm">🔴 Warm</span>
                  <span class="chip-label">L 44°C</span>
                </button>
                <button type="button" class="caloric-chip" data-caloric-temp="L30" title="Left Cold 30°C (Ampullofugal inhibition -> Fast phase Right/Opposite)">
                  <span class="chip-badge cold">🔵 Cold</span>
                  <span class="chip-label">L 30°C</span>
                </button>
                <button type="button" class="caloric-chip" data-caloric-temp="Ice4" title="Ice Water 4°C (Severe hypofunction / areflexia confirmation)">
                  <span class="chip-badge ice">🧊 Ice</span>
                  <span class="chip-label">Ice 4°C</span>
                </button>
              </div>

              <!-- 2. Caloric Posture, Irrigation Controls & Timeline -->
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
                  <button type="button" class="vest-action-btn posture-btn" id="caloric-posture-btn" title="Align to Supine +30° Head Up Posture (θ=60°)">
                    <span class="vest-btn-icon">🛏️</span>
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

              <!-- 3. Actions: Jongkees Matrix, Laterality Badge, VOR Toggle -->
              <div class="vestibular-actions-group">
                <span class="caloric-laterality-tag" id="caloric-laterality-badge">Right Ear (Ipsilateral)</span>
                <button
                  type="button"
                  class="vest-action-btn"
                  id="caloric-jongkees-open-btn"
                  title="Open Interactive Jongkees Bithermal Matrix Calculator"
                >
                  <span class="vest-btn-icon">📊</span>
                  <span class="vest-btn-text">Jongkees</span>
                </button>
                <button
                  type="button"
                  class="vest-action-btn vor-toggle-btn"
                  id="caloric-vor-toggle-btn"
                  title="Toggle Docked 3D VOR Eye Avatar &amp; Clinical VNG Drawer"
                  aria-expanded="false"
                  aria-controls="vor-drawer"
                >
                  <span class="vest-btn-icon">👁️</span>
                  <span class="vest-btn-text">VOR Eyes</span>
                  <span class="vor-arrow" id="caloric-vor-arrow">▸</span>
                </button>
              </div>
            </div>

            <!-- Subview 3: Video Head Impulse Test (vHIT) -->
            <div class="vest-subview vest-vhit-subview" id="vest-vhit-subview" style="display: none;">
              <!-- 1. Canal Pair Selector Chips & Thrust Direction -->
              <div class="vestibular-protocol-group" id="vhit-pair-chips" role="group" aria-label="vHIT Canal Pairs">
                <button type="button" class="vhit-pair-chip active" data-vhit-pair="horizontal" title="Horizontal Semicircular Canals (Yaw Impulse)">
                  <span class="chip-badge">Yaw</span>
                  <span class="chip-label">Horizontal</span>
                </button>
                <button type="button" class="vhit-pair-chip" data-vhit-pair="ralp" title="Right Anterior / Left Posterior (Pitch/Roll +45°)">
                  <span class="chip-badge">Ant/Post</span>
                  <span class="chip-label">RALP (+45°)</span>
                </button>
                <button type="button" class="vhit-pair-chip" data-vhit-pair="larp" title="Left Anterior / Right Posterior (Pitch/Roll -45°)">
                  <span class="chip-badge">Ant/Post</span>
                  <span class="chip-label">LARP (-45°)</span>
                </button>
                <button type="button" class="timeline-btn vhit-dir-btn" id="vhit-dir-left-btn" data-vhit-dir="-1" title="Thrust Head Left">◀ Thrust L</button>
                <button type="button" class="timeline-btn vhit-dir-btn active" id="vhit-dir-right-btn" data-vhit-dir="1" title="Thrust Head Right">Thrust R ▶</button>
              </div>

              <!-- 2. Pathology Presets & Paradigm -->
              <div class="vestibular-timeline-wrap">
                <div class="timeline-header">
                  <span class="timeline-title" id="vhit-status-title">High-Acceleration Head Impulse (15°, 120ms)</span>
                  <div class="timeline-meta-cluster">
                    <span class="hold-timer-badge" id="vhit-gain-badge">Gain: 1.00</span>
                    <span class="clearance-badge" id="vhit-saccade-badge">Normal (No Saccades)</span>
                  </div>
                </div>
                <div class="timeline-slider-row vhit-presets-row">
                  <button type="button" class="vhit-preset-chip active" data-vhit-preset="normal">Normal</button>
                  <button type="button" class="vhit-preset-chip" data-vhit-preset="acute_neuritis">Acute Neuritis</button>
                  <button type="button" class="vhit-preset-chip" data-vhit-preset="chronic_schwannoma">Schwannoma</button>
                  <button type="button" class="vhit-preset-chip" data-vhit-preset="bilateral_loss">Bilateral Loss</button>
                  <button type="button" class="vhit-toggle-btn" id="vhit-paradigm-toggle-btn" title="Toggle HIMP (Earth-Fixed) vs SHIMP (Head-Fixed)">HIMP</button>
                  <button type="button" class="vhit-toggle-btn" id="vhit-slippage-toggle-btn" title="Toggle Goggle Slippage Artifact">Slippage: Off</button>
                </div>
              </div>

              <!-- 3. Actions: Deliver Thrust & VOR Drawer -->
              <div class="vestibular-actions-group">
                <button
                  type="button"
                  class="vest-action-btn vhit-deliver-thrust-btn"
                  id="vhit-deliver-thrust-btn"
                  title="Deliver 15° 120ms High-Acceleration Passive Head Impulse Thrust"
                >
                  <span class="vest-btn-icon">⚡</span>
                  <span class="vest-btn-text">Deliver Thrust</span>
                </button>
                <button
                  type="button"
                  class="vest-action-btn vor-toggle-btn"
                  id="vhit-vor-toggle-btn"
                  title="Toggle Docked 3D VOR Eye Avatar &amp; Clinical VNG Drawer"
                  aria-expanded="false"
                  aria-controls="vor-drawer"
                >
                  <span class="vest-btn-icon">👁️</span>
                  <span class="vest-btn-text">VOR Eyes</span>
                  <span class="vor-arrow" id="vhit-vor-arrow">▸</span>
                </button>
              </div>
            </div>
          </div>

          <!-- 4E. Surgical Suites Workbench Dock Content -->
          <div class="surgical-dock-content" id="surgical-dock-content" style="display: none;">
            <!-- Subnav: CI vs Labyrinthectomy vs Neurectomy -->
            <div class="surg-subnav-bar" id="surg-subnav-bar" role="tablist" aria-label="Surgical Procedures">
              <button type="button" class="surg-subnav-tab active" data-submode="ci" id="surg-subnav-ci">🦻 Cochlear Implant</button>
              <button type="button" class="surg-subnav-tab" data-submode="labyrinthectomy" id="surg-subnav-laby">🪚 Transmastoid Labyrinthectomy</button>
              <button type="button" class="surg-subnav-tab" data-submode="neurectomy" id="surg-subnav-neurectomy">🧠 Retrosigmoid Neurectomy &amp; CPA</button>
            </div>

            <!-- Subview 1: Cochlear Implant (CI) -->
            <div class="surg-subview surg-ci-subview" id="surg-ci-subview" style="display: flex;">
              <div class="surg-chip-group" role="group" aria-label="CI Hardware &amp; Approach">
                <button type="button" class="surg-chip active" id="ci-approach-rw" data-approach="round_window" title="Atraumatic Round Window Membrane Approach">
                  <span class="chip-badge">Approach</span>
                  <span class="chip-label">🎯 Round Window</span>
                </button>
                <button type="button" class="surg-chip" id="ci-approach-coch" data-approach="cochleostomy" title="Anteroinferior Cochleostomy Approach (1mm to RW)">
                  <span class="chip-badge">Approach</span>
                  <span class="chip-label">⚙️ Cochleostomy</span>
                </button>
                <button type="button" class="surg-chip active" id="ci-array-lateral" data-array="lateral_wall" title="Flexible Straight Lateral Wall Array (28mm)">
                  <span class="chip-badge">Array</span>
                  <span class="chip-label">〰️ Lateral Wall</span>
                </button>
                <button type="button" class="surg-chip" id="ci-array-peri" data-array="perimodiolar" title="Pre-Curved Perimodiolar AOS Array (21mm)">
                  <span class="chip-badge">Array</span>
                  <span class="chip-label">🌀 Perimodiolar</span>
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
                <button
                  type="button"
                  class="vest-action-btn surg-drawer-toggle-btn"
                  id="ci-drawer-toggle-btn"
                  title="Toggle Docked Surgical Endoscopy &amp; Biotelemetry Drawer"
                  aria-expanded="false"
                  aria-controls="surgical-drawer"
                >
                  <span class="vest-btn-icon">🔬</span>
                  <span class="vest-btn-text">Monitor</span>
                  <span class="surg-arrow" id="ci-surg-arrow">▸</span>
                </button>
              </div>
            </div>

            <!-- Subview 2: Transmastoid Labyrinthectomy -->
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
                  <button type="button" class="vest-action-btn drill-btn" id="laby-drill-toggle-btn" title="Toggle Otologic Drill (70,000 RPM &amp; Audio Whine)">
                    <span class="vest-btn-icon">🪚</span>
                    <span class="vest-btn-text" id="laby-drill-text">Drill: On</span>
                  </button>
                  <div class="compensation-row">
                    <label class="ci-mini-lbl">Comp Time: <span id="laby-comp-val">0h (Acute)</span></label>
                    <input type="range" class="surgical-slider" id="laby-comp-slider" min="0" max="720" value="0" step="6" title="Central Vestibular Compensation Hours (0 to 720h)" />
                  </div>
                  <button type="button" class="vest-action-btn ablate-btn" id="laby-ablate-all-btn" title="Complete Acute Deafferentation of all 5 Balance End-Organs">
                    <span class="vest-btn-icon">⚡</span>
                    <span class="vest-btn-text">Ablate All</span>
                  </button>
                </div>
              </div>

              <div class="surg-actions-group">
                <button
                  type="button"
                  class="vest-action-btn surg-drawer-toggle-btn"
                  id="laby-drawer-toggle-btn"
                  title="Toggle Docked Surgical Drawer"
                  aria-expanded="false"
                  aria-controls="surgical-drawer"
                >
                  <span class="vest-btn-icon">🔬</span>
                  <span class="vest-btn-text">Monitor</span>
                  <span class="surg-arrow" id="laby-surg-arrow">▸</span>
                </button>
              </div>
            </div>

            <!-- Subview 3: Retrosigmoid Neurectomy & CPA -->
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
                    <button type="button" class="surg-tool-btn active" data-tool="scissors" title="Micro-Scissors">✂️ Scissors</button>
                    <button type="button" class="surg-tool-btn" data-tool="hook" title="Nerve Hook">🪝 Hook</button>
                    <button type="button" class="surg-tool-btn" data-tool="bipolar" title="Bipolar Coagulation">⚡ Bipolar</button>
                  </div>
                  <div class="koos-row">
                    <label class="ci-mini-lbl">Koos: <span id="neurectomy-koos-val">Stage 0</span></label>
                    <input type="range" class="mini-slider" id="neurectomy-koos-slider" min="0" max="4" value="0" step="1" title="Acoustic Neuroma Koos Staging (0 to IV)" />
                  </div>
                  <button type="button" class="vest-action-btn" id="neurectomy-cleavage-btn" title="Toggle Cleavage Plane Highlight">
                    <span class="vest-btn-icon">📐</span>
                    <span class="vest-btn-text">Cleavage</span>
                  </button>
                </div>
              </div>

              <div class="surg-actions-group">
                <button
                  type="button"
                  class="vest-action-btn surg-drawer-toggle-btn"
                  id="neurectomy-drawer-toggle-btn"
                  title="Toggle Docked Surgical Drawer"
                  aria-expanded="false"
                  aria-controls="surgical-drawer"
                >
                  <span class="vest-btn-icon">🔬</span>
                  <span class="vest-btn-text">Monitor</span>
                  <span class="surg-arrow" id="neurectomy-surg-arrow">▸</span>
                </button>
              </div>
            </div>
          </div>
        </nav>

        <!-- 4. Interactive 3-Axis Head Gyro Flyout Panel -->
        <div class="gyro-flyout" id="gyro-flyout" style="display: none;" role="region" aria-label="3-Axis Head Orientation Gyro">
          <div class="gyro-header">
            <span class="gyro-title">3-DOF Head Orientation</span>
            <button type="button" class="gyro-close-btn" id="gyro-close-btn" aria-label="Close Gyro Controls">✕</button>
          </div>
          <div class="gyro-controls-body">
            <!-- Yaw Slider: -180° to +180° -->
            <div class="gyro-slider-row">
              <span class="gyro-axis-label">Yaw (ψ):</span>
              <input type="range" class="gyro-slider" id="gyro-yaw-slider" min="-180" max="180" value="0" />
              <span class="gyro-val-badge" id="gyro-yaw-val">0°</span>
            </div>
            <!-- Pitch / Recline Slider: -30° to +120° -->
            <div class="gyro-slider-row">
              <span class="gyro-axis-label">Pitch (θ):</span>
              <input type="range" class="gyro-slider" id="gyro-pitch-slider" min="-30" max="120" value="0" />
              <span class="gyro-val-badge" id="gyro-pitch-val">0°</span>
            </div>
            <!-- Roll Slider: -90° to +90° -->
            <div class="gyro-slider-row">
              <span class="gyro-axis-label">Roll (γ):</span>
              <input type="range" class="gyro-slider" id="gyro-roll-slider" min="-90" max="90" value="0" />
              <span class="gyro-val-badge" id="gyro-roll-val">0°</span>
            </div>
          </div>
        </div>

        <!-- Collapsible 27 Parts Drawer -->
        <div class="parts-drawer ${this.partsDrawerOpen ? 'open' : ''}" id="parts-drawer" role="region" aria-label="Anatomical Parts List">
          <div class="parts-drawer-header">
            <h2 class="parts-drawer-title">All 27 Anatomical Structures</h2>
            <button type="button" class="drawer-close-btn" id="drawer-close-btn" aria-label="Close parts list">✕</button>
          </div>
          <div class="parts-tree-body" id="parts-tree-body"></div>
        </div>

        <!-- 5. ABOUT & CITATIONS MODAL -->
        <div class="modal-backdrop" id="about-modal" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="about-title">
          <div class="modal-card">
            <div class="modal-header">
              <h2 id="about-title">About Inner Ear 3D Lab</h2>
              <button type="button" class="modal-close-btn" id="about-close-btn" aria-label="Close dialog">✕</button>
            </div>
            <div class="modal-body">
              <div class="disclaimer-callout">
                <span class="callout-icon">⚖️</span>
                <p><strong>Educational &amp; Research Atlas:</strong> This 3D laboratory is created exclusively for anatomical education and research visualization. It does not provide medical diagnosis, clinical triage, or patient treatment advice.</p>
              </div>

              <h3>Anatomical Dataset Sources &amp; Citations</h3>
              <ul class="citation-list">
                <li>
                  <strong>IE-Map v1.0.0:</strong> High-resolution micro-CT &amp; T2 MRI Otsu segmentations of the human inner ear labyrinth and petrous temporal bone.
                </li>
                <li>
                  <strong>David et al. (Morphometry):</strong> Co-planar stereotaxic alignment of anterior, posterior, and lateral semicircular canals and cochlear scala chambers in Right Anterior Superior (RAS) anatomical coordinates.
                </li>
                <li>
                  <strong>Vestibular Physiology:</strong> Ewald's Laws of semicircular canal cupular displacement, ampullofugal/ampullopetal flow dynamics, and CN VIII innervation mapping.
                </li>
              </ul>

              <div class="modal-footer-info">
                <span>Version: MVP 1.0.0</span>
                <span>Render Engine: Three.js Single-Stage WebGL (60fps)</span>
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" class="modal-confirm-btn" id="about-confirm-btn">Close</button>
            </div>
        <!-- 5B. CALORIC JONGKEES BITHERMAL MATRIX MODAL -->
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

              <!-- Clinical Presets -->
              <div class="jongkees-presets-row" role="group" aria-label="Clinical Presets">
                <span class="jongkees-lbl">Presets:</span>
                <button type="button" class="jongkees-preset-btn active" data-preset="normal">Normal</button>
                <button type="button" class="jongkees-preset-btn" data-preset="right_uw">Right Paresis (70%)</button>
                <button type="button" class="jongkees-preset-btn" data-preset="left_uw">Left Paresis (51%)</button>
                <button type="button" class="jongkees-preset-btn" data-preset="dp_right">DP Right (48%)</button>
                <button type="button" class="jongkees-preset-btn" data-preset="bilateral">Bilateral Loss</button>
              </div>

              <!-- 4-Ear SPV Inputs Grid -->
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

              <!-- Calculated Results & Interpretation -->
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

        <!-- 6. HIGH-PERFORMANCE INITIAL LOADING OVERLAY -->
        <div class="loading-overlay" id="loading-overlay" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
          <div class="loading-panel">
            <div class="loading-brand">
              <span class="brand-badge">IE-MAP 3D</span>
              <h2>Inner Ear 3D Lab</h2>
            </div>
            <p class="loading-desc">Loading 27 high-resolution anatomical structures...</p>
            <div class="loading-bar-track">
              <div class="loading-bar-fill" id="loading-fill" style="width: 0%;"></div>
            </div>
            <div class="loading-status-row">
              <span class="loading-status-text" id="loading-status-text">Initializing WebGL Engine...</span>
              <span class="loading-count-text" id="loading-count-text">0 / 27</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindDOMReferences();
    this.attachEventListeners();
  }

  private bindDOMReferences(): void {
    this.canvasHost = this.root.querySelector('#canvas-host') as HTMLElement;
    this.pinsLayer = this.root.querySelector('#pins-layer') as HTMLElement;
    this.modeAnatomyBtn = this.root.querySelector('#mode-anatomy-btn') as HTMLButtonElement;
    this.modeHearingBtn = this.root.querySelector('#mode-hearing-btn') as HTMLButtonElement;
    this.modeRadiologyBtn = this.root.querySelector('#mode-radiology-btn') as HTMLButtonElement;
    this.searchInput = this.root.querySelector('#search-input') as HTMLInputElement;
    this.searchClearBtn = this.root.querySelector('#search-clear-btn') as HTMLButtonElement;
    this.searchDropdown = this.root.querySelector('#search-dropdown') as HTMLElement;
    this.settingsBtn = this.root.querySelector('#settings-btn') as HTMLButtonElement;
    this.settingsPopover = this.root.querySelector('#settings-popover') as HTMLElement;
    this.inspectorCard = this.root.querySelector('#inspector-card') as HTMLElement;
    this.bottomBar = this.root.querySelector('#bottom-bar') as HTMLElement;
    this.anatomyDockContent = this.root.querySelector('#anatomy-dock-content') as HTMLElement;
    this.hearingDockContent = this.root.querySelector('#hearing-dock-content') as HTMLElement;
    this.radiologyDockContent = this.root.querySelector('#radiology-dock-content') as HTMLElement;

    // Anatomy Controls
    this.boneSlider = this.root.querySelector('#bone-peel-slider') as HTMLInputElement;
    this.boneValEl = this.root.querySelector('#bone-val') as HTMLElement;
    this.explodeSlider = this.root.querySelector('#explode-slider') as HTMLInputElement;
    this.explodeValEl = this.root.querySelector('#explode-val') as HTMLElement;
    this.partsToggleBtn = this.root.querySelector('#parts-toggle-btn') as HTMLButtonElement;
    this.partsDrawer = this.root.querySelector('#parts-drawer') as HTMLElement;

    // Hearing Controls
    this.tonePlayBtn = this.root.querySelector('#tone-play-btn') as HTMLButtonElement;
    this.toneIconEl = this.root.querySelector('#tone-icon') as HTMLElement;
    this.toneLabelEl = this.root.querySelector('#tone-label') as HTMLElement;
    this.hearingSlider = this.root.querySelector('#hearing-freq-slider') as HTMLInputElement;
    this.hearingFreqReadout = this.root.querySelector('#hearing-freq-readout') as HTMLElement;
    this.hearingLandmarkBadge = this.root.querySelector('#hearing-landmark-badge') as HTMLElement;
    this.audiogramToggleBtn = this.root.querySelector('#audiogram-toggle-btn') as HTMLButtonElement;
    this.audiogramArrowEl = this.root.querySelector('#audiogram-arrow') as HTMLElement;
    this.octaveChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.octave-chip'));

    // Radiology Controls
    this.planeChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.plane-chip'));
    this.radiologyDepthSlider = this.root.querySelector('#radiology-depth-slider') as HTMLInputElement;
    this.radiologyDepthValEl = this.root.querySelector('#radiology-depth-val') as HTMLElement;
    this.radiologyLandmarkBadgeEl = this.root.querySelector('#radiology-landmark-badge') as HTMLElement;
    this.depthDecBtn = this.root.querySelector('#depth-dec-btn') as HTMLButtonElement;
    this.depthIncBtn = this.root.querySelector('#depth-inc-btn') as HTMLButtonElement;
    this.radiologyFlipBtn = this.root.querySelector('#rad-flip-btn, #radiology-flip-btn') as HTMLButtonElement;
    this.radiologyGuideBtn = this.root.querySelector('#rad-guide-btn, #radiology-guide-btn') as HTMLButtonElement;
    this.radiologyScdsBtn = this.root.querySelector('#rad-scds-toggle-btn, #radiology-scds-btn') as HTMLButtonElement;
    this.radiologyCtToggleBtn = this.root.querySelector('#rad-ct-toggle-btn, #radiology-ct-toggle-btn') as HTMLButtonElement;
    this.ctCardArrowEl = this.root.querySelector('#ct-card-arrow') as HTMLElement;

    this.modeVestibularBtn = this.root.querySelector('#mode-vestibular-btn') as HTMLButtonElement;
    this.vestibularDockContent = this.root.querySelector('#vestibular-dock-content') as HTMLElement;

    // Vestibular Controls
    this.vestProtocolChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.protocol-chip'));
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

    // Diagnostic Vestibular Submodes
    this.vestSubnavTabs = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.vest-subnav-tab'));
    this.vestSubviews = Array.from(this.root.querySelectorAll<HTMLElement>('.vest-subview'));

    // Caloric Testing Controls
    this.caloricTempChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.caloric-chip'));
    this.caloricPlayBtn = this.root.querySelector('#caloric-play-btn') as HTMLButtonElement;
    this.caloricPlayIconEl = this.root.querySelector('#caloric-play-icon') as HTMLElement;
    this.caloricTimerBadgeEl = this.root.querySelector('#caloric-timer-badge') as HTMLElement;
    this.caloricSpvBadgeEl = this.root.querySelector('#caloric-spv-badge') as HTMLElement;
    this.caloricStatusTitleEl = this.root.querySelector('#caloric-status-title') as HTMLElement;
    this.caloricLateralityBadgeEl = this.root.querySelector('#caloric-laterality-badge') as HTMLElement;
    this.caloricPostureBtn = this.root.querySelector('#caloric-posture-btn') as HTMLButtonElement;
    this.caloricGazeChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.alex-gaze-chip'));
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
    this.vhitPairChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-vhit-pair]'));
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

    // Lab Drawers Initialization
    const labShell = this.root.querySelector('.lab-shell') as HTMLElement;
    this.audiogramDrawer = new AudiogramDrawer(labShell);
    this.ctSliceDrawer = new CTSliceDrawer(labShell);
    this.vorDrawer = new VORDrawer(labShell);

    this.ctSliceDrawer.onDepthChange((depthMm) => {
      this.scene.setRadiologyDepth(depthMm);
      this.syncRadiologyDepthUI(depthMm);
    });

    this.ctSliceDrawer.onWindowModeChange((mode) => {
      this.scene.setCTWindowMode(mode);
    });

    this.ctSliceDrawer.onClose(() => {
      this.radiologyCtToggleBtn.classList.remove('open');
      this.radiologyCtToggleBtn.setAttribute('aria-expanded', 'false');
      this.ctCardArrowEl.textContent = '▸';
      this.updateMobileDrawerExclusivity();
    });

    this.vorDrawer.onClose(() => {
      this.syncVORDrawerButtons(false);
      this.updateMobileDrawerExclusivity();
    });

    this.vorDrawer.onDiagnosticModeChange((mode) => {
      if (this.scene.getSnapshot().labMode === 'vestibular') {
        const submode = mode === 'nystagmogram' ? 'bppv' : mode;
        if (this.vestSubmode !== submode) {
          this.switchVestibularSubmode(submode);
        }
      }
    });

    this.vorDrawer.onAlexanderGazeChange((gaze) => {
      this.selectCaloricAlexanderGaze(gaze);
    });
    this.vorDrawer.setCaloricData(22, 20, 21, 21);

    // Surgical Workbench Controls
    this.surgicalDockContent = this.root.querySelector('#surgical-dock-content') as HTMLElement;
    this.modeSurgicalBtn = this.root.querySelector('#mode-surgical-btn') as HTMLButtonElement;
    this.surgSubnavTabs = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.surg-subnav-tab'));
    const ciSub = this.root.querySelector('#surg-ci-subview') as HTMLElement;
    const labySub = this.root.querySelector('#surg-laby-subview') as HTMLElement;
    const neurectomySub = this.root.querySelector('#surg-neurectomy-subview') as HTMLElement;
    if (ciSub) this.surgSubviews.set('ci', ciSub);
    if (labySub) this.surgSubviews.set('labyrinthectomy', labySub);
    if (neurectomySub) this.surgSubviews.set('neurectomy', neurectomySub);

    // CI Controls
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

    // Labyrinthectomy Controls
    this.labyStepChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-laby-step]'));
    this.labyStepTitleEl = this.root.querySelector('#laby-step-title') as HTMLElement;
    this.labyDrillBadgeEl = this.root.querySelector('#laby-drill-badge') as HTMLElement;
    this.labySpvBadgeEl = this.root.querySelector('#laby-spv-badge') as HTMLElement;
    this.labyDrillToggleBtn = this.root.querySelector('#laby-drill-toggle-btn') as HTMLButtonElement;
    this.labyDrillTextEl = this.root.querySelector('#laby-drill-text') as HTMLElement;
    this.labyCompSlider = this.root.querySelector('#laby-comp-slider') as HTMLInputElement;
    this.labyCompValEl = this.root.querySelector('#laby-comp-val') as HTMLElement;
    this.labyAblateAllBtn = this.root.querySelector('#laby-ablate-all-btn') as HTMLButtonElement;

    // Neurectomy Controls
    this.neurectomyStepChips = Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-neurectomy-step]'));
    this.neurectomyToolBtns = Array.from(this.root.querySelectorAll<HTMLButtonElement>('.surg-tool-btn'));
    this.neurectomyStepTitleEl = this.root.querySelector('#neurectomy-step-title') as HTMLElement;
    this.neurectomyAbrBadgeEl = this.root.querySelector('#neurectomy-abr-badge') as HTMLElement;
    this.neurectomyEmgBadgeEl = this.root.querySelector('#neurectomy-emg-badge') as HTMLElement;
    this.neurectomyKoosSlider = this.root.querySelector('#neurectomy-koos-slider') as HTMLInputElement;
    this.neurectomyKoosValEl = this.root.querySelector('#neurectomy-koos-val') as HTMLElement;
    this.neurectomyCleavageBtn = this.root.querySelector('#neurectomy-cleavage-btn') as HTMLButtonElement;

    // Surgical Drawer Initialization
    this.surgicalDrawer = new SurgicalDrawer(labShell);
    this.surgicalDrawer.onClose(() => {
      this.syncSurgicalDrawerButtonUI(false);
      this.updateMobileDrawerExclusivity();
    });

    this.aboutModal = this.root.querySelector('#about-modal') as HTMLElement;
    this.loadingOverlay = this.root.querySelector('#loading-overlay') as HTMLElement;
    this.loadingFill = this.root.querySelector('#loading-fill') as HTMLElement;
    this.loadingText = this.root.querySelector('#loading-status-text') as HTMLElement;
    this.loadingCount = this.root.querySelector('#loading-count-text') as HTMLElement;

    const presetBtns = this.bottomBar.querySelectorAll<HTMLButtonElement>('.preset-btn');
    presetBtns.forEach((btn) => {
      const presetId = btn.getAttribute('data-preset');
      if (presetId) {
        this.presetButtons.set(presetId, btn);
      }
    });
  }

  private attachEventListeners(): void {
    // -------------------------------------------------------------------------
    // Top Search Bar
    // -------------------------------------------------------------------------
    this.searchInput.addEventListener('input', () => {
      const query = this.searchInput.value.trim().toLowerCase();
      this.searchClearBtn.style.display = query.length > 0 ? 'block' : 'none';
      this.activeSearchIndex = -1;
      this.renderSearchResults(query);
    });

    this.searchInput.addEventListener('focus', () => {
      const query = this.searchInput.value.trim().toLowerCase();
      if (query.length > 0) {
        this.renderSearchResults(query);
      }
    });

    this.searchInput.addEventListener('keydown', (ev) => {
      const items = Array.from(
        this.searchDropdown.querySelectorAll<HTMLElement>('.search-result-item')
      );
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
      this.searchClearBtn.style.display = 'none';
      this.closeSearchDropdown();
      this.searchInput.focus();
    });

    document.addEventListener('click', (ev) => {
      if (!this.searchInput.contains(ev.target as Node) && !this.searchDropdown.contains(ev.target as Node)) {
        this.closeSearchDropdown();
      }
      if (this.settingsOpen && !this.settingsPopover.contains(ev.target as Node) && !this.settingsBtn.contains(ev.target as Node)) {
        this.closeSettingsPopover();
      }
    });

    window.addEventListener('resize', () => {
      this.updateMobileDrawerExclusivity();
    });

    // -------------------------------------------------------------------------
    // Settings Button & Popover
    // -------------------------------------------------------------------------
    this.settingsBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.toggleSettingsPopover();
    });

    const popoverCloseBtn = this.root.querySelector('#popover-close-btn') as HTMLButtonElement;
    popoverCloseBtn?.addEventListener('click', () => this.closeSettingsPopover());

    // 3D Label Mode Toggle (Off / Key / All)
    const labelBtns = this.settingsPopover.querySelectorAll<HTMLButtonElement>('[data-label-mode]');
    labelBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-label-mode') as LabelDensityMode;
        if (mode) {
          this.activeLabelMode = mode;
          labelBtns.forEach((b) => b.classList.toggle('active', b === btn));
          this.scene.setOverlays({ labelMode: mode });
          try {
            localStorage.setItem(AppHUD.STORAGE_KEYS.labelMode, mode);
          } catch {
            // ignore
          }
        }
      });
    });

    // Reading Depth Toggle (Simple / Detailed)
    const depthBtns = this.settingsPopover.querySelectorAll<HTMLButtonElement>('[data-reading-depth]');
    depthBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const depth = btn.getAttribute('data-reading-depth') as ReadingDepth;
        if (depth) {
          this.activeReadingDepth = depth;
          depthBtns.forEach((b) => b.classList.toggle('active', b === btn));
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

    // About Dialog Trigger
    const aboutOpenBtn = this.root.querySelector('#about-open-btn') as HTMLButtonElement;
    aboutOpenBtn?.addEventListener('click', () => {
      this.closeSettingsPopover();
      this.openAboutModal();
    });

    const aboutCloseBtn = this.root.querySelector('#about-close-btn') as HTMLButtonElement;
    aboutCloseBtn?.addEventListener('click', () => this.closeAboutModal());

    const aboutConfirmBtn = this.root.querySelector('#about-confirm-btn') as HTMLButtonElement;
    aboutConfirmBtn?.addEventListener('click', () => this.closeAboutModal());

    this.aboutModal.addEventListener('click', (ev) => {
      if (ev.target === this.aboutModal) {
        this.closeAboutModal();
      }
    });

    // -------------------------------------------------------------------------
    // Visual Sliders
    // -------------------------------------------------------------------------
    this.boneSlider.addEventListener('input', () => {
      const val = parseInt(this.boneSlider.value, 10);
      this.boneValEl.textContent = `${val}%`;
      this.scene.setSliders({ bonyPeelPercent: val });
    });

    this.explodeSlider.addEventListener('input', () => {
      const val = parseInt(this.explodeSlider.value, 10);
      this.explodeValEl.textContent = `${val}%`;
      this.scene.setSliders({ explodePercent: val });
    });

    // -------------------------------------------------------------------------
    // 4 Guided Presets
    // -------------------------------------------------------------------------
    this.presetButtons.forEach((btn, presetId) => {
      btn.addEventListener('click', () => {
        this.presetButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.scene.applyDissectionPreset(presetId);
      });
    });

    // -------------------------------------------------------------------------
    // Collapsible 27 Parts Drawer
    // -------------------------------------------------------------------------
    this.partsToggleBtn.addEventListener('click', () => {
      this.togglePartsDrawer();
    });

    const drawerCloseBtn = this.root.querySelector('#drawer-close-btn') as HTMLButtonElement;
    drawerCloseBtn?.addEventListener('click', () => {
      this.closePartsDrawer();
    });

    // -------------------------------------------------------------------------
    // Lab Mode Switcher (Anatomy Atlas vs Hearing Workbench)
    // -------------------------------------------------------------------------
    this.modeAnatomyBtn.addEventListener('click', () => {
      this.switchLabMode('anatomy');
    });

    this.modeHearingBtn.addEventListener('click', () => {
      this.switchLabMode('hearing');
    });

    // -------------------------------------------------------------------------
    // Hearing Workbench Controls
    // -------------------------------------------------------------------------
    // Pure-Tone Play/Pause Toggle
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

    // Logarithmic Stimulus Frequency Slider (20 Hz to 20,000 Hz)
    this.hearingSlider.addEventListener('input', () => {
      const val = parseFloat(this.hearingSlider.value);
      // Map linear slider [0, 1000] to logarithmic frequency [20, 20000] Hz
      const freq = Math.round(20 * Math.pow(10, (3 * val) / 1000));
      this.handleFrequencyChange(freq, false);
    });

    // Standard Audiometric Octave Step Chips
    this.octaveChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const freqStr = chip.getAttribute('data-octave');
        if (freqStr) {
          const freq = parseInt(freqStr, 10);
          this.handleFrequencyChange(freq, true);
        }
      });
    });

    // Clinical Audiogram Drawer Toggle & Callbacks
    this.audiogramToggleBtn.addEventListener('click', () => {
      this.toggleAudiogramDrawer();
    });

    this.audiogramDrawer.onClose(() => {
      this.audiogramToggleBtn.classList.remove('open');
      this.audiogramToggleBtn.setAttribute('aria-expanded', 'false');
      this.audiogramArrowEl.textContent = '▸';
      this.updateMobileDrawerExclusivity();
    });

    this.audiogramDrawer.onPresetChange((presetId, lossSector) => {
      this.scene.setHearingLossSector(lossSector, presetId);
    });

    this.audiogramDrawer.onFrequencySelect((freqHz) => {
      this.handleFrequencyChange(freqHz, true);
    });

    // -------------------------------------------------------------------------
    // Radiology Workbench Controls
    // -------------------------------------------------------------------------
    this.modeRadiologyBtn.addEventListener('click', () => {
      this.switchLabMode('radiology');
    });

    this.planeChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const planeId = chip.getAttribute('data-plane') as RadiologyPlaneId;
        if (planeId) {
          this.planeChips.forEach((c) => c.classList.toggle('active', c === chip));
          this.scene.setRadiologyPlane(planeId);
          const p = RADIOLOGY_PLANES[planeId];
          this.radiologyDepthSlider.min = String(Math.round(p.minDepthMm * 10));
          this.radiologyDepthSlider.max = String(Math.round(p.maxDepthMm * 10));
          this.radiologyDepthSlider.value = String(Math.round(p.defaultDepthMm * 10));
          this.syncRadiologyDepthUI(p.defaultDepthMm);
        }
      });
    });

    this.radiologyDepthSlider.addEventListener('input', () => {
      const val = parseInt(this.radiologyDepthSlider.value, 10);
      const depthMm = val / 10.0;
      this.scene.setRadiologyDepth(depthMm);
      this.syncRadiologyDepthUI(depthMm);
    });

    this.depthDecBtn.addEventListener('click', () => {
      const current = this.scene.getSnapshot().radiologyState.sliceDepthMm;
      const next = Math.round((current - 0.5) * 10) / 10;
      this.scene.setRadiologyDepth(next);
      this.syncRadiologyDepthUI(next);
    });

    this.depthIncBtn.addEventListener('click', () => {
      const current = this.scene.getSnapshot().radiologyState.sliceDepthMm;
      const next = Math.round((current + 0.5) * 10) / 10;
      this.scene.setRadiologyDepth(next);
      this.syncRadiologyDepthUI(next);
    });

    this.radiologyFlipBtn.addEventListener('click', () => {
      const inverted = !this.scene.getSnapshot().radiologyState.clipInverted;
      this.scene.setRadiologyClipInverted(inverted);
      this.radiologyFlipBtn.classList.toggle('active', inverted);
    });

    this.radiologyGuideBtn.addEventListener('click', () => {
      const visible = !this.scene.getSnapshot().radiologyState.showPlaneHelper;
      this.scene.setRadiologyPlaneHelperVisible(visible);
      this.radiologyGuideBtn.classList.toggle('active', visible);
    });

    this.radiologyScdsBtn.addEventListener('click', () => {
      const active = !this.scene.getSnapshot().radiologyState.scdsActive;
      this.scene.setSCDSActive(active);
      this.radiologyScdsBtn.classList.toggle('active', active);
      if (active) {
        this.planeChips.forEach((c) =>
          c.classList.toggle('active', c.getAttribute('data-plane') === 'poschl')
        );
        this.syncRadiologyDepthUI(1.2);
        this.scene.selectStructure('ls_Hsapiens_Sa', false);
      }
      this.renderInspectorCard(this.scene.getSnapshot().selectedMesh);
    });

    this.radiologyCtToggleBtn.addEventListener('click', () => {
      this.toggleCTDrawer();
    });

    // -------------------------------------------------------------------------
    // Vestibular & VOR Workbench Controls
    // -------------------------------------------------------------------------
    this.modeVestibularBtn.addEventListener('click', () => {
      this.switchLabMode('vestibular');
    });

    this.vestProtocolChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const maneuver = chip.getAttribute('data-maneuver') as ManeuverId;
        if (maneuver) {
          this.selectManeuver(maneuver);
        }
      });
    });

    this.vestStepPrevBtn?.addEventListener('click', () => {
      this.pauseSequencer();
      this.stepManeuver(-1);
    });

    this.vestStepNextBtn?.addEventListener('click', () => {
      this.pauseSequencer();
      this.stepManeuver(1);
    });

    this.vestPlayBtn?.addEventListener('click', () => {
      this.toggleSequencer();
    });

    this.vestStepSlider?.addEventListener('input', () => {
      this.pauseSequencer();
      const step = parseInt(this.vestStepSlider.value, 10);
      this.goToStep(step);
    });

    this.vestGyroToggleBtn?.addEventListener('click', () => {
      this.toggleGyroFlyout();
    });

    this.gyroCloseBtn?.addEventListener('click', () => {
      this.closeGyroFlyout();
    });

    const updateGyroFromSliders = () => {
      this.pauseSequencer();
      const yaw = parseFloat(this.gyroYawSlider.value);
      const pitch = parseFloat(this.gyroPitchSlider.value);
      const roll = parseFloat(this.gyroRollSlider.value);
      this.gyroYawValEl.textContent = `${Math.round(yaw)}°`;
      this.gyroPitchValEl.textContent = `${Math.round(pitch)}°`;
      this.gyroRollValEl.textContent = `${Math.round(roll)}°`;
      this.scene.setHeadOrientation(yaw, pitch, roll);
      this.renderInspectorCard(this.scene.getSnapshot().selectedMesh);
    };

    this.gyroYawSlider?.addEventListener('input', updateGyroFromSliders);
    this.gyroPitchSlider?.addEventListener('input', updateGyroFromSliders);
    this.gyroRollSlider?.addEventListener('input', updateGyroFromSliders);

    this.vestResetBtn?.addEventListener('click', () => {
      this.resetVestibular();
    });

    this.vestVorToggleBtn?.addEventListener('click', () => {
      this.toggleVORDrawer('nystagmogram');
    });

    // Vestibular Subnav Modality Tabs
    this.vestSubnavTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const submode = tab.getAttribute('data-submode') as 'bppv' | 'caloric' | 'vhit';
        if (submode) {
          this.switchVestibularSubmode(submode);
        }
      });
    });

    // Caloric Testing Listeners
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
      this.closeJongkeesModal();
      this.openVORDrawer('caloric');
    });

    this.caloricPresetChips.forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset');
        if (preset) {
          this.loadJongkeesPreset(preset);
        }
      });
    });

    [this.jongkeesR44Input, this.jongkeesR30Input, this.jongkeesL44Input, this.jongkeesL30Input].forEach((input) => {
      input?.addEventListener('input', () => {
        this.recalculateJongkees();
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

    // -------------------------------------------------------------------------
    // Surgical Suites Workbench Controls
    // -------------------------------------------------------------------------
    this.modeSurgicalBtn?.addEventListener('click', () => {
      this.switchLabMode('surgical');
    });

    this.surgSubnavTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const submode = tab.getAttribute('data-submode');
        if (submode === 'ci') {
          this.switchSurgicalProcedure('cochlear_implant');
        } else if (submode === 'labyrinthectomy') {
          this.switchSurgicalProcedure('labyrinthectomy');
        } else if (submode === 'neurectomy') {
          this.switchSurgicalProcedure('neurectomy');
        }
      });
    });

    const surgDrawerBtns = this.root.querySelectorAll<HTMLButtonElement>('.surg-drawer-toggle-btn');
    surgDrawerBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.toggleSurgicalDrawer();
      });
    });

    // CI Listeners
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
        const arrayType = chip.getAttribute('data-array') as CIArrayType;
        if (arrayType === 'perimodiolar') {
          this.ciDepthSlider.max = '210';
          if (parseInt(this.ciDepthSlider.value, 10) > 210) {
            this.ciDepthSlider.value = '210';
          }
        } else {
          this.ciDepthSlider.max = '280';
        }
        this.applyCIParameters();
      });
    });

    this.ciDepthSlider?.addEventListener('input', () => {
      this.applyCIParameters();
    });

    this.ciPitchSlider?.addEventListener('input', () => {
      this.applyCIParameters();
    });

    this.ciYawSlider?.addEventListener('input', () => {
      this.applyCIParameters();
    });

    this.ciAutoInsertBtn?.addEventListener('click', () => {
      this.toggleCIAutoInsert();
    });

    this.ciRetractBtn?.addEventListener('click', () => {
      this.stopCIAutoInsert();
      this.ciDepthSlider.value = '0';
      this.ciPitchSlider.value = '0';
      this.ciYawSlider.value = '0';
      this.applyCIParameters();
    });

    // Labyrinthectomy Listeners
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
      const compHours = parseFloat(this.labyCompSlider.value);
      this.applyLabyrinthectomyParameters(compHours);
    });

    this.labyAblateAllBtn?.addEventListener('click', () => {
      this.selectLabyrinthectomyStep(3);
      this.labyCompSlider.value = '0';
      this.applyLabyrinthectomyParameters(0);
    });

    // Neurectomy Listeners
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
  // SEARCH DROPDOWN
  // ===========================================================================
  private renderSearchResults(query: string): void {
    if (!query) {
      this.closeSearchDropdown();
      return;
    }

    const matches = IEMAP_STRUCTURES.filter((item) => {
      const matchName = item.displayName.toLowerCase().includes(query);
      const matchLatin = item.latinName.toLowerCase().includes(query);
      const matchShort = item.shortLabel.toLowerCase().includes(query);
      const matchGroup = SYSTEM_GROUPS[item.systemGroup]?.title.toLowerCase().includes(query);
      return matchName || matchLatin || matchShort || matchGroup;
    });

    if (matches.length === 0) {
      this.searchDropdown.innerHTML = `
        <div class="search-empty">
          <span>No matching ear structures found.</span>
        </div>
      `;
      this.searchDropdown.classList.add('open');
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
            </div>
            <span class="result-badge" style="background: ${groupMeta?.accentHex ?? '#52dcf2'}22; color: ${groupMeta?.accentHex ?? '#52dcf2'}; border-color: ${groupMeta?.accentHex ?? '#52dcf2'}55;">
              ${groupMeta?.shortTitle ?? 'Structure'}
            </span>
          </div>
        `;
      })
      .join('');

    this.searchDropdown.classList.add('open');

    const resultItems = this.searchDropdown.querySelectorAll<HTMLElement>('.search-result-item');
    resultItems.forEach((el) => {
      el.addEventListener('click', () => {
        const meshName = el.getAttribute('data-mesh');
        if (meshName) {
          const struct = STRUCTURE_BY_MESH[meshName];
          if (struct) {
            this.searchInput.value = struct.shortLabel;
            this.searchClearBtn.style.display = 'block';
          }
          this.closeSearchDropdown();
          this.scene.selectStructure(meshName, true);
        }
      });
    });
  }

  private closeSearchDropdown(): void {
    this.searchDropdown.classList.remove('open');
  }

  // ===========================================================================
  // SETTINGS POPOVER & ABOUT MODAL
  // ===========================================================================
  private toggleSettingsPopover(): void {
    this.settingsOpen = !this.settingsOpen;
    this.settingsPopover.classList.toggle('open', this.settingsOpen);
    this.settingsBtn.setAttribute('aria-expanded', this.settingsOpen ? 'true' : 'false');
  }

  private closeSettingsPopover(): void {
    this.settingsOpen = false;
    this.settingsPopover.classList.remove('open');
    this.settingsBtn.setAttribute('aria-expanded', 'false');
  }

  private openAboutModal(): void {
    this.aboutModalOpen = true;
    this.aboutModal.style.display = 'flex';
  }

  private closeAboutModal(): void {
    this.aboutModalOpen = false;
    this.aboutModal.style.display = 'none';
  }

  // ===========================================================================
  // PARTS DRAWER TOGGLE
  // ===========================================================================
  private togglePartsDrawer(): void {
    if (!this.partsDrawerOpen) {
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
      this.closeGyroFlyout();
    }
    this.partsDrawerOpen = !this.partsDrawerOpen;
    this.partsDrawer.classList.toggle('open', this.partsDrawerOpen);
    this.partsToggleBtn.classList.toggle('open', this.partsDrawerOpen);
    this.partsToggleBtn.setAttribute('aria-expanded', this.partsDrawerOpen ? 'true' : 'false');
    const arrowEl = this.partsToggleBtn.querySelector('.toggle-arrow');
    if (arrowEl) {
      arrowEl.textContent = this.partsDrawerOpen ? '▾' : '▸';
    }
    this.updateMobileDrawerExclusivity();
    try {
      localStorage.setItem(AppHUD.STORAGE_KEYS.partsDrawerOpen, String(this.partsDrawerOpen));
    } catch {
      // ignore
    }
  }

  private closePartsDrawer(): void {
    this.partsDrawerOpen = false;
    this.partsDrawer.classList.remove('open');
    this.partsToggleBtn.classList.remove('open');
    this.partsToggleBtn.setAttribute('aria-expanded', 'false');
    this.updateMobileDrawerExclusivity();
    const arrowEl = this.partsToggleBtn.querySelector('.toggle-arrow');
    if (arrowEl) {
      arrowEl.textContent = '▸';
    }
    try {
      localStorage.setItem(AppHUD.STORAGE_KEYS.partsDrawerOpen, 'false');
    } catch {
      // ignore
    }
  }

  private updateMobileDrawerExclusivity(): void {
    if (window.innerWidth <= 640) {
      const anyDrawerOpen =
        this.partsDrawerOpen ||
        (this.audiogramDrawer && this.audiogramDrawer.getIsOpen()) ||
        (this.ctSliceDrawer && this.ctSliceDrawer.getIsOpen()) ||
        (this.vorDrawer && this.vorDrawer.getIsOpen()) ||
        (this.surgicalDrawer && this.surgicalDrawer.getIsOpen()) ||
        this.isGyroFlyoutOpen();
      this.inspectorCard.classList.toggle('drawer-active', anyDrawerOpen);
    } else {
      this.inspectorCard.classList.remove('drawer-active');
    }
  }

  // ===========================================================================
  // AUDIOGRAM DRAWER TOGGLE & HEARING LAB HELPERS
  // ===========================================================================
  private toggleAudiogramDrawer(): void {
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
    const isOpen = this.audiogramDrawer.toggle();
    this.audiogramToggleBtn.classList.toggle('open', isOpen);
    this.audiogramToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    this.audiogramArrowEl.textContent = isOpen ? '▾' : '▸';
    this.updateMobileDrawerExclusivity();
  }

  private openAudiogramDrawer(): void {
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
    this.audiogramDrawer.open();
    this.audiogramToggleBtn.classList.add('open');
    this.audiogramToggleBtn.setAttribute('aria-expanded', 'true');
    this.audiogramArrowEl.textContent = '▾';
    this.updateMobileDrawerExclusivity();
  }

  private closeAudiogramDrawer(): void {
    this.audiogramDrawer.close();
    this.audiogramToggleBtn.classList.remove('open');
    this.audiogramToggleBtn.setAttribute('aria-expanded', 'false');
    this.audiogramArrowEl.textContent = '▸';
    this.updateMobileDrawerExclusivity();
  }

  // ===========================================================================
  // 2D CT MPR DRAWER TOGGLE & RADIOLOGY WORKBENCH HELPERS
  // ===========================================================================
  private toggleCTDrawer(): void {
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
    this.ctSliceDrawer.toggle();
    const isOpen = this.ctSliceDrawer.getIsOpen();
    this.radiologyCtToggleBtn.classList.toggle('open', isOpen);
    this.radiologyCtToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    this.ctCardArrowEl.textContent = isOpen ? '▾' : '▸';
    this.updateMobileDrawerExclusivity();
  }

  private openCTDrawer(): void {
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
    this.ctSliceDrawer.open();
    this.radiologyCtToggleBtn.classList.add('open');
    this.radiologyCtToggleBtn.setAttribute('aria-expanded', 'true');
    this.ctCardArrowEl.textContent = '▾';
    this.updateMobileDrawerExclusivity();
  }

  private closeCTDrawer(): void {
    if (this.ctSliceDrawer && this.ctSliceDrawer.getIsOpen()) {
      this.ctSliceDrawer.close();
      this.radiologyCtToggleBtn.classList.remove('open');
      this.radiologyCtToggleBtn.setAttribute('aria-expanded', 'false');
      this.ctCardArrowEl.textContent = '▸';
      this.updateMobileDrawerExclusivity();
    }
  }

  // ===========================================================================
  // 3D VOR & CLINICAL VNG EYE AVATAR DRAWER TOGGLE
  // ===========================================================================
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
    const mode = targetMode || (this.vestSubmode === 'bppv' ? 'nystagmogram' : this.vestSubmode);
    const isOpen = this.vorDrawer.getIsOpen();

    if (!isOpen) {
      this.vorDrawer.setDiagnosticViewMode(mode);
      this.vorDrawer.open();
    } else {
      const currentMode = this.vorDrawer.getDiagnosticViewMode();
      if (mode !== currentMode) {
        this.vorDrawer.setDiagnosticViewMode(mode);
      } else {
        this.vorDrawer.close();
      }
    }
    const finalIsOpen = this.vorDrawer.getIsOpen();
    this.syncVORDrawerButtons(finalIsOpen);
    this.updateMobileDrawerExclusivity();
  }

  private openVORDrawer(targetMode?: 'nystagmogram' | 'caloric' | 'vhit'): void {
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
    const mode = targetMode || (this.vestSubmode === 'bppv' ? 'nystagmogram' : this.vestSubmode);
    this.vorDrawer.setDiagnosticViewMode(mode);
    this.vorDrawer.open();
    this.syncVORDrawerButtons(true);
    this.updateMobileDrawerExclusivity();
  }

  private closeVORDrawer(): void {
    if (this.vorDrawer && this.vorDrawer.getIsOpen()) {
      this.vorDrawer.close();
      this.syncVORDrawerButtons(false);
      this.updateMobileDrawerExclusivity();
    }
  }

  // ===========================================================================
  // SURGICAL WORKBENCH & MONITOR DRAWER TOGGLE
  // ===========================================================================
  private toggleSurgicalDrawer(): void {
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

    this.surgicalDrawer.toggle();
    const isOpen = this.surgicalDrawer.getIsOpen();
    this.syncSurgicalDrawerButtonUI(isOpen);
    this.updateMobileDrawerExclusivity();
  }

  private openSurgicalDrawer(): void {
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

    this.surgicalDrawer.open();
    this.syncSurgicalDrawerButtonUI(true);
    this.updateMobileDrawerExclusivity();
  }

  private closeSurgicalDrawer(): void {
    if (this.surgicalDrawer && this.surgicalDrawer.getIsOpen()) {
      this.surgicalDrawer.close();
      this.syncSurgicalDrawerButtonUI(false);
      this.updateMobileDrawerExclusivity();
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

  private syncRadiologyDepthUI(depthMm: number): void {
    const snap = this.scene.getSnapshot();
    const planeId = snap.radiologyState.activePlane;
    const sign = depthMm > 0 ? '+' : '';
    this.radiologyDepthValEl.textContent = `${sign}${depthMm.toFixed(1)} mm`;
    const lm = getLandmarkForDepth(planeId, depthMm);
    this.radiologyLandmarkBadgeEl.textContent = lm.label;
    if (document.activeElement !== this.radiologyDepthSlider) {
      this.radiologyDepthSlider.value = String(Math.round(depthMm * 10));
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

    if (mode === 'surgical') {
      this.stopCaloricIrrigation();
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
      this.pauseSequencer();

      if (this.toneSynth.getIsPlaying()) {
        this.toneSynth.pause();
        this.scene.setHearingPlayback(false);
        this.updateTonePlayButton(false);
      }
      this.stopCaloricIrrigation();
      this.scene.setLabMode('surgical');
      this.modeAnatomyBtn.classList.remove('active');
      this.modeAnatomyBtn.setAttribute('aria-selected', 'false');
      this.modeHearingBtn.classList.remove('active');
      this.modeHearingBtn.setAttribute('aria-selected', 'false');
      this.modeRadiologyBtn.classList.remove('active');
      this.modeRadiologyBtn.setAttribute('aria-selected', 'false');
      this.modeVestibularBtn.classList.remove('active');
      this.modeVestibularBtn.setAttribute('aria-selected', 'false');
      this.modeSurgicalBtn.classList.add('active');
      this.modeSurgicalBtn.setAttribute('aria-selected', 'true');

      this.anatomyDockContent.style.display = 'none';
      this.hearingDockContent.style.display = 'none';
      this.radiologyDockContent.style.display = 'none';
      this.vestibularDockContent.style.display = 'none';
      this.surgicalDockContent.style.display = 'flex';

      this.syncSurgicalUI();
      this.renderInspectorCard(this.scene.getSelectedMesh());
    } else if (mode === 'vestibular') {
      this.closeSurgicalDrawer();
      this.stopCIAutoInsert();
      this.toneSynth.stopDrill();
      this.toneSynth.stopEMGAlarm();

      if (this.partsDrawerOpen) {
        this.closePartsDrawer();
      }
      if (this.audiogramDrawer && this.audiogramDrawer.getIsOpen()) {
        this.closeAudiogramDrawer();
      }
      if (this.ctSliceDrawer && this.ctSliceDrawer.getIsOpen()) {
        this.closeCTDrawer();
      }
      this.closeGyroFlyout();
      if (this.toneSynth.getIsPlaying()) {
        this.toneSynth.pause();
        this.scene.setHearingPlayback(false);
        this.updateTonePlayButton(false);
      }
      this.scene.setLabMode('vestibular');
      this.modeAnatomyBtn.classList.remove('active');
      this.modeAnatomyBtn.setAttribute('aria-selected', 'false');
      this.modeHearingBtn.classList.remove('active');
      this.modeHearingBtn.setAttribute('aria-selected', 'false');
      this.modeRadiologyBtn.classList.remove('active');
      this.modeRadiologyBtn.setAttribute('aria-selected', 'false');
      this.modeSurgicalBtn.classList.remove('active');
      this.modeSurgicalBtn.setAttribute('aria-selected', 'false');
      this.modeVestibularBtn.classList.add('active');
      this.modeVestibularBtn.setAttribute('aria-selected', 'true');

      this.anatomyDockContent.style.display = 'none';
      this.hearingDockContent.style.display = 'none';
      this.radiologyDockContent.style.display = 'none';
      this.surgicalDockContent.style.display = 'none';
      this.vestibularDockContent.style.display = 'flex';

      const curr = this.scene.getSelectedMesh();
      if (!curr || curr === 'mesh_david_cochlea' || curr.includes('segT2')) {
        this.scene.selectStructure('ls_Hsapiens_Sp', false);
      }

      this.syncVestibularUI();
      this.renderInspectorCard(this.scene.getSelectedMesh());
    } else if (mode === 'radiology') {
      this.closeSurgicalDrawer();
      this.stopCIAutoInsert();
      this.toneSynth.stopDrill();
      this.toneSynth.stopEMGAlarm();

      this.stopCaloricIrrigation();
      if (this.partsDrawerOpen) {
        this.closePartsDrawer();
      }
      if (this.audiogramDrawer.getIsOpen()) {
        this.closeAudiogramDrawer();
      }
      if (this.vorDrawer && this.vorDrawer.getIsOpen()) {
        this.closeVORDrawer();
      }
      this.closeGyroFlyout();
      this.pauseSequencer();

      if (this.toneSynth.getIsPlaying()) {
        this.toneSynth.pause();
        this.scene.setHearingPlayback(false);
        this.updateTonePlayButton(false);
      }
      this.scene.setLabMode('radiology');
      this.modeAnatomyBtn.classList.remove('active');
      this.modeAnatomyBtn.setAttribute('aria-selected', 'false');
      this.modeHearingBtn.classList.remove('active');
      this.modeHearingBtn.setAttribute('aria-selected', 'false');
      this.modeVestibularBtn.classList.remove('active');
      this.modeVestibularBtn.setAttribute('aria-selected', 'false');
      this.modeSurgicalBtn.classList.remove('active');
      this.modeSurgicalBtn.setAttribute('aria-selected', 'false');
      this.modeRadiologyBtn.classList.add('active');
      this.modeRadiologyBtn.setAttribute('aria-selected', 'true');

      this.anatomyDockContent.style.display = 'none';
      this.hearingDockContent.style.display = 'none';
      this.vestibularDockContent.style.display = 'none';
      this.surgicalDockContent.style.display = 'none';
      this.radiologyDockContent.style.display = 'flex';

      const snap = this.scene.getSnapshot();
      this.syncRadiologyUI(snap.radiologyState);
    } else if (mode === 'hearing') {
      this.closeSurgicalDrawer();
      this.stopCIAutoInsert();
      this.toneSynth.stopDrill();
      this.toneSynth.stopEMGAlarm();

      this.stopCaloricIrrigation();
      if (this.partsDrawerOpen) {
        this.closePartsDrawer();
      }
      if (this.ctSliceDrawer.getIsOpen()) {
        this.closeCTDrawer();
      }
      if (this.vorDrawer && this.vorDrawer.getIsOpen()) {
        this.closeVORDrawer();
      }
      this.closeGyroFlyout();
      this.pauseSequencer();

      this.scene.setLabMode('hearing');
      this.modeAnatomyBtn.classList.remove('active');
      this.modeAnatomyBtn.setAttribute('aria-selected', 'false');
      this.modeRadiologyBtn.classList.remove('active');
      this.modeRadiologyBtn.setAttribute('aria-selected', 'false');
      this.modeVestibularBtn.classList.remove('active');
      this.modeVestibularBtn.setAttribute('aria-selected', 'false');
      this.modeSurgicalBtn.classList.remove('active');
      this.modeSurgicalBtn.setAttribute('aria-selected', 'false');
      this.modeHearingBtn.classList.add('active');
      this.modeHearingBtn.setAttribute('aria-selected', 'true');

      this.anatomyDockContent.style.display = 'none';
      this.radiologyDockContent.style.display = 'none';
      this.vestibularDockContent.style.display = 'none';
      this.surgicalDockContent.style.display = 'none';
      this.hearingDockContent.style.display = 'flex';

      const snap = this.scene.getSnapshot();
      this.syncFrequencyUI(snap.hearingState.activeFrequency, true);
    } else {
      this.closeSurgicalDrawer();
      this.stopCIAutoInsert();
      this.toneSynth.stopDrill();
      this.toneSynth.stopEMGAlarm();

      this.stopCaloricIrrigation();
      if (this.audiogramDrawer.getIsOpen()) {
        this.closeAudiogramDrawer();
      }
      if (this.ctSliceDrawer.getIsOpen()) {
        this.closeCTDrawer();
      }
      if (this.vorDrawer && this.vorDrawer.getIsOpen()) {
        this.closeVORDrawer();
      }
      this.closeGyroFlyout();
      this.pauseSequencer();

      if (this.toneSynth.getIsPlaying()) {
        this.toneSynth.pause();
        this.scene.setHearingPlayback(false);
        this.updateTonePlayButton(false);
      }
      this.scene.setLabMode('anatomy');
      this.modeHearingBtn.classList.remove('active');
      this.modeHearingBtn.setAttribute('aria-selected', 'false');
      this.modeRadiologyBtn.classList.remove('active');
      this.modeRadiologyBtn.setAttribute('aria-selected', 'false');
      this.modeVestibularBtn.classList.remove('active');
      this.modeVestibularBtn.setAttribute('aria-selected', 'false');
      this.modeSurgicalBtn.classList.remove('active');
      this.modeSurgicalBtn.setAttribute('aria-selected', 'false');
      this.modeAnatomyBtn.classList.add('active');
      this.modeAnatomyBtn.setAttribute('aria-selected', 'true');

      this.hearingDockContent.style.display = 'none';
      this.radiologyDockContent.style.display = 'none';
      this.vestibularDockContent.style.display = 'none';
      this.surgicalDockContent.style.display = 'none';
      this.anatomyDockContent.style.display = 'flex';
    }
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
    const submode = submodeMap[proc];

    this.surgSubnavTabs.forEach((tab) => {
      const match = tab.getAttribute('data-submode') === submode;
      tab.classList.toggle('active', match);
    });

    this.surgSubviews.forEach((subview, key) => {
      subview.style.display = key === submode ? 'flex' : 'none';
    });

    this.scene.setSurgicalProcedure(proc);
    this.syncSurgicalUI();
    this.renderInspectorCard(this.scene.getSelectedMesh());
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

    // Auto-select corresponding 3D canal mesh
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
    const steps = MANEUVER_PRESETS[this.activeManeuverId] || [];
    if (this.currentStepIdx >= steps.length - 1 && this.remainingHoldSec <= 0) {
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
    this.gyroFlyout.classList.add('open');
    this.gyroFlyout.style.display = 'flex';
    this.vestGyroToggleBtn.classList.add('active');
    this.vestGyroToggleBtn.setAttribute('aria-expanded', 'true');
    this.updateMobileDrawerExclusivity();
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
    this.updateMobileDrawerExclusivity();
  }

  private setHeadOrientationUI(yaw: number, pitch: number, roll: number): void {
    this.gyroYawSlider.value = String(yaw);
    this.gyroPitchSlider.value = String(pitch);
    this.gyroRollSlider.value = String(roll);
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

    // Update subnav tabs
    this.vestSubnavTabs.forEach((tab) => {
      const isTarget = tab.getAttribute('data-submode') === submode;
      tab.classList.toggle('active', isTarget);
      tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    // Show/hide subviews
    const bppvView = this.root.querySelector('#vest-bppv-subview') as HTMLElement;
    const caloricView = this.root.querySelector('#vest-caloric-subview') as HTMLElement;
    const vhitView = this.root.querySelector('#vest-vhit-subview') as HTMLElement;

    if (bppvView) bppvView.style.display = submode === 'bppv' ? 'flex' : 'none';
    if (caloricView) caloricView.style.display = submode === 'caloric' ? 'flex' : 'none';
    if (vhitView) vhitView.style.display = submode === 'vhit' ? 'flex' : 'none';

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
      // bppv
      this.stopCaloricIrrigation();
      this.caloricElapsedSec = 0;
      this.scene.setLabyrinthLaterality('right');
      this.vorDrawer.setDiagnosticViewMode('nystagmogram');
      this.selectManeuver(this.activeManeuverId);
    }
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

      // Update shader uniforms on horizontal canal
      this.scene.setCaloricUniforms(
        true,
        conv.deltaT,
        Math.min(1.0, this.caloricElapsedSec / 40.0),
        this.caloricElapsedSec
      );

      // Overlay live caloric convection onto 3D scene vestibular telemetry
      this.scene.setCaloricSimulationState(true, conv, alex.modulatedSPV);

      // Update active irrigation in VORDrawer's Caloric Butterfly plot
      this.vorDrawer.setCaloricActiveIrrigation(this.activeCaloricTemp, alex.modulatedSPV);

      // Update badges
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

    // Automatically link peak response to the Jongkees Bithermal Matrix
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
    this.scene.setCaloricUniforms(false, 0, 0, 0);
    this.scene.setCaloricSimulationState(false, null);
    this.vorDrawer.setCaloricActiveIrrigation(null, 0);
  }

  public alignCaloricPosture(): void {
    this.scene.flyToCaloricPosture();
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

    // If idle (t=0), compute against peak response (40s) so clinical degree shows anticipated degree
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

    const label = pair === 'horizontal' ? 'Horizontal (Yaw)' : pair.toUpperCase();
    if (this.vhitStatusTitleEl) {
      this.vhitStatusTitleEl.textContent = `High-Acceleration Head Impulse (${label}, 15°, 120ms)`;
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

    // 1. Deliver 3D animated head impulse
    this.scene.triggerVHITThrust(this.vhitPair, this.vhitDirection, () => {
      if (this.vhitThrustBtn) {
        this.vhitThrustBtn.disabled = false;
        this.vhitThrustBtn.classList.remove('impulsing');
      }
    });

    // 2. Switch drawer to vhit mode and simulate trial
    this.vorDrawer.setDiagnosticViewMode('vhit');
    this.updateVHITReadout();

    // 3. Ensure VOR Drawer is open so user sees the high-speed trace immediately
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

  // ===========================================================================
  // FLOATING PART INSPECTOR CARD
  // ===========================================================================
  private renderInspectorCard(selectedMesh: string | null): void {
    if (!selectedMesh) {
      this.inspectorCard.classList.remove('visible');
      this.inspectorCard.innerHTML = `
        <div class="inspector-hint">
          <span class="hint-icon">👆</span>
          <p>Click any inner ear structure in 3D or search above to inspect.</p>
        </div>
      `;
      return;
    }

    const item = STRUCTURE_BY_MESH[selectedMesh];
    if (!item) {
      this.inspectorCard.classList.remove('visible');
      return;
    }

    const groupMeta = SYSTEM_GROUPS[item.systemGroup];
    const snap = this.scene.getSnapshot();
    const isIsolated = snap.isIsolated;

    const summaryText =
      this.activeReadingDepth === 'detailed'
        ? item.physiologicalFunction
        : item.patientSummary;

    const showSCDSBox =
      snap.radiologyState.scdsActive ||
      snap.labMode === 'radiology' ||
      item.meshName === 'ls_Hsapiens_Sa' ||
      item.meshName === 'segT2_th1.07_Otsu';

    const isSurgicalMode = snap.labMode === 'surgical';
    let surgBoxHtml = '';
    if (isSurgicalMode) {
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
        badgeHtml = laby.step === 3
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
          <div>Koos Tumor: <strong>Stage ${neu.koosStage}</strong></div>
        `;
      }

      surgBoxHtml = `
        <div class="surgical-inspector-box">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="font-size: 11px; color: #e2e8f0;">🔬 ${title}</strong>
            ${badgeHtml}
          </div>
          <div class="surg-metrics-grid">
            ${metricsHtml}
          </div>
          <button type="button" class="surg-inspector-monitor-btn" id="surg-inspector-monitor-btn">
            🔬 Open Surgical Monitor
          </button>
        </div>
      `;
    }

    const isVestibularMode = snap.labMode === 'vestibular';
    const isVestibularPart =
      item.systemGroup === 'semicircular_ducts' ||
      item.systemGroup === 'ampullae_cupulae' ||
      item.systemGroup === 'otolith_vestibule';
    const showVestibularBox = isVestibularMode || isVestibularPart;

    let vestBoxHtml = '';
    if (showVestibularBox) {
      const vestEngine = this.scene.getVestibularEngine();
      const head = this.scene.getHeadOrientation();
      const telem = vestEngine ? vestEngine.getTelemetry(head.yaw, head.pitch, head.roll) : null;
      const currPreset = vestEngine ? vestEngine.getCurrentPreset() : null;

      let canalTitle = 'Posterior Semicircular Canal';
      let canalPlane = 'RALP Plane — 45° Oblique';
      const canalId = telem?.canalId ?? (item.meshName.includes('Hsapiens_Sl') ? 'horizontal' : item.meshName.includes('Hsapiens_Sa') ? 'anterior' : 'posterior');
      if (canalId === 'horizontal') {
        canalTitle = 'Horizontal Semicircular Canal';
        canalPlane = 'Axial Plane — 30° Anterior-Superior';
      } else if (canalId === 'anterior') {
        canalTitle = 'Anterior Semicircular Canal';
        canalPlane = 'LARP Plane — 45° Oblique';
      } else {
        canalTitle = 'Posterior Semicircular Canal';
        canalPlane = 'RALP Plane — 45° Oblique';
      }

      let firingRate = telem ? telem.afferentSpikesPerSec : 90;
      let ewaldLaw = telem?.ewaldLawActive || "Ewald's 3rd Law: Ampullofugal flow excites vertical canal";

      // If Caloric Irrigation is active, reflect caloric excitation / inhibition on CN VIII
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
      const clearancePercent = telem ? telem.clearancePercent : 0;
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
                Clearance: <strong>${clearancePercent.toFixed(0)}%</strong>
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

    this.inspectorCard.innerHTML = `
      <div class="inspector-header">
        <span class="system-badge" style="background: ${groupMeta?.accentHex ?? '#52dcf2'}22; color: ${groupMeta?.accentHex ?? '#52dcf2'}; border-color: ${groupMeta?.accentHex ?? '#52dcf2'}66;">
          ${groupMeta?.shortTitle ?? 'Structure'}
        </span>
        <div class="inspector-header-controls">
          <button type="button" class="inspector-minimize-btn" id="inspector-minimize-btn" title="Minimize / expand card" aria-label="Minimize inspector">─</button>
          <button type="button" class="inspector-close-btn" id="inspector-close-btn" aria-label="Deselect structure">✕</button>
        </div>
      </div>

      <h2 class="inspector-title">${item.displayName}</h2>
      <div class="inspector-latin">${item.latinName}</div>

      ${
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
          : ''
      }

       ${
        showSCDSBox
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
          <div class="scds-box-actions">
             <button type="button" class="scds-audiogram-btn" id="scds-view-audiogram-btn">
               📊 View SCDS Audiogram (Air-Bone Gap)
             </button>
           </div>
         </div>
       `
           : ''
       }

       ${
         showVestibularBox
           ? vestBoxHtml
           : ''
       }

       ${
         isSurgicalMode
           ? surgBoxHtml
           : ''
       }

       <p class="inspector-summary">${summaryText}</p>

       <div class="inspector-actions">
         <button type="button" class="btn-action ${isIsolated ? 'active' : ''}" id="btn-isolate">
           ${isIsolated ? '👁️ Show All Parts' : '🎯 Isolate Part'}
         </button>
         <button type="button" class="btn-action" id="btn-reset-view">
           ↺ Reset View
         </button>
       </div>

       <!-- Expandable Medical Details Accordion -->
       <div class="accordion-section">
         <button
           type="button"
           class="accordion-header ${this.medDetailsAccordionExpanded ? 'open' : ''}"
           id="accordion-toggle-btn"
           aria-expanded="${this.medDetailsAccordionExpanded ? 'true' : 'false'}"
         >
           <span class="acc-title">Medical Details</span>
           <span class="acc-chevron">${this.medDetailsAccordionExpanded ? '▾' : '▸'}</span>
         </button>
         <div class="accordion-content ${this.medDetailsAccordionExpanded ? 'open' : ''}" id="accordion-content">
           <div class="detail-row">
             <span class="detail-label">Latin Term:</span>
             <span class="detail-val"><em>${item.latinName}</em></span>
           </div>
           <div class="detail-row">
             <span class="detail-label">Innervation:</span>
             <span class="detail-val">${item.innervation}</span>
           </div>
           <div class="detail-row">
             <span class="detail-label">Fluid Compartment:</span>
             <span class="detail-val">${item.fluidCompartment}</span>
           </div>
           <div class="detail-row">
             <span class="detail-label">Dimensions / Shape:</span>
             <span class="detail-val">${item.morphometry}</span>
           </div>
           <div class="detail-row clinical-row">
             <span class="detail-label">Clinical Pearl:</span>
             <span class="detail-val">${item.clinicalPearl}</span>
           </div>
         </div>
       </div>
     `;

     this.inspectorCard.classList.add('visible');

     // Attach inspector button handlers
     const minimizeBtn = this.inspectorCard.querySelector('#inspector-minimize-btn') as HTMLButtonElement;
     minimizeBtn?.addEventListener('click', (ev) => {
       ev.stopPropagation();
       this.inspectorCard.classList.toggle('minimized');
       minimizeBtn.textContent = this.inspectorCard.classList.contains('minimized') ? '▢' : '─';
     });

     const closeBtn = this.inspectorCard.querySelector('#inspector-close-btn') as HTMLButtonElement;
     closeBtn?.addEventListener('click', () => {
       this.searchInput.value = '';
       this.searchClearBtn.style.display = 'none';
       this.scene.selectStructure(null);
     });

     const isolateBtn = this.inspectorCard.querySelector('#btn-isolate') as HTMLButtonElement;
     isolateBtn?.addEventListener('click', () => {
       if (snap.isIsolated) {
         this.scene.restoreAllVisibility();
       } else {
         this.scene.isolateSelected();
       }
     });

     const resetBtn = this.inspectorCard.querySelector('#btn-reset-view') as HTMLButtonElement;
     resetBtn?.addEventListener('click', () => {
       this.searchInput.value = '';
       this.searchClearBtn.style.display = 'none';
       this.scene.resetView();
     });

     const scdsAudiogramBtn = this.inspectorCard.querySelector('#scds-view-audiogram-btn') as HTMLButtonElement;
     scdsAudiogramBtn?.addEventListener('click', () => {
       this.switchLabMode('hearing');
       this.openAudiogramDrawer();
       this.audiogramDrawer.setActivePreset('scds');
     });

     const vestViewVorBtn = this.inspectorCard.querySelector('#vest-view-vor-btn') as HTMLButtonElement;
     vestViewVorBtn?.addEventListener('click', () => {
       if (this.scene.getSnapshot().labMode !== 'vestibular') {
         this.switchLabMode('vestibular');
       }
       this.openVORDrawer();
     });

     const surgMonitorBtn = this.inspectorCard.querySelector('#surg-inspector-monitor-btn') as HTMLButtonElement;
     surgMonitorBtn?.addEventListener('click', () => {
       this.openSurgicalDrawer();
     });

    const accordionBtn = this.inspectorCard.querySelector('#accordion-toggle-btn') as HTMLButtonElement;
    accordionBtn?.addEventListener('click', () => {
      this.medDetailsAccordionExpanded = !this.medDetailsAccordionExpanded;
      const content = this.inspectorCard.querySelector('#accordion-content');
      const chevron = this.inspectorCard.querySelector('.acc-chevron');
      if (content && chevron) {
        content.classList.toggle('open', this.medDetailsAccordionExpanded);
        accordionBtn.classList.toggle('open', this.medDetailsAccordionExpanded);
        accordionBtn.setAttribute('aria-expanded', this.medDetailsAccordionExpanded ? 'true' : 'false');
        chevron.textContent = this.medDetailsAccordionExpanded ? '▾' : '▸';
      }
      try {
        localStorage.setItem(AppHUD.STORAGE_KEYS.medDetailsOpen, String(this.medDetailsAccordionExpanded));
      } catch {
        // ignore
      }
    });
  }

  // ===========================================================================
  // ALL 27 PARTS DRAWER RENDER
  // ===========================================================================
  private renderPartsTree(): void {
    const treeBody = this.root.querySelector('#parts-tree-body') as HTMLElement;
    if (!treeBody) return;

    const groups: SystemGroupId[] = [
      'semicircular_ducts',
      'ampullae_cupulae',
      'otolith_vestibule',
      'cochlear_system',
      'bony_capsule',
    ];

    treeBody.innerHTML = groups
      .map((groupId) => {
        const groupMeta = SYSTEM_GROUPS[groupId];
        const groupItems = IEMAP_STRUCTURES.filter((item) => item.systemGroup === groupId);

        const snap = this.scene ? this.scene.getSnapshot() : null;
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

    // Attach row click and eye click handlers
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
          if (window.innerWidth <= 640) {
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
    }
  }

  // ===========================================================================
  // 3D PROJECTED PINS RENDER (Full-Screen Overlay)
  // ===========================================================================
  private renderProjectedPins(pins: ProjectedPin2D[]): void {
    const currentIds = new Set(pins.map((p) => p.id));
    const selectedMesh = this.scene.getSelectedMesh();

    // Remove pins that disappeared
    for (const [id, el] of this.pinElements.entries()) {
      if (!currentIds.has(id)) {
        el.remove();
        this.pinElements.delete(id);
      }
    }

    // Update or create pins
    for (const pin of pins) {
      let el = this.pinElements.get(pin.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'projected-pin';
        el.id = `pin-${pin.id}`;
        el.innerHTML = `
          <span class="pin-dot" style="background: ${pin.colorHex};"></span>
          <span class="pin-text">${pin.label}</span>
        `;
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.scene.selectStructure(pin.meshName, true);
        });
        this.pinsLayer.appendChild(el);
        this.pinElements.set(pin.id, el);
      }

      el.style.transform = `translate(${Math.round(pin.screenX)}px, ${Math.round(pin.screenY)}px)`;
      el.style.display = pin.visible ? 'flex' : 'none';
      el.classList.toggle('selected-pin', selectedMesh === pin.meshName);
    }
  }

  // ===========================================================================
  // REACTIVE STATE RENDER
  // ===========================================================================
  private renderState(snap: LabSceneSnapshot): void {
    // 1. Loading Overlay
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

    // 2. Sliders
    if (document.activeElement !== this.boneSlider) {
      this.boneSlider.value = String(snap.bonyPeelPercent);
      this.boneValEl.textContent = `${snap.bonyPeelPercent}%`;
    }
    if (document.activeElement !== this.explodeSlider) {
      this.explodeSlider.value = String(snap.explodePercent);
      this.explodeValEl.textContent = `${snap.explodePercent}%`;
    }

    // 3. Preset Buttons Active Indicator
    this.presetButtons.forEach((btn, presetId) => {
      btn.classList.toggle('active', snap.activePresetId === presetId);
    });

    // 4. Floating Inspector Card & Search Sync (render only when relevant properties change to prevent scroll jump)
    if (
      snap.selectedMesh !== this.lastRenderedMesh ||
      snap.readingDepth !== this.lastRenderedDepth
    ) {
      this.lastRenderedMesh = snap.selectedMesh;
      this.lastRenderedDepth = snap.readingDepth;
      this.lastRenderedIsolated = snap.isIsolated;
      this.renderInspectorCard(snap.selectedMesh);

      // Keep search bar in sync with selected structure
      if (document.activeElement !== this.searchInput) {
        if (snap.selectedMesh) {
          const struct = STRUCTURE_BY_MESH[snap.selectedMesh];
          if (struct) {
            this.searchInput.value = struct.shortLabel;
            this.searchClearBtn.style.display = 'block';
          }
        } else {
          this.searchInput.value = '';
          this.searchClearBtn.style.display = 'none';
        }
      }
    } else if (snap.isIsolated !== this.lastRenderedIsolated) {
      this.lastRenderedIsolated = snap.isIsolated;
      const isolateBtn = this.inspectorCard.querySelector('#btn-isolate');
      if (isolateBtn) {
        isolateBtn.textContent = snap.isIsolated ? '👁️ Show All Parts' : '🎯 Isolate Part';
        isolateBtn.classList.toggle('active', snap.isIsolated);
      }
    }

    // 5. Update Parts Drawer Row States (highlight selected, eye icons)
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

    // 6. Lab Mode Switcher & Hearing State Synchronization
    if (snap.labMode !== this.lastRenderedLabMode) {
      this.lastRenderedLabMode = snap.labMode;
      const isHearing = snap.labMode === 'hearing';
      this.modeAnatomyBtn.classList.toggle('active', !isHearing);
      this.modeAnatomyBtn.setAttribute('aria-selected', !isHearing ? 'true' : 'false');
      this.modeHearingBtn.classList.toggle('active', isHearing);
      this.modeHearingBtn.setAttribute('aria-selected', isHearing ? 'true' : 'false');
      this.anatomyDockContent.style.display = isHearing ? 'none' : 'flex';
      this.hearingDockContent.style.display = isHearing ? 'flex' : 'none';
    }

    if (snap.labMode === 'hearing') {
      this.syncFrequencyUI(snap.hearingState.activeFrequency, true);
      this.updateTonePlayButton(snap.hearingState.isPlaying);
      this.audiogramDrawer.setActiveFrequency(snap.hearingState.activeFrequency);
    }
  }
}
