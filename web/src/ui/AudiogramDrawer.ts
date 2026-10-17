/**
 * Clinical Pure-Tone Air-Conduction Audiogram Drawer
 *
 * Implements the standard otologic pure-tone audiogram (-10 to 120 dB HL, 125 to 8000 Hz)
 * adhering to the Right Ear clinical convention (Red Circles ○ with solid red lines).
 * Features 4 clinical presets (Normal, Presbycusis, 4 kHz Noise Notch, Ménière's),
 * real-time frequency cursor tracking, Speech Banana phoneme overlay, and bi-directional 3D linking.
 */

export interface AudiogramPreset {
  id: string;
  title: string;
  shortLabel: string;
  subtitle: string;
  thresholds: Record<number, number>; // freqHz -> dB HL
  lossSector: [number, number] | null; // [xMin, xMax] on 3D cochlea
  description: string;
}

export const AUDIOGRAM_FREQUENCIES = [125, 250, 500, 1000, 2000, 4000, 8000];

export const AUDIOGRAM_PRESETS: Record<string, AudiogramPreset> = {
  normal: {
    id: 'normal',
    title: 'Normal Hearing',
    shortLabel: 'Normal',
    subtitle: 'Pristine air conduction (≤ 15 dB HL)',
    thresholds: { 125: 10, 250: 10, 500: 10, 1000: 15, 2000: 10, 4000: 15, 8000: 10 },
    lossSector: null,
    description: 'Auditory thresholds sit comfortably within normal physiological limits across all conversational octaves.',
  },
  presbycusis: {
    id: 'presbycusis',
    title: 'Presbycusis (High Loss)',
    shortLabel: 'Presbycusis',
    subtitle: 'Age-related high-frequency downslope',
    thresholds: { 125: 15, 250: 15, 500: 20, 1000: 30, 2000: 50, 4000: 70, 8000: 85 },
    lossSector: [0.55, 1.0], // >2 kHz, basal turn
    description: 'Symmetrical sensorineural high-frequency rolloff driven by outer hair cell death at the basal turn and stria vascularis atrophy.',
  },
  noise_notch: {
    id: 'noise_notch',
    title: '4 kHz Noise Notch',
    shortLabel: '4 kHz Notch',
    subtitle: 'Acoustic trauma dip at 8–10 mm locus',
    thresholds: { 125: 10, 250: 15, 500: 15, 1000: 20, 2000: 35, 4000: 65, 8000: 25 },
    lossSector: [0.62, 0.76], // 3–6 kHz, 4 kHz notch
    description: 'Pathognomonic V-shaped notch at 4 kHz with recovery at 8 kHz caused by outer hair cell stereocilia shearing from intense noise exposure.',
  },
  meniere: {
    id: 'meniere',
    title: "Ménière's (Low Loss)",
    shortLabel: 'Ménière',
    subtitle: 'Apical endolymphatic hydrops (< 1 kHz)',
    thresholds: { 125: 55, 250: 50, 500: 45, 1000: 35, 2000: 20, 4000: 15, 8000: 15 },
    lossSector: [0.0, 0.35], // < 1 kHz, apical turn
    description: 'Fluctuating low-frequency threshold shift at the compliant apex caused by endolymphatic hydrops pressure and Reissner’s membrane distension.',
  },
  scds: {
    id: 'scds',
    title: 'SSCD Third Window',
    shortLabel: 'SSCD',
    subtitle: 'Low-frequency pseudo-conductive air-bone gap',
    thresholds: { 125: 35, 250: 30, 500: 20, 1000: 15, 2000: 10, 4000: 10, 8000: 10 },
    lossSector: [0.0, 0.25], // < 1 kHz, acoustic energy leakage
    description: 'Third-window acoustic energy leakage causes low-frequency conductive loss on air conduction (25–30 dB HL at 250 Hz) while bone conduction remains supranormal (-5 to 0 dB HL).',
  },
};

export class AudiogramDrawer {
  private container: HTMLElement;
  private rootEl: HTMLElement;
  private activePresetId = 'normal';
  private currentThresholds: Record<number, number> = { ...AUDIOGRAM_PRESETS.normal.thresholds };
  private showSpeechBanana = true;
  private activeFrequency = 1000;
  private isOpen = false;

  private onPresetChangeCallbacks: Array<(presetId: string, lossSector: [number, number] | null) => void> = [];
  private onFrequencySelectCallbacks: Array<(freqHz: number) => void> = [];
  private onCloseCallbacks: Array<() => void> = [];

  // SVG Dimension Constants
  private static readonly SVG_W = 460;
  private static readonly SVG_H = 320;
  private static readonly PAD_L = 50;
  private static readonly PAD_R = 25;
  private static readonly PAD_T = 35;
  private static readonly PAD_B = 35;

  constructor(container: HTMLElement) {
    this.container = container;
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'audiogram-drawer';
    this.rootEl.id = 'audiogram-drawer';
    this.rootEl.setAttribute('role', 'region');
    this.rootEl.setAttribute('aria-label', 'Clinical Pure-Tone Audiogram');
    this.container.appendChild(this.rootEl);

    this.render();
  }

  public open(): void {
    this.isOpen = true;
    this.rootEl.classList.add('open');
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
      return false;
    } else {
      this.open();
      return true;
    }
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }

  public setActivePreset(presetId: string): void {
    if (!AUDIOGRAM_PRESETS[presetId]) return;
    this.activePresetId = presetId;
    this.currentThresholds = { ...AUDIOGRAM_PRESETS[presetId].thresholds };
    this.render();

    const preset = AUDIOGRAM_PRESETS[presetId];
    for (const cb of this.onPresetChangeCallbacks) {
      cb(presetId, preset.lossSector);
    }
  }

  public setActiveFrequency(freqHz: number): void {
    this.activeFrequency = freqHz;
    this.updateFrequencyCursor();
  }

  public onPresetChange(cb: (presetId: string, lossSector: [number, number] | null) => void): void {
    this.onPresetChangeCallbacks.push(cb);
  }

  public onFrequencySelect(cb: (freqHz: number) => void): void {
    this.onFrequencySelectCallbacks.push(cb);
  }

  public onClose(cb: () => void): void {
    this.onCloseCallbacks.push(cb);
  }

  // Coordinate Conversion Helpers
  private freqToX(freq: number): number {
    const minF = 125;
    const maxF = 8000;
    const t = (Math.log2(freq) - Math.log2(minF)) / (Math.log2(maxF) - Math.log2(minF));
    const plotW = AudiogramDrawer.SVG_W - AudiogramDrawer.PAD_L - AudiogramDrawer.PAD_R;
    return AudiogramDrawer.PAD_L + t * plotW;
  }

  private dbToY(db: number): number {
    const minDb = -10;
    const maxDb = 120;
    const t = (db - minDb) / (maxDb - minDb);
    const plotH = AudiogramDrawer.SVG_H - AudiogramDrawer.PAD_T - AudiogramDrawer.PAD_B;
    return AudiogramDrawer.PAD_T + t * plotH;
  }

  private render(): void {
    const activePreset = AUDIOGRAM_PRESETS[this.activePresetId];

    this.rootEl.innerHTML = `
      <div class="audiogram-panel">
        <!-- Drawer Header -->
        <div class="audiogram-header">
          <div class="audiogram-title-group">
            <span class="clinical-badge">RIGHT EAR (AD)</span>
            <h3 class="audiogram-title">Pure-Tone Audiogram</h3>
          </div>
          <div class="audiogram-header-actions">
            <button
              type="button"
              class="speech-banana-toggle ${this.showSpeechBanana ? 'active' : ''}"
              id="speech-banana-btn"
              title="Toggle Speech Banana Overlay"
            >
              🍌 Speech Banana
            </button>
            <button
              type="button"
              class="drawer-close-btn"
              id="audiogram-close-btn"
              aria-label="Close audiogram"
            >✕</button>
          </div>
        </div>

        <!-- 4 Authoritative Clinical Presets -->
        <div class="audiogram-presets-row" role="group" aria-label="Audiogram Clinical Presets">
          ${Object.values(AUDIOGRAM_PRESETS)
            .map(
              (p) => `
            <button
              type="button"
              class="audio-preset-btn ${this.activePresetId === p.id ? 'active' : ''}"
              data-preset-id="${p.id}"
            >
              <span class="preset-title">${p.shortLabel}</span>
            </button>
          `
            )
            .join('')}
        </div>

        <!-- SVG Clinical Audiogram Graph -->
        <div class="audiogram-svg-wrap">
          ${this.renderSVG()}
        </div>

        <!-- Clinical Diagnosis Legend & Summary -->
        <div class="audiogram-footer">
          <div class="preset-meta-info">
            <strong class="preset-meta-title">${activePreset.title}:</strong>
            <span class="preset-meta-desc">${activePreset.description}</span>
          </div>
          <div class="audiogram-conventions">
            <span class="legend-item"><span class="legend-sym red-circle">○</span> Right Ear Air Conduction</span>
            <span class="legend-item"><span class="legend-swatch normal-swatch"></span> Normal (0–20 dB)</span>
            <span class="legend-item"><span class="legend-swatch speech-swatch"></span> Speech Banana</span>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private renderSVG(): string {
    const W = AudiogramDrawer.SVG_W;
    const H = AudiogramDrawer.SVG_H;
    const padL = AudiogramDrawer.PAD_L;
    const padR = AudiogramDrawer.PAD_R;
    const padT = AudiogramDrawer.PAD_T;
    const padB = AudiogramDrawer.PAD_B;
    const plotW = W - padL - padR;

    // Severity Zones Background Shading
    // Normal: -10 to 20 dB HL
    const yNormTop = this.dbToY(-10);
    const yNormBot = this.dbToY(20);
    const yMildBot = this.dbToY(40);
    const yModBot = this.dbToY(70);
    const ySevBot = this.dbToY(90);
    const yProfBot = this.dbToY(120);

    // Speech Banana Area Coordinates
    // Typically 250 Hz (35-50 dB) to 4000 Hz (20-35 dB)
    const sbP1 = `${this.freqToX(250)},${this.dbToY(35)}`;
    const sbP2 = `${this.freqToX(500)},${this.dbToY(25)}`;
    const sbP3 = `${this.freqToX(1000)},${this.dbToY(20)}`;
    const sbP4 = `${this.freqToX(2000)},${this.dbToY(20)}`;
    const sbP5 = `${this.freqToX(4000)},${this.dbToY(25)}`;
    const sbP6 = `${this.freqToX(4000)},${this.dbToY(40)}`;
    const sbP7 = `${this.freqToX(2000)},${this.dbToY(50)}`;
    const sbP8 = `${this.freqToX(1000)},${this.dbToY(55)}`;
    const sbP9 = `${this.freqToX(500)},${this.dbToY(55)}`;
    const sbP10 = `${this.freqToX(250)},${this.dbToY(50)}`;
    const speechBananaPath = `M ${sbP1} L ${sbP2} L ${sbP3} L ${sbP4} L ${sbP5} L ${sbP6} L ${sbP7} L ${sbP8} L ${sbP9} L ${sbP10} Z`;

    // Active Threshold Curve Points
    const pts = AUDIOGRAM_FREQUENCIES.map((f) => {
      const db = this.currentThresholds[f] ?? 15;
      return { f, x: this.freqToX(f), y: this.dbToY(db), db };
    });
    const polylinePts = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    // Active Frequency Cursor Line
    const clampedActiveF = Math.max(125, Math.min(8000, this.activeFrequency));
    const cursorX = this.freqToX(clampedActiveF);

    return `
      <svg
        viewBox="0 0 ${W} ${H}"
        class="audiogram-svg"
        id="audiogram-svg-canvas"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="bananaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ffd54f" stop-opacity="0.22" />
            <stop offset="100%" stop-color="#ffb300" stop-opacity="0.28" />
          </linearGradient>
          <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <!-- Clinical Severity Shading Bands -->
        <!-- Normal Zone (-10 to 20 dB) -->
        <rect x="${padL}" y="${yNormTop}" width="${plotW}" height="${yNormBot - yNormTop}" fill="rgba(82, 220, 242, 0.05)" />
        <!-- Mild Zone (20 to 40 dB) -->
        <rect x="${padL}" y="${yNormBot}" width="${plotW}" height="${yMildBot - yNormBot}" fill="rgba(240, 170, 98, 0.03)" />
        <!-- Moderate Zone (40 to 70 dB) -->
        <rect x="${padL}" y="${yMildBot}" width="${plotW}" height="${yModBot - yMildBot}" fill="rgba(240, 170, 98, 0.06)" />
        <!-- Severe Zone (70 to 90 dB) -->
        <rect x="${padL}" y="${yModBot}" width="${plotW}" height="${ySevBot - yModBot}" fill="rgba(235, 87, 87, 0.07)" />
        <!-- Profound Zone (90 to 120 dB) -->
        <rect x="${padL}" y="${ySevBot}" width="${plotW}" height="${yProfBot - ySevBot}" fill="rgba(235, 87, 87, 0.12)" />

        <!-- Speech Banana Overlay -->
        ${
          this.showSpeechBanana
            ? `
          <path d="${speechBananaPath}" fill="url(#bananaGrad)" stroke="#f0aa62" stroke-width="1.2" stroke-dasharray="3 3" />
          <!-- Phoneme markers inside banana -->
          <text x="${this.freqToX(300)}" y="${this.dbToY(44)}" class="phoneme-label">u, o</text>
          <text x="${this.freqToX(650)}" y="${this.dbToY(40)}" class="phoneme-label">a, m, d</text>
          <text x="${this.freqToX(1800)}" y="${this.dbToY(32)}" class="phoneme-label">sh, ch</text>
          <text x="${this.freqToX(3500)}" y="${this.dbToY(28)}" class="phoneme-label">s, f, th</text>
        `
            : ''
        }

        <!-- Horizontal dB Grid Lines -->
        ${[-10, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]
          .map((db) => {
            const y = this.dbToY(db);
            const isZero = db === 0;
            const isNormLimit = db === 20;
            const strokeColor = isNormLimit
              ? 'rgba(82, 220, 242, 0.45)'
              : isZero
                ? 'rgba(255, 255, 255, 0.35)'
                : 'rgba(255, 255, 255, 0.10)';
            const strokeW = isNormLimit || isZero ? 1.2 : 0.7;
            return `
            <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${strokeColor}" stroke-width="${strokeW}" />
            <text x="${padL - 8}" y="${y + 3.5}" class="axis-label-y" text-anchor="end">${db}</text>
          `;
          })
          .join('')}

        <!-- Vertical Frequency Octave Grid Lines -->
        ${AUDIOGRAM_FREQUENCIES.map((f) => {
          const x = this.freqToX(f);
          const fLabel = f >= 1000 ? `${f / 1000}k` : `${f}`;
          return `
            <line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="rgba(255, 255, 255, 0.12)" stroke-width="0.8" />
            <text x="${x}" y="${padT - 12}" class="axis-label-x" text-anchor="middle">${fLabel}</text>
            <!-- Clickable Frequency Column Hit Area -->
            <rect
              x="${x - 14}"
              y="${padT}"
              width="28"
              height="${H - padT - padB}"
              fill="transparent"
              class="freq-column-hit"
              data-freq="${f}"
            />
          `;
        }).join('')}

        <!-- Axis Titles -->
        <text x="${W / 2}" y="${padT - 24}" class="axis-title" text-anchor="middle">Frequency (Hz)</text>
        <text x="14" y="${H / 2}" class="axis-title axis-title-y" text-anchor="middle" transform="rotate(-90 14 ${H / 2})">Hearing Level (dB HL)</text>

        <!-- Active Playback Frequency Cursor Line -->
        <line
          id="audiogram-cursor-line"
          x1="${cursorX}"
          y1="${padT}"
          x2="${cursorX}"
          y2="${H - padB}"
          stroke="#52dcf2"
          stroke-width="1.8"
          stroke-dasharray="4 3"
        />

        <!-- Right Ear Threshold Connecting Line (Solid Red) -->
        <polyline
          points="${polylinePts}"
          fill="none"
          stroke="#eb5757"
          stroke-width="2.4"
          filter="url(#glowRed)"
        />

        <!-- Right Ear Threshold Nodes: Red Circles ○ -->
        ${pts
          .map(
            (p) => `
          <g class="audiogram-node" data-freq="${p.f}" data-db="${p.db}" transform="translate(${p.x}, ${p.y})">
            <circle r="7.5" fill="none" stroke="#eb5757" stroke-width="2.5" />
            <circle r="2.5" fill="#eb5757" />
          </g>
        `
          )
          .join('')}
      </svg>
    `;
  }

  private updateFrequencyCursor(): void {
    const cursorLine = this.rootEl.querySelector('#audiogram-cursor-line') as SVGLineElement | null;
    if (cursorLine) {
      const clampedActiveF = Math.max(125, Math.min(8000, this.activeFrequency));
      const cursorX = this.freqToX(clampedActiveF);
      cursorLine.setAttribute('x1', cursorX.toFixed(1));
      cursorLine.setAttribute('x2', cursorX.toFixed(1));
    }
  }

  private attachEvents(): void {
    // Close Button
    const closeBtn = this.rootEl.querySelector('#audiogram-close-btn') as HTMLButtonElement | null;
    closeBtn?.addEventListener('click', () => {
      this.close();
    });

    // Speech Banana Toggle
    const bananaBtn = this.rootEl.querySelector('#speech-banana-btn') as HTMLButtonElement | null;
    bananaBtn?.addEventListener('click', () => {
      this.showSpeechBanana = !this.showSpeechBanana;
      this.render();
    });

    // Preset Selection Buttons
    const presetBtns = this.rootEl.querySelectorAll<HTMLButtonElement>('.audio-preset-btn');
    presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-preset-id');
        if (id) {
          this.setActivePreset(id);
        }
      });
    });

    // Clickable frequency nodes and columns
    const hits = this.rootEl.querySelectorAll<SVGElement>('.freq-column-hit, .audiogram-node');
    hits.forEach((el) => {
      el.addEventListener('click', () => {
        const freqStr = el.getAttribute('data-freq');
        if (freqStr) {
          const f = parseInt(freqStr, 10);
          this.activeFrequency = f;
          this.updateFrequencyCursor();
          for (const cb of this.onFrequencySelectCallbacks) {
            cb(f);
          }
        }
      });
    });
  }
}
