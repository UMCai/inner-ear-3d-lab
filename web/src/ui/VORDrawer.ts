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

        <!-- Rolling 3-Lead Nystagmogram Strip Chart -->
        <div class="vor-strip-section">
          <div class="vor-strip-header">
            <span class="vor-strip-title">3-Lead Nystagmogram (10s Rolling)</span>
            <span class="vor-strip-range">±25° Range</span>
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
          <div class="vor-strip-legend">
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
  }

  // ---------------------------------------------------------------------------
  // Drawer Lifecycle & Mutual Exclusivity
  // ---------------------------------------------------------------------------
  public open(): void {
    this.isOpen = true;
    this.rootEl.classList.add('open');
    if (this.stripCtx) {
      this.renderStripChart();
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

    // 6. Draw rolling 3-channel strip chart
    this.renderStripChart();
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
      if (eyeTelem.slowPhaseVelocityDegPerSec > 1.0) {
        this.statusEl.textContent = `Nystagmus: ${eyeTelem.fastPhaseBeatDirection} (${vestTelem.ewaldLawActive || "Ewald's Law"})`;
        this.statusEl.className = 'vor-nystagmus-status active';
      } else {
        this.statusEl.textContent = 'Resting Equilibrium (No Nystagmus)';
        this.statusEl.className = 'vor-nystagmus-status';
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

  private drawStripBaselines(): void {
    if (this.stripCtx) {
      this.renderStripChart();
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
