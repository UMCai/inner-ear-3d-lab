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
import {
  MANEUVER_PRESETS,
  type ManeuverId,
  type VestibularStepPreset,
  type VestibularTelemetryState,
} from '../physics/vestibularEngine';
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
                <span class="ct-card-arrow" id="ct-card-arrow">▾</span>
              </button>
            </div>
          </div>

          <!-- 4D. Vestibular & VOR Workbench Dock Content -->
          <div class="vestibular-dock-content" id="vestibular-dock-content" style="display: none;">
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
                <span class="vor-arrow" id="vor-arrow">▾</span>
              </button>
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
      this.ctCardArrowEl.textContent = '▾';
      this.updateMobileDrawerExclusivity();
    });

    this.vorDrawer.onClose(() => {
      this.vestVorToggleBtn.classList.remove('open');
      this.vestVorToggleBtn.setAttribute('aria-expanded', 'false');
      if (this.vorArrowEl) {
        this.vorArrowEl.textContent = '▾';
      }
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
      this.toggleVORDrawer();
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
        (this.vorDrawer && this.vorDrawer.getIsOpen());
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
    this.ctSliceDrawer.toggle();
    const isOpen = this.ctSliceDrawer.getIsOpen();
    this.radiologyCtToggleBtn.classList.toggle('open', isOpen);
    this.radiologyCtToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    this.ctCardArrowEl.textContent = isOpen ? '▾' : '▸';
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
  private toggleVORDrawer(): void {
    if (this.partsDrawerOpen) {
      this.closePartsDrawer();
    }
    if (this.audiogramDrawer && this.audiogramDrawer.getIsOpen()) {
      this.closeAudiogramDrawer();
    }
    if (this.ctSliceDrawer && this.ctSliceDrawer.getIsOpen()) {
      this.closeCTDrawer();
    }
    this.vorDrawer.toggle();
    const isOpen = this.vorDrawer.getIsOpen();
    this.vestVorToggleBtn.classList.toggle('open', isOpen);
    this.vestVorToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (this.vorArrowEl) {
      this.vorArrowEl.textContent = isOpen ? '▾' : '▸';
    }
    this.updateMobileDrawerExclusivity();
  }

  private openVORDrawer(): void {
    if (this.partsDrawerOpen) {
      this.closePartsDrawer();
    }
    if (this.audiogramDrawer && this.audiogramDrawer.getIsOpen()) {
      this.closeAudiogramDrawer();
    }
    if (this.ctSliceDrawer && this.ctSliceDrawer.getIsOpen()) {
      this.closeCTDrawer();
    }
    this.vorDrawer.open();
    this.vestVorToggleBtn.classList.add('open');
    this.vestVorToggleBtn.setAttribute('aria-expanded', 'true');
    if (this.vorArrowEl) {
      this.vorArrowEl.textContent = '▾';
    }
    this.updateMobileDrawerExclusivity();
  }

  private closeVORDrawer(): void {
    if (this.vorDrawer && this.vorDrawer.getIsOpen()) {
      this.vorDrawer.close();
      this.vestVorToggleBtn.classList.remove('open');
      this.vestVorToggleBtn.setAttribute('aria-expanded', 'false');
      if (this.vorArrowEl) {
        this.vorArrowEl.textContent = '▾';
      }
      this.updateMobileDrawerExclusivity();
    }
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
    if (mode === 'vestibular') {
      if (this.partsDrawerOpen) {
        this.closePartsDrawer();
      }
      if (this.audiogramDrawer && this.audiogramDrawer.getIsOpen()) {
        this.closeAudiogramDrawer();
      }
      if (this.ctSliceDrawer && this.ctSliceDrawer.getIsOpen()) {
        this.closeCTDrawer();
      }
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
      this.modeVestibularBtn.classList.add('active');
      this.modeVestibularBtn.setAttribute('aria-selected', 'true');

      this.anatomyDockContent.style.display = 'none';
      this.hearingDockContent.style.display = 'none';
      this.radiologyDockContent.style.display = 'none';
      this.vestibularDockContent.style.display = 'flex';

      const curr = this.scene.getSelectedMesh();
      if (!curr || curr === 'mesh_david_cochlea' || curr.includes('segT2')) {
        this.scene.selectStructure('ls_Hsapiens_Sp', false);
      }

      this.syncVestibularUI();
      this.renderInspectorCard(this.scene.getSelectedMesh());
    } else if (mode === 'radiology') {
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
      this.modeRadiologyBtn.classList.add('active');
      this.modeRadiologyBtn.setAttribute('aria-selected', 'true');

      this.anatomyDockContent.style.display = 'none';
      this.hearingDockContent.style.display = 'none';
      this.vestibularDockContent.style.display = 'none';
      this.radiologyDockContent.style.display = 'flex';

      const snap = this.scene.getSnapshot();
      this.syncRadiologyUI(snap.radiologyState);
    } else if (mode === 'hearing') {
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
      this.modeHearingBtn.classList.add('active');
      this.modeHearingBtn.setAttribute('aria-selected', 'true');

      this.anatomyDockContent.style.display = 'none';
      this.radiologyDockContent.style.display = 'none';
      this.vestibularDockContent.style.display = 'none';
      this.hearingDockContent.style.display = 'flex';

      const snap = this.scene.getSnapshot();
      this.syncFrequencyUI(snap.hearingState.activeFrequency, true);
    } else {
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
      this.modeAnatomyBtn.classList.add('active');
      this.modeAnatomyBtn.setAttribute('aria-selected', 'true');

      this.hearingDockContent.style.display = 'none';
      this.radiologyDockContent.style.display = 'none';
      this.vestibularDockContent.style.display = 'none';
      this.anatomyDockContent.style.display = 'flex';
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

  private toggleGyroFlyout(): void {
    const isVisible = this.gyroFlyout.style.display !== 'none';
    if (isVisible) {
      this.closeGyroFlyout();
    } else {
      this.openGyroFlyout();
    }
  }

  private openGyroFlyout(): void {
    this.gyroFlyout.style.display = 'block';
    this.vestGyroToggleBtn.classList.add('active');
    this.vestGyroToggleBtn.setAttribute('aria-expanded', 'true');
  }

  private closeGyroFlyout(): void {
    this.gyroFlyout.style.display = 'none';
    this.vestGyroToggleBtn.classList.remove('active');
    this.vestGyroToggleBtn.setAttribute('aria-expanded', 'false');
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
    this.selectManeuver(this.activeManeuverId);
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

      const firingRate = telem ? telem.afferentSpikesPerSec : 90;
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

      const ewaldLaw = telem?.ewaldLawActive || "Ewald's 3rd Law: Ampullofugal flow excites vertical canal";
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
