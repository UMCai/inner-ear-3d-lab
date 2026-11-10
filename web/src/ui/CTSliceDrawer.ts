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
} from '../data/radiologyEngine';

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
          <div class="ct-drag-hint">⇄ Drag horizontally to scrub slice depth</div>
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
  }

  private attachEvents(): void {
    const closeBtn = this.rootEl.querySelector('#ct-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    const boneBtn = this.rootEl.querySelector('#ct-window-bone-btn') as HTMLButtonElement;
    const mriBtn = this.rootEl.querySelector('#ct-window-mri-btn') as HTMLButtonElement;

    boneBtn?.addEventListener('click', () => {
      this.windowMode = 'bone';
      boneBtn.classList.add('active');
      mriBtn?.classList.remove('active');
      this.drawSlice();
      for (const cb of this.onWindowModeChangeCallbacks) cb('bone');
    });

    mriBtn?.addEventListener('click', () => {
      this.windowMode = 'mri_t2';
      mriBtn.classList.add('active');
      boneBtn?.classList.remove('active');
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

    // Subtle temporal bone CT noise / vignette
    const grad = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, 190);
    grad.addColorStop(0, isBone ? 'rgba(22, 34, 42, 0.45)' : 'rgba(10, 18, 24, 0.6)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. Render Anatomical Cross-Section per Plane & Depth
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

    // 3. Render Technical HUD Overlays: Crosshairs, Calipers, Orientation, Scale Bar
    this.drawHUDOverlays(ctx, w, h, isBone, plane);
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

    // Dense otic capsule bony petrous block
    ctx.fillStyle = boneColor;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.52, 140, 115, -0.05, 0, Math.PI * 2);
    ctx.fill();

    // Mastoid air cells spongiosa texture on the lateral flank
    ctx.fillStyle = isBone ? '#070c0f' : '#050a0d';
    for (let i = 0; i < 18; i++) {
      const rx = w * 0.72 + (i % 4) * 14 + (i % 2) * 4;
      const ry = h * 0.35 + Math.floor(i / 4) * 16;
      ctx.beginPath();
      ctx.arc(rx, ry, 3 + (i % 3) * 1.5, 0, Math.PI * 2);
      ctx.fill();
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

      // Measurement tag
      ctx.fillStyle = '#f0aa62';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('1.5 mm DEHISCENCE', haloX, capY - 9);

      // Acoustic shunting dispersion radiating arcs into cranial cavity
      ctx.strokeStyle = 'rgba(240, 170, 98, 0.7)';
      ctx.lineWidth = 1.2;
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(haloX, capY, r * 9, -Math.PI * 0.85, -Math.PI * 0.15);
        ctx.stroke();
      }
    }
  }

  // ===========================================================================
  // 2. STENVERS' PLANE: SSC Anterior & Posterior Limbs End-On + IAC
  // ===========================================================================
  private drawStenversSlice(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    isBone: boolean
  ): void {
    const boneColor = isBone ? '#f2f8fa' : '#142028';
    const fluidColor = isBone ? '#091015' : '#d2f6ff';

    // Petrous pyramid cut
    ctx.fillStyle = boneColor;
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.75);
    ctx.lineTo(w * 0.45, h * 0.28);
    ctx.lineTo(w * 0.88, h * 0.42);
    ctx.lineTo(w * 0.82, h * 0.82);
    ctx.closePath();
    ctx.fill();

    // Anterior Limb of SSC (Cut end-on, Left)
    const antX = w * 0.38;
    const antY = h * 0.42;
    ctx.fillStyle = fluidColor;
    ctx.beginPath();
    ctx.arc(antX, antY, 13, 0, Math.PI * 2);
    ctx.fill();

    // Posterior Limb of SSC (Cut end-on, Right)
    const postX = w * 0.62;
    const postY = h * 0.44;
    ctx.beginPath();
    ctx.arc(postX, postY, 13, 0, Math.PI * 2);
    ctx.fill();

    // Vestibule Cavity (Lower middle)
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.62, 26, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Internal Auditory Canal (IAC) entering medially
    ctx.beginPath();
    ctx.roundRect(w * 0.56, h * 0.66, 75, 16, 4);
    ctx.fill();

    // Labels for limbs
    ctx.fillStyle = isBone ? '#7696a4' : '#4a7588';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Ant Limb', antX, antY - 18);
    ctx.fillText('Post Limb', postX, postY - 18);
    ctx.fillText('IAC', w * 0.74, h * 0.64);
  }

  // ===========================================================================
  // 3. TRUE AXIAL PLANE: Lateral Canal Signet Ring & Basal Cochlear Turn
  // ===========================================================================
  private drawAxialSlice(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    isBone: boolean
  ): void {
    const boneColor = isBone ? '#f2f8fa' : '#142028';
    const fluidColor = isBone ? '#091015' : '#d2f6ff';

    // Petrous bone mass
    ctx.fillStyle = boneColor;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.5, 135, 110, 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Lateral Canal "Signet Ring Sign" (Posterolateral, Right)
    const ringX = w * 0.68;
    const ringY = h * 0.46;
    ctx.fillStyle = fluidColor;
    ctx.beginPath();
    ctx.arc(ringX, ringY, 15, 0, Math.PI * 2);
    ctx.fill();

    // Vestibule (Center)
    const vestX = w * 0.48;
    const vestY = h * 0.48;
    ctx.beginPath();
    ctx.ellipse(vestX, vestY, 28, 20, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Internal Auditory Canal (IAC) extending horizontally to the medial left (M)
    ctx.beginPath();
    ctx.roundRect(w * 0.16, h * 0.45, 95, 18, 4);
    ctx.fill();

    // Cochlea (Anterior, Top A)
    const cochX = w * 0.38;
    const cochY = h * 0.28;
    ctx.beginPath();
    ctx.ellipse(cochX, cochY, 22, 16, 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isBone ? '#7696a4' : '#4a7588';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Lat Canal', ringX, ringY - 19);
    ctx.fillText('Vestibule', vestX, vestY - 24);
    ctx.fillText('IAC', w * 0.24, h * 0.42);
    ctx.fillText('Cochlea', cochX, cochY - 20);
  }

  // ===========================================================================
  // 4. TRUE CORONAL PLANE: Cochlear Modiolus 2.5 Turns & Promontory
  // ===========================================================================
  private drawCoronalSlice(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    isBone: boolean
  ): void {
    const boneColor = isBone ? '#f2f8fa' : '#142028';
    const fluidColor = isBone ? '#091015' : '#d2f6ff';

    // Petrous bone mass
    ctx.fillStyle = boneColor;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.52, 130, 115, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cochlear Modiolus Architecture (2.5 turns spiral, Left M)
    const cX = w * 0.38;
    const cY = h * 0.52;

    // Basal turn lumen
    ctx.fillStyle = fluidColor;
    ctx.beginPath();
    ctx.ellipse(cX, cY + 22, 28, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Middle turn lumen
    ctx.beginPath();
    ctx.ellipse(cX - 4, cY - 4, 20, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Apical turn lumen
    ctx.beginPath();
    ctx.ellipse(cX - 6, cY - 24, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Modiolus central core (Bone stalk)
    ctx.fillStyle = boneColor;
    ctx.beginPath();
    ctx.moveTo(cX - 1, cY - 20);
    ctx.lineTo(cX + 2, cY + 18);
    ctx.lineTo(cX + 7, cY + 18);
    ctx.lineTo(cX + 4, cY - 20);
    ctx.closePath();
    ctx.fill();

    // Vestibule (Right L)
    const vestX = w * 0.65;
    const vestY = h * 0.48;
    ctx.fillStyle = fluidColor;
    ctx.beginPath();
    ctx.ellipse(vestX, vestY, 26, 22, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Tympanic segment facial nerve canal (Above vestibule)
    ctx.beginPath();
    ctx.arc(vestX - 6, vestY - 32, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isBone ? '#7696a4' : '#4a7588';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Modiolus (2.5 turns)', cX, cY + 44);
    ctx.fillText('Vestibule', vestX, vestY + 32);
    ctx.fillText('CN VII', vestX - 6, vestY - 42);
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
