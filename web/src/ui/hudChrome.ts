import type { StructureOntologyItem } from '../data/ontology';
import type { LabMode, LabelDensityMode, ReadingDepth } from '../render/DualStageScene';

export type ThemePreference = 'system' | 'light' | 'dark';
export type NoteState = 'collapsed' | 'compact' | 'expanded';
export type SidebarTab = 'note' | 'lab';

export const THEME_STORAGE_KEY = 'ie3d-color-scheme';

export const MODE_LABELS: Record<LabMode, string> = {
  anatomy: 'Anatomy Atlas',
  hearing: 'Hearing & Tonotopy',
  radiology: 'Virtual Radiology',
  vestibular: 'Vestibular & VOR',
  surgical: 'Surgical Suites',
};

export const MODE_LAB_TAB_LABELS: Record<LabMode, string> = {
  anatomy: 'Parts',
  hearing: 'Audiogram',
  radiology: 'CT MPR',
  vestibular: 'VOR Lab',
  surgical: 'Monitor',
};

export const SVG_ICONS = {
  anatomy: `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 6.5a5.5 5.5 0 1 1-4.7 8.3" /><circle cx="12" cy="12" r="2.2" /></svg>`,
  hearing: `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13h2.5l2-5 3 9 3-11 2.5 7H21" /></svg>`,
  radiology: `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 12h16M12 4v16" /><circle cx="12" cy="12" r="3.5" /></svg>`,
  vestibular: `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 1 0 7.4 11" /><path d="M15.5 3.8 19.5 4.8 18.5 8.8" /><circle cx="12" cy="12" r="2.3" /></svg>`,
  surgical: `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5 13 11m0 0 4.5-4.5a2.1 2.1 0 1 1 3 3L16 14l-3-3Z" /><circle cx="7" cy="7" r="2.2" /></svg>`,
  search: `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>`,
  close: `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>`,
  report: `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h7l4 4v12H7z" /><path d="M14 4v4h4M10 12h5M10 16h5" /></svg>`,
  sun: `<svg class="ui-icon icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.3M12 19.2v2.3M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.5 12h2.3M19.2 12h2.3M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" /></svg>`,
  moon: `<svg class="ui-icon icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" /></svg>`,
  settings: `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="var(--bg-surface-solid)" /><circle cx="15" cy="12" r="2" fill="var(--bg-surface-solid)" /><circle cx="10" cy="17" r="2" fill="var(--bg-surface-solid)" /></svg>`,
  expand: `<svg class="ui-icon icon-expand" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h5v5M20 4l-6 6M9 20H4v-5M4 20l6-6" /></svg>`,
  shrink: `<svg class="ui-icon icon-shrink" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14h6v6M4 20l6-6M20 10h-6V4M20 4l-6 6" /></svg>`,
  collapse: `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>`,
  labels: `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="7.5" cy="12" r="2.2" /><path d="M11 8h8M11 12h8M11 16h6" /></svg>`,
  reset: `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.5-5.8L4 8.7" /><path d="M4 4.5v4.2h4.2" /></svg>`,
};

export function formatRAS(ras: [number, number, number]): string {
  const fmt = (n: number): string => (n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
  return `[${fmt(ras[0])}, ${fmt(ras[1])}, ${fmt(ras[2])}]`;
}

export function compactFluidLabel(fluid: string): string {
  const clean = fluid.replace(/\s*\([^)]*\)/g, '').trim();
  const segments = clean.split(',').map((s) => s.trim()).filter(Boolean);
  if (segments.length <= 1) return clean;
  const head = segments[0].split(' / ')[0].trim();
  return `${head} + ${segments.length - 1}`;
}

export function formatStructureHeadline(item: StructureOntologyItem): string {
  return item.displayName.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function getCompactNoteSentence(item: StructureOntologyItem): string {
  const raw = (item.patientSummary || '').trim();
  if (!raw) return item.latinName;
  const firstPeriod = raw.indexOf('. ');
  const first = firstPeriod !== -1 && firstPeriod < 105 ? raw.slice(0, firstPeriod + 1) : raw;
  return first.length <= 105 ? first : `${first.slice(0, 102).trimEnd()}...`;
}

export function getStructurePrimaryMetric(item: StructureOntologyItem): { label: string; value: string } {
  if (item.endocochlearPotential) {
    return {
      label: 'Potential',
      value: item.endocochlearPotential.split('(')[0].trim(),
    };
  }
  if (item.characteristicFrequencyRange) {
    return {
      label: 'Frequency Band',
      value: item.characteristicFrequencyRange.split('(')[0].trim(),
    };
  }
  const compactMorph = item.morphometry.split('(')[0].split(',')[0].split(';')[0].trim();
  return {
    label: 'Geometry',
    value: compactMorph.length <= 36 ? compactMorph : `${compactMorph.slice(0, 33).trimEnd()}...`,
  };
}

export function updateRangeProgress(input: HTMLInputElement | null): void {
  if (!input) return;
  const min = parseFloat(input.min || '0');
  const max = parseFloat(input.max || '100');
  const val = parseFloat(input.value || '0');
  const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
  input.style.setProperty('--slider-progress', `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`);
}

let displayTransitionSupported: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (displayTransitionSupported !== undefined) return displayTransitionSupported;
  if (typeof document === 'undefined') return false;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;display:none;transition:display 1s allow-discrete !important;';
  document.body.appendChild(probe);
  probe.offsetHeight;
  probe.style.display = 'block';
  displayTransitionSupported = getComputedStyle(probe).transitionProperty.includes('display');
  probe.remove();
  return displayTransitionSupported;
}

export function supportsTopLayerExit(): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
  return CSS.supports('overlay', 'auto') && canTransitionDisplay();
}

export function buildSettingsPopoverHTML(
  labelMode: LabelDensityMode,
  readingDepth: ReadingDepth
): string {
  return `
    <div id="settings-popover" popover="auto" class="settings-popover" role="dialog" aria-label="Display Settings">
      <div class="popover-header">
        <h2 class="popover-title">Display &amp; Atlas Options</h2>
        <button
          type="button"
          class="icon-close-btn"
          id="popover-close-btn"
          popovertarget="settings-popover"
          popovertargetaction="hide"
          aria-label="Close settings"
        >
          ${SVG_ICONS.close}
        </button>
      </div>

      <div class="popover-section">
        <span class="popover-label" id="appearance-heading">Appearance</span>
        <div class="segmented-control" role="group" aria-labelledby="appearance-heading">
          <button type="button" class="segment-btn active" data-theme-pref="system">System</button>
          <button type="button" class="segment-btn" data-theme-pref="light">Light</button>
          <button type="button" class="segment-btn" data-theme-pref="dark">Dark</button>
        </div>
        <p class="popover-hint" id="appearance-hint">Following system preference</p>
      </div>

      <div class="popover-section">
        <span class="popover-label" id="label-mode-heading">3D Part Labels</span>
        <div class="segmented-control" role="group" aria-labelledby="label-mode-heading">
          <button type="button" class="segment-btn ${labelMode === 'off' ? 'active' : ''}" data-label-mode="off">Off</button>
          <button type="button" class="segment-btn ${labelMode === 'key' ? 'active' : ''}" data-label-mode="key">Key</button>
          <button type="button" class="segment-btn ${labelMode === 'all' ? 'active' : ''}" data-label-mode="all">All</button>
        </div>
      </div>

      <div class="popover-section">
        <span class="popover-label" id="reading-depth-heading">Reading Style</span>
        <div class="segmented-control" role="group" aria-labelledby="reading-depth-heading">
          <button type="button" class="segment-btn ${readingDepth === 'simple' ? 'active' : ''}" data-reading-depth="simple">Patient</button>
          <button type="button" class="segment-btn ${readingDepth === 'detailed' ? 'active' : ''}" data-reading-depth="detailed">Clinical</button>
        </div>
      </div>

      <div class="popover-section popover-footer-action">
        <button type="button" class="secondary-action-btn" id="about-open-btn">
          ${SVG_ICONS.report}
          <span>Clinical Summary &amp; Citations</span>
        </button>
      </div>
    </div>
  `;
}

export function buildReportDialogHTML(): string {
  return `
    <dialog id="report-dialog" class="report-dialog" closedby="any" aria-labelledby="report-dialog-title">
      <div class="dialog-header">
        <div>
          <span class="brand-badge">IE-MAP v1.0.0</span>
          <h2 class="dialog-title" id="report-dialog-title" style="margin-top:6px;">Clinical Summary &amp; Stereotaxic Citations</h2>
        </div>
        <button type="button" class="icon-close-btn" id="about-close-btn" aria-label="Close report dialog">
          ${SVG_ICONS.close}
        </button>
      </div>

      <div class="dialog-body">
        <p class="dialog-lead">
          Educational &amp; research anatomical atlas built on IE-Map micro-CT &amp; T2 MRI Otsu reconstructions in canonical Right-Anterior-Superior (RAS) coordinates. Not for clinical diagnosis or patient triage.
        </p>

        <div class="report-summary-grid">
          <div class="report-metric">
            <span class="telemetry-key">Active Specimen Focus</span>
            <span class="telemetry-val" id="rep-active-part">Cochlea</span>
          </div>
          <div class="report-metric">
            <span class="telemetry-key">Active Clinical Mode</span>
            <span class="telemetry-val" id="rep-active-mode">Anatomy Atlas</span>
          </div>
          <div class="report-metric">
            <span class="telemetry-key">Greenwood Map</span>
            <span class="telemetry-val">165.4*(10^(2.1*x) - 0.88), L = 35 mm</span>
          </div>
          <div class="report-metric">
            <span class="telemetry-key">VOR Reference</span>
            <span class="telemetry-val">Curthoys 40–80 ms · τ = 72 h</span>
          </div>
        </div>

        <ul class="citation-list">
          <li><strong>IE-Map v1.0.0:</strong> High-resolution micro-CT &amp; T2 MRI segmentations of the 27-part human inner ear labyrinth and petrous temporal bone in RAS mm.</li>
          <li><strong>Greenwood (1990) &amp; Békésy:</strong> Cochlear frequency-place tonotopy (20 Hz–20 kHz) and basilar membrane traveling-wave envelope.</li>
          <li><strong>Ewald, Steinhausen &amp; Curthoys:</strong> Canal plane kinematics (LARP/RALP/Horizontal), Stokes otoconia sedimentation, Jongkees bithermal calorics, and 40–80 ms vHIT gain.</li>
        </ul>

        <p class="report-note">
          Use <strong>Print Report</strong> for paper archiving or clinical study handouts. The canvas stages hide automatically in print media queries.
        </p>
      </div>

      <div class="dialog-footer">
        <button type="button" class="secondary-action-btn" id="report-print-btn">Print Report</button>
        <button type="button" class="primary-action-btn" id="about-confirm-btn">Done</button>
      </div>
    </dialog>
  `;
}

export function buildLoadingOverlayHTML(): string {
  return `
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
  `;
}
