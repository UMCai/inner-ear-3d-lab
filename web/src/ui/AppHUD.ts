import {
  DISSECTION_PRESETS,
  getPatientSystemSummary,
  IEMAP_STRUCTURES,
  STRUCTURE_BY_MESH,
  SYSTEM_GROUPS,
  SystemGroupId,
  VisibilityState,
} from '../data/ontology';
import {
  EPLEY_CLINICAL_STEPS,
  PhysicsTelemetryState,
  RealtimeEpleySimulator,
} from '../physics/epleyPhysics';
import {
  ClipAxisMode,
  DualStageScene,
  LabAppMode,
  LabelDensityMode,
  LabSceneSnapshot,
  ProjectedPin2D,
  ViewportLayoutMode,
} from '../render/DualStageScene';

const UNOBSTRUCTED_QUIZ_MESHES = new Set<string>([
  'ls_Hsapiens_Sp',
  'ls_Hsapiens_Sa',
  'ls_Hsapiens_Sl',
  'ls_Hsapiens_CCp',
  'ls_Hsapiens_CCa',
  'ls_Hsapiens_SC',
  'ls_Hsapiens_Ap',
  'ls_Hsapiens_Aa',
  'ls_Hsapiens_Al',
  'ls_Hsapiens_utricle',
  'ls_Hsapiens_UCp',
  'mesh_david_sacculus',
  'mesh_david_cochlea',
]);

export class AppHUD {
  private root: HTMLElement;
  private scene!: DualStageScene;
  private canvasHost!: HTMLElement;
  private pinsLayer!: HTMLElement;
  private pinElements = new Map<string, HTMLElement>();
  private pipHudFrame!: HTMLElement;
  private pipTitleEl!: HTMLElement;
  private breadcrumbBar!: HTMLElement;
  private inspectorContainer!: HTMLElement;
  private layerTreeContainer!: HTMLElement;
  private loadingOverlay!: HTMLElement;
  private loadingBarFill!: HTMLElement;
  private loadingText!: HTMLElement;
  private loadingCountText!: HTMLElement;
  private welcomeOverlay!: HTMLElement;
  private advancedToolsCheckbox!: HTMLInputElement;

  // Mode 2 Epley Sandbox Bar Elements
  private epleySandboxBar!: HTMLElement;
  private cameraPresetBar!: HTMLElement;
  private tourPlayBtn!: HTMLButtonElement;
  private epleyCaptionHeadline!: HTMLElement;
  private epleyCaptionSub!: HTMLElement;
  private patientTelemetryGrid!: HTMLElement;
  private technicalTelemetryGrid!: HTMLElement;
  private patientClearanceText!: HTMLElement;
  private patientClearanceFill!: HTMLElement;
  private patientSensationDot!: HTMLElement;
  private patientSensationText!: HTMLElement;
  private patientLocationText!: HTMLElement;
  private telPhiArc!: HTMLElement;
  private telGravityDrive!: HTMLElement;
  private telSpikeRate!: HTMLElement;
  private telNystagmus!: HTMLElement;
  private telRegion!: HTMLElement;

  // Controls references for reactive sync
  private bonyPeelInput!: HTMLInputElement;
  private bonyPeelVal!: HTMLElement;
  private microCutInput!: HTMLInputElement;
  private microCutVal!: HTMLElement;
  private explodeInput!: HTMLInputElement;
  private explodeVal!: HTMLElement;
  private canalithPhiInput!: HTMLInputElement;
  private canalithPhiVal!: HTMLElement;
  private clipOffsetInput!: HTMLInputElement;
  private clipOffsetVal!: HTMLElement;
  private headOpacityInput!: HTMLInputElement;
  private headYawInput!: HTMLInputElement;
  private headYawVal!: HTMLElement;
  private headPitchInput!: HTMLInputElement;
  private headPitchVal!: HTMLElement;
  private undoBtn!: HTMLButtonElement;

  // Phase 1: Collapsible panels & compact floating info card state
  private leftDockEl!: HTMLElement;
  private leftPanelToggleBtn!: HTMLButtonElement;
  private rightDrawerEl!: HTMLElement;
  private rightPanelToggleBtn!: HTMLButtonElement;
  private partListToggleBtn!: HTMLButtonElement;

  // Phase 2: Responsive bottom drawer (<900px) & half-height swipe/tap (<600px) + PiP toggle
  private workspacePanelsShell!: HTMLElement;
  private mobileDrawerHeader!: HTMLElement;
  private mobileDrawerHandleBtn!: HTMLButtonElement;
  private pipToggleBtn!: HTMLButtonElement;
  private activeDrawerTab: 'presets' | 'dissect' | 'layers' | 'slicer' | 'info' | 'parts' = 'presets';
  private mobileDrawerExpanded = false;
  private pipInsetOpenDesktop = true;
  private pipInsetOpenMobile = false;

  // Phase 3: First-visit welcome overlay & Advanced tools toggle (off by default)
  private welcomeDismissed = false;
  private advancedToolsEnabled = false;

  // Phase 5: Audience mode (Patient default), Mode 1 Quiz mode, Mode 2 Predict mode
  private audienceMode: 'student' | 'clinician' | 'patient' = 'patient';
  private quizActive = false;
  private quizType: 'name_highlighted' | 'click_in_3d' = 'name_highlighted';
  private quizTargetMesh = 'ls_Hsapiens_Sp';
  private quizChoices: string[] = [];
  private quizSelectedChoice: string | null = null;
  private quizAnswered = false;
  private quizLastCorrect = false;
  private quizCorrectCount = 0;
  private quizTotalCount = 0;
  private quizSavedLabelMode: LabelDensityMode = 'key';
  private quizPanelEl!: HTMLElement;
  private quizToggleBtn!: HTMLButtonElement;

  private predictModeActive = false;
  private predictPendingStepIdx = 3;
  private predictChoiceMotion: 'stationary' | 'ampullofugal' | 'enter_utricle' = 'ampullofugal';
  private predictChoiceNystagmus: 'none' | 'upbeat_torsional' | 'downbeat_inhibitory' =
    'upbeat_torsional';
  private predictRevealed = false;
  private predictLastMotionCorrect = false;
  private predictLastNystagmusCorrect = false;
  private predictCorrectCount = 0;
  private predictTotalCount = 0;
  private predictPanelEl!: HTMLElement;
  private predictToggleBtn!: HTMLButtonElement;

  // Phase 6: About & Disclaimer Modal
  private aboutModalOpen = false;
  private aboutModalEl!: HTMLElement;

  private leftPanelCollapsed = false;
  private rightPanelCollapsed = false;
  private infoCardExpanded = false;
  private partListCollapsed = true;

  private lastRenderedInspectorKey = '';
  private lastRenderedLayerTreeKey = '';

  private static readonly LS_KEYS = {
    leftCollapsed: 'gate3_left_panel_collapsed',
    rightCollapsed: 'gate3_right_panel_collapsed',
    infoExpanded: 'gate3_info_card_expanded',
    partsCollapsed: 'gate3_part_list_collapsed',
    welcomeChoice: 'gate3_welcome_choice',
    advancedTools: 'gate3_advanced_tools',
    audienceMode: 'gate3_audience_mode',
  };

  constructor(root: HTMLElement) {
    this.root = root;
    this.loadSavedPanelStates();
    this.buildDOM();
    this.scene = new DualStageScene(this.canvasHost);

    this.scene.onStateChange((snap) => this.renderState(snap));
    this.scene.onPinsUpdate((pins) => this.renderProjectedPins(pins));
    this.scene.onTelemetryUpdate((tel) => this.renderLiveTelemetry(tel));
    this.scene.onStructurePicked((meshName) => this.handleStructurePickedForQuiz(meshName));

    window.addEventListener('resize', () => {
      this.applyPanelStatesToDOM();
      this.syncViewportRects();
    });
    this.applyPanelStatesToDOM();
    this.syncViewportRects();
  }

  private readStorageString(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorageString(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage access errors
    }
  }

  private readStorageBool(key: string, fallback: boolean): boolean {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === 'true') return true;
      if (raw === 'false') return false;
    } catch {
      // Ignore storage access errors (private mode / blocked storage)
    }
    return fallback;
  }

  private writeStorageBool(key: string, value: boolean): void {
    try {
      window.localStorage.setItem(key, value ? 'true' : 'false');
    } catch {
      // Ignore storage access errors
    }
  }

  private loadSavedPanelStates(): void {
    // Defaults: left panel open (false), part list collapsed (true), info card compact (false)
    this.leftPanelCollapsed = this.readStorageBool(AppHUD.LS_KEYS.leftCollapsed, false);
    this.rightPanelCollapsed = this.readStorageBool(AppHUD.LS_KEYS.rightCollapsed, false);
    this.infoCardExpanded = this.readStorageBool(AppHUD.LS_KEYS.infoExpanded, false);
    this.partListCollapsed = this.readStorageBool(AppHUD.LS_KEYS.partsCollapsed, true);
    // Welcome overlay shown unless a choice was previously saved; Advanced tools off by default
    const savedWelcome = this.readStorageString(AppHUD.LS_KEYS.welcomeChoice);
    this.welcomeDismissed = Boolean(savedWelcome);
    this.advancedToolsEnabled = this.readStorageBool(AppHUD.LS_KEYS.advancedTools, false);
    // Audience mode defaults to 'patient' unless explicitly saved
    const savedAud = this.readStorageString(AppHUD.LS_KEYS.audienceMode);
    if (savedAud === 'student' || savedAud === 'clinician' || savedAud === 'patient') {
      this.audienceMode = savedAud;
    } else {
      this.audienceMode = 'patient';
    }
  }

  public async init(): Promise<void> {
    this.scene.startRenderLoop();
    await this.scene.loadAllAssets();
    const savedWelcome = this.readStorageString(AppHUD.LS_KEYS.welcomeChoice);
    if (savedWelcome === 'epley_lab' || savedWelcome === 'guided_tour') {
      this.leftPanelCollapsed = true;
      this.partListCollapsed = true;
      this.scene.setAppMode('mode2_physics');
    }
    this.applyPanelStatesToDOM();
    this.syncViewportRects();
  }

  private buildDOM(): void {
    this.root.innerHTML = `
      <div class="lab-shell">
        <!-- TOP HEADER BAR -->
        <header class="lab-header">
          <div class="brand-cluster">
            <span class="brand-badge" title="Gate 3 · IE-Map v1.0.0 Micro-CT Atlas">Inner Ear 3D Guide</span>
            <div class="mode-switch-pill" id="app-mode-switcher">
              <button class="mode-tab-btn active" data-app-mode="mode1_atlas">
                1. Explore Ear Anatomy
              </button>
              <button class="mode-tab-btn" data-app-mode="mode2_physics">
                2. Vertigo &amp; Epley Treatment
              </button>
            </div>
          </div>

          <!-- Search, Labels Toggle & Viewport Layout Switcher -->
          <div class="header-controls">
            <div class="search-wrapper">
              <input
                type="text"
                class="search-input"
                id="structure-search-input"
                placeholder="Search ear parts, vertigo, balance... (⌘K)"
                aria-label="Search inner ear parts"
                autocomplete="off"
              />
              <div class="search-dropdown" id="structure-search-dropdown"></div>
            </div>

            <div class="layout-segmented" id="label-mode-group" role="group" aria-label="3D label density mode">
              <button class="seg-btn" type="button" data-label-mode="off" title="Labels: Off (hide all 3D callout labels)">
                Labels: Off
              </button>
              <button class="seg-btn active" type="button" data-label-mode="key" title="Labels: Key landmarks (non-overlapping)">
                Key
              </button>
              <button class="seg-btn" type="button" data-label-mode="all" title="Labels: All landmarks (zoom in for full detail)">
                All
              </button>
            </div>

            <button
              class="seg-btn pip-toggle-header-btn"
              id="btn-toggle-quiz"
              type="button"
              aria-label="Toggle 3D Ear Anatomy Quiz"
              aria-pressed="false"
              title="Open or close interactive 3D Ear Anatomy Quiz"
            >
              Quiz
            </button>

            <button
              class="seg-btn pip-toggle-header-btn"
              id="btn-toggle-pip-inset"
              type="button"
              aria-label="Toggle 3D patient head view"
              title="Show or hide 3D Patient Head view"
            >
              Hide Head
            </button>

            <button
              class="seg-btn pip-toggle-header-btn"
              id="btn-open-welcome"
              type="button"
              aria-label="Open welcome and mode guide"
              title="Open welcome guide (Guided tour, Explore anatomy, Epley treatment)"
            >
              Start Guide
            </button>

            <button
              class="seg-btn pip-toggle-header-btn"
              id="btn-open-about"
              type="button"
              aria-label="Open About, References, and Educational Disclaimer"
              title="About Inner Ear 3D Guide, Verified Sources &amp; Educational Disclaimer"
            >
              About
            </button>

            <div class="layout-segmented" id="layout-mode-group">
              <button class="seg-btn active" data-layout="labyrinth_main" title="Inner Ear Main + 3D Head PiP">
                Ear Main
              </button>
              <button class="seg-btn" data-layout="head_main" title="Swap Role: 3D Head Main + Inner Ear PiP">
                Swap ⇄
              </button>
              <button class="seg-btn" data-layout="split_50_50" title="Side-by-Side 50/50 Split View">
                50/50 Split
              </button>
            </div>
          </div>
        </header>

        <!-- MAIN WORKSPACE BODY -->
        <div class="lab-body">
          <!-- WebGL Viewport Host -->
          <div class="canvas-stage-host" id="canvas-stage-host">
            <!-- 2D Projected Fiducial & Structure Callout Pins -->
            <div class="pins-overlay-layer" id="pins-overlay-layer"></div>

            <!-- Synchronized Dual-Stage PiP / Split Frame HUD -->
            <div class="pip-frame-hud" id="pip-frame-hud">
              <div class="pip-header">
                <span class="pip-title" id="pip-stage-title">3D HEAD &amp; EAR VIEW</span>
                <div style="display:flex;gap:4px;">
                  <button class="pip-btn" id="pip-swap-btn" type="button" aria-label="Swap main and PiP stages">Swap View ⇄</button>
                  <button class="pip-btn" id="pip-hide-btn" type="button" aria-label="Hide head PiP inset" title="Hide 3D Head View">✕</button>
                </div>
              </div>
              <div class="pip-footer">
                <div class="pip-slider-row">
                  <span>Skin See-Through</span>
                  <input type="range" id="head-opacity-slider" min="0" max="90" value="34" aria-label="Skin see-through opacity" />
                  <label class="pip-sync-label">
                    <input type="checkbox" id="sync-cam-checkbox" checked aria-label="Link camera views" /> Link Views
                  </label>
                </div>
                <div class="pip-slider-row">
                  <span>Turn Head (Left/Right)</span>
                  <input type="range" id="head-yaw-slider" min="-90" max="150" step="1" value="0" aria-label="Turn head left or right angle" />
                  <span id="head-yaw-val" style="width:36px;text-align:right;">0°</span>
                </div>
                <div class="pip-slider-row">
                  <span>Tilt Head (Back/Forward)</span>
                  <input type="range" id="head-pitch-slider" min="-20" max="130" step="1" value="0" aria-label="Tilt head back or forward angle" />
                  <span id="head-pitch-val" style="width:36px;text-align:right;">0°</span>
                </div>
              </div>
            </div>

            <!-- PHASE 5: MODE 1 INTERACTIVE 3D ANATOMY QUIZ PANEL -->
            <div class="quiz-mode-panel hidden" id="quiz-mode-panel" role="region" aria-label="3D Ear Anatomy Quiz"></div>

            <!-- Bottom Camera View Angle Bar -->
            <div class="camera-preset-bar" id="camera-preset-bar">
              <span class="cam-label">VIEW ANGLE:</span>
              <button class="cam-btn" data-cam="posterior_3_4">Overview</button>
              <button class="cam-btn" data-cam="right_lateral">Outer Side</button>
              <button class="cam-btn" data-cam="anterior">Front</button>
              <button class="cam-btn" data-cam="superior">Top</button>
              <button class="cam-btn" data-cam="medial">Inner Side</button>
              <button class="cam-btn" data-cam="posterior_ampulla_zoom">Balance Sensor</button>
              <button class="cam-btn" data-cam="cochlea_zoom">Hearing Snail</button>
            </div>

            <!-- MODE 2: REAL-TIME BPPV & EPLEY TREATMENT BAR -->
            <div class="epley-sandbox-bar" id="epley-sandbox-bar">
              <div class="epley-top-row">
                <button class="tour-play-btn" id="btn-tour-play">▶ Play Audio Guide</button>
                <div class="epley-steps-strip" id="epley-steps-strip"></div>
                <button
                  class="seg-btn predict-toggle-btn"
                  id="btn-toggle-predict"
                  type="button"
                  aria-label="Toggle Epley Step Predict Mode"
                  aria-pressed="false"
                  title="Predict crystal movement and spinning sensation before playing each Epley step"
                >
                  Predict Step
                </button>
                <label class="epley-mute-label">
                  <input type="checkbox" id="chk-mute-audio" aria-label="Mute audio guide" /> Mute Audio
                </label>
              </div>

              <!-- PHASE 5: MODE 2 EPLEY STEP PREDICTION PANEL -->
              <div class="epley-predict-panel hidden" id="epley-predict-panel" role="region" aria-label="Predict Epley Step Outcome"></div>

              <div class="epley-caption-banner">
                <div class="epley-caption-headline" id="epley-caption-headline">
                  Step 1: Sit Upright &amp; Turn Head 45° Right
                </div>
                <div class="epley-caption-sub" id="epley-caption-sub">
                  Click any Epley step button above (or use the Turn/Tilt Head sliders in the top-right box) to watch gravity guide the loose balance crystals through the ear tube.
                </div>
              </div>

              <!-- Patient-Friendly Visual Progress & Sensation Bar (Default in Patient Mode) -->
              <div class="epley-patient-telemetry" id="patient-telemetry-grid">
                <div class="patient-tel-card">
                  <div class="patient-tel-header">
                    <span class="patient-tel-label">Crystal Clearance Progress</span>
                    <span class="patient-tel-value" id="patient-clearance-text" style="color:var(--warm);">0% Cleared</span>
                  </div>
                  <div class="patient-progress-track">
                    <div class="patient-progress-fill" id="patient-clearance-fill" style="width: 0%;"></div>
                  </div>
                </div>
                <div class="patient-tel-card">
                  <span class="patient-tel-label">Dizziness / Spinning Sensation</span>
                  <div class="patient-sensation-row">
                    <span class="sensation-dot calm" id="patient-sensation-dot"></span>
                    <span class="patient-tel-value" id="patient-sensation-text">Calm (No Spinning)</span>
                  </div>
                </div>
                <div class="patient-tel-card">
                  <span class="patient-tel-label">Crystal Location</span>
                  <span class="patient-tel-value" id="patient-location-text" style="color:var(--cyan);">Trapped in Bottom Loop</span>
                </div>
              </div>

              <!-- Clinical & Physics Telemetry Grid (Shown in Student / Clinician / Advanced Mode) -->
              <div class="epley-telemetry-grid" id="technical-telemetry-grid">
                <div class="tel-box">
                  <span class="tel-label">Otoconia Angle &amp; Arc</span>
                  <span class="tel-value" id="tel-phi-arc" style="color:var(--warm);">-84.0° (1.82 mm)</span>
                </div>
                <div class="tel-box">
                  <span class="tel-label">Gravity Drive (g · T)</span>
                  <span class="tel-value" id="tel-gravity-drive">+0.00 (Settled)</span>
                </div>
                <div class="tel-box">
                  <span class="tel-label">CN VIII Ampullary Firing</span>
                  <span class="tel-value" id="tel-spike-rate">90 spk/s</span>
                </div>
                <div class="tel-box">
                  <span class="tel-label">VOR Nystagmus State</span>
                  <span class="tel-value" id="tel-nystagmus">Baseline (None)</span>
                </div>
                <div class="tel-box">
                  <span class="tel-label">Anatomical Region</span>
                  <span class="tel-value" id="tel-region" style="color:var(--cyan);">Posterior Canal (Base)</span>
                </div>
              </div>
            </div>

            <!-- RESPONSIVE PANEL SHELL (Desktop: Floating Left & Right Panels | <=900px: Bottom Tabbed Drawer) -->
            <div class="workspace-panels-shell" id="workspace-panels-shell" data-active-tab="presets">
              <div class="mobile-drawer-header" id="mobile-drawer-header">
                <button
                  class="mobile-drawer-handle"
                  id="mobile-drawer-handle"
                  type="button"
                  aria-label="Swipe or tap to expand or collapse bottom drawer"
                  aria-expanded="false"
                >
                  <span class="drawer-pill-grip"></span>
                  <span class="drawer-handle-text" id="drawer-handle-text">▴ Tap or swipe to expand drawer</span>
                </button>
                <div class="mobile-drawer-tabs" id="mobile-drawer-tabs" role="tablist" aria-label="Ear tools and anatomy tabs">
                  <button class="drawer-tab-btn active" type="button" role="tab" aria-selected="true" data-drawer-tab="presets">Views</button>
                  <button class="drawer-tab-btn" type="button" role="tab" aria-selected="false" data-drawer-tab="dissect">Peel</button>
                  <button class="drawer-tab-btn" type="button" role="tab" aria-selected="false" data-drawer-tab="layers">Layers</button>
                  <button class="drawer-tab-btn" type="button" role="tab" aria-selected="false" data-drawer-tab="slicer">Overlays</button>
                  <button class="drawer-tab-btn" type="button" role="tab" aria-selected="false" data-drawer-tab="info">Info</button>
                  <button class="drawer-tab-btn" type="button" role="tab" aria-selected="false" data-drawer-tab="parts">Parts</button>
                </div>
              </div>

              <!-- Left Floating Layer & View Control Dock -->
              <aside class="left-tool-dock" id="left-tool-dock" aria-label="Left View and Layer Control Panel">
                <div class="panel-collapse-bar">
                  <span class="panel-collapse-title">Views &amp; Layer Controls</span>
                  <button
                    class="panel-toggle-btn"
                    id="btn-toggle-left-panel"
                    type="button"
                    aria-label="Toggle left control panel"
                    aria-expanded="true"
                    title="Collapse or expand left control panel"
                  >
                    <span class="toggle-icon">◀</span>
                    <span class="toggle-label">Hide</span>
                  </button>
                </div>

                <div class="left-dock-scroll-body" id="left-dock-scroll-body">
                  <!-- Phase 3: Advanced Tools Toggle Bar (Off by default) -->
                  <div class="advanced-tools-bar" id="advanced-tools-bar">
                    <label class="advanced-tools-label" for="chk-advanced-tools" title="Show or hide expert tools: 3-axis slicer, fiducial landmarks, canal protractors, radial explode, scalpel &amp; brush">
                      <span class="advanced-tools-title">Advanced tools</span>
                      <span class="advanced-tools-sub">Cross-section slicer, landmarks, protractors &amp; expert tools</span>
                    </label>
                    <input
                      type="checkbox"
                      id="chk-advanced-tools"
                      aria-label="Advanced tools"
                    />
                  </div>

                  <!-- Section 1: Quick View Presets -->
                  <div class="dock-section" data-tab-pane="presets">
                    <div class="dock-section-title">
                      <span>1. Quick View Presets</span>
                    </div>
                    <div class="preset-list" id="preset-list"></div>
                  </div>

                  <!-- Section 2: Active Structure Actions -->
                  <div class="dock-section" data-tab-pane="dissect">
                    <div class="dock-section-title">
                      <span>2. Focus &amp; Peel Selected Part</span>
                    </div>
                    <div class="action-grid" style="margin-bottom:6px;">
                      <button class="action-btn" id="btn-fly-selected">Zoom to Part</button>
                      <button class="action-btn" id="btn-isolate-selected">Show Only This Part</button>
                      <button class="action-btn" id="btn-ghost-others">Make Others See-Through</button>
                      <button class="action-btn" id="btn-hide-selected">Hide This Part</button>
                    </div>
                    <div class="action-grid advanced-tool-item" id="scalpel-brush-grid" style="margin-bottom:6px;">
                      <button class="action-btn" id="btn-tool-scalpel" title="Click any 3D structure to immediately peel/hide it">
                        Scalpel: Click-Hide
                      </button>
                      <button class="action-btn" id="btn-tool-xray" title="Click any 3D structure to make it see-through">
                        Brush: Click-Ghost
                      </button>
                    </div>
                    <div class="action-grid">
                      <button class="action-btn" id="btn-undo-dissect" disabled>Undo Last Step</button>
                      <button class="action-btn" id="btn-reset-all">Reset View</button>
                    </div>
                  </div>

                  <!-- Section 3: Layer Peel & Cutaway -->
                  <div class="dock-section" data-tab-pane="layers">
                    <div class="dock-section-title">
                      <span>3. Peel Outer Layers</span>
                    </div>

                    <div class="control-slider-group">
                      <div class="slider-header">
                        <span>Outer Bone Peel</span>
                        <span class="slider-val" id="bony-peel-val">80%</span>
                      </div>
                      <input type="range" class="lab-range" id="bony-peel-slider" min="0" max="100" value="80" aria-label="Outer bone peel percentage" />
                    </div>

                    <div class="control-slider-group">
                      <div class="slider-header">
                        <span>Open Balance &amp; Hearing Shells</span>
                        <span class="slider-val" id="micro-cut-val">35%</span>
                      </div>
                      <input type="range" class="lab-range" id="micro-cut-slider" min="0" max="100" value="35" aria-label="Open balance and hearing shells percentage" />
                    </div>

                    <div class="control-slider-group advanced-tool-item" id="explode-control-group">
                      <div class="slider-header">
                        <span>Separate All 27 Parts (Explode)</span>
                        <span class="slider-val" id="explode-val">0%</span>
                      </div>
                      <input type="range" class="lab-range" id="explode-slider" min="0" max="100" value="0" aria-label="Separate all 27 parts percentage" />
                    </div>
                  </div>

                  <!-- Section 4: 3-Axis Multi-Planar Cross-Section Slicer (Advanced Tool) -->
                  <div class="dock-section advanced-tool-item" id="ras-slicer-section" data-tab-pane="slicer">
                    <div class="dock-section-title">
                      <span>4. 3D Cross-Section Slicer</span>
                      <label class="inline-flip-label" style="font-size:10px;cursor:pointer;color:var(--text-muted);">
                        <input type="checkbox" id="clip-flip-checkbox" /> Flip
                      </label>
                    </div>
                    <div class="layout-segmented" id="clip-axis-group" style="margin-bottom:8px;width:100%;">
                      <button class="seg-btn active" data-clip="none" style="flex:1;">Off</button>
                      <button class="seg-btn" data-clip="axial_z" style="flex:1;">Top-Down</button>
                      <button class="seg-btn" data-clip="coronal_y" style="flex:1;">Front-Back</button>
                      <button class="seg-btn" data-clip="sagittal_x" style="flex:1;">Side-to-Side</button>
                    </div>
                    <div class="control-slider-group" id="clip-offset-row">
                      <div class="slider-header">
                        <span>Slice Position</span>
                        <span class="slider-val" id="clip-offset-val">0.0 mm</span>
                      </div>
                      <input type="range" class="lab-range" id="clip-offset-slider" min="-7.0" max="11.0" step="0.1" value="0.0" aria-label="Slice position in millimeters" />
                    </div>
                  </div>

                  <!-- Section 5: Reference Landmarks, Canal Planes & BPPV Path -->
                  <div class="dock-section" data-tab-pane="slicer" style="border-bottom:none;">
                    <div class="dock-section-title">
                      <span>5. Overlays &amp; Crystal Path</span>
                    </div>
                    <label class="toggle-row advanced-tool-item" id="fiducials-toggle-row">
                      <span>3D Slicer Landmark Pins (.fcsv)</span>
                      <input type="checkbox" id="chk-fiducials" />
                    </label>
                    <label class="toggle-row advanced-tool-item" id="canal-planes-toggle-row">
                      <span>Canal Plane Protractors (LARP/RALP/Lat)</span>
                      <input type="checkbox" id="chk-canal-planes" />
                    </label>
                    <label class="toggle-row">
                      <span>Balance Tube Path &amp; 5 Crystals</span>
                      <input type="checkbox" id="chk-spline-canaliths" checked />
                    </label>
                    <div class="mode2-only-left-controls" id="mode2-only-left-controls">
                      <label class="toggle-row">
                        <span>Live Gravity Simulation (Mode 2)</span>
                        <input type="checkbox" id="chk-live-physics" />
                      </label>

                      <div class="control-slider-group" style="margin-top:8px;">
                        <div class="slider-header">
                          <span>Manual Crystal Position (φ)</span>
                          <span class="slider-val" id="canalith-phi-val">-84° (Base)</span>
                        </div>
                        <input type="range" class="lab-range" id="canalith-phi-slider" min="-105" max="192" step="1" value="-84" aria-label="Canalith angular position phi" />
                      </div>
                    </div>
                  </div>
                </div>
              </aside>

              <!-- RIGHT FLOATING INFO CARD & COLLAPSIBLE 27-PART LAYER TREE -->
              <aside class="right-inspector-drawer" id="right-inspector-drawer" aria-label="Right Part Info and List Panel">
                <div class="panel-collapse-bar right-collapse-bar">
                  <span class="panel-collapse-title">Part Info &amp; List</span>
                  <div class="right-bar-actions">
                    <button
                      class="panel-toggle-btn"
                      id="btn-toggle-right-panel"
                      type="button"
                      aria-label="Toggle right info and part-list panel"
                      aria-expanded="true"
                      title="Collapse or expand right panel"
                    >
                      <span class="toggle-icon">▶</span>
                    </button>
                  </div>
                </div>

                <div class="right-drawer-body" id="right-drawer-body">
                  <!-- Interactive Anatomical Breadcrumb (Moved from Top Header to prevent overflow) -->
                  <nav class="breadcrumb-bar" id="breadcrumb-bar" data-tab-pane="info" aria-label="Selected structure path"></nav>

                  <!-- Phase 5: Audience Depth Selector (Patient default / Student / Clinician) -->
                  <div class="audience-selector-bar" id="audience-selector-bar" data-tab-pane="info">
                    <span class="audience-bar-label">Explanation:</span>
                    <div class="layout-segmented audience-segmented" id="audience-mode-group" role="group" aria-label="Info card explanation level">
                      <button class="seg-btn active" type="button" data-audience-mode="patient" title="Patient: Simple everyday explanation of balance and hearing parts">
                        Patient
                      </button>
                      <button class="seg-btn" type="button" data-audience-mode="student" title="Student: Core anatomy, nerve supply, physiology, and clinical pearls">
                        Student
                      </button>
                      <button class="seg-btn" type="button" data-audience-mode="clinician" title="Clinician: Full RAS morphometry, mesh telemetry, and diagnostic pearls">
                        Clinician
                      </button>
                    </div>
                  </div>

                  <!-- Floating Info Card (Compact by default, single expand button inside) -->
                  <div
                    class="inspector-card compact"
                    id="inspector-card-container"
                    data-tab-pane="info"
                    role="region"
                    aria-label="Selected part information"
                    tabindex="0"
                  ></div>

                  <!-- Collapsible 27-Part Layer Tree Section -->
                  <div class="part-list-section" id="part-list-section" data-tab-pane="parts">
                    <button
                      class="part-list-toggle-bar"
                      id="btn-toggle-part-list"
                      type="button"
                      aria-label="Toggle 27-part inner ear list"
                      aria-expanded="false"
                    >
                      <span>All 27 Inner Ear Parts</span>
                      <span class="part-list-chevron" id="part-list-chevron">▸ Show 27 Parts</span>
                    </button>
                    <div class="layer-tree-container collapsed" id="layer-tree-container"></div>
                  </div>

                  <!-- Phase 6: Educational Disclaimer Footer -->
                  <div class="education-disclaimer-footer" id="education-disclaimer-footer" data-tab-pane="info">
                    <span>For education only, not for diagnosis.</span>
                    <button
                      class="disclaimer-link-btn"
                      id="btn-footer-about"
                      type="button"
                      aria-label="Open About and Sources dialog"
                    >
                      Sources &amp; About
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>

        <!-- LOADING OVERLAY -->
        <div class="loading-overlay" id="loading-overlay">
          <span class="brand-badge">LOADING INNER EAR 3D GUIDE</span>
          <div style="font-size:14px;font-weight:600;" id="loading-status-text">
            Loading 3D Inner Ear &amp; Head Models...
          </div>
          <div class="loading-count-badge" id="loading-count-text">
            0 / 38 assets (0%)
          </div>
          <div class="loading-bar-track">
            <div class="loading-bar-fill" id="loading-bar-fill"></div>
          </div>
        </div>

        <!-- PHASE 3: FIRST-VISIT WELCOME OVERLAY -->
        <div class="welcome-overlay hidden" id="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title">
          <div class="welcome-card">
            <div class="welcome-card-header">
              <span class="brand-badge">INNER EAR 3D GUIDE</span>
              <button
                class="welcome-close-btn"
                id="btn-close-welcome"
                type="button"
                aria-label="Close welcome dialog"
                title="Dismiss welcome overlay"
              >✕</button>
            </div>
            <h2 class="welcome-title" id="welcome-modal-title">
              Explore Your Inner Ear, Balance &amp; Vertigo (BPPV)
            </h2>
            <p class="welcome-subtitle">
              See how tiny balance crystals inside your ear cause spinning dizziness (vertigo) — and how gentle head movements guide them back into place:
            </p>
            <div class="welcome-options-grid">
              <button
                class="welcome-option-btn"
                type="button"
                data-welcome-choice="guided_tour"
                aria-label="Watch Guided Tour: Start the narrated step-by-step walkthrough"
              >
                <span class="welcome-opt-badge">AUDIO + 3D WALKTHROUGH</span>
                <span class="welcome-opt-title">Watch Guided Tour</span>
                <span class="welcome-opt-desc">
                  Watch and listen to a step-by-step walkthrough of how loose ear crystals cause vertigo and how the Epley treatment clears them.
                </span>
              </button>

              <button
                class="welcome-option-btn"
                type="button"
                data-welcome-choice="explore_atlas"
                aria-label="Explore 3D Ear Anatomy: Open Mode 1 interactive ear model"
              >
                <span class="welcome-opt-badge">1 · EAR ANATOMY</span>
                <span class="welcome-opt-title">Explore 3D Ear Anatomy</span>
                <span class="welcome-opt-desc">
                  Look inside the balance loops and hearing snail, peel away outer bone layers, and click any part to learn what it does.
                </span>
              </button>

              <button
                class="welcome-option-btn"
                type="button"
                data-welcome-choice="epley_lab"
                aria-label="Try Epley Treatment Simulator: Open Mode 2 vertigo and Epley simulator"
              >
                <span class="welcome-opt-badge">2 · VERTIGO &amp; EPLEY</span>
                <span class="welcome-opt-title">Try Epley Treatment Simulator</span>
                <span class="welcome-opt-desc">
                  Turn and tilt the 3D head or step through the Epley maneuver to watch gravity guide loose crystals out of the balance tube.
                </span>
              </button>
            </div>
            <div class="welcome-disclaimer-note">
              For education only, not for diagnosis.
            </div>
          </div>
        </div>

        <!-- PHASE 6: ABOUT, VERIFIED SOURCES & EDUCATIONAL DISCLAIMER MODAL -->
        <div class="welcome-overlay hidden" id="about-disclaimer-modal" role="dialog" aria-modal="true" aria-labelledby="about-modal-title">
          <div class="welcome-card about-modal-card">
            <div class="welcome-card-header">
              <span class="brand-badge">ABOUT &amp; VERIFIED SOURCES · IE-MAP v1.0.0</span>
              <button
                class="welcome-close-btn"
                id="btn-close-about"
                type="button"
                aria-label="Close About and Disclaimer dialog"
                title="Close About dialog"
              >✕</button>
            </div>
            <h2 class="welcome-title" id="about-modal-title">
              3D Atlas Data Sources, Citations &amp; Educational Disclaimer
            </h2>
            <div class="about-disclaimer-banner" id="about-disclaimer-banner">
              <strong>Disclaimer:</strong> For education only, not for diagnosis. This interactive 3D inner ear guide and BPPV crystal-clearing simulator is intended solely for anatomical and patient/clinical education and must not be used for medical diagnosis or self-treatment without a qualified clinician.
            </div>
            <div class="clinical-field">
              <div class="clinical-field-label">Verified 3D Micro-CT Atlas &amp; Clinical Literature Sources</div>
              <ul class="sources-list">
                <li>
                  <strong>IE-Map Atlas (2021):</strong> Ahmadi et al., <em>Sci Rep</em> 11, 3293 (2021). <code>doi:10.1038/s41598-021-82716-0</code> · Zenodo Record <code>10625570</code> (Right Inner Ear RAS Template &amp; 27-Mesh Surface Segmentation).
                </li>
                <li>
                  <strong>Membranous Labyrinth Reconstruction (2016):</strong> David et al., <em>Sci Rep</em> 6, 32772 (2016). <code>doi:10.1038/srep32772</code> (Human Membranous Labyrinth Micro-CT Source).
                </li>
                <li>
                  <strong>Clinical Practice Guideline — BPPV &amp; Canalith Repositioning (2017):</strong> Bhattacharyya et al., <em>Otolaryngol Head Neck Surg</em> 156(3_suppl), S1–S47 (2017).
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;

    this.canvasHost = this.root.querySelector('#canvas-stage-host')!;
    this.pinsLayer = this.root.querySelector('#pins-overlay-layer')!;
    this.pipHudFrame = this.root.querySelector('#pip-frame-hud')!;
    this.pipTitleEl = this.root.querySelector('#pip-stage-title')!;
    this.breadcrumbBar = this.root.querySelector('#breadcrumb-bar')!;
    this.inspectorContainer = this.root.querySelector('#inspector-card-container')!;
    this.layerTreeContainer = this.root.querySelector('#layer-tree-container')!;
    this.loadingOverlay = this.root.querySelector('#loading-overlay')!;
    this.loadingBarFill = this.root.querySelector('#loading-bar-fill')!;
    this.loadingText = this.root.querySelector('#loading-status-text')!;
    this.loadingCountText = this.root.querySelector('#loading-count-text')!;
    this.welcomeOverlay = this.root.querySelector('#welcome-overlay')!;
    this.aboutModalEl = this.root.querySelector('#about-disclaimer-modal')!;
    this.advancedToolsCheckbox = this.root.querySelector('#chk-advanced-tools')!;
    this.quizPanelEl = this.root.querySelector('#quiz-mode-panel')!;
    this.quizToggleBtn = this.root.querySelector('#btn-toggle-quiz')!;
    this.predictPanelEl = this.root.querySelector('#epley-predict-panel')!;
    this.predictToggleBtn = this.root.querySelector('#btn-toggle-predict')!;

    this.workspacePanelsShell = this.root.querySelector('#workspace-panels-shell')!;
    this.mobileDrawerHeader = this.root.querySelector('#mobile-drawer-header')!;
    this.mobileDrawerHandleBtn = this.root.querySelector('#mobile-drawer-handle')!;
    this.pipToggleBtn = this.root.querySelector('#btn-toggle-pip-inset')!;

    this.leftDockEl = this.root.querySelector('#left-tool-dock')!;
    this.leftPanelToggleBtn = this.root.querySelector('#btn-toggle-left-panel')!;
    this.rightDrawerEl = this.root.querySelector('#right-inspector-drawer')!;
    this.rightPanelToggleBtn = this.root.querySelector('#btn-toggle-right-panel')!;
    this.partListToggleBtn = this.root.querySelector('#btn-toggle-part-list')!;

    this.epleySandboxBar = this.root.querySelector('#epley-sandbox-bar')!;
    this.cameraPresetBar = this.root.querySelector('#camera-preset-bar')!;
    this.tourPlayBtn = this.root.querySelector('#btn-tour-play')!;
    this.epleyCaptionHeadline = this.root.querySelector('#epley-caption-headline')!;
    this.epleyCaptionSub = this.root.querySelector('#epley-caption-sub')!;
    this.patientTelemetryGrid = this.root.querySelector('#patient-telemetry-grid')!;
    this.technicalTelemetryGrid = this.root.querySelector('#technical-telemetry-grid')!;
    this.patientClearanceText = this.root.querySelector('#patient-clearance-text')!;
    this.patientClearanceFill = this.root.querySelector('#patient-clearance-fill')!;
    this.patientSensationDot = this.root.querySelector('#patient-sensation-dot')!;
    this.patientSensationText = this.root.querySelector('#patient-sensation-text')!;
    this.patientLocationText = this.root.querySelector('#patient-location-text')!;
    this.telPhiArc = this.root.querySelector('#tel-phi-arc')!;
    this.telGravityDrive = this.root.querySelector('#tel-gravity-drive')!;
    this.telSpikeRate = this.root.querySelector('#tel-spike-rate')!;
    this.telNystagmus = this.root.querySelector('#tel-nystagmus')!;
    this.telRegion = this.root.querySelector('#tel-region')!;

    this.bonyPeelInput = this.root.querySelector('#bony-peel-slider')!;
    this.bonyPeelVal = this.root.querySelector('#bony-peel-val')!;
    this.microCutInput = this.root.querySelector('#micro-cut-slider')!;
    this.microCutVal = this.root.querySelector('#micro-cut-val')!;
    this.explodeInput = this.root.querySelector('#explode-slider')!;
    this.explodeVal = this.root.querySelector('#explode-val')!;
    this.canalithPhiInput = this.root.querySelector('#canalith-phi-slider')!;
    this.canalithPhiVal = this.root.querySelector('#canalith-phi-val')!;
    this.clipOffsetInput = this.root.querySelector('#clip-offset-slider')!;
    this.clipOffsetVal = this.root.querySelector('#clip-offset-val')!;
    this.headOpacityInput = this.root.querySelector('#head-opacity-slider')!;
    this.headYawInput = this.root.querySelector('#head-yaw-slider')!;
    this.headYawVal = this.root.querySelector('#head-yaw-val')!;
    this.headPitchInput = this.root.querySelector('#head-pitch-slider')!;
    this.headPitchVal = this.root.querySelector('#head-pitch-val')!;
    this.undoBtn = this.root.querySelector('#btn-undo-dissect')!;

    this.bindUIEvents();
  }

  private bindUIEvents(): void {
    // 0. Mode 1 <-> Mode 2 Switcher & Epley Step Buttons
    this.root.querySelector('#app-mode-switcher')!.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-app-mode]');
      if (!btn) return;
      const nextMode = btn.dataset.appMode as LabAppMode;
      if (nextMode === 'mode2_physics') {
        if (this.quizActive) {
          this.quizActive = false;
          this.scene.setLockedSelectionMesh(null);
          this.scene.setOverlays({ labelMode: this.quizSavedLabelMode });
        }
        this.leftPanelCollapsed = true;
        this.partListCollapsed = true;
        this.mobileDrawerExpanded = false;
      } else if (nextMode === 'mode1_atlas') {
        if (this.predictModeActive) {
          this.predictModeActive = false;
        }
        this.leftPanelCollapsed = false;
      }
      this.scene.setAppMode(nextMode);
      this.applyPanelStatesToDOM();
      this.syncViewportRects();
    });

    const stepsStrip = this.root.querySelector('#epley-steps-strip')!;
    stepsStrip.innerHTML = EPLEY_CLINICAL_STEPS.map(
      (st) => `
        <button class="epley-step-btn" data-epley-step="${st.stepIndex}" title="${st.clinicalTitle}">
          ${st.shortTitle}
        </button>
      `
    ).join('');

    stepsStrip.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-epley-step]');
      if (!btn) return;
      const idx = parseInt(btn.dataset.epleyStep!, 10);
      this.scene.stopGuidedTour();
      if (this.predictModeActive) {
        this.predictPendingStepIdx = idx;
        this.predictRevealed = false;
        this.renderPredictPanel();
        this.renderState(this.scene.getSnapshot());
        return;
      }
      this.scene.jumpToEpleyStep(idx, true);
    });

    this.tourPlayBtn.addEventListener('click', () => {
      if (this.predictModeActive) {
        this.predictModeActive = false;
        this.applyPanelStatesToDOM();
      }
      this.scene.toggleGuidedTour();
    });

    this.root.querySelector('#chk-mute-audio')!.addEventListener('change', (ev) => {
      this.scene.setAudioMuted((ev.target as HTMLInputElement).checked);
    });

    this.root.querySelector('#chk-live-physics')!.addEventListener('change', (ev) => {
      const enabled = (ev.target as HTMLInputElement).checked;
      this.scene.setOverlays({ livePhysicsEnabled: enabled });
    });

    // 1. Dissection Presets
    const presetListEl = this.root.querySelector('#preset-list')!;
    presetListEl.innerHTML = DISSECTION_PRESETS.map(
      (p) => `
        <button class="preset-btn" data-preset="${p.id}" title="${p.description}">
          <span class="preset-btn-title">${p.title}</span>
          <span class="preset-badge">${p.badge}</span>
        </button>
      `
    ).join('');

    presetListEl.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-preset]');
      if (!btn) return;
      this.scene.applyDissectionPreset(btn.dataset.preset!);
    });

    // 2. Dissection Action Buttons
    this.root.querySelector('#btn-fly-selected')!.addEventListener('click', () => {
      const sel = this.scene.getSnapshot().selectedMesh;
      if (sel) this.scene.flyToStructure(sel);
    });
    this.root.querySelector('#btn-isolate-selected')!.addEventListener('click', () => {
      this.scene.isolateSelected();
    });
    this.root.querySelector('#btn-ghost-others')!.addEventListener('click', () => {
      this.scene.ghostOthersAroundSelected();
    });
    this.root.querySelector('#btn-hide-selected')!.addEventListener('click', () => {
      this.scene.hideSelected();
    });
    this.root.querySelector('#btn-tool-scalpel')!.addEventListener('click', () => {
      const cur = this.scene.getSnapshot().toolMode;
      this.scene.setOverlays({
        toolMode: cur === 'scalpel_hide' ? 'inspect' : 'scalpel_hide',
      });
    });
    this.root.querySelector('#btn-tool-xray')!.addEventListener('click', () => {
      const cur = this.scene.getSnapshot().toolMode;
      this.scene.setOverlays({
        toolMode: cur === 'scalpel_ghost' ? 'inspect' : 'scalpel_ghost',
      });
    });
    this.undoBtn.addEventListener('click', () => this.scene.undoDissection());
    this.root.querySelector('#btn-reset-all')!.addEventListener('click', () => {
      this.scene.resetAllDissection();
    });

    // 3. Layer Peel, Micro-Cutaway, Explode & Canalith Sliders
    this.bonyPeelInput.addEventListener('input', () => {
      this.scene.setSliders({ bonyPeelPercent: parseFloat(this.bonyPeelInput.value) });
    });
    this.microCutInput.addEventListener('input', () => {
      this.scene.setSliders({ microCutawayPercent: parseFloat(this.microCutInput.value) });
    });
    this.explodeInput.addEventListener('input', () => {
      this.scene.setSliders({ explodePercent: parseFloat(this.explodeInput.value) });
    });
    const startPhiDrag = () => this.scene.setPhiSliderDragging(true);
    const endPhiDrag = () => this.scene.setPhiSliderDragging(false);
    this.canalithPhiInput.addEventListener('pointerdown', startPhiDrag);
    this.canalithPhiInput.addEventListener('mousedown', startPhiDrag);
    this.canalithPhiInput.addEventListener('touchstart', startPhiDrag, { passive: true });
    this.canalithPhiInput.addEventListener('pointerup', endPhiDrag);
    this.canalithPhiInput.addEventListener('mouseup', endPhiDrag);
    this.canalithPhiInput.addEventListener('touchend', endPhiDrag, { passive: true });
    this.canalithPhiInput.addEventListener('change', endPhiDrag);
    this.canalithPhiInput.addEventListener('input', () => {
      this.scene.setSliders({ canalithPhiDeg: parseFloat(this.canalithPhiInput.value) });
    });

    // 4. Head Stage Controls (Opacity, Sync, Yaw, Recline, Swap)
    this.headOpacityInput.addEventListener('input', () => {
      this.scene.setSliders({
        headCutawayOpacity: parseFloat(this.headOpacityInput.value) / 100.0,
      });
    });
    this.headYawInput.addEventListener('input', () => {
      this.scene.setSliders({ headYawDeg: parseFloat(this.headYawInput.value) });
    });
    this.headPitchInput.addEventListener('input', () => {
      this.scene.setSliders({ headPitchDeg: parseFloat(this.headPitchInput.value) });
    });
    this.root.querySelector('#sync-cam-checkbox')!.addEventListener('change', (ev) => {
      this.scene.setOverlays({
        syncCameras: (ev.target as HTMLInputElement).checked,
      });
    });
    this.root.querySelector('#pip-swap-btn')!.addEventListener('click', () => {
      const cur = this.scene.getSnapshot().layoutMode;
      const next: ViewportLayoutMode =
        cur === 'labyrinth_main' ? 'head_main' : 'labyrinth_main';
      this.scene.setOverlays({ layoutMode: next });
      this.syncViewportRects();
    });

    // 5. Layout Mode & Label Density Mode Switchers
    this.root.querySelector('#layout-mode-group')!.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-layout]');
      if (!btn) return;
      this.scene.setOverlays({ layoutMode: btn.dataset.layout as ViewportLayoutMode });
      this.syncViewportRects();
    });

    this.root.querySelector('#label-mode-group')!.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-label-mode]');
      if (!btn) return;
      this.scene.setOverlays({ labelMode: btn.dataset.labelMode as LabelDensityMode });
    });

    const handlePinActivate = (ev: Event) => {
      const pinEl = (ev.target as HTMLElement).closest<HTMLElement>('[data-pin-mesh]');
      if (!pinEl) return;
      const meshName = pinEl.dataset.pinMesh!;
      if (!meshName) return;
      this.scene.selectStructure(meshName, false);
      this.handleStructurePickedForQuiz(meshName);
    };
    this.pinsLayer.addEventListener('click', handlePinActivate);

    // 6. Cross-Section Slicer
    this.root.querySelector('#clip-axis-group')!.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-clip]');
      if (!btn) return;
      this.scene.setClippingPlane(btn.dataset.clip as ClipAxisMode);
    });
    this.clipOffsetInput.addEventListener('input', () => {
      const snap = this.scene.getSnapshot();
      if (snap.clipAxis === 'none') {
        this.scene.setClippingPlane('axial_z', parseFloat(this.clipOffsetInput.value));
      } else {
        this.scene.setClippingPlane(snap.clipAxis, parseFloat(this.clipOffsetInput.value));
      }
    });
    this.root.querySelector('#clip-flip-checkbox')!.addEventListener('change', (ev) => {
      const snap = this.scene.getSnapshot();
      this.scene.setClippingPlane(
        snap.clipAxis,
        snap.clipOffsetMm,
        (ev.target as HTMLInputElement).checked
      );
    });

    // 7. Spatial Overlays Checkboxes
    this.root.querySelector('#chk-fiducials')!.addEventListener('change', (ev) => {
      this.scene.setOverlays({ showFiducials: (ev.target as HTMLInputElement).checked });
    });
    this.root.querySelector('#chk-canal-planes')!.addEventListener('change', (ev) => {
      this.scene.setOverlays({ showCanalPlanes: (ev.target as HTMLInputElement).checked });
    });
    this.root.querySelector('#chk-spline-canaliths')!.addEventListener('change', (ev) => {
      this.scene.setOverlays({
        showSplineAndCanaliths: (ev.target as HTMLInputElement).checked,
      });
    });

    // 8. RAS Camera Presets
    this.cameraPresetBar.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-cam]');
      if (!btn) return;
      this.scene.snapCameraViewPreset(btn.dataset.cam as any);
    });

    // 9. Quick Structure Search (Cmd/Ctrl + K)
    const searchInput = this.root.querySelector<HTMLInputElement>('#structure-search-input')!;
    const searchDropdown = this.root.querySelector<HTMLElement>('#structure-search-dropdown')!;

    const updateSearchDropdown = () => {
      const q = searchInput.value.trim().toLowerCase();
      const matches = IEMAP_STRUCTURES.filter(
        (s) =>
          !q ||
          s.displayName.toLowerCase().includes(q) ||
          s.latinName.toLowerCase().includes(q) ||
          s.meshName.toLowerCase().includes(q) ||
          s.clinicalPearl.toLowerCase().includes(q) ||
          s.patientSummary.toLowerCase().includes(q)
      );

      searchDropdown.innerHTML = matches
        .slice(0, 12)
        .map(
          (m) => `
          <div class="search-result-item" data-search-mesh="${m.meshName}">
            <div>
              <div class="search-result-name">${m.displayName}</div>
              ${
                this.audienceMode !== 'patient'
                  ? `<div class="search-result-latin">${m.latinName}</div>`
                  : ''
              }
            </div>
            <span class="preset-badge">${SYSTEM_GROUPS[m.systemGroup].shortTitle}</span>
          </div>
        `
        )
        .join('');
      searchDropdown.classList.add('open');
    };

    searchInput.addEventListener('focus', updateSearchDropdown);
    searchInput.addEventListener('input', updateSearchDropdown);

    searchDropdown.addEventListener('click', (ev) => {
      const row = (ev.target as HTMLElement).closest<HTMLElement>('[data-search-mesh]');
      if (!row) return;
      const meshName = row.dataset.searchMesh!;
      this.scene.selectStructure(meshName, true);
      searchDropdown.classList.remove('open');
      searchInput.value = '';
    });

    document.addEventListener('click', (ev) => {
      if (!(ev.target as HTMLElement).closest('.search-wrapper')) {
        searchDropdown.classList.remove('open');
      }
    });

    window.addEventListener('keydown', (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        searchInput.focus();
      } else if (ev.key === 'Escape') {
        if (this.aboutModalOpen) {
          this.aboutModalOpen = false;
          this.applyPanelStatesToDOM();
        } else if (!this.welcomeDismissed) {
          this.welcomeDismissed = true;
          if (!this.readStorageString(AppHUD.LS_KEYS.welcomeChoice)) {
            this.writeStorageString(AppHUD.LS_KEYS.welcomeChoice, 'explore_atlas');
          }
          this.applyPanelStatesToDOM();
        } else if (searchDropdown.classList.contains('open')) {
          searchDropdown.classList.remove('open');
        }
      }
    });

    // 10. Phase 1: Collapsible Panels & Single Expandable Floating Info Card Control
    this.leftPanelToggleBtn.addEventListener('click', () => {
      this.leftPanelCollapsed = !this.leftPanelCollapsed;
      this.writeStorageBool(AppHUD.LS_KEYS.leftCollapsed, this.leftPanelCollapsed);
      this.applyPanelStatesToDOM();
      this.syncViewportRects();
    });

    this.rightPanelToggleBtn.addEventListener('click', () => {
      this.rightPanelCollapsed = !this.rightPanelCollapsed;
      this.writeStorageBool(AppHUD.LS_KEYS.rightCollapsed, this.rightPanelCollapsed);
      this.applyPanelStatesToDOM();
      this.syncViewportRects();
    });

    this.inspectorContainer.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement;
      if (target.closest('a')) return;
      if (!this.infoCardExpanded || target.closest('[data-toggle-info-card]')) {
        this.infoCardExpanded = !this.infoCardExpanded;
        this.writeStorageBool(AppHUD.LS_KEYS.infoExpanded, this.infoCardExpanded);
        if (this.infoCardExpanded && this.rightPanelCollapsed) {
          this.rightPanelCollapsed = false;
          this.writeStorageBool(AppHUD.LS_KEYS.rightCollapsed, false);
        }
        this.applyPanelStatesToDOM();
      }
    });

    this.inspectorContainer.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        this.infoCardExpanded = !this.infoCardExpanded;
        this.writeStorageBool(AppHUD.LS_KEYS.infoExpanded, this.infoCardExpanded);
        this.applyPanelStatesToDOM();
      }
    });

    this.partListToggleBtn.addEventListener('click', () => {
      this.partListCollapsed = !this.partListCollapsed;
      this.writeStorageBool(AppHUD.LS_KEYS.partsCollapsed, this.partListCollapsed);
      this.applyPanelStatesToDOM();
    });

    // 11. Phase 2: Responsive Bottom Drawer Tabs, Swipe/Tap Handle, and PiP Inset Toggle
    this.root.querySelector('#mobile-drawer-tabs')!.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-drawer-tab]');
      if (!btn) return;
      this.activeDrawerTab = btn.dataset.drawerTab as typeof this.activeDrawerTab;
      this.applyPanelStatesToDOM();
    });

    this.mobileDrawerHandleBtn.addEventListener('click', () => {
      this.mobileDrawerExpanded = !this.mobileDrawerExpanded;
      this.applyPanelStatesToDOM();
      this.syncViewportRects();
    });

    this.workspacePanelsShell.addEventListener('transitionend', () => {
      this.syncViewportRects();
    });

    let touchStartY: number | null = null;
    this.mobileDrawerHeader.addEventListener(
      'touchstart',
      (ev) => {
        if (ev.touches.length > 0) {
          touchStartY = ev.touches[0].clientY;
        }
      },
      { passive: true }
    );
    this.mobileDrawerHeader.addEventListener(
      'touchend',
      (ev) => {
        if (touchStartY !== null && ev.changedTouches.length > 0) {
          const dy = ev.changedTouches[0].clientY - touchStartY;
          if (dy < -24) {
            this.mobileDrawerExpanded = true;
            this.applyPanelStatesToDOM();
            this.syncViewportRects();
          } else if (dy > 24) {
            this.mobileDrawerExpanded = false;
            this.applyPanelStatesToDOM();
            this.syncViewportRects();
          }
        }
        touchStartY = null;
      },
      { passive: true }
    );

    const togglePipInset = () => {
      if (this.scene && this.scene.getSnapshot().layoutMode === 'split_50_50') {
        this.scene.setOverlays({ layoutMode: 'labyrinth_main' });
        if (window.innerWidth <= 600) {
          this.pipInsetOpenMobile = false;
        } else {
          this.pipInsetOpenDesktop = false;
        }
      } else if (window.innerWidth <= 600) {
        this.pipInsetOpenMobile = !this.pipInsetOpenMobile;
      } else {
        this.pipInsetOpenDesktop = !this.pipInsetOpenDesktop;
      }
      this.applyPanelStatesToDOM();
      this.syncViewportRects();
    };

    this.pipToggleBtn.addEventListener('click', togglePipInset);
    this.root.querySelector('#pip-hide-btn')!.addEventListener('click', togglePipInset);

    // 12. Phase 3: Welcome Overlay & Advanced Tools Toggle
    this.advancedToolsCheckbox.addEventListener('change', () => {
      this.advancedToolsEnabled = this.advancedToolsCheckbox.checked;
      this.writeStorageBool(AppHUD.LS_KEYS.advancedTools, this.advancedToolsEnabled);
      if (!this.advancedToolsEnabled) {
        const snap = this.scene.getSnapshot();
        if (snap.toolMode !== 'inspect' || snap.showCanalPlanes || snap.showFiducials) {
          this.scene.setOverlays({
            toolMode: 'inspect',
            showCanalPlanes: false,
            showFiducials: false,
          });
        }
        if (snap.clipAxis !== 'none') {
          this.scene.setClippingPlane('none');
        }
        if (snap.explodePercent > 0) {
          this.scene.setSliders({ explodePercent: 0 });
        }
      }
      this.applyPanelStatesToDOM();
    });

    this.root.querySelector('#btn-open-welcome')!.addEventListener('click', () => {
      this.welcomeDismissed = false;
      this.applyPanelStatesToDOM();
    });

    this.root.querySelector('#btn-close-welcome')!.addEventListener('click', () => {
      this.welcomeDismissed = true;
      if (!this.readStorageString(AppHUD.LS_KEYS.welcomeChoice)) {
        this.writeStorageString(AppHUD.LS_KEYS.welcomeChoice, 'explore_atlas');
      }
      this.applyPanelStatesToDOM();
    });

    this.welcomeOverlay.addEventListener('click', (ev) => {
      const choiceBtn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-welcome-choice]');
      if (!choiceBtn) {
        if (ev.target === this.welcomeOverlay) {
          this.welcomeDismissed = true;
          if (!this.readStorageString(AppHUD.LS_KEYS.welcomeChoice)) {
            this.writeStorageString(AppHUD.LS_KEYS.welcomeChoice, 'explore_atlas');
          }
          this.applyPanelStatesToDOM();
        }
        return;
      }
      const choice = choiceBtn.dataset.welcomeChoice!;
      this.writeStorageString(AppHUD.LS_KEYS.welcomeChoice, choice);
      this.welcomeDismissed = true;

      if (choice === 'guided_tour') {
        if (this.quizActive) {
          this.quizActive = false;
          this.scene.setLockedSelectionMesh(null);
          this.scene.setOverlays({ labelMode: this.quizSavedLabelMode });
        }
        this.predictModeActive = false;
        this.leftPanelCollapsed = true;
        this.partListCollapsed = true;
        this.mobileDrawerExpanded = false;
        this.scene.setAppMode('mode2_physics');
        if (!this.scene.getSnapshot().tourPlaying) {
          this.scene.toggleGuidedTour();
        }
      } else if (choice === 'explore_atlas') {
        this.predictModeActive = false;
        this.leftPanelCollapsed = false;
        this.scene.stopGuidedTour();
        this.scene.setAppMode('mode1_atlas');
      } else if (choice === 'epley_lab') {
        if (this.quizActive) {
          this.quizActive = false;
          this.scene.setLockedSelectionMesh(null);
          this.scene.setOverlays({ labelMode: this.quizSavedLabelMode });
        }
        this.leftPanelCollapsed = true;
        this.partListCollapsed = true;
        this.mobileDrawerExpanded = false;
        this.scene.stopGuidedTour();
        this.scene.setAppMode('mode2_physics');
      }
      this.applyPanelStatesToDOM();
      this.syncViewportRects();
    });

    // 13. Phase 5: Audience Mode Selector (Patient / Student / Clinician)
    this.root.querySelector('#audience-mode-group')!.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-audience-mode]');
      if (!btn) return;
      const mode = btn.dataset.audienceMode as 'student' | 'clinician' | 'patient';
      this.audienceMode = mode;
      this.writeStorageString(AppHUD.LS_KEYS.audienceMode, mode);
      if (this.quizActive) {
        this.renderQuizPanel();
      }
      if (this.predictModeActive) {
        this.renderPredictPanel();
      }
      this.renderState(this.scene.getSnapshot());
    });

    // 14. Phase 5: Mode 1 Anatomy Quiz Toggle & Panel Events
    this.quizToggleBtn.addEventListener('click', () => {
      this.quizActive = !this.quizActive;
      if (this.quizActive) {
        if (this.scene.getSnapshot().appMode !== 'mode1_atlas') {
          this.scene.setAppMode('mode1_atlas');
        }
        this.quizSavedLabelMode = this.scene.getSnapshot().labelMode;
        this.startNextQuizQuestion();
      } else {
        this.scene.setLockedSelectionMesh(null);
        this.scene.setOverlays({ labelMode: this.quizSavedLabelMode });
        this.renderState(this.scene.getSnapshot());
        this.applyPanelStatesToDOM();
      }
    });

    this.quizPanelEl.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement;
      const typeBtn = target.closest<HTMLButtonElement>('[data-quiz-type]');
      if (typeBtn) {
        const nextType = typeBtn.dataset.quizType as 'name_highlighted' | 'click_in_3d';
        if (this.quizType !== nextType) {
          this.quizType = nextType;
          this.startNextQuizQuestion();
        }
        return;
      }

      const choiceBtn = target.closest<HTMLButtonElement>('[data-quiz-choice]');
      if (choiceBtn && !this.quizAnswered && this.quizType === 'name_highlighted') {
        const chosenMesh = choiceBtn.dataset.quizChoice!;
        this.quizSelectedChoice = chosenMesh;
        this.quizAnswered = true;
        this.quizTotalCount += 1;
        this.quizLastCorrect = chosenMesh === this.quizTargetMesh;
        if (this.quizLastCorrect) {
          this.quizCorrectCount += 1;
        }
        this.scene.setLockedSelectionMesh(null);
        this.scene.selectStructure(this.quizTargetMesh, false);
        this.renderQuizPanel();
        this.renderState(this.scene.getSnapshot());
        return;
      }

      if (target.closest('#btn-quiz-next')) {
        this.startNextQuizQuestion();
        return;
      }

      if (target.closest('#btn-quiz-hint')) {
        this.scene.flyToStructure(this.quizTargetMesh);
        return;
      }

      if (target.closest('#btn-quiz-reset-score')) {
        this.quizCorrectCount = 0;
        this.quizTotalCount = 0;
        this.startNextQuizQuestion();
        return;
      }

      if (target.closest('#btn-close-quiz')) {
        this.quizActive = false;
        this.scene.setLockedSelectionMesh(null);
        this.scene.setOverlays({ labelMode: this.quizSavedLabelMode });
        this.renderState(this.scene.getSnapshot());
        this.applyPanelStatesToDOM();
      }
    });

    // 15. Phase 5: Mode 2 Epley Step Predict Mode Toggle & Panel Events
    this.predictToggleBtn.addEventListener('click', () => {
      this.predictModeActive = !this.predictModeActive;
      if (this.predictModeActive) {
        this.scene.stopGuidedTour();
        const curIdx = this.scene.getSnapshot().activeEpleyStepIdx;
        this.predictPendingStepIdx =
          curIdx < 2 ? 2 : Math.min(EPLEY_CLINICAL_STEPS.length - 1, curIdx + 1);
        this.predictRevealed = false;
        this.renderPredictPanel();
      }
      this.applyPanelStatesToDOM();
      this.renderState(this.scene.getSnapshot());
    });

    this.predictPanelEl.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement;
      const motionBtn = target.closest<HTMLButtonElement>('[data-predict-motion]');
      if (motionBtn && !this.predictRevealed) {
        this.predictChoiceMotion = motionBtn.dataset.predictMotion as
          | 'stationary'
          | 'ampullofugal'
          | 'enter_utricle';
        this.renderPredictPanel();
        return;
      }

      const nysBtn = target.closest<HTMLButtonElement>('[data-predict-nystagmus]');
      if (nysBtn && !this.predictRevealed) {
        this.predictChoiceNystagmus = nysBtn.dataset.predictNystagmus as
          | 'none'
          | 'upbeat_torsional'
          | 'downbeat_inhibitory';
        this.renderPredictPanel();
        return;
      }

      if (target.closest('#btn-play-and-reveal-prediction') && !this.predictRevealed) {
        const expected = this.getExpectedStepOutcome(this.predictPendingStepIdx);
        this.predictLastMotionCorrect = this.predictChoiceMotion === expected.motion;
        this.predictLastNystagmusCorrect = this.predictChoiceNystagmus === expected.nystagmus;
        this.predictTotalCount += 1;
        if (this.predictLastMotionCorrect && this.predictLastNystagmusCorrect) {
          this.predictCorrectCount += 1;
        }
        this.predictRevealed = true;
        this.scene.jumpToEpleyStep(this.predictPendingStepIdx, true);
        this.renderPredictPanel();
        return;
      }

      if (target.closest('#btn-predict-next-step')) {
        const nextIdx = (this.predictPendingStepIdx + 1) % EPLEY_CLINICAL_STEPS.length;
        this.predictPendingStepIdx = nextIdx < 2 ? 2 : nextIdx;
        this.predictRevealed = false;
        this.renderPredictPanel();
        this.renderState(this.scene.getSnapshot());
        return;
      }

      if (target.closest('#btn-close-predict')) {
        this.predictModeActive = false;
        this.applyPanelStatesToDOM();
        this.renderState(this.scene.getSnapshot());
      }
    });

    // 16. Phase 6: About, Verified Sources & Educational Disclaimer Modal
    const openAboutModal = () => {
      this.aboutModalOpen = true;
      this.applyPanelStatesToDOM();
    };
    this.root.querySelector('#btn-open-about')!.addEventListener('click', openAboutModal);
    this.root.querySelector('#btn-footer-about')!.addEventListener('click', openAboutModal);
    this.root.querySelector('#btn-close-about')!.addEventListener('click', () => {
      this.aboutModalOpen = false;
      this.applyPanelStatesToDOM();
    });
    this.aboutModalEl.addEventListener('click', (ev) => {
      if (ev.target === this.aboutModalEl) {
        this.aboutModalOpen = false;
        this.applyPanelStatesToDOM();
      }
    });
  }

  private getQuizCandidateStructures() {
    // For "Click Part in 3D" (and in Patient mode), use unobstructed surface landmarks
    // so targets are never hidden inside outer ampulla walls or cochlear shells.
    const snap = this.scene.getSnapshot();
    const useUnobstructedPool =
      this.quizType === 'click_in_3d' || this.audienceMode === 'patient';

    const visibleItems = IEMAP_STRUCTURES.filter((item) => {
      if (item.systemGroup === 'bony_capsule') return false;
      if (useUnobstructedPool && !UNOBSTRUCTED_QUIZ_MESHES.has(item.meshName)) return false;
      return (snap.visibilityMap[item.meshName] ?? item.defaultState) === 'visible';
    });

    if (visibleItems.length >= 6) {
      return visibleItems;
    }

    return IEMAP_STRUCTURES.filter((item) => {
      if (item.systemGroup === 'bony_capsule') return false;
      if (useUnobstructedPool && !UNOBSTRUCTED_QUIZ_MESHES.has(item.meshName)) return false;
      return true;
    });
  }

  private startNextQuizQuestion(): void {
    const pool = this.getQuizCandidateStructures();
    const otherCandidates = pool.filter((item) => item.meshName !== this.quizTargetMesh);
    const chosenPool = otherCandidates.length > 0 ? otherCandidates : pool;
    const targetItem = chosenPool[Math.floor(Math.random() * chosenPool.length)] ?? IEMAP_STRUCTURES[0];
    this.quizTargetMesh = targetItem.meshName;
    this.quizSelectedChoice = null;
    this.quizAnswered = false;
    this.quizLastCorrect = false;

    // Ensure the target structure is visible in 3D, and if it is an internal cupula or cochlear partition,
    // ghost its enclosing outer shell so the glowing highlight is clearly visible.
    const snap = this.scene.getSnapshot();
    if ((snap.visibilityMap[this.quizTargetMesh] ?? targetItem.defaultState) !== 'visible') {
      this.scene.setStructureVisibility(this.quizTargetMesh, 'visible');
    }
    const enclosingShellMap: Record<string, string> = {
      ls_Hsapiens_Sp_Cup_Sp: 'ls_Hsapiens_Ap',
      ls_Hsapiens_Sp_Cup_Ut: 'ls_Hsapiens_Ap',
      ls_Hsapiens_Sa_Cup_Sa: 'ls_Hsapiens_Aa',
      ls_Hsapiens_Sa_Cup_Ut: 'ls_Hsapiens_Aa',
      ls_Hsapiens_Sl_Cup_Sl: 'ls_Hsapiens_Al',
      ls_Hsapiens_Sl_Cup_Ut: 'ls_Hsapiens_Al',
      seg_coch_inner_BM: 'mesh_david_cochlea',
      seg_coch_inner_OC: 'mesh_david_cochlea',
      seg_coch_inner_RM: 'mesh_david_cochlea',
      seg_coch_inner_SL: 'mesh_david_cochlea',
      seg_coch_inner_SM: 'mesh_david_cochlea',
      seg_coch_inner_SV_ST: 'mesh_david_cochlea',
    };
    const enclosingShell = enclosingShellMap[this.quizTargetMesh];
    if (enclosingShell && snap.visibilityMap[enclosingShell] === 'visible') {
      this.scene.setStructureVisibility(enclosingShell, 'ghost');
    }

    // Build 4 multiple choice options (target + 3 distractors)
    const distractorPool = pool.filter((item) => item.meshName !== targetItem.meshName);
    const fallbackDistractors =
      distractorPool.length >= 3
        ? distractorPool
        : IEMAP_STRUCTURES.filter(
            (item) => item.systemGroup !== 'bony_capsule' && item.meshName !== targetItem.meshName
          );
    const shuffledDistractors = [...fallbackDistractors]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const options = [targetItem.meshName, ...shuffledDistractors.map((d) => d.meshName)].sort(
      () => Math.random() - 0.5
    );
    this.quizChoices = options;

    // Hide 3D labels while question is active so labels don't give away the answer
    this.scene.setOverlays({ labelMode: 'off' });

    if (this.quizType === 'name_highlighted') {
      this.scene.setLockedSelectionMesh(null);
      this.scene.selectStructure(this.quizTargetMesh, true);
      this.scene.setLockedSelectionMesh(this.quizTargetMesh);
    } else {
      this.scene.setLockedSelectionMesh(null);
      this.scene.selectStructure(null, false);
    }

    this.renderQuizPanel();
    this.renderState(this.scene.getSnapshot());
    this.applyPanelStatesToDOM();
  }

  private handleStructurePickedForQuiz(meshName: string): void {
    if (!this.quizActive || this.quizType !== 'click_in_3d' || this.quizAnswered) {
      return;
    }
    this.quizSelectedChoice = meshName;
    this.quizAnswered = true;
    this.quizTotalCount += 1;
    this.quizLastCorrect = meshName === this.quizTargetMesh;
    this.scene.setLockedSelectionMesh(null);
    if (this.quizLastCorrect) {
      this.quizCorrectCount += 1;
      this.scene.selectStructure(this.quizTargetMesh, false);
    } else {
      this.scene.selectStructure(this.quizTargetMesh, true);
    }
    this.renderQuizPanel();
    this.renderState(this.scene.getSnapshot());
  }

  private renderQuizPanel(): void {
    const targetItem = STRUCTURE_BY_MESH[this.quizTargetMesh] ?? IEMAP_STRUCTURES[0];
    const targetGroup = SYSTEM_GROUPS[targetItem.systemGroup];
    const pickedItem = this.quizSelectedChoice
      ? STRUCTURE_BY_MESH[this.quizSelectedChoice]
      : null;
    const isPatient = this.audienceMode === 'patient';

    const choicesHtml =
      this.quizType === 'name_highlighted'
        ? `
          <div class="quiz-prompt-text">
            Which highlighted 3D part is currently glowing in the inner ear?
          </div>
          <div class="quiz-choices-grid">
            ${this.quizChoices
              .map((meshName) => {
                const item = STRUCTURE_BY_MESH[meshName] ?? IEMAP_STRUCTURES[0];
                let stateClass = '';
                if (this.quizAnswered) {
                  if (meshName === this.quizTargetMesh) {
                    stateClass = 'quiz-choice-correct';
                  } else if (meshName === this.quizSelectedChoice) {
                    stateClass = 'quiz-choice-wrong';
                  }
                }
                return `
                  <button
                    class="quiz-choice-btn ${stateClass}"
                    type="button"
                    data-quiz-choice="${meshName}"
                    ${this.quizAnswered ? 'disabled' : ''}
                  >
                    <span class="quiz-choice-title">${item.displayName}</span>
                    ${
                      !isPatient
                        ? `<span class="quiz-choice-latin">${item.latinName}</span>`
                        : ''
                    }
                  </button>
                `;
              })
              .join('')}
          </div>
        `
        : `
          <div class="quiz-prompt-text">
            Find &amp; click this part directly on the 3D ear model:
          </div>
          <div class="quiz-click-target-banner">
            <div class="quiz-target-name">${targetItem.displayName}</div>
            <div class="quiz-target-sub">${
              isPatient ? targetGroup.shortTitle : `${targetItem.latinName} · ${targetGroup.shortTitle}`
            }</div>
          </div>
          <div class="quiz-click-actions">
            <button class="seg-btn" type="button" id="btn-quiz-hint">Hint: Zoom Near Part</button>
            <button class="seg-btn" type="button" id="btn-quiz-next">Skip / Next Question →</button>
          </div>
        `;

    const feedbackHtml = this.quizAnswered
      ? `
        <div class="quiz-feedback-box ${this.quizLastCorrect ? 'correct' : 'incorrect'}" id="quiz-feedback-box">
          <div class="quiz-feedback-headline">
            ${
              this.quizLastCorrect
                ? `✓ Correct! ${targetItem.displayName}`
                : `✗ Not quite (You picked: ${pickedItem?.displayName ?? 'Another part'} — Answer: ${targetItem.displayName})`
            }
          </div>
          <div class="quiz-feedback-sub">${targetItem.patientSummary}</div>
          <div style="margin-top:6px;display:flex;justify-content:flex-end;">
            <button class="tour-play-btn" type="button" id="btn-quiz-next">Next Question →</button>
          </div>
        </div>
      `
      : '';

    this.quizPanelEl.innerHTML = `
      <div class="quiz-panel-header">
        <div class="quiz-header-left">
          <span class="brand-badge">EAR ANATOMY QUIZ</span>
          <div class="layout-segmented" id="quiz-type-group" role="group" aria-label="Quiz question mode">
            <button
              class="seg-btn ${this.quizType === 'name_highlighted' ? 'active' : ''}"
              type="button"
              data-quiz-type="name_highlighted"
            >
              Name Highlighted Part
            </button>
            <button
              class="seg-btn ${this.quizType === 'click_in_3d' ? 'active' : ''}"
              type="button"
              data-quiz-type="click_in_3d"
            >
              Click Part in 3D
            </button>
          </div>
        </div>
        <div class="quiz-header-right">
          <span class="quiz-score-badge" id="quiz-score-badge">
            Score: ${this.quizCorrectCount} / ${this.quizTotalCount}
          </span>
          <button class="pip-btn" type="button" id="btn-quiz-reset-score" title="Reset session quiz score">Reset</button>
          <button class="pip-btn" type="button" id="btn-close-quiz" aria-label="Close quiz mode" title="Close Quiz Mode">✕</button>
        </div>
      </div>
      <div class="quiz-panel-body" id="quiz-question-body">
        ${choicesHtml}
        ${feedbackHtml}
      </div>
    `;
  }

  private getExpectedStepOutcome(stepIdx: number): {
    motion: 'stationary' | 'ampullofugal' | 'enter_utricle';
    motionLabel: string;
    nystagmus: 'none' | 'upbeat_torsional' | 'downbeat_inhibitory';
    nystagmusLabel: string;
    explanation: string;
  } {
    const isPatient = this.audienceMode === 'patient';
    if (stepIdx <= 2) {
      return {
        motion: 'stationary',
        motionLabel: isPatient
          ? 'Stays settled at the bottom of the loop'
          : 'Stationary at canal base (φ = -84°)',
        nystagmus: 'none',
        nystagmusLabel: isPatient ? 'Calm (No Spinning)' : 'Baseline (None)',
        explanation: isPatient
          ? 'While sitting upright and turning your head 45° right (Step 1), the loose crystals stay resting at the bottom of the loop without pushing the balance sensor.'
          : 'While sitting upright and turning the head 45° right (Step 1), the otoconia remain settled at the gravity-dependent base of the posterior canal (φ = -84°) with no cupular deflection.',
      };
    }
    if (stepIdx >= 3 && stepIdx <= 5) {
      return {
        motion: 'ampullofugal',
        motionLabel: isPatient
          ? 'Slides away from the sensor toward the exit tube'
          : 'Ampullofugal — drains away from ampulla toward Common Crus',
        nystagmus: 'upbeat_torsional',
        nystagmusLabel: isPatient
          ? 'Brief Spinning Sensation (Crystals Moving)'
          : 'Excitatory Upbeat-Torsional (Ewald’s 3rd Law)',
        explanation: isPatient
          ? 'As you lie back and turn your head left (Steps 2–4), gravity pulls the loose crystals around the loop away from the balance sensor toward the exit tube, causing a brief wave of spinning until they settle.'
          : 'During supine extension and contralateral leftward rotation (Steps 2–4), gravity pulls the otoconia ampullofugally away from the posterior cupula toward the apex and Common Crus, exciting CN VIII and driving upbeat-torsional nystagmus.',
      };
    }
    return {
      motion: 'enter_utricle',
      motionLabel: isPatient
        ? 'Drops out of the loop into the resting sac (Utricle)'
        : 'Exits Common Crus & settles in Utricle (φ = +186°)',
      nystagmus: 'none',
      nystagmusLabel: isPatient ? 'Calm (No Spinning)' : 'Baseline (None)',
      explanation: isPatient
        ? 'Sitting back upright in Step 5 lets the crystals drop out of the exit tube into the large resting sac (utricle), where they no longer trigger spinning vertigo!'
        : 'Returning upright in Step 5 empties the otoconia out of the Common Crus into the utricular vestibule (φ = +186°), allowing the posterior cupula to return to neutral baseline.',
    };
  }

  private renderPredictPanel(): void {
    const step = EPLEY_CLINICAL_STEPS[this.predictPendingStepIdx] ?? EPLEY_CLINICAL_STEPS[3];
    const expected = this.getExpectedStepOutcome(this.predictPendingStepIdx);
    const bothRight = this.predictLastMotionCorrect && this.predictLastNystagmusCorrect;
    const isPatient = this.audienceMode === 'patient';

    this.predictPanelEl.innerHTML = `
      <div class="predict-panel-header">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="brand-badge">PREDICT STEP</span>
          <span class="predict-step-target">Before playing <strong>${step.shortTitle}</strong>:</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="quiz-score-badge" id="predict-score-badge">
            Predictions: ${this.predictCorrectCount} / ${this.predictTotalCount}
          </span>
          <button class="pip-btn" type="button" id="btn-close-predict" aria-label="Close predict mode">✕</button>
        </div>
      </div>

      <div class="predict-questions-row">
        <div class="predict-col">
          <div class="predict-col-label">${
            isPatient ? '1. What will the crystals do?' : '1. Predict Canalith Movement:'
          }</div>
          <div class="predict-btn-group">
            <button
              class="seg-btn ${this.predictChoiceMotion === 'stationary' ? 'active' : ''}"
              type="button"
              data-predict-motion="stationary"
              ${this.predictRevealed ? 'disabled' : ''}
            >
              ${isPatient ? 'Stay at Bottom' : 'Stationary at Base'}
            </button>
            <button
              class="seg-btn ${this.predictChoiceMotion === 'ampullofugal' ? 'active' : ''}"
              type="button"
              data-predict-motion="ampullofugal"
              ${this.predictRevealed ? 'disabled' : ''}
            >
              ${isPatient ? 'Slide Along Loop' : 'Ampullofugal (Away from Ampulla)'}
            </button>
            <button
              class="seg-btn ${this.predictChoiceMotion === 'enter_utricle' ? 'active' : ''}"
              type="button"
              data-predict-motion="enter_utricle"
              ${this.predictRevealed ? 'disabled' : ''}
            >
              ${isPatient ? 'Clear into Resting Sac' : 'Exits into Utricle'}
            </button>
          </div>
        </div>

        <div class="predict-col">
          <div class="predict-col-label">${
            isPatient ? '2. Spinning / Dizziness Sensation:' : '2. Predict VOR Nystagmus Direction:'
          }</div>
          <div class="predict-btn-group">
            <button
              class="seg-btn ${this.predictChoiceNystagmus === 'none' ? 'active' : ''}"
              type="button"
              data-predict-nystagmus="none"
              ${this.predictRevealed ? 'disabled' : ''}
            >
              ${isPatient ? 'Calm (None)' : 'Baseline (None)'}
            </button>
            <button
              class="seg-btn ${this.predictChoiceNystagmus === 'upbeat_torsional' ? 'active' : ''}"
              type="button"
              data-predict-nystagmus="upbeat_torsional"
              ${this.predictRevealed ? 'disabled' : ''}
            >
              ${isPatient ? 'Spinning (Crystals Moving)' : 'Excitatory Upbeat-Torsional'}
            </button>
            <button
              class="seg-btn ${this.predictChoiceNystagmus === 'downbeat_inhibitory' ? 'active' : ''}"
              type="button"
              data-predict-nystagmus="downbeat_inhibitory"
              ${this.predictRevealed ? 'disabled' : ''}
            >
              ${isPatient ? 'Reverse Spinning' : 'Inhibitory Reversal'}
            </button>
          </div>
        </div>

        <div class="predict-action-col">
          ${
            !this.predictRevealed
              ? `<button class="tour-play-btn" type="button" id="btn-play-and-reveal-prediction">
                   ▶ Play Step &amp; Check Answer
                 </button>`
              : `<button class="tour-play-btn" type="button" id="btn-predict-next-step">
                   Next Step →
                 </button>`
          }
        </div>
      </div>

      ${
        this.predictRevealed
          ? `
            <div class="quiz-feedback-box ${bothRight ? 'correct' : 'incorrect'}" id="predict-result-banner">
              <div class="quiz-feedback-headline">
                ${
                  bothRight
                    ? '✓ Both Predictions Correct!'
                    : `Answer — Crystals: ${this.predictLastMotionCorrect ? '✓' : '✗'} (${expected.motionLabel}) · Sensation: ${this.predictLastNystagmusCorrect ? '✓' : '✗'} (${expected.nystagmusLabel})`
                }
              </div>
              <div class="quiz-feedback-sub">${expected.explanation}</div>
            </div>
          `
          : ''
      }
    `;
  }

  private isPipInsetVisible(): boolean {
    if (this.scene && this.scene.getSnapshot().layoutMode === 'split_50_50') {
      return true;
    }
    if (window.innerWidth <= 600) {
      return this.pipInsetOpenMobile;
    }
    return this.pipInsetOpenDesktop;
  }

  private applyPanelStatesToDOM(): void {
    const snap = this.scene ? this.scene.getSnapshot() : null;
    const isMode1 = snap ? snap.appMode === 'mode1_atlas' : true;
    const isMode2 = !isMode1;
    const isSplit = Boolean(snap && snap.layoutMode === 'split_50_50');

    const labShell = this.root.querySelector('.lab-shell');
    if (labShell) {
      labShell.classList.toggle('advanced-tools-off', !this.advancedToolsEnabled);
      labShell.classList.toggle('split-50-50', isSplit);
      labShell.classList.toggle('mode2-active', isMode2);
    }
    this.advancedToolsCheckbox.checked = this.advancedToolsEnabled;
    this.welcomeOverlay.classList.toggle('hidden', this.welcomeDismissed);
    this.aboutModalEl.classList.toggle('hidden', !this.aboutModalOpen);

    // Hide Mode 2 physics-only controls from Left Panel when in Mode 1 (unless Advanced tools is ON)
    const mode2LeftControls = this.root.querySelector<HTMLElement>('#mode2-only-left-controls');
    if (mode2LeftControls) {
      mode2LeftControls.style.display = isMode2 || this.advancedToolsEnabled ? '' : 'none';
    }

    // Audience mode buttons
    this.root.querySelectorAll<HTMLButtonElement>('[data-audience-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.audienceMode === this.audienceMode);
    });

    // Mode 2 Telemetry: Patient visual cards vs Technical telemetry boxes
    const showPatientTelemetry = this.audienceMode === 'patient' && !this.advancedToolsEnabled;
    if (this.patientTelemetryGrid && this.technicalTelemetryGrid) {
      this.patientTelemetryGrid.classList.toggle('hidden', !showPatientTelemetry);
      this.technicalTelemetryGrid.classList.toggle('hidden', showPatientTelemetry);
    }

    // Phase 5: Mode 1 Quiz Panel & Mode 2 Predict Panel visibility
    this.quizToggleBtn.style.display = isMode1 ? '' : 'none';
    this.quizToggleBtn.classList.toggle('active', this.quizActive && isMode1);
    this.quizToggleBtn.setAttribute('aria-pressed', String(this.quizActive && isMode1));
    this.quizPanelEl.classList.toggle('hidden', !(this.quizActive && isMode1));

    this.predictToggleBtn.classList.toggle('active', this.predictModeActive && isMode2);
    this.predictToggleBtn.setAttribute('aria-pressed', String(this.predictModeActive && isMode2));
    this.predictPanelEl.classList.toggle('hidden', !(this.predictModeActive && isMode2));

    // Left control dock
    this.leftDockEl.classList.toggle('collapsed', this.leftPanelCollapsed);
    this.leftPanelToggleBtn.setAttribute('aria-expanded', String(!this.leftPanelCollapsed));
    this.leftPanelToggleBtn.innerHTML = this.leftPanelCollapsed
      ? `<span class="toggle-icon">▶</span><span class="toggle-label">Controls</span>`
      : `<span class="toggle-icon">◀</span><span class="toggle-label">Hide</span>`;

    // Right inspector & part-list panel
    this.rightDrawerEl.classList.toggle('collapsed', this.rightPanelCollapsed);
    this.rightPanelToggleBtn.setAttribute('aria-expanded', String(!this.rightPanelCollapsed));
    this.rightPanelToggleBtn.innerHTML = this.rightPanelCollapsed
      ? `<span class="toggle-icon">◀</span><span class="toggle-label">Part Info</span>`
      : `<span class="toggle-icon">▶</span>`;

    // Floating Info Card (compact vs expanded) with single expand button inside the card
    this.inspectorContainer.classList.toggle('compact', !this.infoCardExpanded);
    this.inspectorContainer.classList.toggle('expanded', this.infoCardExpanded);
    this.inspectorContainer.classList.toggle(
      'both-open',
      this.infoCardExpanded && !this.partListCollapsed
    );
    const expandPillEl = this.inspectorContainer.querySelector<HTMLElement>('#btn-toggle-info-card');
    if (expandPillEl) {
      expandPillEl.setAttribute('aria-expanded', String(this.infoCardExpanded));
      expandPillEl.textContent = this.infoCardExpanded ? '▴ Show Less' : '▾ Read More';
    }

    // 27-Part Layer Tree
    this.layerTreeContainer.classList.toggle('collapsed', this.partListCollapsed);
    this.partListToggleBtn.setAttribute('aria-expanded', String(!this.partListCollapsed));
    const chevronEl = this.root.querySelector('#part-list-chevron');
    if (chevronEl) {
      chevronEl.textContent = this.partListCollapsed ? '▸ Show 27 Parts' : '▾ Hide Parts';
    }

    // Phase 2: Responsive Bottom Drawer State (<=900px) & Swipe/Tap Expand (<600px)
    this.workspacePanelsShell.dataset.activeTab = this.activeDrawerTab;
    this.workspacePanelsShell.classList.toggle('drawer-expanded', this.mobileDrawerExpanded);
    this.mobileDrawerHandleBtn.setAttribute('aria-expanded', String(this.mobileDrawerExpanded));
    const handleTextEl = this.root.querySelector('#drawer-handle-text');
    if (handleTextEl) {
      handleTextEl.textContent = this.mobileDrawerExpanded
        ? '▾ Tap or swipe for half height'
        : '▴ Tap or swipe to expand drawer';
    }

    this.root.querySelectorAll<HTMLButtonElement>('[data-drawer-tab]').forEach((btn) => {
      const isAct = btn.dataset.drawerTab === this.activeDrawerTab;
      btn.classList.toggle('active', isAct);
      btn.setAttribute('aria-selected', String(isAct));
    });

    // PiP Head Inset visibility
    const pipVis = this.isPipInsetVisible();
    this.pipHudFrame.classList.toggle('pip-hidden', !pipVis);
    this.rightDrawerEl.classList.toggle('pip-offset-none', !pipVis);
    this.pipToggleBtn.classList.toggle('active', pipVis);
    this.pipToggleBtn.setAttribute('aria-pressed', String(pipVis));
    this.pipToggleBtn.textContent = pipVis ? 'Hide Head' : 'Show Head';

    // Adjust Mode 2 Epley bar horizontal margins based on panel collapse states
    this.epleySandboxBar.classList.toggle('left-collapsed', this.leftPanelCollapsed);
    this.epleySandboxBar.classList.toggle('right-collapsed', this.rightPanelCollapsed);
    this.epleySandboxBar.classList.toggle('drawer-expanded-offset', this.mobileDrawerExpanded);
    this.cameraPresetBar.classList.toggle('drawer-expanded-offset', this.mobileDrawerExpanded);
  }

  private syncViewportRects(): void {
    const w = this.canvasHost.clientWidth;
    const h = this.canvasHost.clientHeight;
    if (w === 0 || h === 0) return;

    const isSmall = window.innerWidth <= 900;
    let visibleH = h;
    if (isSmall) {
      const hostRect = this.canvasHost.getBoundingClientRect();
      const drawerRect = this.workspacePanelsShell.getBoundingClientRect();
      const targetDrawerRatio =
        window.innerWidth <= 600
          ? this.mobileDrawerExpanded
            ? 0.78
            : 0.42
          : this.mobileDrawerExpanded
          ? 0.5
          : 0.36;
      const expectedDrawerTop = Math.max(
        hostRect.top + h * 0.22,
        window.innerHeight * (1 - targetDrawerRatio) - hostRect.top
      );
      let bottomLimit =
        drawerRect.height > 0 && drawerRect.top > hostRect.top
          ? Math.min(drawerRect.top - hostRect.top, expectedDrawerTop)
          : expectedDrawerTop;

      const isMode2 = this.scene && this.scene.getSnapshot().appMode === 'mode2_physics';
      if (isMode2 && this.epleySandboxBar) {
        const epleyRect = this.epleySandboxBar.getBoundingClientRect();
        if (epleyRect.height > 0 && epleyRect.top > hostRect.top) {
          bottomLimit = Math.min(bottomLimit, epleyRect.top - hostRect.top);
        }
      } else if (!isMode2 && this.cameraPresetBar) {
        const camRect = this.cameraPresetBar.getBoundingClientRect();
        if (camRect.height > 0 && camRect.top > hostRect.top) {
          bottomLimit = Math.min(bottomLimit, camRect.top - hostRect.top);
        }
      }
      visibleH = Math.max(Math.min(h, Math.round(h * 0.22)), Math.round(bottomLimit));
    }

    if (!this.isPipInsetVisible()) {
      this.scene.setViewportRects(
        { left: 0, top: 0, width: w, height: visibleH },
        { left: 0, top: 0, width: 0, height: 0 }
      );
      return;
    }

    const pipW = isSmall ? 220 : 290;
    const pipH = isSmall ? 168 : 215;
    const pad = isSmall ? 10 : 14;
    this.scene.setViewportRects(
      { left: 0, top: 0, width: w, height: visibleH },
      { left: Math.max(0, w - pipW - pad), top: pad, width: pipW, height: pipH }
    );
  }

  private renderLiveTelemetry(tel: PhysicsTelemetryState): void {
    this.canalithPhiInput.value = String(tel.phiDeg);
    this.canalithPhiVal.textContent = `${tel.phiDeg > 0 ? '+' : ''}${Math.round(tel.phiDeg)}°`;
    this.headYawInput.value = String(tel.psiYawDeg);
    this.headYawVal.textContent = `${tel.psiYawDeg > 0 ? '+' : ''}${Math.round(tel.psiYawDeg)}°`;
    this.headPitchInput.value = String(tel.thetaReclineDeg);
    this.headPitchVal.textContent = `${Math.round(tel.thetaReclineDeg)}°`;

    // 1. Update Patient-friendly visual indicators
    this.patientClearanceText.textContent = `${tel.clearancePercent}% Cleared`;
    this.patientClearanceFill.style.width = `${tel.clearancePercent}%`;
    this.patientSensationText.textContent = tel.patientSensation;
    const isSpinning = tel.patientSensation.startsWith('Spinning');
    this.patientSensationDot.classList.toggle('spinning', isSpinning);
    this.patientSensationDot.classList.toggle('calm', !isSpinning);
    this.patientLocationText.textContent = tel.patientLocation;

    // 2. Update Clinical / Technical telemetry boxes
    this.telPhiArc.textContent = `${tel.phiDeg > 0 ? '+' : ''}${tel.phiDeg.toFixed(1)}° (${tel.arcMm.toFixed(2)} mm)`;
    const gSign = tel.gravityAlongCanal >= 0 ? '+' : '';
    const driveLabel =
      Math.abs(tel.velocityDegPerSec) < 0.2
        ? 'Settled'
        : tel.velocityDegPerSec > 0
        ? 'Draining → Utricle'
        : 'Reflux ← Ampulla';
    this.telGravityDrive.textContent = `${gSign}${tel.gravityAlongCanal.toFixed(2)} (${driveLabel})`;
    this.telSpikeRate.textContent = `${tel.afferentSpikesPerSec} spk/s`;
    this.telNystagmus.textContent = tel.nystagmusState;
    this.telRegion.textContent = tel.anatomicalRegion;
  }

  // ===========================================================================
  // RENDER REACTIVE UI STATE (BREADCRUMB, INSPECTOR CARD, LAYER TREE)
  // ===========================================================================
  private renderState(snap: LabSceneSnapshot): void {
    this.loadingBarFill.style.width = `${snap.loadingProgress}%`;
    this.loadingText.textContent = snap.loadingItemLabel;
    this.loadingCountText.textContent = `${snap.loadingCompletedCount} / ${snap.loadingTotalCount} assets (${snap.loadingProgress}%)`;
    if (snap.isLoaded) {
      this.loadingOverlay.classList.add('hidden');
    }

    // Mode 1 vs Mode 2 UI visibility
    this.root.querySelectorAll<HTMLButtonElement>('[data-app-mode]').forEach((btn) => {
      const m = btn.dataset.appMode as LabAppMode;
      btn.classList.toggle('active', m === 'mode1_atlas' && snap.appMode === 'mode1_atlas');
      btn.classList.toggle(
        'active-warm',
        m === 'mode2_physics' && snap.appMode === 'mode2_physics'
      );
    });

    const isMode2 = snap.appMode === 'mode2_physics';
    this.epleySandboxBar.classList.toggle('visible', isMode2);
    this.cameraPresetBar.style.display = isMode2 ? 'none' : 'flex';
    (this.root.querySelector('#chk-live-physics') as HTMLInputElement).checked =
      snap.livePhysicsEnabled;
    (this.root.querySelector('#chk-fiducials') as HTMLInputElement).checked = snap.showFiducials;
    (this.root.querySelector('#chk-canal-planes') as HTMLInputElement).checked =
      snap.showCanalPlanes;
    (this.root.querySelector('#chk-spline-canaliths') as HTMLInputElement).checked =
      snap.showSplineAndCanaliths;
    (this.root.querySelector('#clip-flip-checkbox') as HTMLInputElement).checked = snap.clipFlip;

    // Update Mode 2 Step strip & caption
    this.tourPlayBtn.textContent = snap.tourPlaying
      ? '⏸ Pause Audio Guide'
      : '▶ Play Audio Guide';
    const highlightedStepIdx =
      this.predictModeActive && !this.predictRevealed
        ? this.predictPendingStepIdx
        : snap.activeEpleyStepIdx;
    this.root.querySelectorAll<HTMLButtonElement>('[data-epley-step]').forEach((btn) => {
      btn.classList.toggle(
        'active',
        parseInt(btn.dataset.epleyStep!, 10) === highlightedStepIdx
      );
    });
    const curStep = EPLEY_CLINICAL_STEPS[snap.activeEpleyStepIdx] ?? EPLEY_CLINICAL_STEPS[0];
    const usePatientCopy = this.audienceMode === 'patient' && !this.advancedToolsEnabled;
    if (this.predictModeActive && !this.predictRevealed) {
      const pendingStep =
        EPLEY_CLINICAL_STEPS[this.predictPendingStepIdx] ?? EPLEY_CLINICAL_STEPS[2];
      this.epleyCaptionHeadline.textContent = `Predict Step Outcome: ${pendingStep.shortTitle}`;
      this.epleyCaptionSub.textContent =
        'Choose your prediction for crystal movement and spinning sensation above, then click "Play Step & Check Answer".';
    } else {
      this.epleyCaptionHeadline.textContent = usePatientCopy
        ? curStep.patientHeadline
        : curStep.headline;
      this.epleyCaptionSub.textContent = usePatientCopy ? curStep.patientCaption : curStep.caption;
    }

    // Sync Telemetry snapshot
    if (snap.telemetry) {
      this.renderLiveTelemetry(snap.telemetry);
    }

    // Update Sliders & Values
    this.bonyPeelInput.value = String(snap.bonyPeelPercent);
    this.bonyPeelVal.textContent = `${Math.round(snap.bonyPeelPercent)}%`;
    this.microCutInput.value = String(snap.microCutawayPercent);
    this.microCutVal.textContent = `${Math.round(snap.microCutawayPercent)}%`;
    this.explodeInput.value = String(snap.explodePercent);
    this.explodeVal.textContent = `${Math.round(snap.explodePercent)}%`;
    this.canalithPhiInput.value = String(snap.canalithPhiDeg);
    this.canalithPhiVal.textContent = `${snap.canalithPhiDeg > 0 ? '+' : ''}${Math.round(
      snap.canalithPhiDeg
    )}° (${RealtimeEpleySimulator.classifyRegion(snap.canalithPhiDeg).split(' ')[0]})`;
    this.clipOffsetInput.value = String(snap.clipOffsetMm);
    this.clipOffsetVal.textContent = `${snap.clipOffsetMm.toFixed(1)} mm`;
    this.headYawInput.value = String(snap.headYawDeg);
    this.headYawVal.textContent = `${snap.headYawDeg > 0 ? '+' : ''}${Math.round(snap.headYawDeg)}°`;
    this.headPitchInput.value = String(snap.headPitchDeg);
    this.headPitchVal.textContent = `${Math.round(snap.headPitchDeg)}°`;
    this.undoBtn.disabled = !snap.canUndo;

    this.root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.preset === snap.activePresetId);
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-layout]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.layout === snap.layoutMode);
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-label-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.labelMode === snap.labelMode);
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-clip]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.clip === snap.clipAxis);
    });
    this.root
      .querySelector('#btn-tool-scalpel')!
      .classList.toggle('active', snap.toolMode === 'scalpel_hide');
    this.root
      .querySelector('#btn-tool-xray')!
      .classList.toggle('active', snap.toolMode === 'scalpel_ghost');

    if (snap.layoutMode === 'split_50_50') {
      this.pipHudFrame.classList.add('split-mode');
      this.rightDrawerEl.classList.add('split-layout-offset');
      this.pipTitleEl.textContent = 'LEFT STAGE: 3D HEAD & EAR POSITION';
    } else {
      this.pipHudFrame.classList.remove('split-mode');
      this.rightDrawerEl.classList.remove('split-layout-offset');
      this.pipTitleEl.textContent =
        snap.layoutMode === 'labyrinth_main'
          ? '3D HEAD & EAR VIEW'
          : 'INNER EAR PIP · HEAD CONTROLS';
    }

    // Check if Quiz Mode is actively masking the structure name (both quiz types until answered)
    const isQuizMaskActive = this.quizActive && !this.quizAnswered;
    const quizMaskPrompt =
      this.quizType === 'click_in_3d'
        ? 'Quiz in progress — find & click the requested part in 3D'
        : 'Quiz in progress — identify the highlighted part';

    // Render Interactive Breadcrumb Trail
    const activeMeshName = snap.hoveredMesh ?? snap.selectedMesh ?? 'ls_Hsapiens_Sp';
    const activeItem = STRUCTURE_BY_MESH[activeMeshName] ?? IEMAP_STRUCTURES[0];
    const sysGroup = SYSTEM_GROUPS[activeItem.systemGroup];

    if (isQuizMaskActive) {
      this.breadcrumbBar.innerHTML = `
        <span class="crumb-item" data-crumb-action="reset">Inner Ear</span>
        <span class="crumb-sep">›</span>
        <span class="crumb-item active">${quizMaskPrompt}</span>
      `;
    } else {
      const crumbTitle =
        this.audienceMode === 'patient'
          ? activeItem.displayName
          : `${activeItem.displayName} (${activeItem.latinName}) · Raw ID: ${activeItem.meshName}`;
      this.breadcrumbBar.innerHTML = `
        <span class="crumb-item" data-crumb-action="reset">Inner Ear</span>
        <span class="crumb-sep">›</span>
        <span class="crumb-item" data-crumb-group="${sysGroup.id}">${sysGroup.shortTitle}</span>
        <span class="crumb-sep">›</span>
        <span class="crumb-item active" data-crumb-mesh="${activeItem.meshName}" title="${crumbTitle}">${activeItem.shortLabel}</span>
      `;
    }

    this.breadcrumbBar.querySelectorAll<HTMLElement>('[data-crumb-action]').forEach((el) => {
      el.addEventListener('click', () => this.scene.snapCameraViewPreset('posterior_3_4'));
    });
    this.breadcrumbBar.querySelectorAll<HTMLElement>('[data-crumb-group]').forEach((el) => {
      el.addEventListener('click', () => {
        const gId = el.dataset.crumbGroup as SystemGroupId;
        this.scene.setSystemGroupVisibility(gId, 'visible');
      });
    });
    this.breadcrumbBar.querySelectorAll<HTMLElement>('[data-crumb-mesh]').forEach((el) => {
      el.addEventListener('click', () => {
        this.scene.flyToStructure(el.dataset.crumbMesh!);
      });
    });

    // Render Selected Structure Clinical Inspector Card (Compact floating vs Expanded, Audience-aware & Quiz-masked)
    const inspectedItem =
      STRUCTURE_BY_MESH[snap.selectedMesh ?? 'ls_Hsapiens_Sp'] ?? IEMAP_STRUCTURES[0];
    const inspectedGroup = SYSTEM_GROUPS[inspectedItem.systemGroup];
    const inspectorKey = `${inspectedItem.meshName}|${this.audienceMode}|${
      isQuizMaskActive ? `masked-${this.quizType}` : 'open'
    }`;

    if (inspectorKey !== this.lastRenderedInspectorKey) {
      this.lastRenderedInspectorKey = inspectorKey;

      if (isQuizMaskActive) {
        this.inspectorContainer.innerHTML = `
          <div class="inspector-compact-header" data-toggle-info-card="true">
            <div class="inspector-header-badges">
              <span class="compartment-pill">QUIZ CHALLENGE</span>
            </div>
            <div class="inspector-title-row">
              <div>
                <div class="inspector-title">${quizMaskPrompt}</div>
              </div>
              <button
                type="button"
                class="inspector-expand-pill"
                id="btn-toggle-info-card"
                data-toggle-info-card="true"
                aria-expanded="${this.infoCardExpanded}"
              >
                ${this.infoCardExpanded ? '▴ Show Less' : '▾ Read More'}
              </button>
            </div>
          </div>

          <div class="inspector-compact-preview" data-toggle-info-card="true">
            ${
              this.quizType === 'click_in_3d'
                ? 'Click directly on the requested 3D ear part in the viewport. Full details will appear as soon as you answer!'
                : 'Look at the glowing part in the 3D ear model and pick its name in the Quiz box above. Full details will appear as soon as you answer!'
            }
          </div>

          <div class="inspector-expanded-details">
            <div class="clinical-field">
              <div class="clinical-field-label">Hidden During Quiz</div>
              <div class="clinical-field-body">
                Answer the current Quiz question to reveal this part’s name and how it works.
              </div>
            </div>
          </div>
        `;
      } else {
        const compactPreviewText =
          this.audienceMode === 'patient'
            ? inspectedItem.patientSummary
            : this.audienceMode === 'clinician'
            ? inspectedItem.clinicalPearl
            : inspectedItem.physiologicalFunction;

        const patSysSummary = getPatientSystemSummary(inspectedItem.systemGroup);
        const expandedBodyHtml =
          this.audienceMode === 'patient'
            ? `
              <div class="clinical-field">
                <div class="clinical-field-label">What This Part Does</div>
                <div class="clinical-field-body">${inspectedItem.patientSummary}</div>
              </div>

              <div class="clinical-field">
                <div class="clinical-field-label">Part of the Inner Ear</div>
                <div class="clinical-field-body"><strong>${patSysSummary.title} (${patSysSummary.subtitle}):</strong> ${patSysSummary.roleNote}</div>
              </div>
            `
            : this.audienceMode === 'student'
            ? `
              <div class="inspector-etymology">${inspectedItem.etymology}</div>

              <div class="clinical-field">
                <div class="clinical-field-label">Cranial Nerve VIII Innervation</div>
                <div class="clinical-field-body">${inspectedItem.innervation}</div>
              </div>

              <div class="clinical-field">
                <div class="clinical-field-label">Physiological Mechanism</div>
                <div class="clinical-field-body">${inspectedItem.physiologicalFunction}</div>
              </div>

              <div class="clinical-pearl-box">
                <strong>Clinical &amp; Diagnostic Pearl:</strong> ${inspectedItem.clinicalPearl}
              </div>
            `
            : `
              <div class="inspector-etymology">${inspectedItem.etymology}</div>

              <div class="telemetry-strip">
                <div class="telemetry-cell">
                  <span class="telemetry-key">Mesh / Raw ID</span>
                  <span class="telemetry-val" title="${inspectedItem.structureId}">${inspectedItem.meshName}</span>
                </div>
                <div class="telemetry-cell">
                  <span class="telemetry-key">Geometry</span>
                  <span class="telemetry-val">${inspectedItem.verticesCount.toLocaleString()}v / ${inspectedItem.facesCount.toLocaleString()}f</span>
                </div>
                <div class="telemetry-cell">
                  <span class="telemetry-key">RAS Center (mm)</span>
                  <span class="telemetry-val">(${inspectedItem.centroidRAS.map((n) => n.toFixed(1)).join(', ')})</span>
                </div>
              </div>

              <div class="clinical-field">
                <div class="clinical-field-label">Cranial Nerve VIII Innervation</div>
                <div class="clinical-field-body">${inspectedItem.innervation}</div>
              </div>

              <div class="clinical-field">
                <div class="clinical-field-label">Anatomical Morphometry (RAS)</div>
                <div class="clinical-field-body">${inspectedItem.morphometry}</div>
              </div>

              <div class="clinical-field">
                <div class="clinical-field-label">Physiological Mechanism</div>
                <div class="clinical-field-body">${inspectedItem.physiologicalFunction}</div>
              </div>

              <div class="clinical-pearl-box">
                <strong>Clinical &amp; Diagnostic Pearl:</strong> ${inspectedItem.clinicalPearl}
              </div>

              <div class="clinical-field" style="margin-top:6px;">
                <div class="clinical-field-label">Patient Counseling Summary</div>
                <div class="clinical-field-body">${inspectedItem.patientSummary}</div>
              </div>
            `;

        const sourcesHtml =
          this.audienceMode !== 'patient' &&
          inspectedItem.sources &&
          inspectedItem.sources.length > 0
            ? `
              <div class="clinical-field inspector-sources-section">
                <div class="clinical-field-label">Atlas &amp; Literature Sources</div>
                <ul class="sources-list">
                  ${inspectedItem.sources
                    .map((src) => `<li class="source-item">${src}</li>`)
                    .join('')}
                </ul>
              </div>
            `
            : '';

        const headerTitleAttr =
          this.audienceMode === 'patient'
            ? inspectedItem.displayName
            : `Raw ID: ${inspectedItem.meshName} (${inspectedItem.structureId})`;

        this.inspectorContainer.innerHTML = `
          <div class="inspector-compact-header" data-toggle-info-card="true" title="${headerTitleAttr}">
            <div class="inspector-header-badges">
              <span class="compartment-pill" style="border-color:${inspectedGroup.accentHex};color:${inspectedGroup.accentHex};">
                ${inspectedGroup.shortTitle.toUpperCase()}
              </span>
              <span class="compartment-pill">
                ${
                  this.audienceMode === 'patient'
                    ? 'Simple Guide'
                    : inspectedItem.fluidCompartment
                }
              </span>
              ${
                this.audienceMode !== 'patient'
                  ? `<span class="compartment-pill" title="Raw Mesh &amp; Ontology ID: ${inspectedItem.meshName} / ${inspectedItem.structureId}">
                       ID: ${inspectedItem.meshName}
                     </span>`
                  : ''
              }
            </div>
            <div class="inspector-title-row">
              <div>
                <div class="inspector-title">${inspectedItem.displayName}</div>
                ${
                  this.audienceMode !== 'patient'
                    ? `<div class="inspector-latin">${inspectedItem.latinName}</div>`
                    : ''
                }
              </div>
              <button
                type="button"
                class="inspector-expand-pill"
                id="btn-toggle-info-card"
                data-toggle-info-card="true"
                aria-expanded="${this.infoCardExpanded}"
                aria-label="Expand or collapse part information"
              >
                ${this.infoCardExpanded ? '▴ Show Less' : '▾ Read More'}
              </button>
            </div>
          </div>

          <div class="inspector-compact-preview" data-toggle-info-card="true">
            ${compactPreviewText}
          </div>

          <div class="inspector-expanded-details">
            ${expandedBodyHtml}
            ${sourcesHtml}
          </div>
        `;
      }
    }
    this.applyPanelStatesToDOM();

    // Render 5-System 27-Mesh Layer Tree (only rebuild when selectedMesh, quiz mask, or visibilityMap changes)
    const layerTreeKey = `${snap.selectedMesh ?? ''}|${this.audienceMode}|${
      isQuizMaskActive ? 'masked' : 'open'
    }|${IEMAP_STRUCTURES.map((s) => snap.visibilityMap[s.meshName] ?? s.defaultState).join(',')}`;

    if (layerTreeKey !== this.lastRenderedLayerTreeKey) {
      this.lastRenderedLayerTreeKey = layerTreeKey;
      const groupOrder: SystemGroupId[] = [
        'semicircular_ducts',
        'ampullae_cupulae',
        'otolith_vestibule',
        'cochlear_system',
        'bony_capsule',
      ];

      this.layerTreeContainer.innerHTML = groupOrder
        .map((gId) => {
          const gMeta = SYSTEM_GROUPS[gId];
          const items = IEMAP_STRUCTURES.filter((s) => s.systemGroup === gId);

          const rowsHtml = items
            .map((item) => {
              const st: VisibilityState = snap.visibilityMap[item.meshName] ?? item.defaultState;
              const isSel = !isQuizMaskActive && snap.selectedMesh === item.meshName;
              const rowTooltip =
                this.audienceMode === 'patient'
                  ? item.displayName
                  : `${item.displayName} (${item.latinName}) · Raw ID: ${item.meshName}`;
              return `
                <div class="mesh-row ${isSel ? 'selected' : ''}" data-tree-select="${item.meshName}" title="${rowTooltip}">
                  <div class="mesh-row-left">
                    <span class="mesh-swatch" style="background:${item.colorHex};"></span>
                    <span class="mesh-row-label" title="${rowTooltip}">
                      ${item.shortLabel}
                    </span>
                  </div>
                  <div class="group-vis-btns">
                    <button
                      class="mini-vis-btn ${st === 'visible' ? 'active-vis' : ''}"
                      data-mesh-vis="${item.meshName}:visible"
                      title="Show Solid (${item.shortLabel})"
                    >Show</button>
                    <button
                      class="mini-vis-btn ${st === 'ghost' ? 'active-ghost' : ''}"
                      data-mesh-vis="${item.meshName}:ghost"
                      title="See-Through Ghost (${item.shortLabel})"
                    >Ghost</button>
                    <button
                      class="mini-vis-btn ${st === 'hidden' ? 'active-hide' : ''}"
                      data-mesh-vis="${item.meshName}:hidden"
                      title="Hide Part (${item.shortLabel})"
                    >Hide</button>
                  </div>
                </div>
              `;
            })
            .join('');

          return `
            <div class="system-group-block">
              <div class="system-group-header">
                <div class="system-group-name">
                  <span class="mesh-swatch" style="background:${gMeta.accentHex};"></span>
                  <span>${gMeta.shortTitle} (${items.length})</span>
                </div>
                <div class="group-vis-btns">
                  <button class="mini-vis-btn" data-sys-vis="${gId}:visible">All Show</button>
                  <button class="mini-vis-btn" data-sys-vis="${gId}:ghost">All Ghost</button>
                  <button class="mini-vis-btn" data-sys-vis="${gId}:hidden">Hide</button>
                </div>
              </div>
              ${rowsHtml}
            </div>
          `;
        })
        .join('');

      this.layerTreeContainer
        .querySelectorAll<HTMLButtonElement>('[data-mesh-vis]')
        .forEach((btn) => {
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const [meshName, vis] = btn.dataset.meshVis!.split(':') as [string, VisibilityState];
            this.scene.setStructureVisibility(meshName, vis);
          });
        });

      this.layerTreeContainer
        .querySelectorAll<HTMLButtonElement>('[data-sys-vis]')
        .forEach((btn) => {
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const [gId, vis] = btn.dataset.sysVis!.split(':') as [SystemGroupId, VisibilityState];
            this.scene.setSystemGroupVisibility(gId, vis);
          });
        });

      this.layerTreeContainer
        .querySelectorAll<HTMLElement>('[data-tree-select]')
        .forEach((row) => {
          row.addEventListener('click', () => {
            const meshName = row.dataset.treeSelect!;
            this.scene.selectStructure(meshName, true);
            this.handleStructurePickedForQuiz(meshName);
          });
        });
    }
  }

  private renderProjectedPins(pins: ProjectedPin2D[]): void {
    const activeIds = new Set<string>();
    const isPatient = this.audienceMode === 'patient';

    for (const p of pins) {
      activeIds.add(p.id);
      let el = this.pinElements.get(p.id);

      if (!p.visible) {
        if (el && el.style.display !== 'none') {
          el.style.display = 'none';
        }
        continue;
      }

      if (!el) {
        el = document.createElement('div');
        el.className = 'pin-pill';
        const dot = document.createElement('span');
        dot.className = 'pin-dot';
        const labelSpan = document.createElement('span');
        labelSpan.className = 'pin-label-text';
        el.appendChild(dot);
        el.appendChild(labelSpan);
        this.pinsLayer.appendChild(el);
        this.pinElements.set(p.id, el);
      }

      if (el.style.display !== 'flex') {
        el.style.display = 'flex';
      }
      el.style.left = `${p.screenX.toFixed(1)}px`;
      el.style.top = `${p.screenY.toFixed(1)}px`;
      el.style.borderColor = p.colorHex;

      el.classList.toggle('structure-pin', p.category === 'structure');
      el.classList.toggle('occluded', p.occluded);

      const tooltip = isPatient
        ? p.meshName && STRUCTURE_BY_MESH[p.meshName]
          ? STRUCTURE_BY_MESH[p.meshName].displayName
          : p.label
        : p.sublabel;
      if (el.title !== tooltip) {
        el.title = tooltip;
      }
      if (el.dataset.rawId !== p.rawId) {
        el.dataset.rawId = p.rawId;
      }
      const targetMesh = p.meshName ?? '';
      if ((el.dataset.pinMesh ?? '') !== targetMesh) {
        if (targetMesh) {
          el.dataset.pinMesh = targetMesh;
        } else {
          delete el.dataset.pinMesh;
        }
      }

      const dotEl = el.firstElementChild as HTMLElement | null;
      if (dotEl && dotEl.style.background !== p.colorHex) {
        dotEl.style.background = p.colorHex;
      }
      const textEl = el.lastElementChild as HTMLElement | null;
      if (textEl && textEl.textContent !== p.label) {
        textEl.textContent = p.label;
      }
    }

    for (const [id, el] of this.pinElements.entries()) {
      if (!activeIds.has(id)) {
        el.remove();
        this.pinElements.delete(id);
      }
    }
  }
}
