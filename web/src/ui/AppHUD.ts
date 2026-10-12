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

  private leftPanelCollapsed = false;
  private rightPanelCollapsed = false;
  private infoCardExpanded = false;
  private partListCollapsed = true;

  private static readonly LS_KEYS = {
    leftCollapsed: 'gate3_left_panel_collapsed',
    rightCollapsed: 'gate3_right_panel_collapsed',
    infoExpanded: 'gate3_info_card_expanded',
    partsCollapsed: 'gate3_part_list_collapsed',
  };

  constructor(root: HTMLElement) {
    this.root = root;
    this.loadSavedPanelStates();
    this.buildDOM();
    this.scene = new DualStageScene(this.canvasHost);

    this.scene.onStateChange((snap) => this.renderState(snap));
    this.scene.onPinsUpdate((pins) => this.renderProjectedPins(pins));
    this.scene.onTelemetryUpdate((tel) => this.renderLiveTelemetry(tel));

    window.addEventListener('resize', () => this.syncViewportRects());
    this.applyPanelStatesToDOM();
    this.syncViewportRects();
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
  }

  public async init(): Promise<void> {
    this.scene.startRenderLoop();
    await this.scene.loadAllAssets();
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

          <!-- Search & Viewport Layout Switcher -->
          <div class="header-controls">
            <div class="search-wrapper">
              <input
                type="text"
                class="search-input"
                id="structure-search-input"
                placeholder="Search 27 parts, Latin, BPPV... (⌘K)"
                autocomplete="off"
              />
              <div class="search-dropdown" id="structure-search-dropdown"></div>
            </div>

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
                <button class="pip-btn" id="pip-swap-btn">Swap Stage ⇄</button>
              </div>
              <div class="pip-footer">
                <div class="pip-slider-row">
                  <span>Head Glass</span>
                  <input type="range" id="head-opacity-slider" min="0" max="90" value="34" />
                  <label style="display:flex;align-items:center;gap:3px;cursor:pointer;">
                    <input type="checkbox" id="sync-cam-checkbox" checked /> Sync Orbit
                  </label>
                </div>
                <div class="pip-slider-row">
                  <span>Head Yaw ψ</span>
                  <input type="range" id="head-yaw-slider" min="-90" max="150" step="1" value="0" />
                  <span id="head-yaw-val" style="width:36px;text-align:right;">0°</span>
                </div>
                <div class="pip-slider-row">
                  <span>Recline θ</span>
                  <input type="range" id="head-pitch-slider" min="-20" max="130" step="1" value="0" />
                  <span id="head-pitch-val" style="width:36px;text-align:right;">0°</span>
                </div>
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
                <!-- Section 1: Clinical Dissection Presets -->
                <div class="dock-section">
                  <div class="dock-section-title">
                    <span>1. Clinical Dissection Presets</span>
                  </div>
                  <div class="preset-list" id="preset-list"></div>
                </div>

                <!-- Section 2: Active Structure Dissection Actions -->
                <div class="dock-section">
                  <div class="dock-section-title">
                    <span>2. Virtual Dissection &amp; Scalpel</span>
                  </div>
                  <div class="action-grid" style="margin-bottom:6px;">
                    <button class="action-btn" id="btn-fly-selected">Fly Camera Here</button>
                    <button class="action-btn" id="btn-isolate-selected">Isolate Part</button>
                    <button class="action-btn" id="btn-ghost-others">X-Ray Ghost Others</button>
                    <button class="action-btn" id="btn-hide-selected">Peel / Hide Part</button>
                  </div>
                  <div class="action-grid">
                    <button class="action-btn" id="btn-tool-scalpel" title="Click any 3D structure to immediately peel/hide it">
                      Scalpel: Click-Peel
                    </button>
                    <button class="action-btn" id="btn-tool-xray" title="Click any 3D structure to convert it to X-Ray Ghost">
                      Brush: Click-Ghost
                    </button>
                    <button class="action-btn" id="btn-undo-dissect" disabled>Undo Step</button>
                    <button class="action-btn" id="btn-reset-all">Reset Atlas</button>
                  </div>
                </div>

                <!-- Section 3: Concentric Layer Peel & Radial Explode -->
                <div class="dock-section">
                  <div class="dock-section-title">
                    <span>3. Layer Peel &amp; Radial Explode</span>
                  </div>

                  <div class="control-slider-group">
                    <div class="slider-header">
                      <span>Bony Capsule Peel (Otic Shell)</span>
                      <span class="slider-val" id="bony-peel-val">80%</span>
                    </div>
                    <input type="range" class="lab-range" id="bony-peel-slider" min="0" max="100" value="80" />
                  </div>

                  <div class="control-slider-group">
                    <div class="slider-header">
                      <span>Ampulla &amp; Cochlea Micro-Cutaway</span>
                      <span class="slider-val" id="micro-cut-val">35%</span>
                    </div>
                    <input type="range" class="lab-range" id="micro-cut-slider" min="0" max="100" value="35" />
                  </div>

                  <div class="control-slider-group">
                    <div class="slider-header">
                      <span>Radial Explode Assembly (27 Parts)</span>
                      <span class="slider-val" id="explode-val">0%</span>
                    </div>
                    <input type="range" class="lab-range" id="explode-slider" min="0" max="100" value="0" />
                  </div>
                </div>

                <!-- Section 4: 3-Axis Multi-Planar Cross-Section Slicer -->
                <div class="dock-section">
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
                    <input type="range" class="lab-range" id="clip-offset-slider" min="-7.0" max="11.0" step="0.1" value="0.0" />
                  </div>
                </div>

                <!-- Section 5: Reference Landmarks, Canal Planes & BPPV Path -->
                <div class="dock-section" style="border-bottom:none;">
                  <div class="dock-section-title">
                    <span>5. Spatial Overlays &amp; BPPV Spline</span>
                  </div>
                  <label class="toggle-row">
                    <span>3D Slicer Fiducial Pins (.fcsv)</span>
                    <input type="checkbox" id="chk-fiducials" checked />
                  </label>
                  <label class="toggle-row">
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
                    <input type="range" class="lab-range" id="canalith-phi-slider" min="-105" max="192" step="1" value="-84" />
                  </div>
                </div>
              </div>
            </aside>

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
                <label style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px;cursor:pointer;flex-shrink:0;">
                  <input type="checkbox" id="chk-mute-audio" /> Mute Audio
                </label>
              </div>

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
                <!-- Floating Info Card (Compact by default, expands on click) -->
                <div
                  class="inspector-card compact"
                  id="inspector-card-container"
                  role="region"
                  aria-label="Selected structure clinical inspector"
                  tabindex="0"
                ></div>

                <!-- Collapsible 27-Part Layer Tree Section -->
                <div class="part-list-section" id="part-list-section">
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

        <!-- LOADING OVERLAY -->
        <div class="loading-overlay" id="loading-overlay">
          <span class="brand-badge">LOADING IE-MAP v1.0.0 ATLAS</span>
          <div style="font-size:14px;font-weight:600;" id="loading-status-text">
            Ingesting 27 RAS Meshes &amp; Sculpted Head Context...
          </div>
          <div class="loading-bar-track">
            <div class="loading-bar-fill" id="loading-bar-fill"></div>
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

    // 5. Layout Mode Switcher
    this.root.querySelector('#layout-mode-group')!.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-layout]');
      if (!btn) return;
      this.scene.setOverlays({ layoutMode: btn.dataset.layout as ViewportLayoutMode });
      this.syncViewportRects();
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
  }

  private applyPanelStatesToDOM(): void {
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

    // Adjust Mode 2 Epley bar horizontal margins based on panel collapse states
    this.epleySandboxBar.classList.toggle('left-collapsed', this.leftPanelCollapsed);
    this.epleySandboxBar.classList.toggle('right-collapsed', this.rightPanelCollapsed);
  }

  private syncViewportRects(): void {
    const w = this.canvasHost.clientWidth;
    const h = this.canvasHost.clientHeight;
    const pipW = 290;
    const pipH = 215;
    this.scene.setViewportRects(
      { left: 0, top: 0, width: w, height: h },
      { left: Math.max(0, w - pipW - 14), top: 14, width: pipW, height: pipH }
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
    this.loadingText.textContent = `Loading 27 IE-Map RAS Meshes & Head Context (${snap.loadingProgress}%)...`;
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
      <span class="crumb-item active" data-crumb-mesh="${activeItem.meshName}">${activeItem.shortLabel}</span>
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

    // Render Selected Structure Clinical Inspector Card (Compact floating vs Expanded)
    const inspectedItem =
      STRUCTURE_BY_MESH[snap.selectedMesh ?? 'ls_Hsapiens_Sp'] ?? IEMAP_STRUCTURES[0];
    const inspectedGroup = SYSTEM_GROUPS[inspectedItem.systemGroup];

    this.inspectorContainer.innerHTML = `
      <div class="inspector-compact-header" data-toggle-info-card="true">
        <div class="inspector-header-badges">
          <span class="compartment-pill" style="border-color:${inspectedGroup.accentHex};color:${inspectedGroup.accentHex};">
            ${inspectedGroup.shortTitle.toUpperCase()}
          </span>
          <span class="compartment-pill">
            ${inspectedItem.fluidCompartment}
          </span>
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
        ${inspectedItem.physiologicalFunction}
      </div>

      <div class="inspector-expanded-details">
        <div class="inspector-etymology">${inspectedItem.etymology}</div>

        <div class="telemetry-strip">
          <div class="telemetry-cell">
            <span class="telemetry-key">Mesh ID</span>
            <span class="telemetry-val">${inspectedItem.meshName}</span>
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
              <div class="mesh-row ${isSel ? 'selected' : ''}" data-tree-select="${item.meshName}">
                <div class="mesh-row-left">
                  <span class="mesh-swatch" style="background:${item.colorHex};"></span>
                  <span class="mesh-row-label" title="${item.displayName} (${item.latinName})">
                    ${item.shortLabel}
                  </span>
                </div>
                <div class="group-vis-btns">
                  <button
                    class="mini-vis-btn ${st === 'visible' ? 'active-vis' : ''}"
                    data-mesh-vis="${item.meshName}:visible"
                    title="Solid / Translucent Visible"
                  >Vis</button>
                  <button
                    class="mini-vis-btn ${st === 'ghost' ? 'active-ghost' : ''}"
                    data-mesh-vis="${item.meshName}:ghost"
                    title="Fresnel X-Ray Ghost"
                  >X-Ray</button>
                  <button
                    class="mini-vis-btn ${st === 'hidden' ? 'active-hide' : ''}"
                    data-mesh-vis="${item.meshName}:hidden"
                    title="Peel / Hide Structure"
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
