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
  LabelDensityMode,
  LabSceneSnapshot,
  ProjectedPin2D,
  ReadingDepth,
} from '../render/DualStageScene';

export class AppHUD {
  private root: HTMLElement;
  private scene: DualStageScene;
  private canvasHost!: HTMLElement;
  private pinsLayer!: HTMLElement;
  private pinElements = new Map<string, HTMLElement>();

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
  private boneSlider!: HTMLInputElement;
  private boneValEl!: HTMLElement;
  private explodeSlider!: HTMLInputElement;
  private explodeValEl!: HTMLElement;
  private presetButtons = new Map<string, HTMLButtonElement>();
  private partsToggleBtn!: HTMLButtonElement;
  private partsDrawer!: HTMLElement;
  private partsDrawerOpen = false;

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
    this.renderPartsTree();

    this.scene.onStateChange((snap) => this.renderState(snap));
    this.scene.onPinsUpdate((pins) => this.renderProjectedPins(pins));
    this.scene.onStructurePicked((meshName) => this.handleStructurePicked(meshName));

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

        <!-- 4. COMPACT BOTTOM VISUALIZATION BAR -->
        <nav class="bottom-viz-bar" id="bottom-bar" aria-label="Visualization Controls">
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
        </nav>

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
    this.searchInput = this.root.querySelector('#search-input') as HTMLInputElement;
    this.searchClearBtn = this.root.querySelector('#search-clear-btn') as HTMLButtonElement;
    this.searchDropdown = this.root.querySelector('#search-dropdown') as HTMLElement;
    this.settingsBtn = this.root.querySelector('#settings-btn') as HTMLButtonElement;
    this.settingsPopover = this.root.querySelector('#settings-popover') as HTMLElement;
    this.inspectorCard = this.root.querySelector('#inspector-card') as HTMLElement;
    this.bottomBar = this.root.querySelector('#bottom-bar') as HTMLElement;
    this.boneSlider = this.root.querySelector('#bone-peel-slider') as HTMLInputElement;
    this.boneValEl = this.root.querySelector('#bone-val') as HTMLElement;
    this.explodeSlider = this.root.querySelector('#explode-slider') as HTMLInputElement;
    this.explodeValEl = this.root.querySelector('#explode-val') as HTMLElement;
    this.partsToggleBtn = this.root.querySelector('#parts-toggle-btn') as HTMLButtonElement;
    this.partsDrawer = this.root.querySelector('#parts-drawer') as HTMLElement;
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
    this.partsDrawerOpen = !this.partsDrawerOpen;
    this.partsDrawer.classList.toggle('open', this.partsDrawerOpen);
    this.partsToggleBtn.classList.toggle('open', this.partsDrawerOpen);
    this.partsToggleBtn.setAttribute('aria-expanded', this.partsDrawerOpen ? 'true' : 'false');
    const arrowEl = this.partsToggleBtn.querySelector('.toggle-arrow');
    if (arrowEl) {
      arrowEl.textContent = this.partsDrawerOpen ? '▾' : '▸';
    }
    if (window.innerWidth <= 640) {
      this.inspectorCard.classList.toggle('drawer-active', this.partsDrawerOpen);
    }
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
    this.inspectorCard.classList.remove('drawer-active');
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
  }
}
