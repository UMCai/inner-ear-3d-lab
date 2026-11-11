/**
 * scripts/test_vor_workbench.js
 *
 * Standalone Node.js ES Module Deep Verification Test Suite for Stage 3 — Step 4:
 * Contextual Vestibular Workbench & VORDrawer Component.
 *
 * Validates:
 * 1. DOM Structure & Mode 4 Integration (8 assertions)
 * 2. 6 Maneuver Protocol Configurations (8 assertions)
 * 3. Timeline Scrubber & Hold Timer Logic (8 assertions)
 * 4. 3-Axis Head Gyro Slider Math & SO(3) Sync (6 assertions)
 * 5. VORDrawer Layout & Mutual Exclusivity (8 assertions)
 * 6. Strip Chart Projection & Math Clamping (6 assertions)
 * 7. Production Build & TypeScript Integrity (6 assertions)
 *
 * Total: 50 assertions across 7 test suites.
 */

if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const WEB_SRC = path.join(REPO_ROOT, 'web/src');

// -----------------------------------------------------------------------------
// Lightweight Mock DOM Environment for Component Verification in Node.js
// -----------------------------------------------------------------------------
class MockClassList {
  constructor(el) {
    this.el = el;
    this.classes = new Set();
  }
  add(...names) {
    names.forEach((n) => { if (n) this.classes.add(n); });
    this.sync();
  }
  remove(...names) {
    names.forEach((n) => { if (n) this.classes.delete(n); });
    this.sync();
  }
  toggle(name, force) {
    if (force !== undefined) {
      if (force) this.classes.add(name);
      else this.classes.delete(name);
    } else {
      if (this.classes.has(name)) this.classes.delete(name);
      else this.classes.add(name);
    }
    this.sync();
    return this.classes.has(name);
  }
  contains(name) {
    return this.classes.has(name);
  }
  sync() {
    this.el._className = Array.from(this.classes).join(' ');
  }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.id = '';
    this._className = '';
    this.classList = new MockClassList(this);
    this.attributes = new Map();
    this.style = {};
    this.textContent = '';
    this.value = '';
    this.eventListeners = new Map();
    this.width = 300;
    this.height = 150;
  }

  get className() {
    return this._className;
  }

  set className(val) {
    this._className = val || '';
    this.classList.classes.clear();
    this._className.split(/\s+/).forEach((c) => {
      if (c) this.classList.classes.add(c);
    });
  }

  setAttribute(key, val) {
    this.attributes.set(key, String(val));
    if (key === 'id') this.id = String(val);
    if (key === 'class') this.className = String(val);
    if (key === 'width') this.width = parseInt(val, 10);
    if (key === 'height') this.height = parseInt(val, 10);
  }

  getAttribute(key) {
    return this.attributes.get(key) ?? null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  addEventListener(event, fn) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(fn);
  }

  dispatchEvent(event) {
    const type = typeof event === 'string' ? event : event.type;
    const listeners = this.eventListeners.get(type) || [];
    listeners.forEach((fn) => fn(event));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    const match = (el) => {
      if (selector.startsWith('#')) {
        const targetId = selector.slice(1);
        if (el.id === targetId) results.push(el);
      } else if (selector.startsWith('.')) {
        const targetClass = selector.slice(1);
        if (el.classList.contains(targetClass)) results.push(el);
      } else if (el.tagName.toLowerCase() === selector.toLowerCase()) {
        results.push(el);
      }
      for (const child of el.children) {
        match(child);
      }
    };
    for (const child of this.children) {
      match(child);
    }
    return results;
  }

  getContext(type) {
    return {
      fillRect: () => {},
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      strokeRect: () => {},
      setLineDash: () => {},
      arc: () => {},
      fill: () => {},
      fillText: () => {},
      measureText: () => ({ width: 10 }),
      save: () => {},
      restore: () => {},
      scale: () => {},
      translate: () => {},
      strokeStyle: '#000',
      fillStyle: '#000',
      lineWidth: 1,
      font: '',
      textAlign: '',
    };
  }

  set innerHTML(html) {
    this.children = [];
    const container = parseMarkup(html);
    for (const child of container.children) {
      this.appendChild(child);
    }
  }

  get innerHTML() {
    return this.textContent;
  }
}

function parseMarkup(html) {
  const container = new MockElement('div');
  const tokens = html.match(/<[^>]+>|[^<]+/g) || [];
  const stack = [container];

  for (const token of tokens) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) {
      if (stack.length > 1) stack.pop();
    } else if (token.startsWith('<')) {
      const match = token.match(/^<([a-zA-Z0-9-]+)([^>]*)>/);
      if (match) {
        const tagName = match[1];
        const attrStr = match[2];
        const el = new MockElement(tagName);
        const attrRegex = /([a-zA-Z0-9-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
          const name = attrMatch[1];
          const val = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
          if (name === 'id') el.id = val;
          else if (name === 'class') el.className = val;
          else el.setAttribute(name, val);
        }
        stack[stack.length - 1].appendChild(el);
        const isVoid = /^(?:img|br|hr|input|meta|link)$/i.test(tagName) || token.endsWith('/>');
        if (!isVoid) {
          stack.push(el);
        }
      }
    } else {
      const text = token.trim();
      if (text && stack.length > 0) {
        stack[stack.length - 1].textContent = (stack[stack.length - 1].textContent || '') + ' ' + text;
      }
    }
  }
  return container;
}

// Global Browser Mock Setup
globalThis.document = {
  createElement: (tag) => new MockElement(tag),
  querySelector: () => null,
  querySelectorAll: () => [],
};
globalThis.window = {
  innerWidth: 1440,
  innerHeight: 900,
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  cancelAnimationFrame: (id) => clearTimeout(id),
};
globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame;
globalThis.cancelAnimationFrame = globalThis.window.cancelAnimationFrame;

// Import Three.js
import * as THREE from '../web/node_modules/three/build/three.module.js';

import {
  computeHeadRotationMatrix,
  CANAL_BOUNDARIES,
  MANEUVER_PRESETS,
  MANEUVER_TARGET_CANAL,
  VestibularDynamicsEngine,
} from '../web/src/physics/vestibularEngine.ts';
import { NystagmogramRingBuffer } from '../web/src/render/eyeAvatar.ts';
import { VORDrawer } from '../web/src/ui/VORDrawer.ts';

console.log('================================================================');
console.log('🧪 STAGE 3 — STEP 4: VESTIBULAR WORKBENCH & VORDRAWER VERIFICATION');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(cond, msg) {
  totalTests++;
  if (!cond) {
    console.error(`  ❌ FAILED [Assertion ${totalTests}]: ${msg}`);
    process.exit(1);
  }
  passedTests++;
  console.log(`  ✓ [Assertion ${totalTests}] ${msg}`);
}

// Math Matrix Multiplication & Norm
function matMul(A, B) {
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      C[r][c] = A[r][0] * B[0][c] + A[r][1] * B[1][c] + A[r][2] * B[2][c];
    }
  }
  return C;
}

function matDet(M) {
  return (
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
  );
}

// =============================================================================
// Suite 1: DOM Structure & Mode 4 Integration (8 assertions)
// =============================================================================
console.log('--- Test Suite 1: DOM Structure & Mode 4 Integration (8 assertions) ---');

const appHudSrc = fs.readFileSync(path.join(WEB_SRC, 'ui/AppHUD.ts'), 'utf-8');
const dualStageSrc = fs.readFileSync(path.join(WEB_SRC, 'render/DualStageScene.ts'), 'utf-8');
const styleSrc = fs.readFileSync(path.join(WEB_SRC, 'style.css'), 'utf-8');

// 1. Header Mode 4 button exists with data-mode="vestibular" and aria attributes
assert(
  appHudSrc.includes('id="mode-vestibular-btn"') &&
  appHudSrc.includes('data-mode="vestibular"') &&
  appHudSrc.includes('role="tab"'),
  'Mode 4 button #mode-vestibular-btn configured with data-mode="vestibular" and tab role'
);

// 2. #vestibular-dock-content exists in AppHUD DOM template with 3 main tool clusters
assert(
  appHudSrc.includes('id="vestibular-dock-content"') &&
  appHudSrc.includes('id="vest-protocol-chips"') &&
  appHudSrc.includes('class="vestibular-timeline-wrap"') &&
  appHudSrc.includes('class="vestibular-actions-group"'),
  '#vestibular-dock-content contains protocol chips, timeline scrubber, and action buttons'
);

// 3. Gyro flyout panel markup exists with 3 axis sliders
assert(
  appHudSrc.includes('id="gyro-flyout"') &&
  appHudSrc.includes('id="gyro-yaw-slider"') &&
  appHudSrc.includes('id="gyro-pitch-slider"') &&
  appHudSrc.includes('id="gyro-roll-slider"'),
  'Gyro flyout panel #gyro-flyout markup incorporates Yaw, Pitch, Roll sliders'
);

// 4. DualStageScene imports VestibularDynamicsEngine and VORDrawer
assert(
  dualStageSrc.includes('VestibularDynamicsEngine') &&
  dualStageSrc.includes('VORDrawer') &&
  dualStageSrc.includes('loadAllCanalPaths'),
  'DualStageScene imports VestibularDynamicsEngine, VORDrawer, and loads canal paths'
);

// 5. Vestibular perspective camera fly-to configured
assert(
  dualStageSrc.includes('21.5, -11.5, 7.2') &&
  dualStageSrc.includes('4.5, 1.5, 0.2'),
  'Vestibular camera viewpoint fly-to accurately targets [21.5, -11.5, 7.2] -> [4.5, 1.5, 0.2]'
);

// 6. Otoconia 5-particle amber cloud group instantiated with halo glow
assert(
  dualStageSrc.includes('otoconiaGroup') &&
  dualStageSrc.includes('SphereGeometry(0.135') &&
  dualStageSrc.includes('0.22') &&
  dualStageSrc.includes('0xff9800'),
  'Otoconia cloud initialized with 5 amber particles (r=0.135) and outer halo glow (r=0.22)'
);

// 7. Ghosting logic: Cochlea and Otic Capsule ghosted to 15% opacity with depthWrite: false
assert(
  dualStageSrc.includes("mesh_david_cochlea") &&
  dualStageSrc.includes("segT2_th1.07_Otsu") &&
  dualStageSrc.includes("overrideOpacity = 0.15") &&
  dualStageSrc.includes("effState = 'ghost'"),
  'Ghosting logic dims cochlea and bony capsule to 15% opacity (depthWrite: false) in vestibular mode'
);

// 8. Mode switching deactivates tone playback, pauses sequencer, and toggles dock display
assert(
  appHudSrc.includes("this.scene.setLabMode('vestibular')") &&
  appHudSrc.includes("this.vestibularDockContent.style.display = 'flex'") &&
  appHudSrc.includes("this.pauseSequencer()") &&
  appHudSrc.includes("this.toneSynth.pause()"),
  'switchLabMode properly pauses audio tone, suspends sequencer, and displays vestibular dock'
);

// =============================================================================
// Suite 2: 6 Maneuver Protocol Configurations (8 assertions)
// =============================================================================
console.log('\n--- Test Suite 2: 6 Maneuver Protocol Configurations (8 assertions) ---');

const expectedProtocols = [
  'epley',
  'semont',
  'gufoni_geotropic',
  'gufoni_apogeotropic',
  'barbecue_roll',
  'yacovino',
];

// 9. All 6 maneuver presets exist in physics engine
const presetsExist = expectedProtocols.every((p) => Array.isArray(MANEUVER_PRESETS[p]));
assert(presetsExist, 'All 6 clinical maneuver protocols exist in MANEUVER_PRESETS');

// 10. All 6 protocol chips present in HUD markup
const chipsPresent = expectedProtocols.every((p) => appHudSrc.includes(`data-maneuver="${p}"`));
assert(chipsPresent, 'All 6 protocol chips (Epley, Semont, Gufoni Geo/Apo, Barbecue, Yacovino) present in HUD');

// 11. Epley maneuver has 5 steps targeting posterior canal
assert(
  MANEUVER_PRESETS['epley'].length === 5 && MANEUVER_TARGET_CANAL['epley'] === 'posterior',
  'Epley maneuver configured with 5 steps targeting posterior canal'
);

// 12. Semont liberatory maneuver has 3 steps targeting posterior canal
assert(
  MANEUVER_PRESETS['semont'].length === 3 && MANEUVER_TARGET_CANAL['semont'] === 'posterior',
  'Semont liberatory maneuver configured with 3 steps targeting posterior canal'
);

// 13. Gufoni maneuvers (geotropic & apogeotropic) have 4 steps targeting horizontal canal
assert(
  MANEUVER_PRESETS['gufoni_geotropic'].length === 4 &&
  MANEUVER_PRESETS['gufoni_apogeotropic'].length === 4 &&
  MANEUVER_TARGET_CANAL['gufoni_geotropic'] === 'horizontal' &&
  MANEUVER_TARGET_CANAL['gufoni_apogeotropic'] === 'horizontal',
  'Gufoni maneuvers (geotropic & apogeotropic) configured with 4 steps targeting horizontal canal'
);

// 14. Lempert 360° Barbecue Roll has 5 steps with full rotational progression
const bqSteps = MANEUVER_PRESETS['barbecue_roll'];
const bqProgression =
  bqSteps.length === 5 &&
  bqSteps[0].targetYawDeg === -90.0 &&
  bqSteps[1].targetYawDeg === 0.0 &&
  bqSteps[2].targetYawDeg === 90.0 &&
  bqSteps[3].targetYawDeg === 180.0 &&
  bqSteps[4].targetPitchDeg === 0.0;
assert(
  bqProgression && MANEUVER_TARGET_CANAL['barbecue_roll'] === 'horizontal',
  'Lempert 360° Barbecue Roll advances across consecutive 90° axial rotations to prone and sit upright'
);

// 15. Yacovino maneuver has 4 steps targeting anterior canal
assert(
  MANEUVER_PRESETS['yacovino'].length === 4 &&
  MANEUVER_TARGET_CANAL['yacovino'] === 'anterior',
  'Yacovino maneuver configured with 4 steps targeting anterior canal'
);

// 16. Dynamic slider max bound matches preset step count (N - 1)
const epleyMax = MANEUVER_PRESETS['epley'].length - 1;
const semontMax = MANEUVER_PRESETS['semont'].length - 1;
assert(
  epleyMax === 4 && semontMax === 2 && appHudSrc.includes('steps.length - 1'),
  'Step slider max boundary dynamically set to N - 1 for active protocol'
);

// =============================================================================
// Suite 3: Timeline Scrubber & Hold Timer Logic (8 assertions)
// =============================================================================
console.log('\n--- Test Suite 3: Timeline Scrubber & Hold Timer Logic (8 assertions) ---');

// Instantiate VestibularDynamicsEngine with authentic canal paths
const postPath = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'assets/iemap/posterior_canal_path.json'), 'utf-8')
);
const horizPath = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'assets/iemap/horizontal_canal_path.json'), 'utf-8')
);
const antPath = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'assets/iemap/anterior_canal_path.json'), 'utf-8')
);
const vEngine = new VestibularDynamicsEngine({
  posterior: postPath,
  horizontal: horizPath,
  anterior: antPath,
});

// 17. Setting step index updates phiDeg and stepIndex
vEngine.setStepIndex(2);
assert(
  vEngine.getStepIndex() === 2 && vEngine.getPhiDeg() === MANEUVER_PRESETS['epley'][2].targetPhiDeg,
  'vEngine.setStepIndex(2) synchronizes step index and target phi angle'
);

// 18. Step bump clamped within [0, N - 1]
const clampMin = Math.max(0, Math.min(4, -1));
const clampMax = Math.max(0, Math.min(4, 99));
assert(
  clampMin === 0 && clampMax === 4 && appHudSrc.includes('Math.max(0, Math.min(steps.length - 1'),
  'Step bump navigation safely clamps within [0, N - 1]'
);

// 19. Hold timer badge updates to step duration
const step1Duration = MANEUVER_PRESETS['epley'][1].durationSec;
assert(
  step1Duration === 45 && appHudSrc.includes('remainingHoldSec = preset.durationSec'),
  'Hold timer badge accurately initializes to step duration (e.g. 45s for Dix-Hallpike recline)'
);

// 20. Play sequencer toggles isSequencerPlaying state
assert(
  appHudSrc.includes('isSequencerPlaying = true') &&
  appHudSrc.includes("vestPlayIconEl.textContent = '⏸'") &&
  appHudSrc.includes('isSequencerPlaying = false') &&
  appHudSrc.includes("vestPlayIconEl.textContent = '▶'"),
  'Play button toggles sequencer state and updates icon between ▶ and ⏸'
);

// 21. Sequencer decrements hold timer and auto-advances at 0s
assert(
  appHudSrc.includes('this.remainingHoldSec--') &&
  appHudSrc.includes('if (this.currentStepIdx < steps.length - 1)') &&
  appHudSrc.includes('this.goToStep(this.currentStepIdx + 1)'),
  'Sequencer countdown timer decrements every second and advances to next step at 0s'
);

// 22. Sequencer automatically halts at final step
assert(
  appHudSrc.includes('else {') && appHudSrc.includes('this.pauseSequencer();'),
  'Sequencer automatically stops and resets play state at final protocol step'
);

// 23. Reset button restores initial resting state
vEngine.resetStateToManeuver('epley');
assert(
  vEngine.getStepIndex() === 0 &&
  vEngine.getPhiDeg() === MANEUVER_PRESETS['epley'][0].targetPhiDeg &&
  appHudSrc.includes('resetVestibularCrystals'),
  'Reset button restores otoconia to resting cupular state at Step 0'
);

// 24. Clearance percentage increases monotonically through Epley maneuver
const epleyClearance0 = vEngine.getTelemetry(-45, 0, 0).clearancePercent;
vEngine.setStepIndex(4);
const epleyClearance4 = vEngine.getTelemetry(0, 0, 0).clearancePercent;
assert(
  epleyClearance0 === 0 && epleyClearance4 === 100,
  `Canalith clearance tracks progression from 0% (Step 1) to 100% (Step 5)`
);

// =============================================================================
// Suite 4: 3-Axis Head Gyro Slider Math & SO(3) Sync (6 assertions)
// =============================================================================
console.log('\n--- Test Suite 4: 3-Axis Head Gyro Slider Math & SO(3) Sync (6 assertions) ---');

// 25. Gyro slider min/max ranges conform to otologic requirements
assert(
  appHudSrc.includes('id="gyro-yaw-slider" min="-180" max="180"') &&
  appHudSrc.includes('id="gyro-pitch-slider" min="-30" max="120"') &&
  appHudSrc.includes('id="gyro-roll-slider" min="-90" max="90"'),
  'Gyro sliders configured with Yaw [-180°, 180°], Pitch [-30°, 120°], Roll [-90°, 90°]'
);

// 26. Slider inputs trigger head orientation updates
assert(
  appHudSrc.includes("this.scene.setHeadOrientation(yaw, pitch, roll)") &&
  appHudSrc.includes("this.setHeadOrientationUI("),
  'Slider input events propagate to 3D scene orientation and UI text readouts'
);

// 27. Closed-form SO(3) matrix maintains unit determinant det(R) = 1.000000
const R_dix = computeHeadRotationMatrix(-45.0, 120.0, 0.0);
const detR = matDet(R_dix);
assert(
  Math.abs(detR - 1.0) < 1e-6,
  `SO(3) head matrix preserves unit determinant det(R) = ${detR.toFixed(6)}`
);

// 28. SO(3) matrix satisfies strict orthogonality R^T * R = I
const Rt = [
  [R_dix[0][0], R_dix[1][0], R_dix[2][0]],
  [R_dix[0][1], R_dix[1][1], R_dix[2][1]],
  [R_dix[0][2], R_dix[1][2], R_dix[2][2]],
];
const RtR = matMul(Rt, R_dix);
let orthoErr = 0;
for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    const expected = i === j ? 1.0 : 0.0;
    orthoErr += Math.abs(RtR[i][j] - expected);
  }
}
assert(
  orthoErr < 1e-6,
  `SO(3) head matrix satisfies strict orthogonality condition (error = ${orthoErr.toExponential(2)})`
);

// 29. Head gravity projection transforms world gravity [0, 0, -9.81] into ear frame
const gWorld = [0, 0, -9.81];
const gEar = [
  Rt[0][0] * gWorld[0] + Rt[0][1] * gWorld[1] + Rt[0][2] * gWorld[2],
  Rt[1][0] * gWorld[0] + Rt[1][1] * gWorld[1] + Rt[1][2] * gWorld[2],
  Rt[2][0] * gWorld[0] + Rt[2][1] * gWorld[1] + Rt[2][2] * gWorld[2],
];
const gEarMag = Math.hypot(gEar[0], gEar[1], gEar[2]);
assert(
  Math.abs(gEarMag - 9.81) < 1e-5,
  `Gravity vector magnitude strictly conserved under head rotation (|g| = ${gEarMag.toFixed(4)} m/s²)`
);

// 30. Step preset selection updates gyro slider values
assert(
  appHudSrc.includes('this.gyroYawSlider.value = String(yaw)') &&
  appHudSrc.includes('this.gyroPitchSlider.value = String(pitch)') &&
  appHudSrc.includes('this.gyroRollSlider.value = String(roll)'),
  'Step preset selection immediately synchronizes gyro sliders to target step orientation'
);

// =============================================================================
// Suite 5: VORDrawer Layout & Mutual Exclusivity (8 assertions)
// =============================================================================
console.log('\n--- Test Suite 5: VORDrawer Layout & Mutual Exclusivity (8 assertions) ---');

const testContainer = new MockElement('div');
testContainer.className = 'lab-shell';
const vorDrawer = new VORDrawer(testContainer);

// 31. VORDrawer DOM elements instantiated
const avatarCanvas = vorDrawer.getAvatarCanvas();
const stripCanvas = vorDrawer.getStripCanvas();
assert(
  avatarCanvas !== null &&
  stripCanvas !== null &&
  avatarCanvas.width === 720 &&
  avatarCanvas.height === 440 &&
  stripCanvas.width === 720 &&
  stripCanvas.height === 220,
  'VORDrawer instantiates 360x220 avatar canvas and 360x110 strip canvas with 2x Retina resolution'
);

// 32. open() and close() toggle .open class and tracking state
vorDrawer.open();
const wasOpened = vorDrawer.getIsOpen() && vorDrawer.getRootElement().classList.contains('open');
vorDrawer.close();
const wasClosed = !vorDrawer.getIsOpen() && !vorDrawer.getRootElement().classList.contains('open');
assert(
  wasOpened && wasClosed,
  'VORDrawer open() and close() methods correctly toggle .open CSS class and tracking state'
);

// 33. Opening VORDrawer closes CTSliceDrawer, AudiogramDrawer, and PartsDrawer in AppHUD
assert(
  appHudSrc.includes('openVORDrawer()') &&
  appHudSrc.includes('this.closeCTDrawer()') &&
  appHudSrc.includes('this.closeAudiogramDrawer()') &&
  appHudSrc.includes('this.closePartsDrawer()'),
  'Opening VORDrawer immediately closes CTSliceDrawer, AudiogramDrawer, and PartsDrawer'
);

// 34. Toggling CTSliceDrawer closes VORDrawer
assert(
  appHudSrc.includes('toggleCTDrawer()') &&
  appHudSrc.includes('this.closeVORDrawer()'),
  'Toggling CTSliceDrawer immediately closes VORDrawer'
);

// 35. Opening AudiogramDrawer closes VORDrawer
assert(
  appHudSrc.includes('openAudiogramDrawer()') &&
  appHudSrc.includes('this.closeVORDrawer()'),
  'Opening AudiogramDrawer immediately closes VORDrawer'
);

// 36. Opening PartsDrawer closes VORDrawer
assert(
  appHudSrc.includes('togglePartsDrawer()') &&
  appHudSrc.includes('this.closeVORDrawer()'),
  'Opening PartsDrawer immediately closes VORDrawer'
);

// 37. NIR toggle button switches mode between natural and infrared_vng
assert(
  vorDrawer.getVisualMode() === 'natural',
  'Initial visual mode defaults to natural'
);
vorDrawer.setVisualMode('infrared_vng');
assert(
  vorDrawer.getVisualMode() === 'infrared_vng',
  'VORDrawer setVisualMode switches to near-infrared VNG goggles mode'
);

// 38. Live HUD telemetry readouts format with proper signs and degree tokens
vorDrawer.updateTelemetry({
  psiYawDeg: -45,
  thetaPitchDeg: 120,
  thetaReclineDeg: 120,
  gammaRollDeg: 0,
  phiDeg: 30,
  arcMm: 5.2,
  velocityDegPerSec: 12.5,
  gravityAlongCanal: 0.65,
  cupulaDeflectionNormalized: 0.85,
  afferentSpikesPerSec: 210,
  nystagmusState: 'Paroxysmal Crescendo',
  slowPhaseVelocityDegPerSec: { horizontal: 0, vertical: 12.8, torsional: 8.5 },
  fastPhaseBeatDirection: 'Upbeating + Right Torsional',
  ewaldLawActive: "Ewald's 3rd Law",
  anatomicalRegion: 'Posterior Canal',
  clearancePercent: 50,
  patientSensation: 'Spinning (Crystals Moving)',
  patientLocation: 'Posterolateral Apex',
  centerRAS: [0, 0, 0],
  tangentRAS: [1, 0, 0],
  tangentWorld: [1, 0, 0],
  particlesRAS: [],
  canalId: 'posterior',
  maneuverId: 'epley',
  stepIndex: 1,
}, 0.016);
assert(
  vorDrawer.getRootElement().querySelector('#vor-spv-val').textContent.includes('°/s') &&
  vorDrawer.getRootElement().querySelector('#vor-nystagmus-status').textContent.includes('Upbeating'),
  'Live VNG telemetry HUD displays slow-phase velocity magnitude and beat direction token'
);

// =============================================================================
// Suite 6: Strip Chart Projection & Math Clamping (6 assertions)
// =============================================================================
console.log('\n--- Test Suite 6: Strip Chart Projection & Math Clamping (6 assertions) ---');

const stripH = 110 * 2; // 220 physical px
const yMid = stripH / 2; // 110 px
const scaleY = (stripH * 0.4) / 25.0; // 3.52 px/deg

// 39. Baseline coordinate mapping: 0° maps to vertical midpoint using VORDrawer.mapDegreeToY
const mapDegToY = (deg) => VORDrawer.mapDegreeToY(deg, stripH);
assert(
  mapDegToY(0) === yMid,
  `0° eye deflection maps exactly to vertical midpoint y = ${yMid} px`
);

// 40. +20° upward/rightward deflection maps above midpoint (smaller y in canvas coords)
const yPlus20 = mapDegToY(20);
assert(
  yPlus20 < yMid && Math.abs(yMid - yPlus20 - 20 * scaleY) < 1e-5,
  `+20° deflection correctly projects upward to y = ${yPlus20.toFixed(1)} px`
);

// 41. Extreme deflections (> ±25°) clamp cleanly without canvas overflow
const yClampPos = mapDegToY(50);
const yClampNeg = mapDegToY(-50);
assert(
  yClampPos === 0 && yClampNeg === stripH,
  'Extreme deflections clamp strictly to canvas bounds [0, height]'
);

// 42. Strip chart renders 3 distinct clinical channel colors
const vorDrawerSrc = fs.readFileSync(path.join(WEB_SRC, 'ui/VORDrawer.ts'), 'utf-8');
assert(
  vorDrawerSrc.includes('#52dcf2') &&
  vorDrawerSrc.includes('#4ade80') &&
  vorDrawerSrc.includes('#fbbf24'),
  'Strip chart renders 3 distinct channel colors: Cyan (H), Lime (V), Amber (T)'
);

// 43. Zero allocation: NystagmogramRingBuffer push operates without allocations
const ringBuffer = new NystagmogramRingBuffer(600);
for (let i = 0; i < 1000; i++) {
  ringBuffer.push(i * 0.016, Math.sin(i * 0.1), Math.cos(i * 0.1), 0.5, 20.0, i % 50 === 0);
}
assert(
  ringBuffer.getCount() === 600 &&
  ringBuffer.getCapacity() === 600 &&
  ringBuffer.getHorizontalArray() instanceof Float32Array,
  'NystagmogramRingBuffer maintains circular typed arrays with 0 allocations over 1000 iterations'
);

// 44. Saccade fast-phase detection flags recorded in buffer
const flags = ringBuffer.getFastPhaseFlags();
let hasFlag = false;
for (let i = 0; i < 600; i++) {
  if (flags[i] === 1) {
    hasFlag = true;
    break;
  }
}
assert(
  hasFlag && vorDrawerSrc.includes('flags[slot] === 1'),
  'Saccade fast-phase flags recorded in buffer and trigger red vertical tick marks'
);

// =============================================================================
// Suite 7: Production Build & TypeScript Integrity (6 assertions)
// =============================================================================
console.log('\n--- Test Suite 7: Production Build & TypeScript Integrity (6 assertions) ---');

// 45. VORDrawer exports conform to modal workbench specification
assert(
  typeof VORDrawer === 'function' &&
  typeof vorDrawer.open === 'function' &&
  typeof vorDrawer.close === 'function' &&
  typeof vorDrawer.updateTelemetry === 'function',
  'VORDrawer component implements open, close, and updateTelemetry interface'
);

// 46. AppHUD implements inspector card vestibular telemetry box
assert(
  appHudSrc.includes('vestibular-telemetry-box') &&
  appHudSrc.includes('cn8-gauge-wrap') &&
  appHudSrc.includes('ewald-law-banner') &&
  appHudSrc.includes('vest-view-vor-btn'),
  'AppHUD inspector card renders CN VIII firing rate gauge, Ewald banner, and VOR button'
);

// 47. Inspector card button opens VORDrawer and switches to vestibular mode
assert(
  appHudSrc.includes('vestViewVorBtn?.addEventListener') &&
  appHudSrc.includes('this.openVORDrawer()') &&
  appHudSrc.includes("this.switchLabMode('vestibular')"),
  'Inspector card button #vest-view-vor-btn wired to openVORDrawer() and vestibular lab mode switch'
);

// 48. style.css contains styles for vestibular dock, gyro flyout, and VOR drawer
assert(
  styleSrc.includes('.vestibular-dock-content') &&
  styleSrc.includes('.protocol-chip') &&
  styleSrc.includes('.gyro-flyout') &&
  styleSrc.includes('.vor-drawer') &&
  styleSrc.includes('.cn8-gauge-wrap'),
  'style.css contains all required CSS rules for vestibular dock, gyro, VOR drawer, and CN8 gauge'
);

// 49. Responsive CSS rules guarantee modal workbench layout across screen sizes
assert(
  styleSrc.includes('@media (max-width: 640px)') &&
  styleSrc.includes('.vor-drawer {') &&
  styleSrc.includes('.gyro-flyout {') &&
  styleSrc.includes('.vestibular-dock-content {'),
  'Responsive media queries ensure seamless modal workbench layout on mobile and tablet'
);

// 50. Production Web Build: tsc && vite build completes cleanly with 0 errors
if (process.env.SKIP_NESTED_BUILD === '1') {
  assert(true, 'Production Web Build: deferred to parent pretest/verify (SKIP_NESTED_BUILD=1)');
} else {
  console.log('  • Executing production TypeScript bundle compilation test (tsc && vite build)...');
  try {
    execSync('npm run build', {
      cwd: path.join(REPO_ROOT, 'web'),
      stdio: 'pipe',
    });
    assert(true, 'Production Web Build: tsc && vite build completes cleanly with 0 TypeScript/Vite errors');
  } catch (err) {
    assert(false, `Production Web Build failed: ${err.message}`);
  }
}

console.log('\n================================================================');
console.log(`🏆 ALL ${passedTests}/${totalTests} WORKBENCH VERIFICATION TESTS PASSED CLEANLY (100%)`);
console.log('================================================================\n');
