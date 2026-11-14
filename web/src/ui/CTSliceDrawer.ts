/**
 * web/src/ui/CTSliceDrawer.ts
 *
 * Synchronized 2D Temporal Bone CT Multiplanar Reformation (MPR) Drawer.
 *
 * Implements high-resolution clinical bone-window (W:4000, L:+700 HU) and T2 CISS MRI
 * cross-sectional visualization matching authentic IE-Map stereotaxic slicing planes.
 * Features:
 * - 360x360 Retina (720x720 physical) 2D MPR Canvas with realistic attenuation profiles.
 * - SCDS 1.5 mm apical bone dehiscence rendering with interactive caliper measurement bracket.
 * - Standard clinical orientation tokens (AS/PI, PL/AM, A/P/M/L, S/I/L/M).
 * - High-precision 5 mm scale bar with 1 mm ticks.
 * - Bi-directional touch/mouse drag scrubbing linking directly with the 3D cutting plane.
 */

import {
  CTWindowMode,
  getLandmarkForDepth,
  RADIOLOGY_PLANES,
  RadiologyPlaneId,
  SCDS_PARAMETERS,
} from '../data/radiologyEngine';
import {
  ensureRadiologyVolumeLoaded,
  getLoadedRadiologyVolume,
  MPR_FOV_MM,
  onRadiologyVolumeReady,
  resliceVolumeToRGBA,
} from '../data/radiologyVolume';

export class CTSliceDrawer {
  private container: HTMLElement;
  private rootEl: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  private activePlaneId: RadiologyPlaneId = 'poschl';
  private currentDepthMm = 1.2;
  private scdsActive = false;
  private windowMode: CTWindowMode = 'bone';
  private isOpen = false;

  private isDragging = false;
  private dragStartX = 0;
  private dragStartDepth = 0;

  private onDepthChangeCallbacks: Array<(depthMm: number) => void> = [];
  private onWindowModeChangeCallbacks: Array<(mode: CTWindowMode) => void> = [];
  private onCloseCallbacks: Array<() => void> = [];

  // Canvas physical resolution
  private static readonly CANVAS_LOGICAL_SIZE = 360;
  private static readonly CANVAS_PIXEL_RATIO = 2;
  private static readonly MPR_RESLICE_SIZE = 240;

  // Pre-allocated offscreen reslice buffer (zero-GC during scrubbing)
  private resliceCanvas!: HTMLCanvasElement;
  private resliceCtx!: CanvasRenderingContext2D;
  private resliceImageData!: ImageData;
  private unsubVolumeReady: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'ct-slice-drawer';
    this.rootEl.id = 'ct-slice-drawer';
    this.rootEl.setAttribute('role', 'region');
    this.rootEl.setAttribute('aria-label', '2D Temporal Bone CT MPR Slice Viewer');
    this.container.appendChild(this.rootEl);

    this.renderDOM();
    this.initCanvas();
    this.attachEvents();
    this.drawSlice();
  }

  public open(): void {
    this.isOpen = true;
    this.rootEl.classList.add('open');
    void ensureRadiologyVolumeLoaded(this.windowMode);
    this.drawSlice();
  }

  public close(): void {
    this.isOpen = false;
    this.rootEl.classList.remove('open');
    for (const cb of this.onCloseCallbacks) {
      cb();
    }
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }

  public dispose(): void {
    if (this.unsubVolumeReady) {
      this.unsubVolumeReady();
      this.unsubVolumeReady = null;
    }
  }

  public update(
    planeId: RadiologyPlaneId,
    depthMm: number,
    scdsActive: boolean,
    windowMode: CTWindowMode
  ): void {
    this.activePlaneId = planeId;
    this.currentDepthMm = depthMm;
    this.scdsActive = scdsActive;
    this.windowMode = windowMode;

    this.updateHeaderMeta();
    if (this.isOpen) {
      void ensureRadiologyVolumeLoaded(this.windowMode);
      this.drawSlice();
    }
  }

  public onDepthChange(cb: (depthMm: number) => void): void {
    this.onDepthChangeCallbacks.push(cb);
  }

  public onWindowModeChange(cb: (mode: CTWindowMode) => void): void {
    this.onWindowModeChangeCallbacks.push(cb);
  }

  public onClose(cb: () => void): void {
    this.onCloseCallbacks.push(cb);
  }

  // ---------------------------------------------------------------------------
  // DOM Construction
  // ---------------------------------------------------------------------------
  private renderDOM(): void {
    this.rootEl.innerHTML = `
      <div class="ct-panel">
        <div class="ct-header">
          <div class="ct-title-group">
            <span class="clinical-badge ct-badge">HRCT</span>
            <span class="ct-title" id="ct-header-title">2D Temporal Bone MPR (0.5 mm)</span>
          </div>
          <div class="ct-window-toggles">
            <button
              type="button"
              class="ct-window-btn ${this.windowMode === 'bone' ? 'active' : ''}"
              id="ct-window-bone-btn"
              title="Bone Window (WW: 4000, WL: +700 HU)"
            >Bone (4000/700)</button>
            <button
              type="button"
              class="ct-window-btn ${this.windowMode === 'mri_t2' ? 'active' : ''}"
              id="ct-window-mri-btn"
              title="T2 MRI CISS / FIESTA Mode"
            >T2 MRI</button>
            <button type="button" class="drawer-close-btn" id="ct-close-btn" aria-label="Close 2D CT Card">✕</button>
          </div>
        </div>

        <div class="ct-canvas-wrap" id="ct-canvas-wrap">
          <canvas
            class="ct-canvas"
            id="ct-canvas"
            width="${CTSliceDrawer.CANVAS_LOGICAL_SIZE * CTSliceDrawer.CANVAS_PIXEL_RATIO}"
            height="${CTSliceDrawer.CANVAS_LOGICAL_SIZE * CTSliceDrawer.CANVAS_PIXEL_RATIO}"
          ></canvas>
          <div class="ct-drag-hint">⇄ Drag to scrub</div>
        </div>

        <div class="ct-footer">
          <div class="ct-meta-row">
            <span class="ct-plane-name" id="ct-plane-readout">Pöschl's Plane</span>
            <span class="ct-depth-badge" id="ct-depth-readout">+1.2 mm</span>
          </div>
          <div class="ct-landmark-text" id="ct-landmark-readout">Superior Canal Osseous Halo (SSCD Gold Standard)</div>
        </div>
      </div>
    `;
  }

  private initCanvas(): void {
    this.canvas = this.rootEl.querySelector('#ct-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.ctx.scale(CTSliceDrawer.CANVAS_PIXEL_RATIO, CTSliceDrawer.CANVAS_PIXEL_RATIO);

    const resSize = CTSliceDrawer.MPR_RESLICE_SIZE;
    this.resliceCanvas = document.createElement('canvas');
    this.resliceCanvas.width = resSize;
    this.resliceCanvas.height = resSize;
    this.resliceCtx = this.resliceCanvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.resliceImageData = this.resliceCtx.createImageData(resSize, resSize);

    this.unsubVolumeReady = onRadiologyVolumeReady((mode) => {
      if (this.isOpen && mode === this.windowMode) {
        this.drawSlice();
      }
    });
  }

  private attachEvents(): void {
    const closeBtn = this.rootEl.querySelector('#ct-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    const boneBtn = this.rootEl.querySelector('#ct-window-bone-btn') as HTMLButtonElement;
    const mriBtn = this.rootEl.querySelector('#ct-window-mri-btn') as HTMLButtonElement;

    boneBtn?.addEventListener('click', () => {
      this.windowMode = 'bone';
      this.updateHeaderMeta();
      void ensureRadiologyVolumeLoaded('bone');
      this.drawSlice();
      for (const cb of this.onWindowModeChangeCallbacks) cb('bone');
    });

    mriBtn?.addEventListener('click', () => {
      this.windowMode = 'mri_t2';
      this.updateHeaderMeta();
      void ensureRadiologyVolumeLoaded('mri_t2');
      this.drawSlice();
      for (const cb of this.onWindowModeChangeCallbacks) cb('mri_t2');
    });

    // Touch & Pointer Drag Scrubbing
    this.canvas.addEventListener('pointerdown', (ev) => {
      this.isDragging = true;
      this.dragStartX = ev.clientX;
      this.dragStartDepth = this.currentDepthMm;
      this.canvas.setPointerCapture(ev.pointerId);
    });

    this.canvas.addEventListener('pointermove', (ev) => {
      if (!this.isDragging) return;
      const dx = ev.clientX - this.dragStartX;
      const plane = RADIOLOGY_PLANES[this.activePlaneId];
      // 100px drag = 2.0 mm depth scrub
      const targetDepth = this.dragStartDepth + (dx / 100.0) * 2.0;
      const clamped = Math.max(plane.minDepthMm, Math.min(plane.maxDepthMm, targetDepth));
      const rounded = Math.round(clamped * 10) / 10;
      if (rounded !== this.currentDepthMm) {
        this.currentDepthMm = rounded;
        for (const cb of this.onDepthChangeCallbacks) {
          cb(rounded);
        }
        this.drawSlice();
      }
    });

    const stopDrag = (ev: PointerEvent) => {
      if (this.isDragging) {
        this.isDragging = false;
        try {
          this.canvas.releasePointerCapture(ev.pointerId);
        } catch {}
      }
    };
    this.canvas.addEventListener('pointerup', stopDrag);
    this.canvas.addEventListener('pointercancel', stopDrag);
  }

  private updateHeaderMeta(): void {
    const plane = RADIOLOGY_PLANES[this.activePlaneId];
    const planeEl = this.rootEl.querySelector('#ct-plane-readout');
    const depthEl = this.rootEl.querySelector('#ct-depth-readout');
    const lmEl = this.rootEl.querySelector('#ct-landmark-readout');
    const badgeEl = this.rootEl.querySelector('.ct-badge');
    const boneBtn = this.rootEl.querySelector('#ct-window-bone-btn');
    const mriBtn = this.rootEl.querySelector('#ct-window-mri-btn');

    if (badgeEl) badgeEl.textContent = this.windowMode === 'bone' ? 'HRCT' : 'CISS';
    boneBtn?.classList.toggle('active', this.windowMode === 'bone');
    mriBtn?.classList.toggle('active', this.windowMode === 'mri_t2');

    if (planeEl) planeEl.textContent = plane.title;
    if (depthEl) {
      const sign = this.currentDepthMm > 0 ? '+' : '';
      depthEl.textContent = `${sign}${this.currentDepthMm.toFixed(1)} mm`;
    }
    if (lmEl) {
      const lm = getLandmarkForDepth(this.activePlaneId, this.currentDepthMm);
      lmEl.textContent = lm.label;
    }
  }

  // ---------------------------------------------------------------------------
  // Canvas MPR Rendering Engine
  // ---------------------------------------------------------------------------
  public drawSlice(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = CTSliceDrawer.CANVAS_LOGICAL_SIZE;
    const h = CTSliceDrawer.CANVAS_LOGICAL_SIZE;
    const isBone = this.windowMode === 'bone';
    const plane = RADIOLOGY_PLANES[this.activePlaneId];

    // 1. Background (Black air / temporal bone cavity)
    ctx.fillStyle = isBone ? '#060a0d' : '#040709';
    ctx.fillRect(0, 0, w, h);

    // 2. Render Real IE-Map Volume MPR Slice if loaded, otherwise procedural fallback
    const loadedVol = getLoadedRadiologyVolume(this.windowMode);
    if (loadedVol && this.resliceImageData && this.resliceCtx) {
      const resSize = CTSliceDrawer.MPR_RESLICE_SIZE;
      resliceVolumeToRGBA(
        loadedVol,
        plane,
        this.currentDepthMm,
        resSize,
        resSize,
        this.resliceImageData.data,
        {
          fovMm: MPR_FOV_MM,
          flipHorizontal: this.activePlaneId === 'poschl',
          flipVertical: true,
          oobR: isBone ? 6 : 4,
          oobG: isBone ? 10 : 7,
          oobB: isBone ? 13 : 9,
          oobAlpha: 255,
          inBoundsAlpha: 255,
        }
      );
      this.resliceCtx.putImageData(this.resliceImageData, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.resliceCanvas, 0, 0, w, h);

      // Interactive 1.5 mm SCDS Dehiscence + Acoustic Shunting Caliper Overlay
      if (this.scdsActive && this.activePlaneId === 'poschl' && Math.abs(this.currentDepthMm - 1.2) < 1.6) {
        this.drawSCDSOverlay(ctx, w, h, isBone, plane);
      }
      ctx.restore();
    } else {
      // Subtle temporal bone CT noise / vignette while volume is lazy-loading
      const grad = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, 190);
      grad.addColorStop(0, isBone ? 'rgba(22, 34, 42, 0.45)' : 'rgba(10, 18, 24, 0.6)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      if (this.activePlaneId === 'poschl') {
        this.drawPoschlSlice(ctx, w, h, isBone);
      } else if (this.activePlaneId === 'stenvers') {
        this.drawStenversSlice(ctx, w, h, isBone);
      } else if (this.activePlaneId === 'axial') {
        this.drawAxialSlice(ctx, w, h, isBone);
      } else {
        this.drawCoronalSlice(ctx, w, h, isBone);
      }
      ctx.restore();
    }

    // 3. Render Technical HUD Overlays: Crosshairs, Calipers, Orientation, Scale Bar
    this.drawHUDOverlays(ctx, w, h, isBone, plane);
  }

  /**
   * Projects SCDS_PARAMETERS.canalRoofApexRAS onto the 2D Pöschl slice and renders
   * the 1.5 mm third-window bone defect, fluid protrusion, caliper, and shunting arcs.
   */
  private drawSCDSOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    isBone: boolean,
    plane: typeof RADIOLOGY_PLANES[RadiologyPlaneId]
  ): void {
    const roof = SCDS_PARAMETERS.canalRoofApexRAS;
    const dx = roof[0] - plane.centerRAS[0];
    const dy = roof[1] - plane.centerRAS[1];
    const dz = roof[2] - plane.centerRAS[2];
    const uMm = dx * plane.inPlaneX[0] + dy * plane.inPlaneX[1] + dz * plane.inPlaneX[2];
    const vMm = dx * plane.inPlaneY[0] + dy * plane.inPlaneY[1] + dz * plane.inPlaneY[2];

    const pxPerMm = w / MPR_FOV_MM; // 15 px / mm at 360px & 24mm FOV
    const scdsX = w * 0.5 - uMm * pxPerMm; // poschl has +inPlaneX on Left (AS)
    const scdsY = h * 0.5 - vMm * pxPerMm;
    const halfGapPx = (SCDS_PARAMETERS.defectLengthMm * 0.5) * pxPerMm; // 0.75mm * 15 = 11.25px (22.5px span)

    // 1. Carve 1.5 mm cortical roof defect & show compliant fluid/dural interface
    ctx.fillStyle = isBone ? '#080e13' : '#b2e8fa';
    ctx.beginPath();
    ctx.ellipse(scdsX, scdsY, halfGapPx, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Amber Caliper Measurement Bracket: 1.5 mm Dehiscence
    const capY = scdsY - 9;
    const capLeft = scdsX - halfGapPx;
    const capRight = scdsX + halfGapPx;

    ctx.strokeStyle = '#f0aa62';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(capLeft, capY - 5);
    ctx.lineTo(capLeft, capY + 5);
    ctx.moveTo(capLeft, capY);
    ctx.lineTo(capRight, capY);
    ctx.moveTo(capRight, capY - 5);
    ctx.lineTo(capRight, capY + 5);
    ctx.stroke();

    // 3. Acoustic shunting dispersion radiating arcs into middle cranial fossa
    ctx.strokeStyle = 'rgba(240, 170, 98, 0.72)';
    ctx.lineWidth = 1.25;
    for (let r = 1; r <= 3; r++) {
      ctx.beginPath();
      ctx.arc(scdsX, capY, r * 7.5, -Math.PI * 0.82, -Math.PI * 0.18);
      ctx.stroke();
    }

    // 4. Measurement tag placed cleanly above outer shunting arc (clamped inside canvas)
    const labelY = Math.max(24, capY - 28);
    ctx.fillStyle = '#f0aa62';
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('1.5 mm DEHISCENCE', scdsX, labelY);
  }

  // ===========================================================================
  // 1. PÖSCHL'S PLANE: SSC Halo & SSCD Bone Defect
  // ===========================================================================
  private drawPoschlSlice(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    isBone: boolean
  ): void {
    const depth = this.currentDepthMm;
    const boneColor = isBone ? '#f2f8fa' : '#142028';
    const fluidColor = isBone ? '#091015' : '#d2f6ff';
    const trabeculaColor = isBone ? '#c4d7de' : '#1f2e38';

    // Dense otic capsule bony petrous block with Hounsfield cortical-to-spongiosa gradient
    const petrousGrad = ctx.createRadialGradient(w * 0.48, h * 0.46, 28, w * 0.5, h * 0.52, 148);
    if (isBone) {
      petrousGrad.addColorStop(0, '#f5fafc');
      petrousGrad.addColorStop(0.65, '#d6e4ea');
      petrousGrad.addColorStop(1, '#7a929e');
    } else {
      petrousGrad.addColorStop(0, '#0f181f');
      petrousGrad.addColorStop(0.7, '#182630');
      petrousGrad.addColorStop(1, '#233542');
    }
    ctx.fillStyle = petrousGrad;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.53, 140, 110, -0.05, 0, Math.PI * 2);
    ctx.fill();

    // Subtle middle cranial fossa dural margin above petrous ridge
    ctx.strokeStyle = isBone ? 'rgba(130, 165, 180, 0.45)' : 'rgba(140, 210, 235, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(w * 0.14, h * 0.30);
    ctx.quadraticCurveTo(w * 0.50, h * 0.21, w * 0.86, h * 0.33);
    ctx.stroke();

    // Organic mastoid air cells spongiosa clusters on the lateral flank
    const cellOffsets = [
      [0.72, 0.38, 6.2], [0.77, 0.41, 4.5], [0.74, 0.46, 7.0], [0.80, 0.47, 4.2],
      [0.70, 0.51, 5.0], [0.76, 0.53, 6.5], [0.81, 0.54, 3.8], [0.73, 0.59, 5.5],
      [0.78, 0.60, 4.6], [0.68, 0.43, 3.6], [0.83, 0.49, 3.2], [0.75, 0.65, 4.0],
    ];
    for (const [cxF, cyF, r] of cellOffsets) {
      ctx.fillStyle = isBone ? '#080e12' : '#04080b';
      ctx.beginPath();
      ctx.arc(w * cxF, h * cyF, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isBone ? 'rgba(210, 228, 235, 0.55)' : 'rgba(40, 62, 74, 0.7)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Superior Semicircular Canal Halo Center: (180, 150)
    const haloX = w * 0.5;
    const haloY = h * 0.42;
    const outerR = 56;
    const innerR = 32;

    // Halo bone ring background
    ctx.fillStyle = trabeculaColor;
    ctx.beginPath();
    ctx.arc(haloX, haloY, outerR + 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = boneColor;
    ctx.beginPath();
    ctx.arc(haloX, haloY, outerR, 0, Math.PI * 2);
    ctx.fill();

    // Superior Canal Lumen (Circular hollow)
    ctx.fillStyle = fluidColor;
    ctx.beginPath();
    ctx.arc(haloX, haloY, innerR, 0, Math.PI * 2);
    ctx.fill();

    // Central bone island inside the SSC arch (Subarcuate Fossa cortex)
    ctx.fillStyle = boneColor;
    ctx.beginPath();
    ctx.arc(haloX, haloY, innerR - 10, 0, Math.PI * 2);
    ctx.fill();

    // Vestibule Cavity at base of SSC
    ctx.fillStyle = fluidColor;
    ctx.beginPath();
    ctx.ellipse(haloX + 6, haloY + 84, 28, 20, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Cochlear basal turn anteromedially (Left side)
    ctx.beginPath();
    ctx.arc(haloX - 68, haloY + 82, 18, 0, Math.PI * 2);
    ctx.fill();

    // SCDS DEFECT PRESENTATION: Interrupted bone roof at 12 o'clock
    const isAtHalo = Math.abs(depth - 1.2) < 1.6;
    if (this.scdsActive && isAtHalo) {
      // 1. Carve out absent bone defect at roof apex: arc from 80° to 100° (12 o'clock)
      ctx.fillStyle = isBone ? '#060a0d' : '#040709';
      ctx.beginPath();
      ctx.moveTo(haloX, haloY);
      ctx.arc(haloX, haloY, outerR + 10, -Math.PI * 0.62, -Math.PI * 0.38);
      ctx.closePath();
      ctx.fill();

      // Fluid protrusion bulging towards middle cranial fossa dura
      ctx.fillStyle = isBone ? '#101c24' : '#b2e8fa';
      ctx.beginPath();
      ctx.arc(haloX, haloY - innerR - 3, 7, 0, Math.PI * 2);
      ctx.fill();

      // 2. Amber Caliper Measurement Bracket: 1.5 mm Dehiscence
      const capY = haloY - outerR - 4;
      const capLeft = haloX - 16;
      const capRight = haloX + 16;

      ctx.strokeStyle = '#f0aa62';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      // Left tick
      ctx.moveTo(capLeft, capY - 5);
      ctx.lineTo(capLeft, capY + 5);
      // Main span line
      ctx.moveTo(capLeft, capY);
      ctx.lineTo(capRight, capY);
      // Right tick
      ctx.moveTo(capRight, capY - 5);
      ctx.lineTo(capRight, capY + 5);
      ctx.stroke();

      // Acoustic shunting dispersion radiating arcs into cranial cavity
      ctx.strokeStyle = 'rgba(240, 170, 98, 0.65)';
      ctx.lineWidth = 1.2;
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(haloX, capY, r * 8, -Math.PI * 0.82, -Math.PI * 0.18);
        ctx.stroke();
      }

      // Measurement tag placed cleanly above the outer shunting arc (zero overlap)
      ctx.fillStyle = '#f0aa62';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('1.5 mm DEHISCENCE', haloX, capY - 32);
    }
  }

  // ===========================================================================
  // 2. STENVERS' PLANE: Depth-Responsive SSC Limbs, EVA, IAC & Cochlear Turn
  // ===========================================================================
  private drawStenversSlice(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    isBone: boolean
  ): void {
    const boneColor = isBone ? '#f2f8fa' : '#142028';
    const fluidColor = isBone ? '#091015' : '#d2f6ff';
    const labelColor = isBone ? '#7696a4' : '#4a7588';
    const d = this.currentDepthMm; // Range: -6.0 .. +6.0 mm

    // Smooth zone weights along Stenvers depth axis
    const wPostArch = Math.max(0, Math.min(1, (-1.8 - d) / 2.6));
    const wSSC = Math.max(0.18, 1 - Math.abs(d - 0.3) / 3.6);
    const wVest = Math.max(0.15, 1 - Math.abs(d - 0.5) / 3.4);
    const wCochlea = Math.max(0, Math.min(1, (d - 1.0) / 2.8));

    // Petrous pyramid outline subtly shifts with depth
    const apexShiftX = d * 2.2;
    ctx.fillStyle = boneColor;
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.76);
    ctx.lineTo(w * 0.44 + apexShiftX * 0.4, h * 0.27);
    ctx.lineTo(w * 0.88, h * 0.41);
    ctx.lineTo(w * 0.82, h * 0.82);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = fluidColor;

    // 1. Posterior Canal Arch & Vestibular Aqueduct (-6.0 to -0.5 mm)
    if (d < 0.2) {
      const archOpacity = Math.max(0.25, wPostArch);
      ctx.save();
      ctx.globalAlpha = archOpacity;
      ctx.beginPath();
      ctx.arc(w * 0.52, h * 0.46, 36 + wPostArch * 8, Math.PI * 0.9, Math.PI * 1.95);
      ctx.lineWidth = 10;
      ctx.strokeStyle = fluidColor;
      ctx.stroke();

      // Vestibular Aqueduct (Slit descending posteromedially around -2.5 to -0.5 mm)
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(w * 0.55, h * 0.56);
      ctx.lineTo(w * 0.70, h * 0.72);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Anterior & Posterior Limbs of SSC (End-on, shifting closer near arch roof / separating into limbs near vestibule)
    const limbSpread = 0.12 - Math.min(0.08, Math.abs(d) * 0.012);
    const limbR = 6 + 8 * wSSC;
    const antX = w * (0.50 - limbSpread);
    const antY = h * (0.42 - d * 0.01);
    const postX = w * (0.50 + limbSpread);
    const postY = h * (0.44 + d * 0.008);

    ctx.beginPath();
    ctx.arc(antX, antY, limbR, 0, Math.PI * 2);
    ctx.arc(postX, postY, Math.max(4, limbR * (d > 2.2 ? 0.55 : 1.0)), 0, Math.PI * 2);
    ctx.fill();

    // 3. Vestibule Cavity & Internal Auditory Canal (-2.0 to +2.5 mm)
    if (wVest > 0.2) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, wVest);
      ctx.beginPath();
      ctx.ellipse(w * 0.50, h * 0.62, 26 * wVest, 18 * wVest, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.roundRect(w * 0.56, h * 0.66, 72 * wVest, 14 * wVest + 2, 4);
      ctx.fill();
      ctx.restore();
    }

    // 4. Cochlear Basal Turn & Modiolus (Anterior Stenvers depths: +1.5 to +6.0 mm)
    if (wCochlea > 0.05) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, wCochlea * 1.15);
      const cX = w * 0.38;
      const cY = h * 0.56;
      ctx.beginPath();
      ctx.ellipse(cX, cY + 12, 24 * wCochlea, 12 * wCochlea, -0.15, 0, Math.PI * 2);
      ctx.fill();
      if (d > 3.2) {
        const spiralScale = Math.min(1, (d - 3.0) / 2.2);
        ctx.beginPath();
        ctx.ellipse(cX - 4, cY - 8, 17 * spiralScale, 10 * spiralScale, -0.1, 0, Math.PI * 2);
        ctx.ellipse(cX - 6, cY - 22, 10 * spiralScale, 6 * spiralScale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Labels for active structures at this depth
    ctx.fillStyle = labelColor;
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    if (wSSC > 0.45) {
      ctx.fillText('Ant Limb', antX, antY - limbR - 6);
      if (d <= 2.2) ctx.fillText('Post Limb', postX, postY - limbR - 6);
    }
    if (d < -0.5 && d > -3.2) {
      ctx.fillText('Vest Aq', w * 0.70, h * 0.79);
    }
    if (wVest > 0.45) {
      ctx.fillText('IAC', w * 0.72, h * 0.62);
    }
    if (wCochlea > 0.35) {
      ctx.fillText(d > 3.5 ? 'Cochlea (2.5T)' : 'Basal Turn', w * 0.36, h * 0.74);
    }
  }

  // ===========================================================================
  // 3. TRUE AXIAL PLANE: Depth-Responsive Cochlea / Signet Ring / SSC Roof
  // ===========================================================================
  private drawAxialSlice(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    isBone: boolean
  ): void {
    const boneColor = isBone ? '#f2f8fa' : '#142028';
    const fluidColor = isBone ? '#091015' : '#d2f6ff';
    const labelColor = isBone ? '#7696a4' : '#4a7588';
    const d = this.currentDepthMm; // Range: -7.0 .. +9.0 mm

    // Petrous bone mass tapers slightly at superior arcuate eminence
    const boneScale = d > 4.0 ? Math.max(0.76, 1 - (d - 4.0) * 0.04) : 1.0;
    ctx.fillStyle = boneColor;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.5, 135 * boneScale, 110 * boneScale, 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = fluidColor;

    // 1. Cochlea & Round Window Niche (-7.0 to +1.8 mm)
    if (d < 2.2) {
      const cochWeight = d < -0.5 ? Math.max(0.35, 1 - Math.abs(d + 2.2) / 5.2) : Math.max(0.25, 1 - d / 2.5);
      const cochX = w * 0.38;
      const cochY = h * 0.28 + d * 1.4;
      ctx.save();
      ctx.globalAlpha = Math.min(1, cochWeight + 0.2);
      ctx.beginPath();
      ctx.ellipse(cochX, cochY, 24 * cochWeight, 17 * cochWeight, 0.38, 0, Math.PI * 2);
      ctx.fill();
      if (d < -1.0 && d > -5.5) {
        // Middle/Apical turn & Basal hook near Round Window
        ctx.beginPath();
        ctx.ellipse(cochX - 18, cochY + 12, 13 * cochWeight, 9 * cochWeight, 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 2. Lateral Canal Signet Ring + Vestibule + IAC (-1.2 to +3.5 mm, peak at +1.0 mm)
    const latWeight = Math.max(0, 1 - Math.abs(d - 1.0) / 3.4);
    if (latWeight > 0.08) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, latWeight * 1.15);
      const ringX = w * 0.68;
      const ringY = h * 0.46;
      // Outer ring of horizontal canal around central bone island
      ctx.beginPath();
      ctx.arc(ringX, ringY, 17 * Math.max(0.55, latWeight), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = boneColor;
      ctx.beginPath();
      ctx.arc(ringX, ringY, 7 * Math.max(0.4, latWeight), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = fluidColor;
      // Vestibule (Center)
      ctx.beginPath();
      ctx.ellipse(w * 0.48, h * 0.48, 28 * latWeight, 20 * latWeight, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Internal Auditory Canal (IAC) extending medially
      ctx.beginPath();
      ctx.roundRect(w * 0.16, h * 0.45, 95 * Math.max(0.45, latWeight), 16 * latWeight + 2, 4);
      ctx.fill();
      ctx.restore();
    }

    // 3. Superior Canal Ampulla, Common Crus & Roof Arch (+2.0 to +9.0 mm)
    if (d > 1.8) {
      const supWeight = Math.min(1, (d - 1.8) / 2.2);
      ctx.save();
      ctx.globalAlpha = supWeight;
      if (d < 6.2) {
        // Two transverse limbs moving closer as cut approaches the SSC roof
        const sep = Math.max(8, (6.4 - d) * 8.5);
        ctx.beginPath();
        ctx.arc(w * 0.52 - sep, h * 0.40, 10, 0, Math.PI * 2);
        ctx.arc(w * 0.56 + sep, h * 0.52, 10, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Single superior arcuate eminence tangent cut (+6.2 to +9.0 mm)
        ctx.beginPath();
        ctx.ellipse(w * 0.54, h * 0.45, 22, 8, 0.52, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.fillStyle = labelColor;
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    if (latWeight > 0.35) {
      ctx.fillText('Lat Canal', w * 0.68, h * 0.46 - 21);
      ctx.fillText('Vestibule', w * 0.48, h * 0.48 - 24);
      ctx.fillText('IAC', w * 0.24, h * 0.42);
    }
    if (d < 1.8) {
      ctx.fillText('Cochlea', w * 0.38, h * 0.28 + d * 1.4 - 20);
    }
    if (d > 2.2) {
      ctx.fillText(d > 6.0 ? 'SSC Roof Apex' : 'SSC Crura', w * 0.54, h * 0.34);
    }
  }

  // ===========================================================================
  // 4. TRUE CORONAL PLANE: Depth-Responsive Post Canal -> Vestibule -> Modiolus
  // ===========================================================================
  private drawCoronalSlice(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    isBone: boolean
  ): void {
    const boneColor = isBone ? '#f2f8fa' : '#142028';
    const fluidColor = isBone ? '#091015' : '#d2f6ff';
    const labelColor = isBone ? '#7696a4' : '#4a7588';
    const d = this.currentDepthMm; // Range: -8.5 .. +7.5 mm

    // Petrous bone mass
    ctx.fillStyle = boneColor;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.52, 130, 115, 0, 0, Math.PI * 2);
    ctx.fill();

    // Smooth anatomical zone weights along Anterior-Posterior (+Y / -Y) Coronal axis
    const wPost = Math.max(0, Math.min(1, (-1.2 - d) / 2.8));
    const wVest = Math.max(0, 1 - Math.abs(d) / 3.2);
    const wCoch = Math.max(0, Math.min(1, (d + 1.2) / 3.2)) * (d > 5.2 ? Math.max(0.35, 1 - (d - 5.2) / 3.2) : 1);

    // 1. Posterior Canal & Descending Mastoid CN VII (-8.5 to -1.5 mm)
    if (wPost > 0.08) {
      ctx.save();
      ctx.globalAlpha = wPost;
      ctx.strokeStyle = fluidColor;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(w * 0.56, h * 0.46, 36, -Math.PI * 0.65, Math.PI * 0.55);
      ctx.stroke();

      // Descending Mastoid CN VII (Vertical canal laterally)
      ctx.fillStyle = fluidColor;
      ctx.beginPath();
      ctx.roundRect(w * 0.72, h * 0.46, 9, 54, 4);
      ctx.fill();
      ctx.restore();
    }

    // 2. Vestibule, Oval Window & Tympanic CN VII (-2.5 to +2.5 mm)
    if (wVest > 0.12) {
      ctx.save();
      ctx.globalAlpha = wVest;
      const vestX = w * 0.65;
      const vestY = h * 0.48;
      ctx.fillStyle = fluidColor;
      ctx.beginPath();
      ctx.ellipse(vestX, vestY, 26 * Math.max(0.45, wVest), 22 * Math.max(0.45, wVest), 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Tympanic segment facial nerve canal above oval window
      ctx.beginPath();
      ctx.arc(vestX - 6, vestY - 32, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Cochlear Modiolus Architecture (2.5 turns spiral, scaling in anteriorly from -1.0 to +7.5 mm)
    if (wCoch > 0.08) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, wCoch * 1.15);
      const cX = w * 0.38;
      const cY = h * 0.52;
      const s = Math.max(0.35, wCoch);

      ctx.fillStyle = fluidColor;
      ctx.beginPath();
      ctx.ellipse(cX, cY + 22, 28 * s, 14 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(cX - 4, cY - 4, 20 * s, 11 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(cX - 6, cY - 24, 12 * s, 7 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Modiolus central bone core
      ctx.fillStyle = boneColor;
      ctx.beginPath();
      ctx.moveTo(cX - 1, cY - 20 * s);
      ctx.lineTo(cX + 2, cY + 18 * s);
      ctx.lineTo(cX + 7, cY + 18 * s);
      ctx.lineTo(cX + 4, cY - 20 * s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = labelColor;
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    if (wCoch > 0.32) {
      ctx.fillText(d > 5.0 ? 'Cochlear Apex' : 'Modiolus (2.5 turns)', w * 0.38, h * 0.52 + 44);
    }
    if (wVest > 0.35) {
      ctx.fillText('Vestibule', w * 0.65, h * 0.48 + 32);
      ctx.fillText('CN VII (Tymp)', w * 0.65 - 6, h * 0.48 - 42);
    }
    if (wPost > 0.35) {
      ctx.fillText('Post Canal', w * 0.56, h * 0.46 - 44);
      ctx.fillText('CN VII (Mast)', w * 0.72, h * 0.46 + 68);
    }
  }

  // ===========================================================================
  // 5. RADIOLOGICAL HUD OVERLAYS
  // ===========================================================================
  private drawHUDOverlays(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    isBone: boolean,
    plane: typeof RADIOLOGY_PLANES[RadiologyPlaneId]
  ): void {
    // 1. Subtle Center Crosshair with 5mm ticks
    ctx.strokeStyle = 'rgba(82, 220, 242, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);

    ctx.beginPath();
    ctx.moveTo(w / 2, 25);
    ctx.lineTo(w / 2, h - 25);
    ctx.moveTo(25, h / 2);
    ctx.lineTo(w - 25, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Clinical Orientation Tokens (Top, Bottom, Left, Right)
    const tokens = plane.orientationLabels;
    ctx.fillStyle = '#52dcf2';
    ctx.font = 'bold 12px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Top
    ctx.fillText(tokens.top, w / 2, 14);
    // Bottom
    ctx.fillText(tokens.bottom, w / 2, h - 14);
    // Left
    ctx.fillText(tokens.left, 14, h / 2);
    // Right
    ctx.fillText(tokens.right, w - 14, h / 2);

    // 3. Technical Metadata Tags (Top-Left)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillStyle = '#9ec0cd';
    const tag1 = isBone ? 'HRCT TEMPORAL BONE' : '3D T2 CISS FIESTA';
    const tag2 = isBone ? 'W:4000 L:+700 HU' : 'TR/TE 5.5/2.4 ms';
    const tag3 = `FOV 24 mm · SLICE 0.5 mm`;
    ctx.fillText(tag1, 14, 14);
    ctx.fillText(tag2, 14, 27);
    ctx.fillText(tag3, 14, 40);

    // 4. 5 mm Scale Bar with 1 mm Ticks (Bottom-Left)
    // At FOV 24 mm in 360px: 1 mm = 15 px, 5 mm = 75 px
    const scaleBarX = 14;
    const scaleBarY = h - 24;
    const scaleBarW = 75; // 5 mm

    ctx.strokeStyle = '#52dcf2';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(scaleBarX, scaleBarY);
    ctx.lineTo(scaleBarX + scaleBarW, scaleBarY);
    // 1 mm tick marks
    for (let i = 0; i <= 5; i++) {
      const tx = scaleBarX + (scaleBarW / 5) * i;
      const th = i === 0 || i === 5 ? 6 : 3;
      ctx.moveTo(tx, scaleBarY - th);
      ctx.lineTo(tx, scaleBarY + th);
    }
    ctx.stroke();

    ctx.fillStyle = '#52dcf2';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('5 mm', scaleBarX, scaleBarY - 14);
  }
}
