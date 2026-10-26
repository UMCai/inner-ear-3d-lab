/**
 * web/src/ui/VORDrawer.ts
 *
 * Docked Clinical Video-Nystagmography (VNG) & 3D VOR Eye Avatar Drawer.
 * Stage 3 — Step 4: Gate 3 Medaium Architecture.
 *
 * Features:
 * 1. Bilateral 3D Eye Avatar Viewport:
 *    - 360x220 logical (720x440 physical Retina) canvas connected to EyeAvatarEngine.
 *    - 3-DOF Listing's Law, cyclovergent coupling, and saccadic burst visualization.
 * 2. Real-Time Rolling 3-Lead Nystagmogram Strip Chart:
 *    - 360x110 logical (720x220 physical Retina) canvas reading from NystagmogramRingBuffer.
 *    - Cyan (#52dcf2) Horizontal, Lime (#4ade80) Vertical, Amber (#fbbf24) Torsional leads.
 *    - High-contrast zero baseline, ±10° and ±20° dashed grid lines, saccade flags.
 * 3. Near-Infrared (NIR) VNG Goggles Toggle:
 *    - Monochromatic 850–940 nm camera response filter vs natural ocular materials.
 * 4. Gaze Tracking Overlays (Pupil Crosshairs ⊕ and Corneal Purkinje Glints ✱).
 * 5. Strict drawer mutual exclusivity with CTSliceDrawer, AudiogramDrawer, and PartsDrawer.
 */

import {
  EyeAvatarEngine,
  type EyeAvatarConfig,
  type EyeTelemetry,
  type VisualMode,
} from '../render/eyeAvatar.ts';
import type { VestibularTelemetryState } from '../physics/vestibularEngine.ts';
import {
  VHITImpulseBuffer,
  type VHITPathologyPreset,
  type VHITParadigm,
  computeAlexanderModulation,
  calculateJongkees,
} from '../physics/diagnosticVestibularEngine.ts';

export class VORDrawer {
  private container: HTMLElement;
  private rootEl: HTMLElement;
  private avatarCanvas!: HTMLCanvasElement;
  private hudCanvas!: HTMLCanvasElement;
  private stripCanvas!: HTMLCanvasElement;
  private hudCtx: CanvasRenderingContext2D | null = null;
  private stripCtx: CanvasRenderingContext2D | null = null;

  public eyeEngine: EyeAvatarEngine;
  private isOpen = false;
  private visualMode: VisualMode = 'natural';
  private onCloseCallbacks: Array<() => void> = [];

  // Diagnostic Vestibular Modes: Nystagmogram vs Caloric Butterfly vs vHIT Dual-Trace
  private diagnosticViewMode: 'nystagmogram' | 'caloric' | 'vhit' = 'nystagmogram';
  private alexanderGazeYaw = 0; // -30, 0, +30 degrees
  private readonly vhitBuffer = new VHITImpulseBuffer();
  private vhitCursorMs: number | null = null;

  // Caloric Butterfly Plot dataset
  private caloricValues = {
    r44: 22,
    r30: 20,
    l44: 21,
    l30: 21,
    activeTemp: null as string | null,
    activeSPV: 0,
  };
  private onAlexGazeChangeCallbacks: Array<(gaze: number) => void> = [];
  private onDiagnosticModeChangeCallbacks: Array<(mode: 'nystagmogram' | 'caloric' | 'vhit') => void> = [];

  // Mode DOM Elements
  private stripTitleEl!: HTMLElement;
  private stripRangeEl!: HTMLElement;
  private stripTabs: HTMLButtonElement[] = [];
  private alexanderRowEl!: HTMLElement;
  private alexGazeBtns: HTMLButtonElement[] = [];
  private alexBadgeEl!: HTMLElement;
  private stripLegendEl!: HTMLElement;

  // DOM Elements
  private modeToggleBtn!: HTMLButtonElement;
  private modeIconEl!: HTMLElement;
  private modeLabelEl!: HTMLElement;
  private closeBtn!: HTMLButtonElement;

  // Live Metric Telemetry Elements
  private hValEl!: HTMLElement;
  private vValEl!: HTMLElement;
  private tValEl!: HTMLElement;
  private spvValEl!: HTMLElement;
  private statusEl!: HTMLElement;

  // Retina Scaling Factors
  private static readonly AVATAR_LOGICAL_W = 360;
  private static readonly AVATAR_LOGICAL_H = 220;
  private static readonly STRIP_LOGICAL_W = 360;
  private static readonly STRIP_LOGICAL_H = 110;
  private static readonly CANVAS_PIXEL_RATIO = 2;

  constructor(container: HTMLElement, config?: EyeAvatarConfig) {
    this.container = container;
    this.visualMode = config?.visualMode || 'natural';

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'vor-drawer';
    this.rootEl.id = 'vor-drawer';
    this.rootEl.setAttribute('role', 'region');
    this.rootEl.setAttribute('aria-label', '3D VOR & Clinical VNG Eye Avatar');
    this.container.appendChild(this.rootEl);

    this.renderDOM();
    this.initCanvases();
    this.attachEvents();

    // Instantiate EyeAvatarEngine attached to avatarCanvas
    this.eyeEngine = new EyeAvatarEngine({
      canvas: this.avatarCanvas,
      logicalWidth: VORDrawer.AVATAR_LOGICAL_W,
      logicalHeight: VORDrawer.AVATAR_LOGICAL_H,
      pixelRatio: VORDrawer.CANVAS_PIXEL_RATIO,
      visualMode: this.visualMode,
      gazeMode: config?.gazeMode || 'bilateral',
      glbPath: config?.glbPath || '/assets/iemap/eye_avatar.glb',
    });

    // Asynchronously load avatar 3D asset if in browser environment with origin
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      this.eyeEngine.load().catch((err) => {
        // In test/headless environments without WebGL, silently fallback to mathematical simulation
        if (typeof console !== 'undefined') {
          console.warn('VORDrawer: EyeAvatarEngine load notice:', err?.message || err);
        }
      });
    }

    this.drawStripBaselines();
  }

  // ---------------------------------------------------------------------------
  // DOM Rendering & Layout
  // ---------------------------------------------------------------------------
  private renderDOM(): void {
    this.rootEl.innerHTML = `
      <div class="vor-panel">
        <!-- Drawer Header -->
        <div class="vor-header">
          <div class="vor-title-cluster">
            <span class="vor-icon" aria-hidden="true">👁️</span>
            <div class="vor-title-text">
              <span class="vor-title">Clinical VNG &amp; 3D VOR</span>
              <span class="vor-subtitle">Listing's Law · 3-Lead Oculography</span>
            </div>
          </div>
          <div class="vor-header-actions">
            <button
              type="button"
              class="vor-mode-toggle-btn"
              id="vor-mode-toggle-btn"
              title="Toggle Natural vs Infrared VNG Goggles Mode"
              aria-label="Toggle Infrared VNG Mode"
            >
              <span class="vor-mode-icon" id="vor-mode-icon">${this.visualMode === 'infrared_vng' ? '🔴' : '👁️'}</span>
              <span class="vor-mode-label" id="vor-mode-label">${this.visualMode === 'infrared_vng' ? 'NIR VNG' : 'Natural'}</span>
            </button>
            <button type="button" class="drawer-close-btn" id="vor-close-btn" aria-label="Close VOR Drawer">✕</button>
          </div>
        </div>

        <!-- 3D Eye Avatar Viewport & Gaze HUD -->
        <div class="vor-avatar-stage" id="vor-avatar-stage">
          <canvas
            class="vor-avatar-canvas"
            id="vor-avatar-canvas"
            width="${VORDrawer.AVATAR_LOGICAL_W * VORDrawer.CANVAS_PIXEL_RATIO}"
            height="${VORDrawer.AVATAR_LOGICAL_H * VORDrawer.CANVAS_PIXEL_RATIO}"
            style="width: ${VORDrawer.AVATAR_LOGICAL_W}px; height: ${VORDrawer.AVATAR_LOGICAL_H}px;"
          ></canvas>
          <canvas
            class="vor-hud-canvas"
            id="vor-hud-canvas"
            width="${VORDrawer.AVATAR_LOGICAL_W * VORDrawer.CANVAS_PIXEL_RATIO}"
            height="${VORDrawer.AVATAR_LOGICAL_H * VORDrawer.CANVAS_PIXEL_RATIO}"
            style="width: ${VORDrawer.AVATAR_LOGICAL_W}px; height: ${VORDrawer.AVATAR_LOGICAL_H}px;"
          ></canvas>
          <div class="vor-eye-labels">
            <span class="vor-eye-tag right">Right Eye (OD)</span>
            <span class="vor-eye-tag left">Left Eye (OS)</span>
          </div>
        </div>

        <!-- Live Telemetry Overlays -->
        <div class="vor-telemetry-cluster" id="vor-telemetry-cluster">
          <div class="vor-metrics-row">
            <span class="vor-metric-pill" id="vor-metric-h" title="Horizontal Conjugate Gaze Angle">
              <span class="m-lbl">H:</span> <span class="m-val" id="vor-h-val">0.0°</span>
            </span>
            <span class="vor-metric-pill" id="vor-metric-v" title="Vertical Conjugate Gaze Angle">
              <span class="m-lbl">V:</span> <span class="m-val" id="vor-v-val">0.0°</span>
            </span>
            <span class="vor-metric-pill" id="vor-metric-t" title="Vestibular Cyclotorsion Angle">
              <span class="m-lbl">T:</span> <span class="m-val" id="vor-t-val">0.0°</span>
            </span>
            <span class="vor-metric-pill spv-pill" id="vor-metric-spv" title="Slow-Phase Velocity Magnitude">
              <span class="m-lbl">SPV:</span> <span class="m-val" id="vor-spv-val">0.0°/s</span>
            </span>
          </div>
          <div class="vor-nystagmus-status" id="vor-nystagmus-status">
            Resting Equilibrium (No Nystagmus)
          </div>
        </div>

        <!-- Rolling 3-Lead Nystagmogram / Caloric / vHIT Dual-Trace Strip Chart -->
        <div class="vor-strip-section">
          <div class="vor-strip-header">
            <span class="vor-strip-title" id="vor-strip-title">3-Lead Nystagmogram (10s Rolling)</span>
            <span class="vor-strip-range" id="vor-strip-range">±25° Range</span>
          </div>

          <!-- Diagnostic Strip Tabs -->
          <div class="vor-strip-mode-tabs" id="vor-strip-mode-tabs" role="tablist" aria-label="Diagnostic Strip Modes">
            <button type="button" class="vor-strip-tab active" data-strip-mode="nystagmogram">3-Lead</button>
            <button type="button" class="vor-strip-tab" data-strip-mode="caloric">Caloric Butterfly</button>
            <button type="button" class="vor-strip-tab" data-strip-mode="vhit">vHIT Dual-Trace</button>
          </div>

          <!-- Alexander's Law Gaze Modulation Row (Active in Caloric Mode) -->
          <div class="vor-alexander-row" id="vor-alexander-row" style="display: none;">
            <span class="alex-label">Alexander Gaze:</span>
            <div class="alex-btn-group" role="group" aria-label="Alexander Gaze Positions">
              <button type="button" class="alex-gaze-btn" data-gaze="-30">◀ -30°</button>
              <button type="button" class="alex-gaze-btn active" data-gaze="0">◉ 0°</button>
              <button type="button" class="alex-gaze-btn" data-gaze="30">+30° ▶</button>
            </div>
            <span class="alex-badge" id="vor-alex-badge">2nd Degree</span>
          </div>

          <div class="vor-strip-wrap">
            <canvas
              class="vor-strip-canvas"
              id="vor-strip-canvas"
              width="${VORDrawer.STRIP_LOGICAL_W * VORDrawer.CANVAS_PIXEL_RATIO}"
              height="${VORDrawer.STRIP_LOGICAL_H * VORDrawer.CANVAS_PIXEL_RATIO}"
              style="width: ${VORDrawer.STRIP_LOGICAL_W}px; height: ${VORDrawer.STRIP_LOGICAL_H}px;"
            ></canvas>
          </div>
          <div class="vor-strip-legend" id="vor-strip-legend">
            <span class="leg-item leg-h"><span class="leg-line h-line"></span> Horiz (Cyan)</span>
            <span class="leg-item leg-v"><span class="leg-line v-line"></span> Vert (Lime)</span>
            <span class="leg-item leg-t"><span class="leg-line t-line"></span> Torsion (Amber)</span>
          </div>
        </div>
      </div>
    `;

    // Query element references
    this.avatarCanvas = this.rootEl.querySelector('#vor-avatar-canvas') as HTMLCanvasElement;
    this.hudCanvas = this.rootEl.querySelector('#vor-hud-canvas') as HTMLCanvasElement;
    this.stripCanvas = this.rootEl.querySelector('#vor-strip-canvas') as HTMLCanvasElement;
    this.modeToggleBtn = this.rootEl.querySelector('#vor-mode-toggle-btn') as HTMLButtonElement;
    this.modeIconEl = this.rootEl.querySelector('#vor-mode-icon') as HTMLElement;
    this.modeLabelEl = this.rootEl.querySelector('#vor-mode-label') as HTMLElement;
    this.closeBtn = this.rootEl.querySelector('#vor-close-btn') as HTMLButtonElement;

    this.hValEl = this.rootEl.querySelector('#vor-h-val') as HTMLElement;
    this.vValEl = this.rootEl.querySelector('#vor-v-val') as HTMLElement;
    this.tValEl = this.rootEl.querySelector('#vor-t-val') as HTMLElement;
    this.spvValEl = this.rootEl.querySelector('#vor-spv-val') as HTMLElement;
    this.statusEl = this.rootEl.querySelector('#vor-nystagmus-status') as HTMLElement;

    this.stripTitleEl = this.rootEl.querySelector('#vor-strip-title') as HTMLElement;
    this.stripRangeEl = this.rootEl.querySelector('#vor-strip-range') as HTMLElement;
    this.alexanderRowEl = this.rootEl.querySelector('#vor-alexander-row') as HTMLElement;
    this.alexBadgeEl = this.rootEl.querySelector('#vor-alex-badge') as HTMLElement;
    this.stripLegendEl = this.rootEl.querySelector('#vor-strip-legend') as HTMLElement;

    this.stripTabs = Array.from(
      this.rootEl.querySelectorAll('#vor-strip-mode-tabs .vor-strip-tab')
    ) as HTMLButtonElement[];
    this.alexGazeBtns = Array.from(
      this.rootEl.querySelectorAll('.alex-gaze-btn')
    ) as HTMLButtonElement[];
  }

  private initCanvases(): void {
    if (this.hudCanvas && typeof this.hudCanvas.getContext === 'function') {
      this.hudCtx = this.hudCanvas.getContext('2d');
    }
    if (this.stripCanvas && typeof this.stripCanvas.getContext === 'function') {
      this.stripCtx = this.stripCanvas.getContext('2d');
    }
  }

  private attachEvents(): void {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.modeToggleBtn) {
      this.modeToggleBtn.addEventListener('click', () => this.toggleVisualMode());
    }

    // Diagnostic strip mode tab clicks
    this.stripTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.stripMode as 'nystagmogram' | 'caloric' | 'vhit';
        if (mode) {
          this.setDiagnosticViewMode(mode);
          for (const cb of this.onDiagnosticModeChangeCallbacks) {
            cb(mode);
          }
        }
      });
    });

    // Alexander gaze button clicks
    this.alexGazeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const gaze = parseInt(btn.dataset.gaze || '0', 10);
        this.setAlexanderGaze(gaze);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Diagnostic Mode API
  // ---------------------------------------------------------------------------

  public setDiagnosticViewMode(mode: 'nystagmogram' | 'caloric' | 'vhit'): void {
    this.diagnosticViewMode = mode;

    this.stripTabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.stripMode === mode);
    });

    if (mode === 'vhit') {
      if (this.stripTitleEl) this.stripTitleEl.textContent = 'vHIT High-Speed Dual-Trace Velocity (0–350ms)';
      if (this.stripRangeEl) this.stripRangeEl.textContent = '0–300°/s Range';
      if (this.alexanderRowEl) this.alexanderRowEl.style.display = 'none';
      if (this.stripLegendEl) {
        this.stripLegendEl.innerHTML = `
          <span class="leg-item leg-head"><span class="leg-line head-line"></span> Head Vel (Amber)</span>
          <span class="leg-item leg-eye"><span class="leg-line eye-line"></span> Inv Eye (Cyan)</span>
          <span class="leg-item leg-covert"><span class="leg-dot covert-dot"></span> Covert (Purple)</span>
          <span class="leg-item leg-overt"><span class="leg-dot overt-dot"></span> Overt (Red)</span>
        `;
      }
      this.renderVHITDualTracePlot();
    } else if (mode === 'caloric') {
      if (this.stripTitleEl) this.stripTitleEl.textContent = "Caloric COWS Butterfly Plot (Claussen Diagram)";
      if (this.stripRangeEl) this.stripRangeEl.textContent = '0–50°/s SPV Range';
      if (this.alexanderRowEl) this.alexanderRowEl.style.display = 'flex';
      if (this.stripLegendEl) {
        this.stripLegendEl.innerHTML = `
          <span class="leg-item leg-eye"><span class="leg-line eye-line"></span> Left-Beating (Cyan)</span>
          <span class="leg-item leg-head"><span class="leg-line head-line"></span> Right-Beating (Amber)</span>
          <span class="leg-item"><span class="leg-dot" style="background:#22c55e;"></span> Norm Zone (15–30°/s)</span>
        `;
      }
      this.renderCaloricButterflyPlot();
    } else {
      // nystagmogram
      if (this.stripTitleEl) this.stripTitleEl.textContent = '3-Lead Nystagmogram (10s Rolling)';
      if (this.stripRangeEl) this.stripRangeEl.textContent = '±25° Range';
      if (this.alexanderRowEl) this.alexanderRowEl.style.display = 'none';
      if (this.stripLegendEl) {
        this.stripLegendEl.innerHTML = `
          <span class="leg-item leg-h"><span class="leg-line h-line"></span> Horiz (Cyan)</span>
          <span class="leg-item leg-v"><span class="leg-line v-line"></span> Vert (Lime)</span>
          <span class="leg-item leg-t"><span class="leg-line t-line"></span> Torsion (Amber)</span>
        `;
      }
      this.renderStripChart();
    }
  }

  public getDiagnosticViewMode(): 'nystagmogram' | 'caloric' | 'vhit' {
    return this.diagnosticViewMode;
  }

  public onDiagnosticModeChange(cb: (mode: 'nystagmogram' | 'caloric' | 'vhit') => void): void {
    this.onDiagnosticModeChangeCallbacks.push(cb);
  }

  public onAlexanderGazeChange(cb: (gaze: number) => void): void {
    this.onAlexGazeChangeCallbacks.push(cb);
  }

  public setAlexanderGaze(gazeDeg: number, notify = true): void {
    this.alexanderGazeYaw = gazeDeg;
    this.alexGazeBtns.forEach((btn) => {
      btn.classList.toggle('active', parseInt(btn.dataset.gaze || '0', 10) === gazeDeg);
    });
    if (notify) {
      for (const cb of this.onAlexGazeChangeCallbacks) {
        cb(gazeDeg);
      }
    }
    if (this.diagnosticViewMode === 'caloric' && this.alexBadgeEl) {
      const eyeTelem = this.eyeEngine ? this.eyeEngine.getTelemetry() : null;
      const beatSign = eyeTelem && eyeTelem.fastPhaseBeatDirection === 'Left-Beating' ? -1 : 1;
      const baseSPV = this.caloricValues.activeSPV > 0
        ? this.caloricValues.activeSPV
        : (eyeTelem ? eyeTelem.slowPhaseVelocityDegPerSec : 0);
      const alex = computeAlexanderModulation(baseSPV, this.alexanderGazeYaw, beatSign);
      this.alexBadgeEl.textContent = `${alex.clinicalDegree} (${alex.modulatedSPV.toFixed(1)}°/s)`;
    }
    if (this.diagnosticViewMode === 'caloric') {
      this.renderCaloricButterflyPlot();
    }
  }

  public getAlexanderGaze(): number {
    return this.alexanderGazeYaw;
  }

  public setCaloricData(r44: number, r30: number, l44: number, l30: number): void {
    this.caloricValues.r44 = r44;
    this.caloricValues.r30 = r30;
    this.caloricValues.l44 = l44;
    this.caloricValues.l30 = l30;
    if (this.diagnosticViewMode === 'caloric') {
      this.renderCaloricButterflyPlot();
    }
  }

  public setCaloricActiveIrrigation(temp: string | null, currentSPV = 0): void {
    this.caloricValues.activeTemp = temp;
    this.caloricValues.activeSPV = currentSPV;
    if (this.diagnosticViewMode === 'caloric') {
      this.renderCaloricButterflyPlot();
    }
  }

  public getCaloricData(): { r44: number; r30: number; l44: number; l30: number; activeTemp: string | null; activeSPV: number } {
    return { ...this.caloricValues };
  }

  public getVHITBuffer(): VHITImpulseBuffer {
    return this.vhitBuffer;
  }

  public simulateVHIT(
    preset: VHITPathologyPreset = 'normal',
    paradigm: VHITParadigm = 'himp',
    goggleSlippage = false
  ): void {
    this.vhitBuffer.simulateTrial(preset, paradigm, goggleSlippage);
    if (this.diagnosticViewMode === 'vhit') {
      this.renderVHITDualTracePlot();
    }
  }

  public updateVHITPlayback(
    elapsedSec: number,
    msIndex: number,
    pair: 'horizontal' | 'ralp' | 'larp' = 'horizontal',
    direction: 1 | -1 = 1
  ): void {
    const cap = this.vhitBuffer.getCapacity();
    const clampedMs = Math.max(0, Math.min(cap - 1, msIndex));
    this.vhitCursorMs = clampedMs;

    const eyePos = this.vhitBuffer.eyePosArray[clampedMs];
    const flag = this.vhitBuffer.saccadeFlags[clampedMs];
    const isFast = flag > 0;
    const headVel = this.vhitBuffer.headVelArray[clampedMs];
    const eyeVel = this.vhitBuffer.invertedEyeVelArray[clampedMs];
    const cn8Rate = this.vhitBuffer.cn8FiringRateArray ? this.vhitBuffer.cn8FiringRateArray[clampedMs] : 90;

    let eyeDeg = -direction * eyePos;
    if (flag === 3) {
      // In SHIMP, anti-compensatory saccade refixates toward the head-fixed target
      const headPos = this.vhitBuffer.headPosArray[clampedMs];
      eyeDeg = direction * (headPos * 0.8 - eyePos * 0.3);
    }

    if (pair === 'horizontal') {
      this.eyeEngine.setGazeAngles(eyeDeg, 0, 0, isFast);
    } else if (pair === 'larp') {
      this.eyeEngine.setGazeAngles(eyeDeg * 0.707, eyeDeg * 0.707, eyeDeg * 0.3, isFast);
    } else {
      this.eyeEngine.setGazeAngles(-eyeDeg * 0.707, eyeDeg * 0.707, -eyeDeg * 0.3, isFast);
    }

    this.eyeEngine.render();
    this.renderTrackingHud(this.eyeEngine.getTelemetry());

    if (this.hValEl) {
      this.hValEl.textContent = `${eyeDeg >= 0 ? '+' : ''}${eyeDeg.toFixed(1)}°`;
    }
    if (this.spvValEl) {
      this.spvValEl.textContent = `${eyeVel.toFixed(0)}°/s`;
    }
    if (this.statusEl) {
      if (flag === 1) {
        this.statusEl.textContent = `vHIT: Covert Catch-Up Saccade (Intra-Thrust · CN VIII: ${cn8Rate.toFixed(0)} sp/s)`;
        this.statusEl.className = 'vor-nystagmus-status active';
      } else if (flag === 2) {
        this.statusEl.textContent = `vHIT: Overt Catch-Up Saccade (Post-Thrust Refixation · CN VIII: ${cn8Rate.toFixed(0)} sp/s)`;
        this.statusEl.className = 'vor-nystagmus-status active';
      } else if (flag === 3) {
        this.statusEl.textContent = `vHIT: SHIMP Anti-Compensatory Saccade (CN VIII: ${cn8Rate.toFixed(0)} sp/s)`;
        this.statusEl.className = 'vor-nystagmus-status active';
      } else if (headVel > 10.0) {
        this.statusEl.textContent = `vHIT: High-Acceleration VOR (${headVel.toFixed(0)}°/s Thrust · CN VIII: ${cn8Rate.toFixed(0)} sp/s)`;
        this.statusEl.className = 'vor-nystagmus-status';
      } else {
        this.statusEl.textContent = `Target Fixed (CN VIII: ${cn8Rate.toFixed(0)} sp/s)`;
        this.statusEl.className = 'vor-nystagmus-status';
      }
    }

    if (this.diagnosticViewMode === 'vhit') {
      this.renderVHITDualTracePlot();
    }
  }

  public clearVHITPlayback(): void {
    this.vhitCursorMs = null;
    this.eyeEngine.setGazeAngles(0, 0, 0, false);
    this.eyeEngine.render();
    this.renderTrackingHud(this.eyeEngine.getTelemetry());
    if (this.statusEl) {
      const g = this.vhitBuffer.calculatedGain;
      const hasSacc = this.vhitBuffer.covertSaccadePresent || this.vhitBuffer.overtSaccadePresent;
      if (hasSacc || g < 0.7) {
        this.statusEl.textContent = `vHIT Trial Complete: Low Gain (${g.toFixed(2)}) with Catch-Up Saccades`;
        this.statusEl.className = 'vor-nystagmus-status active';
      } else {
        this.statusEl.textContent = `vHIT Trial Complete: Normal VOR Gain (${g.toFixed(2)}) — Target Retained`;
        this.statusEl.className = 'vor-nystagmus-status';
      }
    }
    if (this.diagnosticViewMode === 'vhit') {
      this.renderVHITDualTracePlot();
    }
  }

  // ---------------------------------------------------------------------------
  // Drawer Lifecycle & Mutual Exclusivity
  // ---------------------------------------------------------------------------
  public open(): void {
    this.isOpen = true;
    this.rootEl.classList.add('open');
    if (this.stripCtx) {
      if (this.diagnosticViewMode === 'vhit') {
        this.renderVHITDualTracePlot();
      } else if (this.diagnosticViewMode === 'caloric') {
        this.renderCaloricButterflyPlot();
      } else {
        this.renderStripChart();
      }
    }
  }

  public close(): void {
    this.isOpen = false;
    this.rootEl.classList.remove('open');
    for (const cb of this.onCloseCallbacks) {
      cb();
    }
  }

  public toggle(): boolean {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
    return this.isOpen;
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }

  public getRootElement(): HTMLElement {
    return this.rootEl;
  }

  public getAvatarCanvas(): HTMLCanvasElement {
    return this.avatarCanvas;
  }

  public getStripCanvas(): HTMLCanvasElement {
    return this.stripCanvas;
  }

  public onClose(cb: () => void): void {
    this.onCloseCallbacks.push(cb);
  }

  public getEyeEngine(): EyeAvatarEngine {
    return this.eyeEngine;
  }

  public getVisualMode(): VisualMode {
    return this.visualMode;
  }

  public setVisualMode(mode: VisualMode): void {
    this.visualMode = mode;
    this.eyeEngine.setVisualMode(mode);
    if (this.modeIconEl && this.modeLabelEl) {
      this.modeIconEl.textContent = mode === 'infrared_vng' ? '🔴' : '👁️';
      this.modeLabelEl.textContent = mode === 'infrared_vng' ? 'NIR VNG' : 'Natural';
    }
    this.rootEl.classList.toggle('nir-active', mode === 'infrared_vng');
  }

  public toggleVisualMode(): void {
    const nextMode: VisualMode = this.visualMode === 'natural' ? 'infrared_vng' : 'natural';
    this.setVisualMode(nextMode);
  }

  // ---------------------------------------------------------------------------
  // 60FPS Telemetry & Simulation Step
  // ---------------------------------------------------------------------------
  public updateTelemetry(telem: VestibularTelemetryState, dt: number): void {
    if (this.diagnosticViewMode === 'vhit') {
      // In vHIT mode, if not in an active high-speed playback, keep plot rendered without BPPV interference
      if (this.vhitCursorMs === null) {
        this.renderVHITDualTracePlot();
      }
      return;
    }

    // 1. Advance eye avatar kinematic ODE
    this.eyeEngine.update(dt, telem);

    // 2. Render 3D eye avatar canvas
    this.eyeEngine.render();

    // 3. Query telemetry snapshot (zero-allocation)
    const eyeTelem = this.eyeEngine.getTelemetry();

    // 4. Update 2D tracking HUD overlays (pupil crosshairs and corneal glints)
    this.renderTrackingHud(eyeTelem);

    // 5. Update live metric text badges
    this.updateMetricBadges(eyeTelem, telem);

    // 6. Alexander's Law modulation badge in Caloric mode
    if (this.diagnosticViewMode === 'caloric' && this.alexBadgeEl) {
      const beatSign = eyeTelem.fastPhaseBeatDirection === 'Left-Beating' ? -1 : 1;
      const alex = computeAlexanderModulation(
        eyeTelem.slowPhaseVelocityDegPerSec,
        this.alexanderGazeYaw,
        beatSign
      );
      this.alexBadgeEl.textContent = `${alex.clinicalDegree} (${alex.modulatedSPV.toFixed(1)}°/s)`;
    }

    // 7. Draw strip chart or Caloric Butterfly plot
    if (this.diagnosticViewMode === 'caloric') {
      this.renderCaloricButterflyPlot();
    } else {
      this.renderStripChart();
    }
  }

  private updateMetricBadges(eyeTelem: EyeTelemetry, vestTelem: VestibularTelemetryState): void {
    if (this.hValEl) {
      const h = eyeTelem.horizontalDeg;
      const hStr = h >= 0 ? `+${h.toFixed(1)}°` : `${h.toFixed(1)}°`;
      this.hValEl.textContent = hStr;
    }
    if (this.vValEl) {
      const v = eyeTelem.verticalDeg;
      const vStr = v >= 0 ? `+${v.toFixed(1)}°` : `${v.toFixed(1)}°`;
      this.vValEl.textContent = vStr;
    }
    if (this.tValEl) {
      const t = eyeTelem.torsionalRightDeg;
      const tStr = t >= 0 ? `+${t.toFixed(1)}°` : `${t.toFixed(1)}°`;
      this.tValEl.textContent = tStr;
    }
    if (this.spvValEl) {
      this.spvValEl.textContent = `${eyeTelem.slowPhaseVelocityDegPerSec.toFixed(1)}°/s`;
    }
    if (this.statusEl) {
      if (this.diagnosticViewMode === 'caloric') {
        if (eyeTelem.slowPhaseVelocityDegPerSec > 1.0) {
          this.statusEl.textContent = `Caloric Nystagmus: ${eyeTelem.fastPhaseBeatDirection} (COWS · SPV ${eyeTelem.slowPhaseVelocityDegPerSec.toFixed(1)}°/s)`;
          this.statusEl.className = 'vor-nystagmus-status active';
        } else {
          this.statusEl.textContent = 'Caloric Convection: Resting Equilibrium (Ready to Irrigate)';
          this.statusEl.className = 'vor-nystagmus-status';
        }
      } else {
        if (eyeTelem.slowPhaseVelocityDegPerSec > 1.0) {
          this.statusEl.textContent = `Nystagmus: ${eyeTelem.fastPhaseBeatDirection} (${vestTelem.ewaldLawActive || "Ewald's Law"})`;
          this.statusEl.className = 'vor-nystagmus-status active';
        } else {
          this.statusEl.textContent = 'Resting Equilibrium (No Nystagmus)';
          this.statusEl.className = 'vor-nystagmus-status';
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Gaze Tracking HUD: Pupil Crosshairs ⊕ and Corneal Glints ✱
  // ---------------------------------------------------------------------------
  private renderTrackingHud(telem: EyeTelemetry): void {
    if (!this.hudCtx) return;

    const ctx = this.hudCtx;
    const w = this.hudCanvas.width;
    const h = this.hudCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const dpr = VORDrawer.CANVAS_PIXEL_RATIO;
    ctx.save();
    ctx.scale(dpr, dpr);

    const isNIR = this.visualMode === 'infrared_vng';
    const crosshairColor = isNIR ? '#facc15' : '#38bdf8';

    // Right Eye Pupil Crosshair ⊕
    if (telem.pupilScreenR && telem.pupilScreenR.visible) {
      this.drawCrosshair(ctx, telem.pupilScreenR.x, telem.pupilScreenR.y, crosshairColor, 7);
    }
    // Left Eye Pupil Crosshair ⊕
    if (telem.pupilScreenL && telem.pupilScreenL.visible) {
      this.drawCrosshair(ctx, telem.pupilScreenL.x, telem.pupilScreenL.y, crosshairColor, 7);
    }

    // Right Eye Purkinje Glint ✱
    if (telem.glintScreenR && telem.glintScreenR.visible) {
      this.drawPurkinjeGlint(ctx, telem.glintScreenR.x, telem.glintScreenR.y);
    }
    // Left Eye Purkinje Glint ✱
    if (telem.glintScreenL && telem.glintScreenL.visible) {
      this.drawPurkinjeGlint(ctx, telem.glintScreenL.x, telem.glintScreenL.y);
    }

    ctx.restore();
  }

  private drawCrosshair(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    size: number
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    // Small reticle circle
    ctx.beginPath();
    ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair lines
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();
  }

  private drawPurkinjeGlint(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Subtle 4-point glint rays
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 3.5, y);
    ctx.lineTo(x + 3.5, y);
    ctx.moveTo(x, y - 3.5);
    ctx.lineTo(x, y + 3.5);
    ctx.stroke();
  }

  // ---------------------------------------------------------------------------
  // 60FPS Zero-Allocation Nystagmogram Strip Chart Rendering
  // ---------------------------------------------------------------------------
  public renderStripChart(): void {
    if (!this.stripCtx) return;

    const ctx = this.stripCtx;
    const w = this.stripCanvas.width;
    const h = this.stripCanvas.height;

    // Background
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, w, h);

    const yMid = h / 2;
    const maxDeg = 25.0; // ±25° deflection range
    const scaleY = (h * 0.4) / maxDeg;

    // Grid Baselines: ±20°, ±10°, 0°
    ctx.lineWidth = 1;

    // Dashed grid lines at ±20° and ±10°
    ctx.strokeStyle = '#1e293b';
    ctx.setLineDash([4, 4]);

    // +20°
    ctx.beginPath();
    ctx.moveTo(0, yMid - 20 * scaleY);
    ctx.lineTo(w, yMid - 20 * scaleY);
    ctx.stroke();

    // +10°
    ctx.beginPath();
    ctx.moveTo(0, yMid - 10 * scaleY);
    ctx.lineTo(w, yMid - 10 * scaleY);
    ctx.stroke();

    // -10°
    ctx.beginPath();
    ctx.moveTo(0, yMid + 10 * scaleY);
    ctx.lineTo(w, yMid + 10 * scaleY);
    ctx.stroke();

    // -20°
    ctx.beginPath();
    ctx.moveTo(0, yMid + 20 * scaleY);
    ctx.lineTo(w, yMid + 20 * scaleY);
    ctx.stroke();

    // Solid Zero Baseline (0°)
    ctx.setLineDash([]);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, yMid);
    ctx.lineTo(w, yMid);
    ctx.stroke();

    // Degree axis tick labels
    ctx.fillStyle = '#64748b';
    ctx.font = '18px monospace';
    ctx.fillText('+20°', 6, yMid - 20 * scaleY + 6);
    ctx.fillText('  0°', 6, yMid + 6);
    ctx.fillText('-20°', 6, yMid + 20 * scaleY + 6);

    const ringBuffer = this.eyeEngine.getRingBuffer();
    const count = ringBuffer.getCount();
    if (count < 2) return;

    const hArr = ringBuffer.getHorizontalArray();
    const vArr = ringBuffer.getVerticalArray();
    const tArr = ringBuffer.getTorsionalArray();
    const flags = ringBuffer.getFastPhaseFlags();
    const writeIdx = ringBuffer.getWriteIndex();
    const cap = ringBuffer.getCapacity();

    // Saccade Fast-Phase Marker Ticks (Red vertical markers at top of chart)
    ctx.fillStyle = '#ef4444';
    for (let i = 0; i < count; i++) {
      const slot = (writeIdx - count + i + cap) % cap;
      if (flags[slot] === 1) {
        const x = (i / (cap - 1)) * w;
        ctx.fillRect(x - 1, 2, 2, 8);
      }
    }

    // Draw 3 continuous channels in single pass (ZERO object allocations)
    this.drawChannelPath(ctx, hArr, writeIdx, count, cap, w, h, yMid, scaleY, '#52dcf2'); // H: Cyan
    this.drawChannelPath(ctx, vArr, writeIdx, count, cap, w, h, yMid, scaleY, '#4ade80'); // V: Lime
    this.drawChannelPath(ctx, tArr, writeIdx, count, cap, w, h, yMid, scaleY, '#fbbf24'); // T: Amber
  }

  public static mapDegreeToY(
    deg: number,
    canvasHeight: number = VORDrawer.STRIP_LOGICAL_H * VORDrawer.CANVAS_PIXEL_RATIO
  ): number {
    const yMid = canvasHeight / 2;
    const maxDeg = 25.0;
    const scaleY = (canvasHeight * 0.4) / maxDeg;
    const rawY = yMid - deg * scaleY;
    return Math.max(0, Math.min(canvasHeight, rawY));
  }

  private drawChannelPath(
    ctx: CanvasRenderingContext2D,
    arr: Float32Array,
    writeIdx: number,
    count: number,
    cap: number,
    w: number,
    h: number,
    yMid: number,
    scaleY: number,
    strokeColor: string
  ): void {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.0;
    ctx.beginPath();

    const denom = Math.max(1, cap - 1);
    for (let i = 0; i < count; i++) {
      const slot = (writeIdx - count + i + cap) % cap;
      const deg = arr[slot];
      const x = (i / denom) * w;
      // Invert Y: positive degree = upward deflection
      const rawY = yMid - deg * scaleY;
      const clampedY = Math.max(0, Math.min(h, rawY));

      if (i === 0) {
        ctx.moveTo(x, clampedY);
      } else {
        ctx.lineTo(x, clampedY);
      }
    }
    ctx.stroke();
  }

  public renderVHITDualTracePlot(): void {
    if (!this.stripCtx) return;

    const ctx = this.stripCtx;
    const w = this.stripCanvas.width;
    const h = this.stripCanvas.height;

    // Background
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, w, h);

    const maxVel = 300.0; // 0 to 300°/s
    const maxT = 0.350;   // 0 to 350 ms

    // Baselines at 100°/s, 200°/s, 0°/s
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#1e293b';
    ctx.setLineDash([4, 4]);

    const y200 = h - (200.0 / maxVel) * (h * 0.82) - 14;
    const y100 = h - (100.0 / maxVel) * (h * 0.82) - 14;
    const yZero = h - 14;

    ctx.beginPath();
    ctx.moveTo(0, y200);
    ctx.lineTo(w, y200);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, y100);
    ctx.lineTo(w, y100);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, yZero);
    ctx.lineTo(w, yZero);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#64748b';
    ctx.font = '16px monospace';
    ctx.fillText('200°/s', 6, y200 - 4);
    ctx.fillText('100°/s', 6, y100 - 4);
    ctx.fillText('0ms', 6, yZero + 12);
    ctx.fillText('120ms', (0.120 / maxT) * w - 24, yZero + 12);
    ctx.fillText('350ms', w - 50, yZero + 12);

    // 40–80 ms Curthoys Shaded Regression Window
    const x40 = (0.040 / maxT) * w;
    const x80 = (0.080 / maxT) * w;
    ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.fillRect(x40, 4, x80 - x40, yZero - 4);

    ctx.strokeStyle = 'rgba(6, 182, 212, 0.40)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x40, 4);
    ctx.lineTo(x40, yZero);
    ctx.moveTo(x80, 4);
    ctx.lineTo(x80, yZero);
    ctx.stroke();
    ctx.setLineDash([]);

    // Curthoys Gain Readout Badge in Window
    const gain = this.vhitBuffer.calculatedGain;
    ctx.fillStyle = gain >= 0.80 ? '#22c55e' : '#ef4444';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`VOR Gain: ${gain.toFixed(2)}`, x80 + 12, 24);

    // Plot Head Velocity (Amber, #f59e0b)
    const cap = this.vhitBuffer.getCapacity();
    const headVel = this.vhitBuffer.headVelArray;
    const invEyeVel = this.vhitBuffer.invertedEyeVelArray;
    const flags = this.vhitBuffer.saccadeFlags;

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < cap; i++) {
      const x = (i / (cap - 1)) * w;
      const v = headVel[i];
      const y = yZero - (v / maxVel) * (h * 0.82);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Plot Inverted Eye Velocity (Cyan, #06b6d4)
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < cap; i++) {
      const x = (i / (cap - 1)) * w;
      const v = invEyeVel[i];
      const y = yZero - (v / maxVel) * (h * 0.82);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Saccade Marker Tags
    for (let i = 0; i < cap; i++) {
      const f = flags[i];
      if (f > 0) {
        const x = (i / (cap - 1)) * w;
        if (f === 1) {
          // Covert Saccade (Purple #a855f7)
          ctx.fillStyle = '#a855f7';
          ctx.fillRect(x - 2, 4, 4, 10);
        } else if (f === 2) {
          // Overt Saccade (Crimson #ef4444)
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(x - 2, 4, 4, 10);
        } else if (f === 3) {
          // SHIMP (Emerald #10b981)
          ctx.fillStyle = '#10b981';
          ctx.fillRect(x - 2, 4, 4, 10);
        }
      }
    }

    // Live Animated Playhead Scanning Needle during Impulse
    if (this.vhitCursorMs !== null && this.vhitCursorMs >= 0 && this.vhitCursorMs < cap) {
      const curX = (this.vhitCursorMs / (cap - 1)) * w;
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.0;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(curX, 4);
      ctx.lineTo(curX, yZero);
      ctx.stroke();
      ctx.setLineDash([]);

      // Point on Head Velocity
      const curHeadY = yZero - (headVel[this.vhitCursorMs] / maxVel) * (h * 0.82);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(curX, curHeadY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Point on Inverted Eye Velocity
      const curEyeY = yZero - (invEyeVel[this.vhitCursorMs] / maxVel) * (h * 0.82);
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(curX, curEyeY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Time readout badge
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${this.vhitCursorMs}ms`, Math.min(w - 60, Math.max(10, curX - 18)), 16);
      ctx.restore();
    }
  }

  public renderCaloricButterflyPlot(): void {
    if (!this.stripCtx) return;

    const ctx = this.stripCtx;
    const w = this.stripCanvas.width;
    const h = this.stripCanvas.height;

    // Background
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const maxSPV = 50.0;
    const scaleX = (w * 0.40) / maxSPV;
    const scaleY = (h * 0.38) / maxSPV;

    // 1. Shaded Normative Corridor (15°/s to 30°/s)
    const normMax = 30.0;
    ctx.fillStyle = 'rgba(34, 197, 94, 0.06)';
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cx, cy - normMax * scaleY);
    ctx.lineTo(cx + normMax * scaleX, cy);
    ctx.lineTo(cx, cy + normMax * scaleY);
    ctx.lineTo(cx - normMax * scaleX, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Crosshair Grid Baselines
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    // Horizontal baseline
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();

    // Vertical baseline
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.stroke();

    ctx.setLineDash([]);

    // 3. Axis Labels
    ctx.fillStyle = '#64748b';
    ctx.font = '14px monospace';
    ctx.fillText('◀ Left-Beating', 10, cy - 6);
    ctx.fillText('Right-Beating ▶', w - 130, cy - 6);

    ctx.fillStyle = '#f59e0b';
    ctx.fillText('Warm 44°C ▲', cx + 8, 18);
    ctx.fillStyle = '#06b6d4';
    ctx.fillText('Cold 30°C ▼', cx + 8, h - 8);

    // 4. Coordinates for the 4 responses:
    // Right Warm (R44): Beats Right (+x), Warm (-y)
    // Left Cold (L30): Beats Right (+x), Cold (+y)
    // Left Warm (L44): Beats Left (-x), Warm (-y)
    // Right Cold (R30): Beats Left (-x), Cold (+y)
    const { r44, r30, l44, l30, activeTemp, activeSPV } = this.caloricValues;

    // Modulate with active irrigation if matching
    const effR44 = (activeTemp === 'R44' && activeSPV > 0) ? activeSPV : r44;
    const effR30 = (activeTemp === 'R30' && activeSPV > 0) ? activeSPV : r30;
    const effL44 = (activeTemp === 'L44' && activeSPV > 0) ? activeSPV : l44;
    const effL30 = (activeTemp === 'L30' && activeSPV > 0) ? activeSPV : l30;

    const xR44 = cx + Math.min(effR44, maxSPV) * scaleX;
    const yR44 = cy - Math.min(effR44, maxSPV) * scaleY;

    const xL30 = cx + Math.min(effL30, maxSPV) * scaleX;
    const yL30 = cy + Math.min(effL30, maxSPV) * scaleY;

    const xL44 = cx - Math.min(effL44, maxSPV) * scaleX;
    const yL44 = cy - Math.min(effL44, maxSPV) * scaleY;

    const xR30 = cx - Math.min(effR30, maxSPV) * scaleX;
    const yR30 = cy + Math.min(effR30, maxSPV) * scaleY;

    // 5. Right Butterfly Wing (Amber: Right-beating R44 and L30)
    ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(xR44, yR44);
    ctx.lineTo(xL30, yL30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 6. Left Butterfly Wing (Cyan: Left-beating L44 and R30)
    ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(xL44, yL44);
    ctx.lineTo(xR30, yR30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 7. Data Points and Text Badges
    const drawPoint = (
      x: number,
      y: number,
      color: string,
      label: string,
      isRightAligned: boolean,
      isTopAligned: boolean
    ) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 15px monospace';
      const textX = isRightAligned ? x + 8 : x - 75;
      const textY = isTopAligned ? y - 6 : y + 16;
      ctx.fillText(label, textX, textY);
    };

    drawPoint(xR44, yR44, '#fbbf24', `R44: ${Math.round(effR44)}°/s`, true, true);
    drawPoint(xL30, yL30, '#fbbf24', `L30: ${Math.round(effL30)}°/s`, true, false);
    drawPoint(xL44, yL44, '#38bdf8', `L44: ${Math.round(effL44)}°/s`, false, true);
    drawPoint(xR30, yR30, '#38bdf8', `R30: ${Math.round(effR30)}°/s`, false, false);

    // 8. Pulsing Active Irrigation Ring
    if (activeTemp) {
      let activeX = cx;
      let activeY = cy;
      let activeColor = '#ffffff';
      if (activeTemp === 'R44') {
        activeX = xR44;
        activeY = yR44;
        activeColor = '#f59e0b';
      } else if (activeTemp === 'R30') {
        activeX = xR30;
        activeY = yR30;
        activeColor = '#06b6d4';
      } else if (activeTemp === 'L44') {
        activeX = xL44;
        activeY = yL44;
        activeColor = '#f59e0b';
      } else if (activeTemp === 'L30') {
        activeX = xL30;
        activeY = yL30;
        activeColor = '#06b6d4';
      }

      const pulseRadius = 7 + Math.sin(performance.now() * 0.01) * 3;
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(activeX, activeY, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 9. Calculated Jongkees Summary Badge
    const jRes = calculateJongkees(effR44, effR30, effL44, effL30);
    const uwStr = `UW: ${jRes.canalParesisPercent.toFixed(1)}%`;
    const dpStr = `DP: ${jRes.directionalPreponderancePercent.toFixed(1)}%`;
    const flag =
      jRes.pareticEar === 'symmetric'
        ? 'Symmetric'
        : `${jRes.pareticEar.toUpperCase()} Paresis`;

    ctx.fillStyle = jRes.canalParesisPercent > 25.0 ? '#ef4444' : '#22c55e';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${uwStr} · ${dpStr} (${flag})`, 10, 20);
  }

  private drawStripBaselines(): void {
    if (this.stripCtx) {
      if (this.diagnosticViewMode === 'vhit') {
        this.renderVHITDualTracePlot();
      } else if (this.diagnosticViewMode === 'caloric') {
        this.renderCaloricButterflyPlot();
      } else {
        this.renderStripChart();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Resource Disposal
  // ---------------------------------------------------------------------------
  public dispose(): void {
    this.eyeEngine.dispose();
    this.onCloseCallbacks = [];
    if (this.rootEl.parentElement) {
      this.rootEl.parentElement.removeChild(this.rootEl);
    }
  }
}
