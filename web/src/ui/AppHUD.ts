import {
  DISSECTION_PRESETS,
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

export class AppHUD {
  private root: HTMLElement;
  private scene!: DualStageScene;
  private canvasHost!: HTMLElement;
  private pinsLayer!: HTMLElement;
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
  private infoCardToggleBtn!: HTMLButtonElement;
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

  // Phase 5: Audience mode, Mode 1 Quiz mode, Mode 2 Predict mode
  private audienceMode: 'student' | 'clinician' | 'patient' = 'student';
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

  private leftPanelCollapsed = false;
  private rightPanelCollapsed = false;
  private infoCardExpanded = false;
  private partListCollapsed = true;

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
    // Defaults per Phase 1: left panel open (false), part list collapsed (true), info card compact (false)
    this.leftPanelCollapsed = this.readStorageBool(AppHUD.LS_KEYS.leftCollapsed, false);
    this.rightPanelCollapsed = this.readStorageBool(AppHUD.LS_KEYS.rightCollapsed, false);
    this.infoCardExpanded = this.readStorageBool(AppHUD.LS_KEYS.infoExpanded, false);
    this.partListCollapsed = this.readStorageBool(AppHUD.LS_KEYS.partsCollapsed, true);
    // Phase 3: Welcome overlay shown unless a choice was previously saved; Advanced tools off by default
    const savedWelcome = this.readStorageString(AppHUD.LS_KEYS.welcomeChoice);
    this.welcomeDismissed = Boolean(savedWelcome);
    this.advancedToolsEnabled = this.readStorageBool(AppHUD.LS_KEYS.advancedTools, false);
    // Phase 5: Audience mode (Student / Clinician / Patient)
    const savedAud = this.readStorageString(AppHUD.LS_KEYS.audienceMode);
    if (savedAud === 'student' || savedAud === 'clinician' || savedAud === 'patient') {
      this.audienceMode = savedAud;
    }
  }

  public async init(): Promise<void> {
    this.scene.startRenderLoop();
    await this.scene.loadAllAssets();
    const savedWelcome = this.readStorageString(AppHUD.LS_KEYS.welcomeChoice);
    if (savedWelcome === 'epley_lab') {
      this.scene.setAppMode('mode2_physics');
    }
    this.syncViewportRects();
  }

  private buildDOM(): void {
    this.root.innerHTML = `
      <div class="lab-shell">
        <!-- TOP CLINICAL HEADER BAR -->
        <header class="lab-header">
          <div class="brand-cluster">
            <span class="brand-badge">GATE 3 · IE-MAP v1.0.0</span>
            <div class="mode-switch-pill" id="app-mode-switcher">
              <button class="mode-tab-btn active" data-app-mode="mode1_atlas">
                Mode 1: 27-Mesh Anatomy Atlas
              </button>
              <button class="mode-tab-btn" data-app-mode="mode2_physics">
                Mode 2: Live BPPV &amp; Epley Physics Lab
              </button>
            </div>
          </div>

          <!-- Interactive Anatomical Breadcrumb -->
          <nav class="breadcrumb-bar" id="breadcrumb-bar"></nav>

          <!-- Search, Labels Toggle & Viewport Layout Switcher -->
          <div class="header-controls">
            <div class="search-wrapper">
              <input
                type="text"
                class="search-input"
                id="structure-search-input"
                placeholder="Search 27 parts, Latin, BPPV... (⌘K)"
                aria-label="Search anatomical structures"
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
              aria-label="Toggle Mode 1 3D Anatomy Quiz"
              aria-pressed="false"
              title="Open or close Mode 1 interactive 3D Anatomy Quiz"
            >
              Quiz Mode
            </button>

            <button
              class="seg-btn pip-toggle-header-btn"
              id="btn-toggle-pip-inset"
              type="button"
              aria-label="Toggle 3D patient head PiP inset"
              title="Show or hide 3D Patient Head PiP inset"
            >
              Head PiP
            </button>

            <button
              class="seg-btn pip-toggle-header-btn"
              id="btn-open-welcome"
              type="button"
              aria-label="Open welcome and mode guide"
              title="Open welcome screen (Guided tour, Explore atlas, Epley lab)"
            >
              Start Guide
            </button>

            <div class="layout-segmented" id="layout-mode-group">
              <button class="seg-btn active" data-layout="labyrinth_main" title="Labyrinth Main + Patient Head PiP">
                Labyrinth Main
              </button>
              <button class="seg-btn" data-layout="head_main" title="Swap Role: Patient Head Main + Labyrinth PiP">
                Swap Main ↔ PiP
              </button>
              <button class="seg-btn" data-layout="split_50_50" title="Side-by-Side 50/50 Dual Stage">
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
                <span class="pip-title" id="pip-stage-title">3D PATIENT HEAD &amp; RIGHT EAR CUTAWAY</span>
                <div style="display:flex;gap:4px;">
                  <button class="pip-btn" id="pip-swap-btn" type="button" aria-label="Swap main and PiP stages">Swap Stage ⇄</button>
                  <button class="pip-btn" id="pip-hide-btn" type="button" aria-label="Hide head PiP inset" title="Hide Head PiP">✕</button>
                </div>
              </div>
              <div class="pip-footer">
                <div class="pip-slider-row">
                  <span>Head Glass</span>
                  <input type="range" id="head-opacity-slider" min="0" max="90" value="34" aria-label="Head glass opacity" />
                  <label style="display:flex;align-items:center;gap:3px;cursor:pointer;">
                    <input type="checkbox" id="sync-cam-checkbox" checked /> Sync Orbit
                  </label>
                </div>
                <div class="pip-slider-row">
                  <span>Head Yaw ψ</span>
                  <input type="range" id="head-yaw-slider" min="-90" max="150" step="1" value="0" aria-label="Head yaw angle" />
                  <span id="head-yaw-val" style="width:36px;text-align:right;">0°</span>
                </div>
                <div class="pip-slider-row">
                  <span>Recline θ</span>
                  <input type="range" id="head-pitch-slider" min="-20" max="130" step="1" value="0" aria-label="Head recline angle" />
                  <span id="head-pitch-val" style="width:36px;text-align:right;">0°</span>
                </div>
              </div>
            </div>

            <!-- PHASE 5: MODE 1 INTERACTIVE 3D ANATOMY QUIZ PANEL -->
            <div class="quiz-mode-panel hidden" id="quiz-mode-panel" role="region" aria-label="Mode 1 3D Anatomy Quiz"></div>

            <!-- Bottom RAS Anatomical ViewCube / Camera Orientation Bar -->
            <div class="camera-preset-bar" id="camera-preset-bar">
              <span class="cam-label">RAS CAMERA:</span>
              <button class="cam-btn" data-cam="posterior_3_4">Gate 3 (Post 3/4)</button>
              <button class="cam-btn" data-cam="right_lateral">Right Lateral (+X)</button>
              <button class="cam-btn" data-cam="anterior">Anterior (+Y)</button>
              <button class="cam-btn" data-cam="superior">Superior (+Z)</button>
              <button class="cam-btn" data-cam="medial">Medial (-X)</button>
              <button class="cam-btn" data-cam="posterior_ampulla_zoom">Post. Cupula Zoom</button>
              <button class="cam-btn" data-cam="cochlea_zoom">Cochlear Scalae Zoom</button>
            </div>

            <!-- MODE 2: REAL-TIME BPPV & EPLEY PHYSICS SANDBOX BAR -->
            <div class="epley-sandbox-bar" id="epley-sandbox-bar">
              <div class="epley-top-row">
                <button class="tour-play-btn" id="btn-tour-play">▶ Play 8-Shot Audio Tour</button>
                <div class="epley-steps-strip" id="epley-steps-strip"></div>
                <button
                  class="seg-btn predict-toggle-btn"
                  id="btn-toggle-predict"
                  type="button"
                  aria-label="Toggle Epley Step Predict Mode"
                  aria-pressed="false"
                  title="Predict canalith motion and nystagmus direction before playing each Epley step"
                >
                  Predict Mode
                </button>
                <label style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px;cursor:pointer;flex-shrink:0;">
                  <input type="checkbox" id="chk-mute-audio" /> Mute Audio
                </label>
              </div>

              <!-- PHASE 5: MODE 2 EPLEY STEP PREDICTION PANEL -->
              <div class="epley-predict-panel hidden" id="epley-predict-panel" role="region" aria-label="Predict Epley Step Outcome"></div>

              <div class="epley-caption-banner">
                <div class="epley-caption-headline" id="epley-caption-headline">
                  Step 1: Sit Upright &amp; Turn Head 45° Right (ψ = -45°, θ = 0°)
                </div>
                <div class="epley-caption-sub" id="epley-caption-sub">
                  Drag Head Yaw ψ &amp; Recline θ in the top-right PiP gimbal (or click any Epley step above) to watch real-time Stokes gravitational sedimentation along the 3D posterior canal spline.
                </div>
              </div>

              <div class="epley-telemetry-grid">
                <div class="tel-box">
                  <span class="tel-label">Otoconia Angle &amp; Arc</span>
                  <span class="tel-value" id="tel-phi-arc" style="color:var(--warm);">-84.0° (1.82 mm)</span>
                </div>
                <div class="tel-box">
                  <span class="tel-label">Gravity Drive (g · T)</span>
                  <span class="tel-value" id="tel-gravity-drive">+0.00 (Static)</span>
                </div>
                <div class="tel-box">
                  <span class="tel-label">CN VIII Ampullary Firing</span>
                  <span class="tel-value" id="tel-spike-rate">90 spk/s (Tonic)</span>
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
                <div class="mobile-drawer-tabs" id="mobile-drawer-tabs" role="tablist" aria-label="Lab tools and anatomy tabs">
                  <button class="drawer-tab-btn active" type="button" role="tab" aria-selected="true" data-drawer-tab="presets">Presets</button>
                  <button class="drawer-tab-btn" type="button" role="tab" aria-selected="false" data-drawer-tab="dissect">Dissect</button>
                  <button class="drawer-tab-btn" type="button" role="tab" aria-selected="false" data-drawer-tab="layers">Layers</button>
                  <button class="drawer-tab-btn" type="button" role="tab" aria-selected="false" data-drawer-tab="slicer">Slicer</button>
                  <button class="drawer-tab-btn" type="button" role="tab" aria-selected="false" data-drawer-tab="info">Info</button>
                  <button class="drawer-tab-btn" type="button" role="tab" aria-selected="false" data-drawer-tab="parts">Parts</button>
                </div>
              </div>

              <!-- Left Floating Dissection & Layer Control Dock -->
              <aside class="left-tool-dock" id="left-tool-dock" aria-label="Left Dissection and Control Panel">
                <div class="panel-collapse-bar">
                  <span class="panel-collapse-title">Dissection &amp; Controls</span>
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
                    <label class="advanced-tools-label" for="chk-advanced-tools" title="Show or hide expert tools: RAS slicer, fiducial pins, canal-plane protractors, radial explode, scalpel &amp; brush">
                      <span class="advanced-tools-title">Advanced tools</span>
                      <span class="advanced-tools-sub">Slicer, Fiducials, Protractors, Explode, Scalpel &amp; Brush</span>
                    </label>
                    <input
                      type="checkbox"
                      id="chk-advanced-tools"
                      aria-label="Advanced tools"
                    />
                  </div>

                  <!-- Section 1: Clinical Dissection Presets -->
                  <div class="dock-section" data-tab-pane="presets">
                    <div class="dock-section-title">
                      <span>1. Clinical Dissection Presets</span>
                    </div>
                    <div class="preset-list" id="preset-list"></div>
                  </div>

                  <!-- Section 2: Active Structure Dissection Actions -->
                  <div class="dock-section" data-tab-pane="dissect">
                    <div class="dock-section-title">
                      <span>2. Virtual Dissection</span>
                    </div>
                    <div class="action-grid" style="margin-bottom:6px;">
                      <button class="action-btn" id="btn-fly-selected">Fly Camera Here</button>
                      <button class="action-btn" id="btn-isolate-selected">Isolate Part</button>
                      <button class="action-btn" id="btn-ghost-others">X-Ray Ghost Others</button>
                      <button class="action-btn" id="btn-hide-selected">Peel / Hide Part</button>
                    </div>
                    <div class="action-grid advanced-tool-item" id="scalpel-brush-grid" style="margin-bottom:6px;">
                      <button class="action-btn" id="btn-tool-scalpel" title="Click any 3D structure to immediately peel/hide it">
                        Scalpel: Click-Peel
                      </button>
                      <button class="action-btn" id="btn-tool-xray" title="Click any 3D structure to convert it to X-Ray Ghost">
                        Brush: Click-Ghost
                      </button>
                    </div>
                    <div class="action-grid">
                      <button class="action-btn" id="btn-undo-dissect" disabled>Undo Step</button>
                      <button class="action-btn" id="btn-reset-all">Reset Atlas</button>
                    </div>
                  </div>

                  <!-- Section 3: Concentric Layer Peel & Radial Explode -->
                  <div class="dock-section" data-tab-pane="layers">
                    <div class="dock-section-title">
                      <span>3. Layer Peel &amp; Cutaway</span>
                    </div>

                    <div class="control-slider-group">
                      <div class="slider-header">
                        <span>Bony Capsule Peel (Otic Shell)</span>
                        <span class="slider-val" id="bony-peel-val">80%</span>
                      </div>
                      <input type="range" class="lab-range" id="bony-peel-slider" min="0" max="100" value="80" aria-label="Bony capsule peel percentage" />
                    </div>

                    <div class="control-slider-group">
                      <div class="slider-header">
                        <span>Ampulla &amp; Cochlea Micro-Cutaway</span>
                        <span class="slider-val" id="micro-cut-val">35%</span>
                      </div>
                      <input type="range" class="lab-range" id="micro-cut-slider" min="0" max="100" value="35" aria-label="Ampulla and cochlea micro-cutaway percentage" />
                    </div>

                    <div class="control-slider-group advanced-tool-item" id="explode-control-group">
                      <div class="slider-header">
                        <span>Radial Explode Assembly (27 Parts)</span>
                        <span class="slider-val" id="explode-val">0%</span>
                      </div>
                      <input type="range" class="lab-range" id="explode-slider" min="0" max="100" value="0" aria-label="Radial explode assembly percentage" />
                    </div>
                  </div>

                  <!-- Section 4: 3-Axis Multi-Planar Cross-Section Slicer (Advanced Tool) -->
                  <div class="dock-section advanced-tool-item" id="ras-slicer-section" data-tab-pane="slicer">
                    <div class="dock-section-title">
                      <span>4. RAS Cross-Section Slicer</span>
                      <label style="font-size:10px;cursor:pointer;color:var(--text-muted);">
                        <input type="checkbox" id="clip-flip-checkbox" /> Flip
                      </label>
                    </div>
                    <div class="layout-segmented" id="clip-axis-group" style="margin-bottom:8px;width:100%;">
                      <button class="seg-btn active" data-clip="none" style="flex:1;">Off</button>
                      <button class="seg-btn" data-clip="axial_z" style="flex:1;">Axial Z</button>
                      <button class="seg-btn" data-clip="coronal_y" style="flex:1;">Coronal Y</button>
                      <button class="seg-btn" data-clip="sagittal_x" style="flex:1;">Sagittal X</button>
                    </div>
                    <div class="control-slider-group" id="clip-offset-row">
                      <div class="slider-header">
                        <span>Section Plane Coordinate</span>
                        <span class="slider-val" id="clip-offset-val">0.0 mm</span>
                      </div>
                      <input type="range" class="lab-range" id="clip-offset-slider" min="-7.0" max="11.0" step="0.1" value="0.0" aria-label="Section plane coordinate in millimeters" />
                    </div>
                  </div>

                  <!-- Section 5: Reference Landmarks, Canal Planes & BPPV Path -->
                  <div class="dock-section" data-tab-pane="slicer" style="border-bottom:none;">
                    <div class="dock-section-title">
                      <span>5. Spatial Overlays &amp; BPPV Spline</span>
                    </div>
                    <label class="toggle-row advanced-tool-item" id="fiducials-toggle-row">
                      <span>3D Slicer Fiducial Pins (.fcsv)</span>
                      <input type="checkbox" id="chk-fiducials" checked />
                    </label>
                    <label class="toggle-row advanced-tool-item" id="canal-planes-toggle-row">
                      <span>Canal Plane Protractors (LARP/RALP/Lat)</span>
                      <input type="checkbox" id="chk-canal-planes" />
                    </label>
                    <label class="toggle-row">
                      <span>Posterior Canal Spline &amp; 5 Canaliths</span>
                      <input type="checkbox" id="chk-spline-canaliths" checked />
                    </label>
                    <label class="toggle-row">
                      <span>Live Stokes Gravity Physics (Mode 2)</span>
                      <input type="checkbox" id="chk-live-physics" />
                    </label>

                    <div class="control-slider-group" style="margin-top:8px;">
                      <div class="slider-header">
                        <span>Canalith Position (φ)</span>
                        <span class="slider-val" id="canalith-phi-val">-84° (Base)</span>
                      </div>
                      <input type="range" class="lab-range" id="canalith-phi-slider" min="-105" max="192" step="1" value="-84" aria-label="Canalith angular position phi" />
                    </div>
                  </div>
                </div>
              </aside>

              <!-- RIGHT FLOATING CLINICAL INSPECTOR & COLLAPSIBLE 27-PART LAYER TREE -->
              <aside class="right-inspector-drawer" id="right-inspector-drawer" aria-label="Right Clinical Info and Parts Panel">
                <div class="panel-collapse-bar right-collapse-bar">
                  <span class="panel-collapse-title">Structure Info &amp; Parts</span>
                  <div class="right-bar-actions">
                    <button
                      class="panel-toggle-btn"
                      id="btn-toggle-info-card"
                      type="button"
                      aria-label="Expand or collapse structure info card"
                      aria-expanded="false"
                      title="Expand or collapse full clinical info card"
                    >
                      <span class="toggle-label">Expand Info ▾</span>
                    </button>
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
                  <!-- Phase 5: Audience Depth Selector (Student / Clinician / Patient) -->
                  <div class="audience-selector-bar" id="audience-selector-bar" data-tab-pane="info">
                    <span class="audience-bar-label">Audience:</span>
                    <div class="layout-segmented audience-segmented" id="audience-mode-group" role="group" aria-label="Info card audience depth">
                      <button class="seg-btn active" type="button" data-audience-mode="student" title="Student: Core anatomy, innervation, physiology, and clinical pearls">
                        Student
                      </button>
                      <button class="seg-btn" type="button" data-audience-mode="clinician" title="Clinician: Full RAS morphometry, mesh telemetry, and diagnostic pearls">
                        Clinician
                      </button>
                      <button class="seg-btn" type="button" data-audience-mode="patient" title="Patient: Plain-language explanation of balance and hearing structures">
                        Patient
                      </button>
                    </div>
                  </div>

                  <!-- Floating Info Card (Compact by default, expands on click) -->
                  <div
                    class="inspector-card compact"
                    id="inspector-card-container"
                    data-tab-pane="info"
                    role="region"
                    aria-label="Selected structure clinical inspector"
                    tabindex="0"
                  ></div>

                  <!-- Collapsible 27-Part Layer Tree Section -->
                  <div class="part-list-section" id="part-list-section" data-tab-pane="parts">
                    <button
                      class="part-list-toggle-bar"
                      id="btn-toggle-part-list"
                      type="button"
                      aria-label="Toggle 27-part anatomical layer list"
                      aria-expanded="false"
                    >
                      <span>27-Part Anatomical Layer Tree</span>
                      <span class="part-list-chevron" id="part-list-chevron">▸ Show Parts</span>
                    </button>
                    <div class="layer-tree-container collapsed" id="layer-tree-container"></div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>

        <!-- LOADING OVERLAY -->
        <div class="loading-overlay" id="loading-overlay">
          <span class="brand-badge">LOADING IE-MAP v1.0.0 ATLAS</span>
          <div style="font-size:14px;font-weight:600;" id="loading-status-text">
            Ingesting 27 RAS Meshes &amp; Sculpted Head Context...
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
              <span class="brand-badge">GATE 3 · IE-MAP v1.0.0</span>
              <button
                class="welcome-close-btn"
                id="btn-close-welcome"
                type="button"
                aria-label="Close welcome dialog"
                title="Dismiss welcome overlay"
              >✕</button>
            </div>
            <h2 class="welcome-title" id="welcome-modal-title">
              Interactive Inner Ear 3D Anatomy &amp; Dissection Lab
            </h2>
            <p class="welcome-subtitle">
              Choose how you would like to start exploring the 27-mesh micro-CT inner ear atlas and BPPV canalithiasis simulator:
            </p>
            <div class="welcome-options-grid">
              <button
                class="welcome-option-btn"
                type="button"
                data-welcome-choice="guided_tour"
                aria-label="Guided tour: Start the narrated 8-shot clinical audio tour"
              >
                <span class="welcome-opt-badge">AUDIO + 3D TOUR</span>
                <span class="welcome-opt-title">Guided tour</span>
                <span class="welcome-opt-desc">
                  Start the narrated 8-shot clinical walkthrough of posterior canal BPPV and the Epley maneuver.
                </span>
              </button>

              <button
                class="welcome-option-btn"
                type="button"
                data-welcome-choice="explore_atlas"
                aria-label="Explore atlas: Open Mode 1 27-mesh anatomy atlas"
              >
                <span class="welcome-opt-badge">MODE 1 · ANATOMY</span>
                <span class="welcome-opt-title">Explore atlas</span>
                <span class="welcome-opt-desc">
                  Inspect, peel, and isolate all 27 inner ear structures in the IE-Map micro-CT atlas.
                </span>
              </button>

              <button
                class="welcome-option-btn"
                type="button"
                data-welcome-choice="epley_lab"
                aria-label="Epley lab: Open Mode 2 live BPPV and Epley physics lab"
              >
                <span class="welcome-opt-badge">MODE 2 · PHYSICS</span>
                <span class="welcome-opt-title">Epley lab</span>
                <span class="welcome-opt-desc">
                  Control 3D head orientation and watch real-time Stokes gravitational otoconia settling.
                </span>
              </button>
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
    this.infoCardToggleBtn = this.root.querySelector('#btn-toggle-info-card')!;
    this.partListToggleBtn = this.root.querySelector('#btn-toggle-part-list')!;

    this.epleySandboxBar = this.root.querySelector('#epley-sandbox-bar')!;
    this.cameraPresetBar = this.root.querySelector('#camera-preset-bar')!;
    this.tourPlayBtn = this.root.querySelector('#btn-tour-play')!;
    this.epleyCaptionHeadline = this.root.querySelector('#epley-caption-headline')!;
    this.epleyCaptionSub = this.root.querySelector('#epley-caption-sub')!;
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
      this.scene.setAppMode(btn.dataset.appMode as LabAppMode);
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
        return;
      }
      this.scene.jumpToEpleyStep(idx, true);
    });

    this.tourPlayBtn.addEventListener('click', () => {
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

    this.pinsLayer.addEventListener('click', (ev) => {
      const pinEl = (ev.target as HTMLElement).closest<HTMLElement>('[data-pin-mesh]');
      if (!pinEl) return;
      const meshName = pinEl.dataset.pinMesh!;
      this.scene.selectStructure(meshName, false);
    });

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
          s.clinicalPearl.toLowerCase().includes(q)
      );

      searchDropdown.innerHTML = matches
        .slice(0, 12)
        .map(
          (m) => `
          <div class="search-result-item" data-search-mesh="${m.meshName}">
            <div>
              <div class="search-result-name">${m.displayName}</div>
              <div class="search-result-latin">${m.latinName}</div>
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
      }
    });

    // 10. Phase 1: Collapsible Panels & Expandable Floating Info Card
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

    this.infoCardToggleBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.infoCardExpanded = !this.infoCardExpanded;
      this.writeStorageBool(AppHUD.LS_KEYS.infoExpanded, this.infoCardExpanded);
      if (this.infoCardExpanded && this.rightPanelCollapsed) {
        this.rightPanelCollapsed = false;
        this.writeStorageBool(AppHUD.LS_KEYS.rightCollapsed, false);
      }
      this.applyPanelStatesToDOM();
    });

    this.inspectorContainer.addEventListener('click', (ev) => {
      // Allow clicking interactive links/buttons inside expanded card without accidentally collapsing if needed,
      // unless clicking the expand/collapse hint or clicking anywhere when compact.
      const target = ev.target as HTMLElement;
      if (target.closest('a')) return;
      if (!this.infoCardExpanded || target.closest('[data-toggle-info-card]')) {
        this.infoCardExpanded = !this.infoCardExpanded;
        this.writeStorageBool(AppHUD.LS_KEYS.infoExpanded, this.infoCardExpanded);
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
      if (window.innerWidth <= 600) {
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
      if (!this.advancedToolsEnabled && this.scene.getSnapshot().toolMode !== 'inspect') {
        this.scene.setOverlays({ toolMode: 'inspect' });
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
      this.applyPanelStatesToDOM();

      if (choice === 'guided_tour') {
        this.scene.setAppMode('mode2_physics');
        if (!this.scene.getSnapshot().tourPlaying) {
          this.scene.toggleGuidedTour();
        }
      } else if (choice === 'explore_atlas') {
        this.scene.stopGuidedTour();
        this.scene.setAppMode('mode1_atlas');
      } else if (choice === 'epley_lab') {
        this.scene.stopGuidedTour();
        this.scene.setAppMode('mode2_physics');
      }
    });

    // 13. Phase 5: Audience Mode Selector (Student / Clinician / Patient)
    this.root.querySelector('#audience-mode-group')!.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-audience-mode]');
      if (!btn) return;
      const mode = btn.dataset.audienceMode as 'student' | 'clinician' | 'patient';
      this.audienceMode = mode;
      this.writeStorageString(AppHUD.LS_KEYS.audienceMode, mode);
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
        this.scene.setOverlays({ labelMode: this.quizSavedLabelMode });
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
        this.renderQuizPanel();
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
        this.scene.setOverlays({ labelMode: this.quizSavedLabelMode });
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
          curIdx < 2 ? 3 : Math.min(EPLEY_CLINICAL_STEPS.length - 1, curIdx + 1);
        this.predictRevealed = false;
        this.renderPredictPanel();
      }
      this.applyPanelStatesToDOM();
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
        this.predictPendingStepIdx = nextIdx < 2 ? 3 : nextIdx;
        this.predictRevealed = false;
        this.renderPredictPanel();
        return;
      }

      if (target.closest('#btn-close-predict')) {
        this.predictModeActive = false;
        this.applyPanelStatesToDOM();
      }
    });
  }

  private getQuizCandidateStructures() {
    // Prefer visible membranous structures so 3D highlighting and clicking are clear
    const snap = this.scene.getSnapshot();
    const visibleItems = IEMAP_STRUCTURES.filter(
      (item) =>
        item.systemGroup !== 'bony_capsule' &&
        (snap.visibilityMap[item.meshName] ?? item.defaultState) === 'visible'
    );
    return visibleItems.length >= 6
      ? visibleItems
      : IEMAP_STRUCTURES.filter((item) => item.systemGroup !== 'bony_capsule');
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

    // Build 4 multiple choice options (target + 3 distractors with distinct displayNames)
    const distractorPool = IEMAP_STRUCTURES.filter(
      (item) => item.meshName !== targetItem.meshName
    );
    const shuffledDistractors = [...distractorPool].sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [targetItem.meshName, ...shuffledDistractors.map((d) => d.meshName)].sort(
      () => Math.random() - 0.5
    );
    this.quizChoices = options;

    // Hide 3D labels while question is active so labels don't give away the answer
    this.scene.setOverlays({ labelMode: 'off' });

    if (this.quizType === 'name_highlighted') {
      this.scene.selectStructure(this.quizTargetMesh, true);
    } else {
      this.scene.selectStructure(null, false);
    }

    this.renderQuizPanel();
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
    if (this.quizLastCorrect) {
      this.quizCorrectCount += 1;
    } else {
      this.scene.selectStructure(this.quizTargetMesh, true);
    }
    this.renderQuizPanel();
  }

  private renderQuizPanel(): void {
    const targetItem = STRUCTURE_BY_MESH[this.quizTargetMesh] ?? IEMAP_STRUCTURES[0];
    const targetGroup = SYSTEM_GROUPS[targetItem.systemGroup];
    const pickedItem = this.quizSelectedChoice
      ? STRUCTURE_BY_MESH[this.quizSelectedChoice]
      : null;

    const choicesHtml =
      this.quizType === 'name_highlighted'
        ? `
          <div class="quiz-prompt-text">
            Which highlighted 3D structure is currently selected in the labyrinth?
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
                    <span class="quiz-choice-latin">${item.latinName}</span>
                  </button>
                `;
              })
              .join('')}
          </div>
        `
        : `
          <div class="quiz-prompt-text">
            Find &amp; click this structure directly in the 3D labyrinth:
          </div>
          <div class="quiz-click-target-banner">
            <div class="quiz-target-name">${targetItem.displayName}</div>
            <div class="quiz-target-sub">${targetItem.latinName} · ${targetGroup.shortTitle}</div>
          </div>
          <div class="quiz-click-actions">
            <button class="seg-btn" type="button" id="btn-quiz-hint">Hint: Fly Camera Near</button>
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
                : `✗ Incorrect (You selected: ${pickedItem?.displayName ?? 'Another part'} — Answer: ${targetItem.displayName})`
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
          <span class="brand-badge">MODE 1 QUIZ</span>
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
    if (stepIdx <= 2) {
      return {
        motion: 'stationary',
        motionLabel: 'Stationary at canal base (φ = -84°)',
        nystagmus: 'none',
        nystagmusLabel: 'Baseline (None)',
        explanation:
          'While sitting upright and turning the head 45° right (Step 1), the otoconia remain settled at the gravity-dependent base of the posterior canal (φ = -84°) with no cupular deflection.',
      };
    }
    if (stepIdx >= 3 && stepIdx <= 5) {
      return {
        motion: 'ampullofugal',
        motionLabel: 'Ampullofugal — drains away from ampulla toward Common Crus',
        nystagmus: 'upbeat_torsional',
        nystagmusLabel: 'Excitatory Upbeat-Torsional (Ewald’s 3rd Law)',
        explanation:
          'During supine extension and contralateral leftward rotation (Steps 2–4), gravity pulls the otoconia ampullofugally away from the posterior cupula toward the apex and Common Crus, exciting CN VIII and driving upbeat-torsional nystagmus.',
      };
    }
    return {
      motion: 'enter_utricle',
      motionLabel: 'Exits Common Crus & settles in Utricle (φ = +186°)',
      nystagmus: 'none',
      nystagmusLabel: 'Baseline (None)',
      explanation:
        'Returning upright in Step 5 empties the otoconia out of the Common Crus into the utricular vestibule (φ = +186°), allowing the posterior cupula to return to neutral baseline.',
    };
  }

  private renderPredictPanel(): void {
    const step = EPLEY_CLINICAL_STEPS[this.predictPendingStepIdx] ?? EPLEY_CLINICAL_STEPS[3];
    const expected = this.getExpectedStepOutcome(this.predictPendingStepIdx);
    const bothRight = this.predictLastMotionCorrect && this.predictLastNystagmusCorrect;

    this.predictPanelEl.innerHTML = `
      <div class="predict-panel-header">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="brand-badge">PREDICT MODE</span>
          <span class="predict-step-target">Before playing <strong>${step.shortTitle}</strong> (${step.clinicalTitle}):</span>
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
          <div class="predict-col-label">1. Predict Canalith Movement:</div>
          <div class="predict-btn-group">
            <button
              class="seg-btn ${this.predictChoiceMotion === 'stationary' ? 'active' : ''}"
              type="button"
              data-predict-motion="stationary"
              ${this.predictRevealed ? 'disabled' : ''}
            >
              Stationary at Base
            </button>
            <button
              class="seg-btn ${this.predictChoiceMotion === 'ampullofugal' ? 'active' : ''}"
              type="button"
              data-predict-motion="ampullofugal"
              ${this.predictRevealed ? 'disabled' : ''}
            >
              Ampullofugal (Away from Ampulla)
            </button>
            <button
              class="seg-btn ${this.predictChoiceMotion === 'enter_utricle' ? 'active' : ''}"
              type="button"
              data-predict-motion="enter_utricle"
              ${this.predictRevealed ? 'disabled' : ''}
            >
              Exits into Utricle
            </button>
          </div>
        </div>

        <div class="predict-col">
          <div class="predict-col-label">2. Predict VOR Nystagmus Direction:</div>
          <div class="predict-btn-group">
            <button
              class="seg-btn ${this.predictChoiceNystagmus === 'none' ? 'active' : ''}"
              type="button"
              data-predict-nystagmus="none"
              ${this.predictRevealed ? 'disabled' : ''}
            >
              Baseline (None)
            </button>
            <button
              class="seg-btn ${this.predictChoiceNystagmus === 'upbeat_torsional' ? 'active' : ''}"
              type="button"
              data-predict-nystagmus="upbeat_torsional"
              ${this.predictRevealed ? 'disabled' : ''}
            >
              Excitatory Upbeat-Torsional
            </button>
            <button
              class="seg-btn ${this.predictChoiceNystagmus === 'downbeat_inhibitory' ? 'active' : ''}"
              type="button"
              data-predict-nystagmus="downbeat_inhibitory"
              ${this.predictRevealed ? 'disabled' : ''}
            >
              Inhibitory Reversal
            </button>
          </div>
        </div>

        <div class="predict-action-col">
          ${
            !this.predictRevealed
              ? `<button class="tour-play-btn" type="button" id="btn-play-and-reveal-prediction">
                   ▶ Play Step &amp; Reveal Answer
                 </button>`
              : `<button class="tour-play-btn" type="button" id="btn-predict-next-step">
                   Predict Next Step →
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
                    : `Answer Revealed — Motion: ${this.predictLastMotionCorrect ? '✓' : '✗'} (${expected.motionLabel}) · Nystagmus: ${this.predictLastNystagmusCorrect ? '✓' : '✗'} (${expected.nystagmusLabel})`
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
    if (window.innerWidth <= 600) {
      return this.pipInsetOpenMobile;
    }
    return this.pipInsetOpenDesktop;
  }

  private applyPanelStatesToDOM(): void {
    const labShell = this.root.querySelector('.lab-shell');
    if (labShell) {
      labShell.classList.toggle('advanced-tools-off', !this.advancedToolsEnabled);
    }
    this.advancedToolsCheckbox.checked = this.advancedToolsEnabled;
    this.welcomeOverlay.classList.toggle('hidden', this.welcomeDismissed);

    // Phase 5: Audience mode buttons
    this.root.querySelectorAll<HTMLButtonElement>('[data-audience-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.audienceMode === this.audienceMode);
    });

    // Phase 5: Mode 1 Quiz Panel & Mode 2 Predict Panel visibility
    const isMode1 = this.scene ? this.scene.getSnapshot().appMode === 'mode1_atlas' : true;
    const isMode2 = !isMode1;
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
      ? `<span class="toggle-icon">◀</span><span class="toggle-label">Info &amp; Parts</span>`
      : `<span class="toggle-icon">▶</span>`;

    // Floating Info Card (compact vs expanded)
    this.inspectorContainer.classList.toggle('compact', !this.infoCardExpanded);
    this.inspectorContainer.classList.toggle('expanded', this.infoCardExpanded);
    this.infoCardToggleBtn.setAttribute('aria-expanded', String(this.infoCardExpanded));
    this.infoCardToggleBtn.innerHTML = this.infoCardExpanded
      ? `<span class="toggle-label">Compact Info ▴</span>`
      : `<span class="toggle-label">Expand Info ▾</span>`;

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
    this.pipToggleBtn.classList.toggle('active', pipVis);
    this.pipToggleBtn.setAttribute('aria-pressed', String(pipVis));
    this.pipToggleBtn.textContent = pipVis ? 'Hide PiP' : 'Show PiP';

    // Adjust Mode 2 Epley bar horizontal margins based on panel collapse states
    this.epleySandboxBar.classList.toggle('left-collapsed', this.leftPanelCollapsed);
    this.epleySandboxBar.classList.toggle('right-collapsed', this.rightPanelCollapsed);
    this.epleySandboxBar.classList.toggle('drawer-expanded-offset', this.mobileDrawerExpanded);
    this.cameraPresetBar.classList.toggle('drawer-expanded-offset', this.mobileDrawerExpanded);
  }

  private syncViewportRects(): void {
    const w = this.canvasHost.clientWidth;
    const h = this.canvasHost.clientHeight;
    if (!this.isPipInsetVisible()) {
      this.scene.setViewportRects(
        { left: 0, top: 0, width: w, height: h },
        { left: 0, top: 0, width: 0, height: 0 }
      );
      return;
    }
    const isSmall = window.innerWidth <= 900;
    const pipW = isSmall ? 230 : 290;
    const pipH = isSmall ? 175 : 215;
    this.scene.setViewportRects(
      { left: 0, top: 0, width: w, height: h },
      { left: Math.max(0, w - pipW - 12), top: 12, width: pipW, height: pipH }
    );
  }

  private renderLiveTelemetry(tel: PhysicsTelemetryState): void {
    this.canalithPhiInput.value = String(tel.phiDeg);
    this.canalithPhiVal.textContent = `${tel.phiDeg > 0 ? '+' : ''}${Math.round(tel.phiDeg)}°`;
    this.headYawInput.value = String(tel.psiYawDeg);
    this.headYawVal.textContent = `${tel.psiYawDeg > 0 ? '+' : ''}${Math.round(tel.psiYawDeg)}°`;
    this.headPitchInput.value = String(tel.thetaReclineDeg);
    this.headPitchVal.textContent = `${Math.round(tel.thetaReclineDeg)}°`;

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

    // Update Mode 2 Step strip & caption
    this.tourPlayBtn.textContent = snap.tourPlaying
      ? '⏸ Pause Clinical Tour'
      : '▶ Play 8-Shot Audio Tour';
    this.root.querySelectorAll<HTMLButtonElement>('[data-epley-step]').forEach((btn) => {
      btn.classList.toggle(
        'active',
        parseInt(btn.dataset.epleyStep!, 10) === snap.activeEpleyStepIdx
      );
    });
    const curStep = EPLEY_CLINICAL_STEPS[snap.activeEpleyStepIdx] ?? EPLEY_CLINICAL_STEPS[0];
    this.epleyCaptionHeadline.textContent = curStep.headline;
    this.epleyCaptionSub.textContent = curStep.caption;

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
      this.pipTitleEl.textContent = 'STAGE 1 (LEFT): 3D PATIENT HEAD & PETROUS CUTAWAY';
    } else {
      this.pipHudFrame.classList.remove('split-mode');
      this.rightDrawerEl.classList.remove('split-layout-offset');
      this.pipTitleEl.textContent =
        snap.layoutMode === 'labyrinth_main'
          ? '3D PATIENT HEAD & RIGHT EAR CUTAWAY'
          : '27-MESH IE-Map LABYRINTH STAGE';
    }

    // Render Interactive Breadcrumb Trail
    const activeMeshName = snap.hoveredMesh ?? snap.selectedMesh ?? 'ls_Hsapiens_Sp';
    const activeItem = STRUCTURE_BY_MESH[activeMeshName] ?? IEMAP_STRUCTURES[0];
    const sysGroup = SYSTEM_GROUPS[activeItem.systemGroup];

    this.breadcrumbBar.innerHTML = `
      <span class="crumb-item" data-crumb-action="reset">Right Inner Ear (RAS)</span>
      <span class="crumb-sep">›</span>
      <span class="crumb-item" data-crumb-group="${sysGroup.id}">${sysGroup.shortTitle}</span>
      <span class="crumb-sep">›</span>
      <span class="crumb-item" data-crumb-group="${sysGroup.id}">${activeItem.subGroup}</span>
      <span class="crumb-sep">›</span>
      <span class="crumb-item active" data-crumb-mesh="${activeItem.meshName}" title="${activeItem.displayName} (${activeItem.latinName}) · Raw ID: ${activeItem.meshName}">${activeItem.shortLabel}</span>
    `;

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

    // Render Selected Structure Clinical Inspector Card (Compact floating vs Expanded, Audience-aware)
    const inspectedItem =
      STRUCTURE_BY_MESH[snap.selectedMesh ?? 'ls_Hsapiens_Sp'] ?? IEMAP_STRUCTURES[0];
    const inspectedGroup = SYSTEM_GROUPS[inspectedItem.systemGroup];

    const compactPreviewText =
      this.audienceMode === 'patient'
        ? inspectedItem.patientSummary
        : this.audienceMode === 'clinician'
        ? inspectedItem.clinicalPearl
        : inspectedItem.physiologicalFunction;

    const expandedBodyHtml =
      this.audienceMode === 'patient'
        ? `
          <div class="clinical-field">
            <div class="clinical-field-label">Plain-Language Summary (Patient View)</div>
            <div class="clinical-field-body">${inspectedItem.patientSummary}</div>
          </div>

          <div class="clinical-field">
            <div class="clinical-field-label">Inner Ear System</div>
            <div class="clinical-field-body">${inspectedGroup.title} — ${inspectedGroup.subtitle}</div>
          </div>

          <div class="clinical-pearl-box">
            <strong>Why It Matters in BPPV &amp; Balance:</strong> ${inspectedItem.clinicalPearl}
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

    this.inspectorContainer.innerHTML = `
      <div class="inspector-compact-header" data-toggle-info-card="true" title="Raw ID: ${inspectedItem.meshName} (${inspectedItem.structureId})">
        <div class="inspector-header-badges">
          <span class="compartment-pill" style="border-color:${inspectedGroup.accentHex};color:${inspectedGroup.accentHex};">
            ${inspectedGroup.shortTitle.toUpperCase()}
          </span>
          <span class="compartment-pill">
            ${
              this.audienceMode === 'patient'
                ? 'Patient Guide'
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
            <div class="inspector-latin">${inspectedItem.latinName}</div>
          </div>
          <span class="inspector-expand-pill" data-toggle-info-card="true">
            ${this.infoCardExpanded ? '▴ Less' : '▾ Expand'}
          </span>
        </div>
      </div>

      <div class="inspector-compact-preview" data-toggle-info-card="true">
        ${compactPreviewText}
      </div>

      <div class="inspector-expanded-details">
        ${expandedBodyHtml}
      </div>
    `;
    this.applyPanelStatesToDOM();

    // Render 5-System 27-Mesh Layer Tree
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
            const isSel = snap.selectedMesh === item.meshName;
            return `
              <div class="mesh-row ${isSel ? 'selected' : ''}" data-tree-select="${item.meshName}" title="${item.displayName} (${item.latinName}) · Raw ID: ${item.meshName}">
                <div class="mesh-row-left">
                  <span class="mesh-swatch" style="background:${item.colorHex};"></span>
                  <span class="mesh-row-label" title="${item.displayName} (${item.latinName}) · Raw ID: ${item.meshName}">
                    ${item.shortLabel}
                  </span>
                </div>
                <div class="group-vis-btns">
                  <button
                    class="mini-vis-btn ${st === 'visible' ? 'active-vis' : ''}"
                    data-mesh-vis="${item.meshName}:visible"
                    title="Solid / Translucent Visible (${item.meshName})"
                  >Vis</button>
                  <button
                    class="mini-vis-btn ${st === 'ghost' ? 'active-ghost' : ''}"
                    data-mesh-vis="${item.meshName}:ghost"
                    title="Fresnel X-Ray Ghost (${item.meshName})"
                  >X-Ray</button>
                  <button
                    class="mini-vis-btn ${st === 'hidden' ? 'active-hide' : ''}"
                    data-mesh-vis="${item.meshName}:hidden"
                    title="Peel / Hide Structure (${item.meshName})"
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
                <button class="mini-vis-btn" data-sys-vis="${gId}:visible">All Vis</button>
                <button class="mini-vis-btn" data-sys-vis="${gId}:ghost">All X-Ray</button>
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

  private renderProjectedPins(pins: ProjectedPin2D[]): void {
    this.pinsLayer.innerHTML = pins
      .filter((p) => p.visible)
      .map(
        (p) => `
        <div
          class="pin-pill ${p.category === 'structure' ? 'structure-pin' : ''} ${
          p.occluded ? 'occluded' : ''
        }"
          style="left:${p.screenX.toFixed(1)}px;top:${p.screenY.toFixed(1)}px;border-color:${
          p.colorHex
        };"
          title="${p.sublabel}"
          data-raw-id="${p.rawId}"
          ${p.meshName ? `data-pin-mesh="${p.meshName}"` : ''}
        >
          <span class="pin-dot" style="background:${p.colorHex};"></span>
          <span>${p.label}</span>
        </div>
      `
      )
      .join('');
  }
}
