/**
 * web/src/ui/SurgicalDrawer.ts
 *
 * Stage 4 Modal Workbench: Docked Surgical Endoscopy & Biotelemetry Drawer
 *
 * Implements:
 * 1. 5th Docked Drawer Class conforming strictly to the "Modal Workbench" Zero-Clutter UI (360x360 logical, 720x720 Retina).
 * 2. Upper 2D Canvas (360x220 logical, 720x440 Retina):
 *    - CI Mode: Scala Tympani cross-section, basilar membrane caliper (d_BM), modiolus wall distance, translocation warning.
 *    - Labyrinthectomy Mode: Otic capsule canal fenestration, drill burr RPM cutting profile, irrigation.
 *    - Neurectomy Mode: IAC 4-quadrant fundus diagram (Bill's bar, Falciform crest, CN VII, Cochlear, SVN, IVN) & cleavage plane.
 * 3. Lower 2D Canvas (360x110 logical, 720x220 Retina):
 *    - CI Mode: Insertion force curve (F_ins mN vs s mm), safe/caution/rupture threshold lines, Greenwood channel spectrum bars.
 *    - Labyrinthectomy Mode: Acute contralateral spontaneous paralytic nystagmogram sawtooth strip & Alexander degree.
 *    - Neurectomy Mode: Rolling dual-channel intraoperative monitor (Lead 1: ABR Wave V click-evoked trace; Lead 2: Facial EMG burst monitor).
 * 4. Strict 5-Drawer Mutual Exclusivity.
 */

import type { SurgicalLabState } from '../render/DualStageScene';
import { getGreenwoodColor } from '../render/gate3Materials';

export class SurgicalDrawer {
  private container: HTMLElement;
  private rootEl: HTMLElement;
  private monitorCanvas!: HTMLCanvasElement;
  private plotCanvas!: HTMLCanvasElement;
  private monitorCtx: CanvasRenderingContext2D | null = null;
  private plotCtx: CanvasRenderingContext2D | null = null;

  private isOpen = false;
  private onCloseCallbacks: Array<() => void> = [];

  // Cached Telemetry State
  private currentLabState: SurgicalLabState | null = null;
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private simTime = 0.0;

  // Header & Badges DOM references
  private procBadgeEl!: HTMLElement;
  private statusBadgeEl!: HTMLElement;
  private closeBtn!: HTMLButtonElement;
  private monitorTitleEl!: HTMLElement;
  private caliperTextEl!: HTMLElement;
  private plotTitleEl!: HTMLElement;
  private plotLegendEl!: HTMLElement;

  private static readonly LOGICAL_W = 360;
  private static readonly MONITOR_LOGICAL_H = 220;
  private static readonly PLOT_LOGICAL_H = 110;
  private static readonly PIXEL_RATIO = 2;

  constructor(container: HTMLElement) {
    this.container = container;

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'surgical-drawer';
    this.rootEl.id = 'surgical-drawer';
    this.rootEl.setAttribute('role', 'region');
    this.rootEl.setAttribute('aria-label', 'Surgical Endoscopy & Biotelemetry');
    this.container.appendChild(this.rootEl);

    this.renderDOM();
    this.initCanvases();
    this.attachEvents();
  }

  private renderDOM(): void {
    this.rootEl.innerHTML = `
      <div class="surgical-panel">
        <!-- Header -->
        <div class="surgical-header">
          <div class="surgical-title-cluster">
            <span class="surgical-icon">🔬</span>
            <div class="surgical-title-text">
              <span class="surgical-title">Surgical Endoscopy &amp; Telemetry</span>
              <span class="surgical-subtitle" id="surg-subtitle">Microsurgical Calipers &amp; Electrophysiology</span>
            </div>
          </div>
          <div class="surgical-header-actions">
            <span class="surg-proc-badge" id="surg-proc-badge">CI</span>
            <span class="surg-status-badge status-safe" id="surg-status-badge">OPTIMAL</span>
            <button type="button" class="surgical-close-btn" id="surg-close-btn" title="Close Surgical Drawer" aria-label="Close Surgical Drawer">✕</button>
          </div>
        </div>

        <!-- Upper 2D Monitor Canvas (360x220) -->
        <div class="surg-monitor-section">
          <div class="surg-monitor-header">
            <span class="surg-monitor-title" id="surg-monitor-title">Scala Tympani Lumen Cross-Section</span>
            <span class="surg-caliper-text" id="surg-caliper-text">BM Clearance: 0.45 mm (SAFE)</span>
          </div>
          <div class="surg-monitor-wrap">
            <canvas
              class="surg-monitor-canvas"
              id="surg-monitor-canvas"
              width="${SurgicalDrawer.LOGICAL_W * SurgicalDrawer.PIXEL_RATIO}"
              height="${SurgicalDrawer.MONITOR_LOGICAL_H * SurgicalDrawer.PIXEL_RATIO}"
              style="width: ${SurgicalDrawer.LOGICAL_W}px; height: ${SurgicalDrawer.MONITOR_LOGICAL_H}px;"
            ></canvas>
          </div>
        </div>

        <!-- Lower Live Biotelemetry / Signal Tracing Canvas (360x110) -->
        <div class="surg-plot-section">
          <div class="surg-plot-header">
            <span class="surg-plot-title" id="surg-plot-title">Insertion Force Curve (mN vs mm)</span>
            <div class="surg-plot-legend" id="surg-plot-legend">
              <span class="leg-item"><span class="dot dot-green"></span> &lt;15mN</span>
              <span class="leg-item"><span class="dot dot-yellow"></span> 15–28mN</span>
              <span class="leg-item"><span class="dot dot-red"></span> &ge;30mN</span>
            </div>
          </div>
          <div class="surg-plot-wrap">
            <canvas
              class="surg-plot-canvas"
              id="surg-plot-canvas"
              width="${SurgicalDrawer.LOGICAL_W * SurgicalDrawer.PIXEL_RATIO}"
              height="${SurgicalDrawer.PLOT_LOGICAL_H * SurgicalDrawer.PIXEL_RATIO}"
              style="width: ${SurgicalDrawer.LOGICAL_W}px; height: ${SurgicalDrawer.PLOT_LOGICAL_H}px;"
            ></canvas>
          </div>
        </div>
      </div>
    `;

    this.monitorCanvas = this.rootEl.querySelector('#surg-monitor-canvas') as HTMLCanvasElement;
    this.plotCanvas = this.rootEl.querySelector('#surg-plot-canvas') as HTMLCanvasElement;
    this.procBadgeEl = this.rootEl.querySelector('#surg-proc-badge') as HTMLElement;
    this.statusBadgeEl = this.rootEl.querySelector('#surg-status-badge') as HTMLElement;
    this.closeBtn = this.rootEl.querySelector('#surg-close-btn') as HTMLButtonElement;
    this.monitorTitleEl = this.rootEl.querySelector('#surg-monitor-title') as HTMLElement;
    this.caliperTextEl = this.rootEl.querySelector('#surg-caliper-text') as HTMLElement;
    this.plotTitleEl = this.rootEl.querySelector('#surg-plot-title') as HTMLElement;
    this.plotLegendEl = this.rootEl.querySelector('#surg-plot-legend') as HTMLElement;
  }

  private initCanvases(): void {
    if (this.monitorCanvas) {
      this.monitorCtx = this.monitorCanvas.getContext('2d');
      if (this.monitorCtx) {
        this.monitorCtx.scale(SurgicalDrawer.PIXEL_RATIO, SurgicalDrawer.PIXEL_RATIO);
      }
    }
    if (this.plotCanvas) {
      this.plotCtx = this.plotCanvas.getContext('2d');
      if (this.plotCtx) {
        this.plotCtx.scale(SurgicalDrawer.PIXEL_RATIO, SurgicalDrawer.PIXEL_RATIO);
      }
    }
  }

  private attachEvents(): void {
    this.closeBtn.addEventListener('click', () => {
      this.close();
    });
  }

  public open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.rootEl.classList.add('open');
    this.rootEl.style.display = 'flex';
    this.startRenderLoop();
    this.renderFrame();
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastFrameTime = 0;
    this.rootEl.classList.remove('open');
    this.rootEl.style.display = 'none';
    this.onCloseCallbacks.forEach((cb) => cb());
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

  public onClose(callback: () => void): void {
    this.onCloseCallbacks.push(callback);
  }

  public updateTelemetry(state: SurgicalLabState): void {
    this.currentLabState = state;
    this.updateBadgesAndHeaders();
    if (this.isOpen) {
      this.renderFrame();
    }
  }

  private updateBadgesAndHeaders(): void {
    if (!this.currentLabState) return;
    const { activeProcedure, ciState, labyState, neurectomyState } = this.currentLabState;

    if (activeProcedure === 'cochlear_implant') {
      this.procBadgeEl.textContent = '🦻 Cochlear Implant';
      this.monitorTitleEl.textContent = 'Scala Tympani Lumen Cross-Section';
      this.plotTitleEl.textContent = 'Insertion Force Curve (mN vs mm)';

      if (ciState.isRuptured) {
        this.statusBadgeEl.textContent = 'CRITICAL BREACH';
        this.statusBadgeEl.className = 'surg-status-badge status-danger';
        this.caliperTextEl.textContent = `BM Clearance: ${ciState.distanceToBasilarMembraneMm.toFixed(2)} mm (BREACH)`;
      } else if (ciState.translocationRisk === 'caution') {
        this.statusBadgeEl.textContent = 'CAUTION';
        this.statusBadgeEl.className = 'surg-status-badge status-warning';
        this.caliperTextEl.textContent = `BM Clearance: ${ciState.distanceToBasilarMembraneMm.toFixed(2)} mm (CAUTION)`;
      } else {
        this.statusBadgeEl.textContent = 'OPTIMAL';
        this.statusBadgeEl.className = 'surg-status-badge status-safe';
        this.caliperTextEl.textContent = `BM Clearance: ${ciState.distanceToBasilarMembraneMm.toFixed(2)} mm (SAFE)`;
      }

      this.plotLegendEl.innerHTML = `
        <span class="leg-item"><span class="dot dot-green"></span> &lt;15mN</span>
        <span class="leg-item"><span class="dot dot-yellow"></span> 15–28mN</span>
        <span class="leg-item"><span class="dot dot-red"></span> &ge;30mN</span>
      `;
    } else if (activeProcedure === 'labyrinthectomy') {
      this.procBadgeEl.textContent = '🪚 Labyrinthectomy';
      this.monitorTitleEl.textContent = 'Canal Fenestration & Otic Capsule';
      this.plotTitleEl.textContent = 'Spontaneous Nystagmogram (Contralateral)';

      if (labyState.neuroepitheliumAblated) {
        this.statusBadgeEl.textContent = 'DEAFFERENTED';
        this.statusBadgeEl.className = 'surg-status-badge status-danger';
        this.caliperTextEl.textContent = `SPV: ${labyState.spontaneousSPVDegSec.toFixed(1)}°/s (${labyState.alexanderDegree}rd Deg)`;
      } else if (labyState.step >= 1) {
        this.statusBadgeEl.textContent = 'CANALECTOMY';
        this.statusBadgeEl.className = 'surg-status-badge status-warning';
        this.caliperTextEl.textContent = `Drill: ${labyState.drillRpm.toLocaleString()} RPM`;
      } else {
        this.statusBadgeEl.textContent = 'MASTOIDECTOMY';
        this.statusBadgeEl.className = 'surg-status-badge status-safe';
        this.caliperTextEl.textContent = 'Intact Labyrinth (90 sp/s)';
      }

      this.plotLegendEl.innerHTML = `
        <span class="leg-item"><span class="dot dot-cyan"></span> Left-Beating</span>
        <span class="leg-item">SPV: ${labyState.spontaneousSPVDegSec.toFixed(1)}°/s</span>
      `;
    } else if (activeProcedure === 'neurectomy') {
      this.procBadgeEl.textContent = '🧠 Neurectomy';
      this.monitorTitleEl.textContent = 'IAC Fundus 4-Quadrant View';
      this.plotTitleEl.textContent = 'Intraoperative ABR & EMG Monitor';

      if (neurectomyState.isEMGAlarmActive) {
        this.statusBadgeEl.textContent = 'EMG TRACTION ALARM';
        this.statusBadgeEl.className = 'surg-status-badge status-danger';
        this.caliperTextEl.textContent = `EMG: ${neurectomyState.facialEMGVoltageMicroVolts.toFixed(0)} μV (WARNING)`;
      } else if (neurectomyState.tractionRisk === 'WARNING') {
        this.statusBadgeEl.textContent = 'ABR DELAY';
        this.statusBadgeEl.className = 'surg-status-badge status-warning';
        this.caliperTextEl.textContent = `Wave V: ${neurectomyState.abrWaveVLatencyMs.toFixed(2)} ms`;
      } else {
        this.statusBadgeEl.textContent = 'CLEAVAGE SAFE';
        this.statusBadgeEl.className = 'surg-status-badge status-safe';
        this.caliperTextEl.textContent = `Wave V: ${neurectomyState.abrWaveVLatencyMs.toFixed(2)} ms · EMG: ${neurectomyState.facialEMGVoltageMicroVolts.toFixed(0)} μV`;
      }

      this.plotLegendEl.innerHTML = `
        <span class="leg-item"><span class="dot dot-lime"></span> ABR Lead</span>
        <span class="leg-item"><span class="dot dot-amber"></span> CN VII EMG</span>
      `;
    }
  }

  private startRenderLoop(): void {
    if (this.animationFrameId !== null) return;
    const loop = (timestamp: number) => {
      if (!this.isOpen) {
        this.animationFrameId = null;
        this.lastFrameTime = 0;
        return;
      }
      const rawDt = (timestamp - this.lastFrameTime) * 0.001;
      const dt = this.lastFrameTime > 0 && rawDt > 0 ? Math.min(rawDt, 0.1) : 0.016;
      this.lastFrameTime = timestamp;
      this.simTime += dt;
      this.renderFrame();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.lastFrameTime = performance.now();
    this.animationFrameId = requestAnimationFrame(loop);
  }

  private renderFrame(): void {
    if (!this.isOpen || !this.currentLabState) return;
    this.renderUpperMonitor();
    this.renderLowerPlot();
  }

  // ===========================================================================
  // UPPER MONITOR: 2D Endoscopic Cross-Section / Fundus Schematic
  // ===========================================================================
  private renderUpperMonitor(): void {
    const ctx = this.monitorCtx;
    if (!ctx) return;

    const w = SurgicalDrawer.LOGICAL_W;
    const h = SurgicalDrawer.MONITOR_LOGICAL_H;

    // Clear background
    ctx.fillStyle = '#060d13';
    ctx.fillRect(0, 0, w, h);

    // Subtle endoscopic vignetting & grid
    const grad = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(8, 20, 30, 0.6)');
    grad.addColorStop(1, 'rgba(3, 8, 12, 0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const { activeProcedure, ciState, labyState, neurectomyState } = this.currentLabState!;

    if (activeProcedure === 'cochlear_implant') {
      this.renderCIMonitor(ctx, w, h, ciState);
    } else if (activeProcedure === 'labyrinthectomy') {
      this.renderLabyMonitor(ctx, w, h, labyState);
    } else if (activeProcedure === 'neurectomy') {
      this.renderNeurectomyMonitor(ctx, w, h, neurectomyState);
    }
  }

  private renderCIMonitor(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    ciState: NonNullable<SurgicalLabState['ciState']>
  ): void {
    const cx = w / 2;
    const cy = h / 2 + 10;

    // Draw Scala Tympani Cross-Section Outline
    ctx.save();
    ctx.beginPath();
    // Lumen boundaries: Basilar membrane ceiling (top), lateral wall (right), floor (bottom), modiolus (left)
    ctx.moveTo(cx - 90, cy - 40); // Modiolar crest
    ctx.lineTo(cx + 80, cy - 40); // Basilar Membrane ceiling
    ctx.quadraticCurveTo(cx + 110, cy + 10, cx + 70, cy + 50); // Lateral wall
    ctx.lineTo(cx - 60, cy + 50); // Bony floor
    ctx.quadraticCurveTo(cx - 100, cy + 10, cx - 90, cy - 40); // Modiolar wall
    ctx.closePath();

    ctx.fillStyle = 'rgba(15, 34, 48, 0.7)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    // Basilar Membrane Ceiling (Highlight line)
    ctx.beginPath();
    ctx.moveTo(cx - 90, cy - 40);
    ctx.lineTo(cx + 80, cy - 40);
    ctx.lineWidth = 3.0;
    ctx.strokeStyle = ciState.isRuptured ? '#ef4444' : '#34d399';
    ctx.stroke();

    // Ceiling label
    ctx.font = '9px monospace';
    ctx.fillStyle = ciState.isRuptured ? '#f87171' : '#6ee7b7';
    ctx.fillText('BASILAR MEMBRANE (SCALA MEDIA)', cx - 75, cy - 48);

    // Lateral wall label
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('LATERAL WALL', cx + 45, cy + 65);

    // Modiolus wall label
    ctx.fillText('MODIOLUS', cx - 110, cy + 20);

    // Calculate tip circle position inside lumen
    // Normal resting center is at (cx, cy + 10)
    // d_BM reduces as tip moves UP toward ceiling (cy - 40)
    const ceilingY = cy - 40;
    const floorY = cy + 45;
    const normDist = Math.max(0.05, Math.min(0.45, ciState.distanceToBasilarMembraneMm)) / 0.45;
    const tipY = ceilingY + normDist * (floorY - ceilingY);

    // Perimodiolar offsets left (towards modiolus cx - 40), lateral wall sits right (cx + 35)
    let tipX = cx + 25;
    if (ciState.arrayType === 'perimodiolar' && ciState.insertionDepthMm > 9.5) {
      tipX = cx - 35;
    }

    // Draw Electrode Array Tip Circle
    ctx.beginPath();
    ctx.arc(tipX, tipY, 12, 0, Math.PI * 2);
    ctx.fillStyle = ciState.isRuptured
      ? '#ef4444'
      : ciState.translocationRisk === 'caution'
      ? '#f59e0b'
      : '#38bdf8';
    ctx.fill();
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Platinum core dot
    ctx.beginPath();
    ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Basilar Membrane Distance Caliper (Vertical measurement line with arrows)
    ctx.beginPath();
    ctx.setLineDash([3, 2]);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX, ceilingY);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = ciState.isRuptured
      ? '#ef4444'
      : ciState.translocationRisk === 'caution'
      ? '#f59e0b'
      : '#10b981';
    ctx.stroke();
    ctx.setLineDash([]);

    // Caliper label tag
    const caliperY = (tipY + ceilingY) / 2;
    const tagX = Math.min(w - 134, tipX + 8);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(tagX, caliperY - 8, 126, 16);
    ctx.font = '10px monospace';
    ctx.fillStyle = ciState.isRuptured ? '#f87171' : '#34d399';
    ctx.fillText(`BM Clear: ${ciState.distanceToBasilarMembraneMm.toFixed(2)}mm`, tagX + 4, caliperY + 4);

    // Rupture flashing alarm text if breached
    if (ciState.isRuptured) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.fillRect(cx - 140, cy - 15, 280, 30);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 140, cy - 15, 280, 30);

      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ BASILAR MEMBRANE RUPTURED INTO SV', cx, cy + 4);
      ctx.textAlign = 'start';
    }

    ctx.restore();
  }

  private renderLabyMonitor(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    labyState: NonNullable<SurgicalLabState['labyState']>
  ): void {
    const cx = w / 2;
    const cy = h / 2 + 5;

    ctx.save();
    // Otic capsule bone outline
    ctx.fillStyle = 'rgba(20, 30, 40, 0.8)';
    ctx.beginPath();
    ctx.arc(cx, cy, 75, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Semicircular canal lumen cutaway (Horizontal canal unroofing)
    ctx.beginPath();
    ctx.arc(cx, cy, 45, -0.3, Math.PI + 0.3);
    ctx.lineWidth = 14;
    ctx.strokeStyle = labyState.canalsMilled.horizontal ? 'rgba(56, 189, 248, 0.25)' : '#0284c7';
    ctx.stroke();

    // High-speed diamond drill burr
    if (labyState.isDrillActive || labyState.step < 3) {
      const burrAngle = this.simTime * 20.0;
      const burrX = cx + 25;
      const burrY = cy - 25;

      // Burr shaft
      ctx.beginPath();
      ctx.moveTo(burrX + 45, burrY - 45);
      ctx.lineTo(burrX, burrY);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#94a3b8';
      ctx.stroke();

      // Burr sphere
      ctx.beginPath();
      ctx.arc(burrX, burrY, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#f1f5f9';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();

      // Irrigation spray droplets
      ctx.fillStyle = '#38bdf8';
      for (let i = 0; i < 6; i++) {
        const dropX = burrX - 8 + Math.sin(burrAngle + i * 1.2) * 14;
        const dropY = burrY + 8 + Math.cos(burrAngle + i * 1.5) * 12;
        ctx.beginPath();
        ctx.arc(dropX, dropY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Step status banners
    ctx.font = '10px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('OTIC CAPSULE BONE', cx - 60, cy - 82);
    ctx.fillText(
      labyState.neuroepitheliumAblated
        ? 'STATUS: NEUROEPITHELIUM CURETTED (0 sp/s)'
        : `DRILL: ${labyState.isDrillActive ? '70,000 RPM · ACTIVE' : 'STANDBY'}`,
      cx - 95,
      cy + 92
    );

    ctx.restore();
  }

  private renderNeurectomyMonitor(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    neurectomyState: NonNullable<SurgicalLabState['neurectomyState']>
  ): void {
    const cx = w / 2;
    const cy = h / 2 + 5;
    const r = 68;

    ctx.save();
    // IAC Fundus outer bony border
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 24, 34, 0.85)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    // 1. Falciform Crest (Transverse Crista) dividing Superior (+Z) and Inferior (-Z)
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    // 2. Bill's Bar (Vertical Crista) dividing Superior half into Anterior and Posterior
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    // Quadrant Nerve Bundles
    // Anterosuperior: Facial Nerve (CN VII)
    ctx.beginPath();
    ctx.arc(cx - 30, cy - 30, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.font = 'bold 8.5px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('VII Motor', cx - 42, cy - 27);

    // Posterosuperior: Superior Vestibular Nerve (SVN of CN VIII)
    ctx.beginPath();
    ctx.arc(cx + 30, cy - 30, 14, 0, Math.PI * 2);
    ctx.fillStyle = neurectomyState.vestibularNerveTransected ? '#ef4444' : '#60a5fa';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(neurectomyState.vestibularNerveTransected ? 'VIII Cut' : 'VIII SVN', cx + 14, cy - 27);

    // Anteroinferior: Cochlear Nerve (CN VIII cochlear)
    ctx.beginPath();
    ctx.arc(cx - 30, cy + 30, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#34d399'; // Green = preserved!
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillText('VIII Coch', cx - 44, cy + 33);

    // Posteroinferior: Inferior Vestibular Nerve (IVN of CN VIII)
    ctx.beginPath();
    ctx.arc(cx + 30, cy + 30, 14, 0, Math.PI * 2);
    ctx.fillStyle = neurectomyState.vestibularNerveTransected ? '#ef4444' : '#60a5fa';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(neurectomyState.vestibularNerveTransected ? 'VIII Cut' : 'VIII IVN', cx + 14, cy + 33);

    // Cleavage plane dissection line
    if (neurectomyState.cleavagePlaneVisible) {
      ctx.beginPath();
      ctx.setLineDash([4, 3]);
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx, cy + r);
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = '#f43f5e';
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Anatomical orientation markers
    ctx.font = '8px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('SUPERIOR (Bill\'s Bar)', cx - 45, cy - r - 4);
    ctx.fillText('ANTERIOR', cx - r - 22, cy + 3);
    ctx.fillText('POSTERIOR', cx + r + 5, cy + 3);

    // Educational Mnemonic: "7-up, Coke down"
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('"7-up, Coke down": VII Sup-Ant · Coch Inf-Ant · Vestibular Post', 10, h - 6);

    ctx.restore();
  }

  // ===========================================================================
  // LOWER PLOT: Insertion Force Curve / Nystagmogram / ABR-EMG
  // ===========================================================================
  private renderLowerPlot(): void {
    const ctx = this.plotCtx;
    if (!ctx) return;

    const w = SurgicalDrawer.LOGICAL_W;
    const h = SurgicalDrawer.PLOT_LOGICAL_H;

    ctx.fillStyle = '#050a0f';
    ctx.fillRect(0, 0, w, h);

    const { activeProcedure, ciState, labyState, neurectomyState } = this.currentLabState!;

    if (activeProcedure === 'cochlear_implant') {
      this.renderCIPlot(ctx, w, h, ciState);
    } else if (activeProcedure === 'labyrinthectomy') {
      this.renderLabyPlot(ctx, w, h, labyState);
    } else if (activeProcedure === 'neurectomy') {
      this.renderNeurectomyPlot(ctx, w, h, neurectomyState);
    }
  }

  private renderCIPlot(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    ciState: NonNullable<SurgicalLabState['ciState']>
  ): void {
    const padL = 36;
    const padR = 12;
    const padT = 12;
    const padB = 24;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    ctx.save();
    // Grid lines for Force (0, 15, 30 mN)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let f = 0; f <= 35; f += 15) {
      const y = padT + plotH - (f / 35) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();

      ctx.font = '8px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${f}mN`, 6, y + 3);
    }

    // 15 mN Safe Ceiling (Green dashed)
    const safeY = padT + plotH - (15 / 35) * plotH;
    ctx.beginPath();
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
    ctx.moveTo(padL, safeY);
    ctx.lineTo(padL + plotW, safeY);
    ctx.stroke();

    // 30 mN Rupture Threshold (Red dashed)
    const ruptureY = padT + plotH - (30 / 35) * plotH;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.moveTo(padL, ruptureY);
    ctx.lineTo(padL + plotW, ruptureY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Curve of F_ins up to current insertion depth
    const curDepth = ciState.insertionDepthMm;
    const maxDepth = 28.0;

    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH);
    for (let s = 0; s <= curDepth; s += 0.5) {
      const x = padL + (s / maxDepth) * plotW;
      // Recompute normalized historical force
      const fBase = 1.5 + 0.32 * s + 0.0075 * s * s;
      const totalF = Math.min(35, fBase * (ciState.insertionForceMilliNewtons / (1.5 + 0.32 * curDepth + 0.0075 * curDepth * curDepth || 1)));
      const y = padT + plotH - (totalF / 35) * plotH;
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = ciState.isRuptured
      ? '#ef4444'
      : ciState.translocationRisk === 'caution'
      ? '#f59e0b'
      : '#38bdf8';
    ctx.stroke();

    // Current point dot
    const curX = padL + (curDepth / maxDepth) * plotW;
    const curY = padT + plotH - (Math.min(35, ciState.insertionForceMilliNewtons) / 35) * plotH;
    ctx.beginPath();
    ctx.arc(curX, curY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // 22 Mini Greenwood Channel Bars along bottom axis (E1 apical violet -> E22 basal red)
    const barW = plotW / 22;
    for (let i = 0; i < 22; i++) {
      const bx = padL + i * barW;
      const by = padT + plotH + 6;
      const normX = Math.max(0.0, Math.min(1.0, i / 21));
      const color = getGreenwoodColor(normX);
      ctx.fillStyle = `#${color.getHexString()}`;
      ctx.fillRect(bx, by, barW - 1, 5);
    }

    ctx.restore();
  }

  private renderLabyPlot(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    labyState: NonNullable<SurgicalLabState['labyState']>
  ): void {
    ctx.save();
    const midY = h / 2;

    // Zero baseline
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, midY);
    ctx.lineTo(w - 10, midY);
    ctx.stroke();

    if (labyState.spontaneousSPVDegSec > 0.5) {
      // Sawtooth wave beating Left (contralateral)
      const spv = labyState.spontaneousSPVDegSec;
      const period = Math.max(16, 60 - spv * 0.8);
      const amp = Math.min(35, spv * 0.95);

      ctx.beginPath();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;

      let first = true;
      for (let x = 10; x < w - 10; x++) {
        const phase = ((x + this.simTime * 80.0) % period) / period;
        // Sawtooth: linear slow drift upward, instant fast reset downward
        const y = midY - (phase - 0.5) * amp;
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      ctx.font = '9px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`SPV = ${spv.toFixed(1)}°/s (${labyState.nystagmusBeatDirection})`, 14, 18);
    } else {
      ctx.font = '10px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Resting Tonic Equilibrium (SPV = 0.0°/s)', 30, midY + 4);
    }

    ctx.restore();
  }

  private renderNeurectomyPlot(
    ctx: CanvasRenderingContext2D,
    w: number,
    _h: number,
    neurectomyState: NonNullable<SurgicalLabState['neurectomyState']>
  ): void {
    ctx.save();

    // Lead 1: ABR Wave V Trace (Top half - Auditory / CN VIII preservation)
    const abrY = 28;
    ctx.font = '8px monospace';
    ctx.fillStyle = '#4ade80';
    ctx.fillText(`LEAD 1: CN VIII / Brainstem ABR Wave V (${neurectomyState.abrWaveVLatencyMs.toFixed(2)} ms)`, 10, 14);

    ctx.beginPath();
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.5;
    for (let x = 10; x < w - 10; x++) {
      const tMs = ((x - 10) / (w - 20)) * 10.0;
      // Synthetic Waves I–V
      const wave1 = 4.0 * Math.exp(-Math.pow((tMs - 1.6) / 0.25, 2));
      const wave3 = 6.0 * Math.exp(-Math.pow((tMs - 3.7) / 0.35, 2));
      const waveV = 10.0 * Math.exp(-Math.pow((tMs - neurectomyState.abrWaveVLatencyMs) / 0.45, 2));
      const y = abrY - (wave1 + wave3 + waveV) * (neurectomyState.abrWaveVAmplitudeMicroVolts / 0.55);
      if (x === 10) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Lead 2: Facial Nerve EMG Trace (Bottom half - CN VII motor preservation)
    const emgY = 85;
    ctx.font = '8px monospace';
    ctx.fillStyle = neurectomyState.isEMGAlarmActive ? '#f87171' : '#fbbf24';
    ctx.fillText(`LEAD 2: CN VII Facial Nerve EMG (${neurectomyState.facialEMGVoltageMicroVolts.toFixed(0)}μV)`, 10, 68);

    ctx.beginPath();
    ctx.strokeStyle = neurectomyState.isEMGAlarmActive ? '#ef4444' : '#fbbf24';
    ctx.lineWidth = 1.4;
    for (let x = 10; x < w - 10; x++) {
      let noise = (Math.sin(x * 0.45 + this.simTime * 20.0) + Math.cos(x * 1.2)) * 1.5;
      if (neurectomyState.facialEMGVoltageMicroVolts > 100.0) {
        noise += (Math.sin(x * 0.9 + this.simTime * 50.0) * neurectomyState.facialEMGVoltageMicroVolts) / 35.0;
      }
      const y = emgY + Math.max(-18, Math.min(18, noise));
      if (x === 10) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.restore();
  }

  public dispose(): void {
    this.isOpen = false;
    this.lastFrameTime = 0;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.rootEl.remove();
  }
}
