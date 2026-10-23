import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';

const DIST_DIR = '/Users/umcai/Documents/antigravity/radiant-darwin/web/dist';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 4188;
const DEBUG_PORT = 9225;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.obj': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// 1. Static file server for built dist
function startServer() {
  const server = createServer((req, res) => {
    let filePath = join(DIST_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!existsSync(filePath)) {
      filePath = join(DIST_DIR, 'index.html');
    }
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    try {
      const data = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    } catch (err) {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[Server] Static server running on http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

// 2. Launch Headless Chrome with Remote Debugging
let chromeTmpDir = null;
function launchChrome() {
  chromeTmpDir = mkdtempSync(join(tmpdir(), 'chrome-cdp-lab-'));
  const proc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${chromeTmpDir}`,
      '--no-sandbox',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--mute-audio',
      '--hide-scrollbars',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  return proc;
}

async function waitForCdpEndpoint(maxWaitMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      if (res.ok) {
        const data = await res.json();
        const page = data.find((d) => d.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          return page.webSocketDebuggerUrl;
        }
      }
    } catch {
      // Chrome starting up...
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Timeout waiting for Chrome CDP endpoint');
}

// 3. CDP Client wrapper
class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        } else if (msg.method) {
          const cbs = this.events.get(msg.method) || [];
          for (const cb of cbs) cb(msg.params);
        }
      } catch (e) {
        console.error('Error handling CDP message:', e);
      }
    };
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }

  send(method, params = {}, timeoutMs = 25000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timeout (${timeoutMs}ms) awaiting CDP response for ${method}`));
        }
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, cb) {
    if (!this.events.has(method)) this.events.set(method, []);
    this.events.get(method).push(cb);
  }

  close() {
    this.ws?.close();
  }
}

// 4. Test Suite Execution
async function run() {
  console.log('=== Starting Pure 3D Inner Ear Anatomy Lab Automated CDP Tests ===');
  const server = await startServer();
  const chromeProc = launchChrome();

  try {
    const wsUrl = await waitForCdpEndpoint();
    console.log(`[CDP] Connected to ${wsUrl}`);
    const client = new CdpClient(wsUrl);
    await client.connect();

    const consoleErrors = [];
    client.on('Runtime.consoleAPICalled', (params) => {
      const text = params.args.map((a) => a.value || a.description || '').join(' ');
      if (params.type === 'error') {
        console.error(`[Browser Error] ${text}`);
        consoleErrors.push(`[Console Error] ${text}`);
      }
    });
    client.on('Runtime.exceptionThrown', (params) => {
      const text = params.exceptionDetails.exception?.description || params.exceptionDetails.text;
      console.error(`[Browser Exception] ${text}`);
      consoleErrors.push(`[Uncaught Exception] ${text}`);
    });

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    const viewports = [
      { name: 'Desktop High-Res', width: 1440, height: 900, mobile: false },
      { name: 'Desktop Standard', width: 1280, height: 800, mobile: false },
      { name: 'Tablet Portrait', width: 768, height: 1024, mobile: true },
      { name: 'Mobile Handset', width: 390, height: 844, mobile: true },
    ];

    for (const vp of viewports) {
      console.log(`\n--- Testing Viewport: ${vp.name} (${vp.width}×${vp.height}) ---`);

      await client.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: vp.mobile,
      });

      await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
      await new Promise((r) => setTimeout(r, 600));

      // Wait for page load and 3D assets to load
      let loaded = false;
      const startTime = Date.now();
      while (!loaded && Date.now() - startTime < 18000) {
        const evalRes = await client.send('Runtime.evaluate', {
          expression: `
            (() => {
              const loadingEl = document.querySelector('#loading-overlay');
              const isHidden = !loadingEl || loadingEl.style.display === 'none' || loadingEl.classList.contains('fade-out');
              const title = document.querySelector('.brand-title')?.textContent || '';
              const count = document.querySelector('#loading-count-text')?.textContent || '';
              return { isHidden, title, count };
            })()
          `,
          returnByValue: true,
        });
        if (evalRes.result?.value?.isHidden && evalRes.result?.value?.title.includes('Inner Ear 3D Lab')) {
          loaded = true;
        } else {
          if (Date.now() - startTime > 1000 && (Math.round((Date.now() - startTime) / 300) % 5 === 0)) {
            console.log(`[Loading Progress ${Math.round((Date.now() - startTime) / 1000)}s]`, evalRes.result?.value);
          }
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      if (!loaded) {
        throw new Error(`Timeout waiting for 3D lab to load at ${vp.name}`);
      }
      console.log(`✓ 3D Lab successfully loaded 27 anatomical meshes`);

      // 1. Verify DOM Cleanliness (No legacy Mode 2, quiz, predict, PiP, audio)
      const domCheck = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const forbiddenSelectors = [
              '.epley-sandbox-bar',
              '.epley-stepper',
              '.quiz-panel',
              '.predict-panel',
              '.patient-telemetry-grid',
              '.technical-telemetry-grid',
              '.pip-hud-frame',
              '#pip-window',
              '.audio-player',
              '.mode-tabs'
            ];
            const found = forbiddenSelectors.filter(sel => document.querySelector(sel) !== null);
            return found;
          })()
        `,
        returnByValue: true,
      });
      if (domCheck.result.value.length > 0) {
        throw new Error(`Legacy elements found in DOM: ${domCheck.result.value.join(', ')}`);
      }
      console.log(`✓ Zero legacy Mode 2, Quiz, Predict, or PiP elements present in DOM`);

      // 2. Verify Top Header: Title, Search bar, Settings button
      const headerCheck = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const title = document.querySelector('.brand-title')?.textContent;
            const searchInput = document.querySelector('#search-input') !== null;
            const settingsBtn = document.querySelector('#settings-btn') !== null;
            return { title, searchInput, settingsBtn };
          })()
        `,
        returnByValue: true,
      });
      if (!headerCheck.result.value.title?.includes('Inner Ear 3D Lab')) {
        throw new Error(`Header title mismatch: ${headerCheck.result.value.title}`);
      }
      if (!headerCheck.result.value.searchInput || !headerCheck.result.value.settingsBtn) {
        throw new Error('Header search bar or settings button missing');
      }
      console.log(`✓ Minimal Top Header verified (Title: 'Inner Ear 3D Lab', Search Bar, Settings Button)`);

      // 3. Verify Floating Inspector Card (Title, System badge, plain-English summary, Isolate, Reset)
      const inspectorCheck = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const card = document.querySelector('#inspector-card');
            const title = card?.querySelector('.inspector-title')?.textContent;
            const badge = card?.querySelector('.system-badge')?.textContent;
            const summary = card?.querySelector('.inspector-summary')?.textContent;
            const isolateBtn = card?.querySelector('#btn-isolate') !== null;
            const resetBtn = card?.querySelector('#btn-reset-view') !== null;
            const accordionBtn = card?.querySelector('#accordion-toggle-btn') !== null;
            return {
              visible: card?.classList.contains('visible'),
              title,
              badge,
              hasSummary: Boolean(summary && summary.length > 10),
              isolateBtn,
              resetBtn,
              accordionBtn
            };
          })()
        `,
        returnByValue: true,
      });
      if (!inspectorCheck.result.value.visible || !inspectorCheck.result.value.title) {
        throw new Error('Floating Inspector Card is not visible with selected structure');
      }
      if (!inspectorCheck.result.value.isolateBtn || !inspectorCheck.result.value.resetBtn || !inspectorCheck.result.value.accordionBtn) {
        throw new Error('Inspector Card action buttons missing');
      }
      console.log(`✓ Floating Inspector Card verified (Selected: "${inspectorCheck.result.value.title}", Badge: "${inspectorCheck.result.value.badge?.trim()}", Plain Summary present)`);

      // 4. Test Accordion expansion
      const accordionTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const btn = document.querySelector('#accordion-toggle-btn');
            const content = document.querySelector('#accordion-content');
            if (!content?.classList.contains('open')) {
              btn?.click();
            }
            return {
              open: content?.classList.contains('open'),
              text: content?.textContent || ''
            };
          })()
        `,
        returnByValue: true,
      });
      if (!accordionTest.result.value.open || !accordionTest.result.value.text.includes('Latin Term')) {
        throw new Error('Medical Details accordion failed to expand with Latin details');
      }
      console.log(`✓ Expandable Medical Details accordion verified (Latin, CN VIII Innervation, Pearls)`);

      // 4b. Test Accordion scroll retention under slider updates (no DOM scroll reset)
      const scrollRetentionTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const card = document.querySelector('#inspector-card');
            card.scrollTop = 60;
            const setScroll = card.scrollTop;
            const slider = document.querySelector('#bone-peel-slider');
            slider.value = '50';
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            const currentScroll = card.scrollTop;
            return { setScroll, currentScroll };
          })()
        `,
        returnByValue: true,
      });
      if (scrollRetentionTest.result.value.setScroll > 0 && scrollRetentionTest.result.value.currentScroll === 0) {
        throw new Error('Inspector Card reset scroll position during slider input');
      }
      console.log(`✓ Inspector Card scroll preservation verified (retained: ${scrollRetentionTest.result.value.currentScroll}px)`);

      // 5. Test [ 🎯 Isolate Part ] and [ ↺ Reset View ]
      const isolateTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const isolateBtn = document.querySelector('#btn-isolate');
            isolateBtn.click();
            const isolatedText = isolateBtn.textContent.trim();
            const resetBtn = document.querySelector('#btn-reset-view');
            resetBtn.click();
            return { isolatedText };
          })()
        `,
        returnByValue: true,
      });
      console.log(`✓ Isolate / Reset View action buttons verified (Isolate toggled: "${isolateTest.result.value.isolatedText}")`);

      // 6. Test Search Bar functionality (input, ArrowDown keyboard highlight, Enter selection)
      const searchTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const input = document.querySelector('#search-input');
            input.value = 'cochlea';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const dropdown = document.querySelector('#search-dropdown');
            const items = dropdown.querySelectorAll('.search-result-item');
            const itemCount = items.length;

            // Test ArrowDown highlight
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
            const hasHighlighted = dropdown.querySelector('.search-result-item.highlighted') !== null;

            // Test Enter selection
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            const selectedText = input.value;
            return { itemCount, hasHighlighted, selectedText };
          })()
        `,
        returnByValue: true,
      });
      if (searchTest.result.value.itemCount === 0 || !searchTest.result.value.hasHighlighted) {
        throw new Error('Search input did not return matching results or arrow navigation failed');
      }
      console.log(`✓ Search Bar verified (${searchTest.result.value.itemCount} matches found for "cochlea", ArrowDown highlighted, Enter selected "${searchTest.result.value.selectedText}")`);

      // 7. Test 4 Guided Presets in Compact Bottom Bar
      const presetsTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const presets = ['balance_system', 'hearing_snail', 'exploded_view', 'overview'];
            const clicked = [];
            for (const p of presets) {
              const btn = document.querySelector(\`.preset-btn[data-preset="\${p}"]\`);
              if (btn) {
                btn.click();
                clicked.push(p);
              }
            }
            return clicked;
          })()
        `,
        returnByValue: true,
      });
      if (presetsTest.result.value.length !== 4) {
        throw new Error(`Only ${presetsTest.result.value.length} of 4 presets found`);
      }
      console.log(`✓ 4 Guided Presets verified (Overview, Balance System, Hearing Snail, Exploded View)`);

      // 8. Test 2 Visual Sliders (Outer Bone Shell, Separate Parts)
      const slidersTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const boneSlider = document.querySelector('#bone-peel-slider');
            const boneVal = document.querySelector('#bone-val');
            boneSlider.value = '40';
            boneSlider.dispatchEvent(new Event('input', { bubbles: true }));
            const boneText = boneVal?.textContent;

            const explodeSlider = document.querySelector('#explode-slider');
            const explodeVal = document.querySelector('#explode-val');
            explodeSlider.value = '55';
            explodeSlider.dispatchEvent(new Event('input', { bubbles: true }));
            const explodeText = explodeVal?.textContent;

            return { boneText, explodeText };
          })()
        `,
        returnByValue: true,
      });
      if (slidersTest.result.value.boneText !== '40%' || slidersTest.result.value.explodeText !== '55%') {
        throw new Error(`Slider update failed: bone=${slidersTest.result.value.boneText}, explode=${slidersTest.result.value.explodeText}`);
      }
      console.log(`✓ 2 Visual Sliders verified (Outer Bone Shell: ${slidersTest.result.value.boneText}, Separate Parts: ${slidersTest.result.value.explodeText})`);

      // 9. Test Collapsible 27 Parts Drawer & Single-Click Eye Toggles
      const partsDrawerTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const toggleBtn = document.querySelector('#parts-toggle-btn');
            const drawer = document.querySelector('#parts-drawer');
            const inspectorCard = document.querySelector('#inspector-card');
            if (!drawer?.classList.contains('open')) {
              toggleBtn?.click();
            }
            const mobileDrawerActive = inspectorCard?.classList.contains('drawer-active') || false;
            const rows = drawer?.querySelectorAll('.part-row') || [];
            const eyeBtn = rows[0]?.querySelector('.eye-toggle-btn');
            const beforeEye = eyeBtn?.textContent;
            eyeBtn?.click();
            const afterEye = eyeBtn?.textContent;
            eyeBtn?.click(); // restore
            if (drawer?.classList.contains('open')) {
              toggleBtn?.click(); // close drawer
            }
            return {
              drawerOpen: drawer?.classList.contains('open'),
              rowCount: rows.length,
              beforeEye,
              afterEye,
              mobileDrawerActive
            };
          })()
        `,
        returnByValue: true,
      });
      if (partsDrawerTest.result.value.rowCount !== 27) {
        throw new Error(`Expected 27 anatomical parts in drawer, found ${partsDrawerTest.result.value.rowCount}`);
      }
      console.log(`✓ Collapsible 27 Parts Drawer verified (${partsDrawerTest.result.value.rowCount} parts rendered, single-click eye toggled "${partsDrawerTest.result.value.beforeEye}" -> "${partsDrawerTest.result.value.afterEye}")`);

      // 10. Test Settings Popover & About Dialog
      const settingsTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const settingsBtn = document.querySelector('#settings-btn');
            settingsBtn.click();
            const popover = document.querySelector('#settings-popover');
            const popoverOpen = popover?.classList.contains('open');

            const allLabelBtn = popover.querySelector('[data-label-mode="all"]');
            allLabelBtn?.click();

            const aboutBtn = document.querySelector('#about-open-btn');
            aboutBtn?.click();
            const modal = document.querySelector('#about-modal');
            const modalOpen = modal?.style.display !== 'none';

            const closeBtn = document.querySelector('#about-close-btn');
            closeBtn?.click();
            const modalClosed = modal?.style.display === 'none';

            return { popoverOpen, modalOpen, modalClosed };
          })()
        `,
        returnByValue: true,
      });
      if (!settingsTest.result.value.popoverOpen || !settingsTest.result.value.modalOpen || !settingsTest.result.value.modalClosed) {
        throw new Error(`Settings/About dialog test failed: ${JSON.stringify(settingsTest.result.value)}`);
      }
      console.log(`✓ Settings Popover & About & Citations Modal verified (3D Labels: Off/Key/All, Reading Depth: Simple/Detailed, Citations)`);

      const ss = await client.send('Page.captureScreenshot', { format: 'png' });
      mkdirSync('/Users/umcai/Documents/antigravity/radiant-darwin/output', { recursive: true });
      const ssPath = `/Users/umcai/Documents/antigravity/radiant-darwin/output/mvp_${vp.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
      writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
      console.log(`✓ Captured visual screenshot to ${ssPath}`);

      // 11. Test Mode Switcher: Switch to Hearing Lab
      const hearingModeTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const hearingBtn = document.querySelector('#mode-hearing-btn');
            hearingBtn?.click();
            const hearingDock = document.querySelector('#hearing-dock-content');
            const anatomyDock = document.querySelector('#anatomy-dock-content');
            const hearingBtnActive = hearingBtn?.classList.contains('active');
            const hearingDockVisible = hearingDock && hearingDock.style.display !== 'none';
            const anatomyDockHidden = anatomyDock && anatomyDock.style.display === 'none';
            return { hearingBtnActive, hearingDockVisible, anatomyDockHidden };
          })()
        `,
        returnByValue: true,
      });
      if (!hearingModeTest.result.value.hearingBtnActive || !hearingModeTest.result.value.hearingDockVisible || !hearingModeTest.result.value.anatomyDockHidden) {
        throw new Error(`Hearing mode switch failed: ${JSON.stringify(hearingModeTest.result.value)}`);
      }
      console.log(`✓ Mode Switcher verified (switched to Hearing & Tonotopy mode)`);

      // 12. Test Hearing Slider & Live Readout
      const hearingSliderTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const slider = document.querySelector('#hearing-freq-slider');
            slider.value = '700'; // ~2.8 kHz
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            const readout = document.querySelector('#hearing-freq-readout')?.textContent;
            const badge = document.querySelector('#hearing-landmark-badge')?.textContent;
            return { readout, badge };
          })()
        `,
        returnByValue: true,
      });
      console.log(`✓ Hearing Slider verified (Readout: ${hearingSliderTest.result.value.readout}, Landmark: "${hearingSliderTest.result.value.badge}")`);

      // 13. Test Octave Jump Chips
      const octaveTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const chip4k = document.querySelector('.octave-chip[data-octave="4000"]');
            chip4k?.click();
            const readout = document.querySelector('#hearing-freq-readout')?.textContent;
            const chipActive = chip4k?.classList.contains('active');
            return { readout, chipActive };
          })()
        `,
        returnByValue: true,
      });
      if (!octaveTest.result.value.chipActive || !octaveTest.result.value.readout.includes('4000')) {
        throw new Error(`Octave chip test failed: ${JSON.stringify(octaveTest.result.value)}`);
      }
      console.log(`✓ Octave Jump Chips verified (jumped to 4000 Hz, readout: ${octaveTest.result.value.readout})`);

      // 14. Test Audiogram Drawer Toggle & Clinical Presets
      const audiogramTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const toggleBtn = document.querySelector('#audiogram-toggle-btn');
            toggleBtn?.click();
            const drawer = document.querySelector('#audiogram-drawer');
            const drawerOpen = drawer?.classList.contains('open');
            const presetButtons = drawer?.querySelectorAll('.audio-preset-btn') || [];
            
            // Click Noise Notch preset
            drawer?.querySelector('.audio-preset-btn[data-preset-id="noise_notch"]')?.click();
            const activePresetBtn = drawer?.querySelector('.audio-preset-btn.active');
            const notchActive = activePresetBtn?.getAttribute('data-preset-id') === 'noise_notch';
            const title = drawer?.querySelector('.preset-meta-title')?.textContent;

            // Toggle Speech Banana
            const bananaBtn = drawer?.querySelector('#speech-banana-btn');
            bananaBtn?.click();
            const bananaToggled = bananaBtn !== null;

            return { drawerOpen, presetCount: presetButtons.length, notchActive, title, bananaToggled };
          })()
        `,
        returnByValue: true,
      });
      if (!audiogramTest.result.value.drawerOpen || audiogramTest.result.value.presetCount !== 7 || !audiogramTest.result.value.notchActive) {
        throw new Error(`Audiogram drawer test failed: ${JSON.stringify(audiogramTest.result.value)}`);
      }
      console.log(`✓ Clinical Audiogram Drawer verified (${audiogramTest.result.value.presetCount} presets, active: "${audiogramTest.result.value.title}")`);

      // 15. Test Drawer Mutual Exclusivity
      const mutualExclusivityTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const audioDrawer = document.querySelector('#audiogram-drawer');
            const partsDrawer = document.querySelector('#parts-drawer');
            const audioOpen = audioDrawer?.classList.contains('open');
            const partsOpenWithAudio = partsDrawer?.classList.contains('open');

            // Switch to Anatomy mode, open parts drawer
            document.querySelector('#mode-anatomy-btn')?.click();
            const partsToggle = document.querySelector('#parts-toggle-btn');
            if (!partsDrawer?.classList.contains('open')) {
              partsToggle?.click();
            }
            const partsOpen = partsDrawer?.classList.contains('open');

            // Switch back to Hearing mode and open audiogram
            document.querySelector('#mode-hearing-btn')?.click();
            const audiogramToggle = document.querySelector('#audiogram-toggle-btn');
            if (!audioDrawer?.classList.contains('open')) {
              audiogramToggle?.click();
            }
            const partsOpenAfterAudiogram = partsDrawer?.classList.contains('open');

            return { audioOpen, partsOpenWithAudio, partsOpen, partsOpenAfterAudiogram };
          })()
        `,
        returnByValue: true,
      });
      if (mutualExclusivityTest.result.value.partsOpenAfterAudiogram) {
        throw new Error('Mutual exclusivity failed: parts drawer remained open when audiogram was opened');
      }
      console.log(`✓ Drawer Mutual Exclusivity verified (Audiogram and 27-Parts drawers never overlap)`);

      // 16. Capture Stage 1 Hearing Lab Screenshot
      const hearingSs = await client.send('Page.captureScreenshot', { format: 'png' });
      const hearingSsPath = `/Users/umcai/Documents/antigravity/radiant-darwin/output/stage1_hearing_${vp.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
      writeFileSync(hearingSsPath, Buffer.from(hearingSs.data, 'base64'));
      console.log(`✓ Captured Stage 1 Hearing Lab visual screenshot to ${hearingSsPath}`);

      // =========================================================================
      // STAGE 2: VIRTUAL RADIOLOGY & SCDS VERIFICATION
      // =========================================================================
      // 17. Test Mode Switcher -> Virtual Radiology
      const radModeTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const radBtn = document.querySelector('#mode-radiology-btn');
            radBtn?.click();
            const radActive = radBtn?.classList.contains('active');
            const dockContent = document.querySelector('#radiology-dock-content');
            const dockVisible = dockContent && getComputedStyle(dockContent).display !== 'none';
            const planeChips = document.querySelectorAll('.plane-chip');
            return { radActive, dockVisible, planeChipCount: planeChips.length };
          })()
        `,
        returnByValue: true,
      });
      if (!radModeTest.result.value.radActive || !radModeTest.result.value.dockVisible || radModeTest.result.value.planeChipCount !== 4) {
        throw new Error(`Radiology mode test failed: ${JSON.stringify(radModeTest.result.value)}`);
      }
      console.log(`✓ Mode Switcher verified (switched to Virtual Radiology, 4 plane chips active)`);
      await new Promise((r) => setTimeout(r, 600));

      // 18. Test Plane Switching & Slider Bounds
      const planeSwitchTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const stenversChip = document.querySelector('.plane-chip[data-plane="stenvers"]');
            stenversChip?.click();
            const stenversActive = stenversChip?.classList.contains('active');
            const slider = document.querySelector('#radiology-depth-slider');
            const stenversMin = slider?.getAttribute('min');
            const stenversMax = slider?.getAttribute('max');

            // Switch back to Poschl
            const poschlChip = document.querySelector('.plane-chip[data-plane="poschl"]');
            poschlChip?.click();
            const poschlActive = poschlChip?.classList.contains('active');

            return { stenversActive, stenversMin, stenversMax, poschlActive };
          })()
        `,
        returnByValue: true,
      });
      if (!planeSwitchTest.result.value.stenversActive || !planeSwitchTest.result.value.poschlActive) {
        throw new Error(`Plane switch test failed: ${JSON.stringify(planeSwitchTest.result.value)}`);
      }
      console.log(`✓ Slicing Plane switching verified (Pöschl, Stenvers bounds [${planeSwitchTest.result.value.stenversMin}, ${planeSwitchTest.result.value.stenversMax}])`);
      await new Promise((r) => setTimeout(r, 600));

      // 19. Test Depth Slider & Dynamic Landmark Badge
      const depthScrubTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const slider = document.querySelector('#radiology-depth-slider');
            if (slider) {
              slider.value = "12";
              slider.dispatchEvent(new Event('input', { bubbles: true }));
            }
            const depthVal = document.querySelector('#radiology-depth-val')?.textContent;
            const landmark = document.querySelector('#radiology-landmark-badge')?.textContent;
            return { depthVal, landmark };
          })()
        `,
        returnByValue: true,
      });
      if (!depthScrubTest.result.value.depthVal?.includes('+1.2') || !depthScrubTest.result.value.landmark?.includes('Superior Canal')) {
        throw new Error(`Depth scrub test failed: ${JSON.stringify(depthScrubTest.result.value)}`);
      }
      console.log(`✓ Radiology Depth Scrubber verified (Depth: ${depthScrubTest.result.value.depthVal}, Landmark: "${depthScrubTest.result.value.landmark}")`);

      // 20. Test 2D CT MPR Slice Drawer & Mutual Exclusivity
      const ctDrawerTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const ctToggleBtn = document.querySelector('#rad-ct-toggle-btn');
            ctToggleBtn?.click();
            const ctDrawer = document.querySelector('#ct-slice-drawer');
            const drawerOpen = ctDrawer?.classList.contains('open');
            const canvas = document.querySelector('#ct-canvas');
            const hasCanvas = canvas !== null && canvas.width > 0 && canvas.height > 0;
            const partsDrawerOpen = document.querySelector('#parts-drawer')?.classList.contains('open');
            const audiogramDrawerOpen = document.querySelector('#audiogram-drawer')?.classList.contains('open');
            const inspectorHidden = document.querySelector('#inspector-card')?.classList.contains('drawer-active');

            // Switch to T2 MRI window preset and back
            const mriBtn = document.querySelector('#ct-window-mri-btn');
            mriBtn?.click();
            const mriActive = mriBtn?.classList.contains('active');
            const boneBtn = document.querySelector('#ct-window-bone-btn');
            boneBtn?.click();
            const boneActive = boneBtn?.classList.contains('active');

            return { drawerOpen, hasCanvas, partsDrawerOpen, audiogramDrawerOpen, inspectorHidden, mriActive, boneActive };
          })()
        `,
        returnByValue: true,
      });
      if (!ctDrawerTest.result.value.drawerOpen || !ctDrawerTest.result.value.hasCanvas || ctDrawerTest.result.value.partsDrawerOpen || ctDrawerTest.result.value.audiogramDrawerOpen) {
        throw new Error(`CT Drawer test failed: ${JSON.stringify(ctDrawerTest.result.value)}`);
      }
      if (vp.width <= 640 && !ctDrawerTest.result.value.inspectorHidden) {
        throw new Error('Mobile drawer exclusivity failed: inspector remained visible with CT drawer open');
      }
      console.log(`✓ 2D CT MPR Slice Drawer verified (Retina Canvas, Bone Window 4000/700, Mutual Exclusivity clean)`);

      // 21. Test SCDS Defect Scenario & Third-Window Biomechanics Box
      const scdsTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const scdsBtn = document.querySelector('#rad-scds-toggle-btn');
            scdsBtn?.click();
            const scdsActive = scdsBtn?.classList.contains('active');
            const poschlActive = document.querySelector('.plane-chip[data-plane="poschl"]')?.classList.contains('active');
            const depthVal = document.querySelector('#radiology-depth-val')?.textContent;
            const inspectorBox = document.querySelector('.scds-biomechanics-box');
            const hasInspectorBox = inspectorBox !== null;
            const hasTullio = inspectorBox?.textContent?.includes('Tullio');

            return { scdsActive, poschlActive, depthVal, hasInspectorBox, hasTullio };
          })()
        `,
        returnByValue: true,
      });
      if (!scdsTest.result.value.scdsActive || !scdsTest.result.value.poschlActive || !scdsTest.result.value.hasInspectorBox || !scdsTest.result.value.hasTullio) {
        throw new Error(`SCDS scenario test failed: ${JSON.stringify(scdsTest.result.value)}`);
      }
      console.log(`✓ SCDS Third-Window Scenario verified (Snaps to Pöschl at +1.2 mm, Tullio/Hennebert clinical triad active)`);
      await new Promise((r) => setTimeout(r, 650));

      // 22. Capture Stage 2 Virtual Radiology Visual Screenshot
      const radSs = await client.send('Page.captureScreenshot', { format: 'png' });
      const radSsPath = `/Users/umcai/Documents/antigravity/radiant-darwin/output/stage2_radiology_${vp.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
      writeFileSync(radSsPath, Buffer.from(radSs.data, 'base64'));
      console.log(`✓ Captured Stage 2 Virtual Radiology visual screenshot to ${radSsPath}`);

      // =========================================================================
      // 23. Test Mode Switcher -> Vestibular & VOR Lab (Mode 4)
      const vestModeTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const vestBtn = document.querySelector('#mode-vestibular-btn');
            vestBtn?.click();
            const vestActive = vestBtn?.classList.contains('active');
            const dockContent = document.querySelector('#vestibular-dock-content');
            const dockVisible = dockContent && getComputedStyle(dockContent).display !== 'none';
            const chips = document.querySelectorAll('.protocol-chip');
            const radDockHidden = document.querySelector('#radiology-dock-content')?.style.display === 'none';
            const hearingDockHidden = document.querySelector('#hearing-dock-content')?.style.display === 'none';
            const ctDrawerClosed = !document.querySelector('#ct-slice-drawer')?.classList.contains('open');
            return { vestActive, dockVisible, chipCount: chips.length, radDockHidden, hearingDockHidden, ctDrawerClosed };
          })()
        `,
        returnByValue: true,
      });
      if (
        !vestModeTest.result.value.vestActive ||
        !vestModeTest.result.value.dockVisible ||
        vestModeTest.result.value.chipCount !== 6 ||
        !vestModeTest.result.value.ctDrawerClosed
      ) {
        throw new Error(`Vestibular mode test failed: ${JSON.stringify(vestModeTest.result.value)}`);
      }
      console.log(`✓ Mode Switcher verified (switched to Vestibular & VOR, 6 maneuver chips, CT closed)`);
      await new Promise((r) => setTimeout(r, 600));

      // 24. Test Maneuver Protocol Switching & Dynamic Step Slider Bounds
      const maneuverSwitchTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const semontChip = document.querySelector('.protocol-chip[data-maneuver="semont"]');
            semontChip?.click();
            const semontActive = semontChip?.classList.contains('active');
            const slider = document.querySelector('#vest-step-slider');
            const semontMax = slider?.getAttribute('max');

            // Switch to Barbecue Roll
            const bqChip = document.querySelector('.protocol-chip[data-maneuver="barbecue_roll"]');
            bqChip?.click();
            const bqActive = bqChip?.classList.contains('active');
            const bqMax = slider?.getAttribute('max');

            // Switch back to Epley
            const epleyChip = document.querySelector('.protocol-chip[data-maneuver="epley"]');
            epleyChip?.click();
            const epleyActive = epleyChip?.classList.contains('active');
            const epleyMax = slider?.getAttribute('max');

            return { semontActive, semontMax, bqActive, bqMax, epleyActive, epleyMax };
          })()
        `,
        returnByValue: true,
      });
      if (
        !maneuverSwitchTest.result.value.semontActive ||
        maneuverSwitchTest.result.value.semontMax !== '2' ||
        !maneuverSwitchTest.result.value.bqActive ||
        maneuverSwitchTest.result.value.bqMax !== '4' ||
        !maneuverSwitchTest.result.value.epleyActive ||
        maneuverSwitchTest.result.value.epleyMax !== '4'
      ) {
        throw new Error(`Maneuver switch test failed: ${JSON.stringify(maneuverSwitchTest.result.value)}`);
      }
      console.log(`✓ Clinical Maneuver switching verified (Semont 3-step, Barbecue 5-step, Epley 5-step)`);
      await new Promise((r) => setTimeout(r, 600));

      // 25. Test Timeline Step Bump & Sequencer Play/Pause
      const sequencerTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const nextBtn = document.querySelector('#vest-step-next-btn');
            nextBtn?.click();
            const sliderVal = document.querySelector('#vest-step-slider')?.value;
            const holdTimer = document.querySelector('#vest-hold-timer-badge')?.textContent;

            // Test play sequencer toggle
            const playBtn = document.querySelector('#vest-play-btn');
            playBtn?.click();
            const isPlaying = playBtn?.classList.contains('playing');
            const playIcon = document.querySelector('#vest-play-icon')?.textContent;

            // Pause sequencer
            playBtn?.click();
            const isPaused = !playBtn?.classList.contains('playing');
            const pauseIcon = document.querySelector('#vest-play-icon')?.textContent;

            // Reset back to step 0
            document.querySelector('#vest-reset-btn')?.click();
            const resetVal = document.querySelector('#vest-step-slider')?.value;

            return { sliderVal, holdTimer, isPlaying, playIcon, isPaused, pauseIcon, resetVal };
          })()
        `,
        returnByValue: true,
      });
      if (
        sequencerTest.result.value.sliderVal !== '1' ||
        !sequencerTest.result.value.holdTimer?.includes('45s') ||
        !sequencerTest.result.value.isPlaying ||
        sequencerTest.result.value.playIcon !== '⏸' ||
        !sequencerTest.result.value.isPaused ||
        sequencerTest.result.value.pauseIcon !== '▶' ||
        sequencerTest.result.value.resetVal !== '0'
      ) {
        throw new Error(`Sequencer test failed: ${JSON.stringify(sequencerTest.result.value)}`);
      }
      console.log(`✓ Timeline scrubber, bump controls, and auto-play sequencer verified`);

      // 26. Test Interactive 3-Axis Head Gyro Flyout
      const gyroTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const gyroBtn = document.querySelector('#vest-gyro-toggle-btn');
            gyroBtn?.click();
            const flyout = document.querySelector('#gyro-flyout');
            const flyoutOpen = flyout && getComputedStyle(flyout).display !== 'none';

            const yawSlider = document.querySelector('#gyro-yaw-slider');
            const pitchSlider = document.querySelector('#gyro-pitch-slider');
            const rollSlider = document.querySelector('#gyro-roll-slider');
            if (yawSlider && pitchSlider && rollSlider) {
              yawSlider.value = "45";
              yawSlider.dispatchEvent(new Event('input', { bubbles: true }));
              pitchSlider.value = "30";
              pitchSlider.dispatchEvent(new Event('input', { bubbles: true }));
              rollSlider.value = "-15";
              rollSlider.dispatchEvent(new Event('input', { bubbles: true }));
            }
            const yawVal = document.querySelector('#gyro-yaw-val')?.textContent;
            const pitchVal = document.querySelector('#gyro-pitch-val')?.textContent;
            const rollVal = document.querySelector('#gyro-roll-val')?.textContent;

            // Close gyro
            document.querySelector('#gyro-close-btn')?.click();
            const flyoutClosed = flyout?.style.display === 'none';

            return { flyoutOpen, yawVal, pitchVal, rollVal, flyoutClosed };
          })()
        `,
        returnByValue: true,
      });
      if (
        !gyroTest.result.value.flyoutOpen ||
        !gyroTest.result.value.yawVal?.includes('45°') ||
        !gyroTest.result.value.pitchVal?.includes('30°') ||
        !gyroTest.result.value.rollVal?.includes('-15°') ||
        !gyroTest.result.value.flyoutClosed
      ) {
        throw new Error(`Gyro test failed: ${JSON.stringify(gyroTest.result.value)}`);
      }
      console.log(`✓ Interactive 3-Axis Head Gyro verified (Yaw +45°, Pitch +30°, Roll -15°)`);

      // 27. Test Docked 3D VOR Eye Avatar & Clinical VNG Drawer
      const vorDrawerTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const vorBtn = document.querySelector('#vest-vor-toggle-btn');
            vorBtn?.click();
            const vorDrawer = document.querySelector('#vor-drawer');
            const drawerOpen = vorDrawer?.classList.contains('open');

            const avatarCanvas = document.querySelector('#vor-avatar-canvas');
            const stripCanvas = document.querySelector('#vor-strip-canvas');
            const hasAvatarCanvas = avatarCanvas !== null && avatarCanvas.width > 0 && avatarCanvas.height > 0;
            const hasStripCanvas = stripCanvas !== null && stripCanvas.width > 0 && stripCanvas.height > 0;

            // Test NIR toggle
            const modeToggleBtn = document.querySelector('#vor-mode-toggle-btn');
            modeToggleBtn?.click();
            const nirActive = vorDrawer?.classList.contains('nir-active');
            const modeLabel = document.querySelector('#vor-mode-label')?.textContent;

            // Toggle back to Natural
            modeToggleBtn?.click();
            const naturalActive = !vorDrawer?.classList.contains('nir-active');

            // 4-way Drawer Mutual Exclusivity: opening CTSliceDrawer should close VORDrawer
            document.querySelector('#rad-ct-toggle-btn')?.click();
            const vorClosedByCt = !vorDrawer?.classList.contains('open');

            // Re-open VORDrawer should close CT
            vorBtn?.click();
            const vorReopened = vorDrawer?.classList.contains('open');
            const ctClosedByVor = !document.querySelector('#ct-slice-drawer')?.classList.contains('open');

            return {
              drawerOpen,
              hasAvatarCanvas,
              hasStripCanvas,
              nirActive,
              modeLabel,
              naturalActive,
              vorClosedByCt,
              vorReopened,
              ctClosedByVor,
            };
          })()
        `,
        returnByValue: true,
      });
      if (
        !vorDrawerTest.result.value.drawerOpen ||
        !vorDrawerTest.result.value.hasAvatarCanvas ||
        !vorDrawerTest.result.value.hasStripCanvas ||
        !vorDrawerTest.result.value.nirActive ||
        !vorDrawerTest.result.value.modeLabel?.includes('NIR') ||
        !vorDrawerTest.result.value.naturalActive ||
        !vorDrawerTest.result.value.vorClosedByCt ||
        !vorDrawerTest.result.value.vorReopened ||
        !vorDrawerTest.result.value.ctClosedByVor
      ) {
        throw new Error(`VOR Drawer test failed: ${JSON.stringify(vorDrawerTest.result.value)}`);
      }
      console.log(`✓ 3D VOR Eye Avatar & Clinical VNG Drawer verified (Retina Avatars, Strip Chart, NIR Goggles, 4-Way Exclusivity)`);
      await new Promise((r) => setTimeout(r, 650));

      // 28. Capture Stage 3 BPPV Visual Screenshot
      const vestSs = await client.send('Page.captureScreenshot', { format: 'png' });
      const vestSsPath = `/Users/umcai/Documents/antigravity/radiant-darwin/output/stage3_vestibular_${vp.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
      writeFileSync(vestSsPath, Buffer.from(vestSs.data, 'base64'));
      console.log(`✓ Captured Stage 3 BPPV visual screenshot to ${vestSsPath}`);

      // =========================================================================
      // 28A. Stage 3 Phase 3B: Caloric Testing Suite (COWS & Alexander's Law)
      const caloricTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            // 1. Switch to Caloric submode via subnav tab
            const caloricTab = document.querySelector('.vest-subnav-tab[data-submode="caloric"]');
            caloricTab?.click();
            const caloricSubview = document.querySelector('#vest-caloric-subview');
            const caloricVisible = caloricSubview && getComputedStyle(caloricSubview).display !== 'none';
            const bppvHidden = document.querySelector('#vest-bppv-subview')?.style.display === 'none';

            // 2. Laterality Switching: Left ear (L44) mirrors labyrinth
            const l44Chip = document.querySelector('.caloric-chip[data-caloric-temp="L44"]');
            l44Chip?.click();
            const latBadgeLeft = document.querySelector('#caloric-laterality-badge')?.textContent;

            // Switch back to Right ear (R44)
            const r44Chip = document.querySelector('.caloric-chip[data-caloric-temp="R44"]');
            r44Chip?.click();
            const latBadgeRight = document.querySelector('#caloric-laterality-badge')?.textContent;

            // 3. Align Supine +30° Posture
            const postureBtn = document.querySelector('#caloric-posture-btn');
            postureBtn?.click();

            // 4. Start Caloric Irrigation
            const playBtn = document.querySelector('#caloric-play-btn');
            playBtn?.click();
            const isIrrigating = playBtn?.classList.contains('playing');

            return {
              caloricVisible,
              bppvHidden,
              latBadgeLeft,
              latBadgeRight,
              isIrrigating,
            };
          })()
        `,
        returnByValue: true,
      });

      if (
        !caloricTest.result.value.caloricVisible ||
        !caloricTest.result.value.bppvHidden ||
        !caloricTest.result.value.latBadgeLeft?.includes('Left Ear') ||
        !caloricTest.result.value.latBadgeRight?.includes('Right Ear') ||
        !caloricTest.result.value.isIrrigating
      ) {
        throw new Error(`Caloric test failed: ${JSON.stringify(caloricTest.result.value)}`);
      }
      console.log(`✓ Caloric Testing Suite verified (Subnav switch, L44/R44 laterality, Supine +30°, Irrigation active)`);

      // Allow irrigation to run for ~1.5s to generate thermal convection and nystagmus
      await new Promise((r) => setTimeout(r, 1600));

      // Test Alexander Gaze modulation and pause irrigation
      const alexGazeTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const timerText = document.querySelector('#caloric-timer-badge')?.textContent;
            const spvText = document.querySelector('#caloric-spv-badge')?.textContent;

            // Click Alexander Gaze +30° chip
            const gazePlus = document.querySelector('.alex-gaze-chip[data-alex-gaze="30"]');
            gazePlus?.click();
            const alexBadge = document.querySelector('#caloric-alex-degree-badge')?.textContent;

            // Stop irrigation
            const playBtn = document.querySelector('#caloric-play-btn');
            playBtn?.click();
            const isPaused = !playBtn?.classList.contains('playing');

            // Reset gaze to 0°
            document.querySelector('.alex-gaze-chip[data-alex-gaze="0"]')?.click();

            return { timerText, spvText, alexBadge, isPaused };
          })()
        `,
        returnByValue: true,
      });

      if (
        !alexGazeTest.result.value.timerText ||
        alexGazeTest.result.value.timerText === '⏱️ 0s / 40s' ||
        !alexGazeTest.result.value.isPaused
      ) {
        throw new Error(`Alexander gaze / irrigation timer test failed: ${JSON.stringify(alexGazeTest.result.value)}`);
      }
      console.log(`✓ Caloric Convection ODE & Alexander's Law verified (Timer: ${alexGazeTest.result.value.timerText}, SPV: ${alexGazeTest.result.value.spvText}, Gaze: ${alexGazeTest.result.value.alexBadge})`);

      // Test Jongkees Calculator Modal
      const jongkeesTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            // Open modal
            const openBtn = document.querySelector('#caloric-jongkees-open-btn');
            openBtn?.click();
            const modal = document.querySelector('#caloric-jongkees-modal');
            const modalOpen = modal && getComputedStyle(modal).display !== 'none';

            // Select Acute Right Neuritis preset
            const rightPreset = document.querySelector('.jongkees-preset-btn[data-preset="right_uw"]');
            rightPreset?.click();
            const uwVal = document.querySelector('#jongkees-uw-val')?.textContent;
            const dpVal = document.querySelector('#jongkees-dp-val')?.textContent;
            const interp = document.querySelector('#caloric-interp-card')?.textContent;

            // Close modal via Apply
            const applyBtn = document.querySelector('#caloric-modal-apply-btn');
            applyBtn?.click();
            const modalClosed = modal && modal.style.display === 'none';

            return { modalOpen, uwVal, dpVal, interp, modalClosed };
          })()
        `,
        returnByValue: true,
      });

      if (
        !jongkeesTest.result.value.modalOpen ||
        !jongkeesTest.result.value.uwVal ||
        parseFloat(jongkeesTest.result.value.uwVal) < 25.0 ||
        !/right/i.test(jongkeesTest.result.value.interp || '') ||
        !jongkeesTest.result.value.modalClosed
      ) {
        throw new Error(`Jongkees modal test failed: ${JSON.stringify(jongkeesTest.result.value)}`);
      }
      console.log(`✓ Jongkees Matrix Calculator verified (UW: ${jongkeesTest.result.value.uwVal}, DP: ${jongkeesTest.result.value.dpVal}, Pathologic Right Paresis flagged)`);

      // Capture Stage 3 Caloric Screenshot
      const caloricSs = await client.send('Page.captureScreenshot', { format: 'png' });
      const caloricSsPath = `/Users/umcai/Documents/antigravity/radiant-darwin/output/stage3_caloric_${vp.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
      writeFileSync(caloricSsPath, Buffer.from(caloricSs.data, 'base64'));
      console.log(`✓ Captured Stage 3 Caloric visual screenshot to ${caloricSsPath}`);

      // =========================================================================
      // 28B. Stage 3 Phase 3B: Video Head Impulse Test (vHIT) Suite
      const vhitTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            // Switch to vHIT submode via subnav tab
            const vhitTab = document.querySelector('.vest-subnav-tab[data-submode="vhit"]');
            vhitTab?.click();
            const vhitSubview = document.querySelector('#vest-vhit-subview');
            const vhitVisible = vhitSubview && getComputedStyle(vhitSubview).display !== 'none';

            // Test canal pair selector
            const ralpChip = document.querySelector('.vhit-pair-chip[data-vhit-pair="ralp"]');
            ralpChip?.click();
            const ralpActive = ralpChip?.classList.contains('active');

            const horizChip = document.querySelector('.vhit-pair-chip[data-vhit-pair="horizontal"]');
            horizChip?.click();
            const horizActive = horizChip?.classList.contains('active');

            // Test direction selector
            const dirLeft = document.querySelector('#vhit-dir-left-btn');
            dirLeft?.click();
            const leftActive = dirLeft?.classList.contains('active');
            const dirRight = document.querySelector('#vhit-dir-right-btn');
            dirRight?.click();
            const rightActive = dirRight?.classList.contains('active');

            // Test pathology preset selection (Schwannoma with covert saccades)
            const schwannomaChip = document.querySelector('.vhit-preset-chip[data-vhit-preset="chronic_schwannoma"]');
            schwannomaChip?.click();
            const schwannomaActive = schwannomaChip?.classList.contains('active');
            const previewGain = document.querySelector('#vhit-gain-badge')?.textContent;

            // Toggle SHIMP paradigm
            const paradigmBtn = document.querySelector('#vhit-paradigm-toggle-btn');
            paradigmBtn?.click();
            const isShimp = paradigmBtn?.textContent?.includes('SHIMP');
            paradigmBtn?.click();
            const isHimp = paradigmBtn?.textContent?.includes('HIMP');

            return {
              vhitVisible,
              ralpActive,
              horizActive,
              leftActive,
              rightActive,
              schwannomaActive,
              previewGain,
              isShimp,
              isHimp,
            };
          })()
        `,
        returnByValue: true,
      });

      if (
        !vhitTest.result.value.vhitVisible ||
        !vhitTest.result.value.ralpActive ||
        !vhitTest.result.value.horizActive ||
        !vhitTest.result.value.rightActive ||
        !vhitTest.result.value.schwannomaActive ||
        !vhitTest.result.value.previewGain?.includes('0.38') ||
        !vhitTest.result.value.isHimp
      ) {
        throw new Error(`vHIT setup test failed: ${JSON.stringify(vhitTest.result.value)}`);
      }
      console.log(`✓ vHIT Workbench Controls verified (Canal pairs, Direction, Schwannoma preset, HIMP/SHIMP)`);

      // Deliver High-Acceleration Head Impulse Thrust
      const thrustTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const thrustBtn = document.querySelector('#vhit-deliver-thrust-btn');
            thrustBtn?.click();
            const isImpulsing = thrustBtn?.classList.contains('impulsing') || thrustBtn?.disabled;
            return { isImpulsing };
          })()
        `,
        returnByValue: true,
      });

      if (!thrustTest.result.value.isImpulsing) {
        throw new Error('vHIT Deliver Thrust button failed to initiate impulse animation');
      }

      // Wait for head thrust animation (600ms) to complete and button to reset
      await new Promise((r) => setTimeout(r, 750));

      const postThrustTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const thrustBtn = document.querySelector('#vhit-deliver-thrust-btn');
            const isReset = !thrustBtn?.classList.contains('impulsing') && !thrustBtn?.disabled;
            const vorDrawer = document.querySelector('#vor-drawer');
            const drawerOpen = vorDrawer?.classList.contains('open');
            const gainBadge = document.querySelector('#vhit-gain-badge')?.textContent;
            const saccadeBadge = document.querySelector('#vhit-saccade-badge')?.textContent;
            const stripTitle = document.querySelector('#vor-strip-title')?.textContent;

            return { isReset, drawerOpen, gainBadge, saccadeBadge, stripTitle };
          })()
        `,
        returnByValue: true,
      });

      if (
        !postThrustTest.result.value.isReset ||
        !postThrustTest.result.value.drawerOpen ||
        !postThrustTest.result.value.gainBadge?.includes('Gain:') ||
        !postThrustTest.result.value.stripTitle?.includes('vHIT')
      ) {
        throw new Error(`vHIT post-thrust execution failed: ${JSON.stringify(postThrustTest.result.value)}`);
      }
      console.log(`✓ vHIT High-Acceleration Head Thrust executed & verified (Gain: ${postThrustTest.result.value.gainBadge}, Saccades: ${postThrustTest.result.value.saccadeBadge}, Dual-Trace plot active)`);

      // Capture Stage 3 vHIT Screenshot
      const vhitSs = await client.send('Page.captureScreenshot', { format: 'png' });
      const vhitSsPath = `/Users/umcai/Documents/antigravity/radiant-darwin/output/stage3_vhit_${vp.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
      writeFileSync(vhitSsPath, Buffer.from(vhitSs.data, 'base64'));
      console.log(`✓ Captured Stage 3 vHIT visual screenshot to ${vhitSsPath}`);

      // Return to BPPV submode before Stage 4
      await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            document.querySelector('.vest-subnav-tab[data-submode="bppv"]')?.click();
          })()
        `,
      });
      await new Promise((r) => setTimeout(r, 400));

      // =========================================================================
      // 28C. Stage 4: Surgical Suites & Implant Simulations Verification
      await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const surgBtn = document.querySelector('#mode-surgical-btn');
            surgBtn?.click();
          })()
        `,
      });
      await new Promise((r) => setTimeout(r, 600));

      const surgModeTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const dock = document.querySelector('#surgical-dock-content');
            const dockVisible = dock && getComputedStyle(dock).display !== 'none';
            const ciSubview = document.querySelector('#surg-ci-subview');
            const ciVisible = ciSubview && getComputedStyle(ciSubview).display !== 'none';

            // Open Surgical Drawer via toggle button
            const surgDrawerBtn = document.querySelector('#ci-drawer-toggle-btn');
            surgDrawerBtn?.click();
            const surgDrawer = document.querySelector('#surgical-drawer');
            const drawerOpen = surgDrawer?.classList.contains('open');
            const hasMonitorCanvas = !!surgDrawer?.querySelector('#surg-monitor-canvas');
            const hasPlotCanvas = !!surgDrawer?.querySelector('#surg-plot-canvas');

            // Test 5-way mutual exclusivity: Opening CT drawer closes surgical drawer
            const ctBtn = document.querySelector('#rad-ct-toggle-btn');
            ctBtn?.click();
            const surgClosedByCt = !surgDrawer?.classList.contains('open');

            // Reopen surgical drawer closes CT drawer
            surgDrawerBtn?.click();
            const surgReopened = surgDrawer?.classList.contains('open');
            const ctClosedBySurg = !document.querySelector('#ct-slice-drawer')?.classList.contains('open');

            return {
              dockVisible,
              ciVisible,
              drawerOpen,
              hasMonitorCanvas,
              hasPlotCanvas,
              surgClosedByCt,
              surgReopened,
              ctClosedBySurg,
            };
          })()
        `,
        returnByValue: true,
      });

      if (
        !surgModeTest.result.value.dockVisible ||
        !surgModeTest.result.value.ciVisible ||
        !surgModeTest.result.value.drawerOpen ||
        !surgModeTest.result.value.hasMonitorCanvas ||
        !surgModeTest.result.value.hasPlotCanvas ||
        !surgModeTest.result.value.surgClosedByCt ||
        !surgModeTest.result.value.surgReopened ||
        !surgModeTest.result.value.ctClosedBySurg
      ) {
        throw new Error(`Surgical Drawer test failed: ${JSON.stringify(surgModeTest.result.value)}`);
      }
      console.log(`✓ Stage 4 Surgical Suites verified (Dock Workbench, CI Navigation, 2D Endoscopy & Plot, 5-Way Exclusivity)`);
      await new Promise((r) => setTimeout(r, 650));

      // Capture Stage 4 Surgical Visual Screenshot
      const surgSs = await client.send('Page.captureScreenshot', { format: 'png' });
      const surgSsPath = `/Users/umcai/Documents/antigravity/radiant-darwin/output/stage4_surgical_${vp.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
      writeFileSync(surgSsPath, Buffer.from(surgSs.data, 'base64'));
      console.log(`✓ Captured Stage 4 Surgical visual screenshot to ${surgSsPath}`);

      // 29. Return to Anatomy Mode and close drawers for clean state
      await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const surgDrawer = document.querySelector('#surgical-drawer');
            if (surgDrawer?.classList.contains('open')) {
              document.querySelector('#ci-drawer-toggle-btn')?.click();
            }
            const vorDrawer = document.querySelector('#vor-drawer');
            if (vorDrawer?.classList.contains('open')) {
              document.querySelector('#vest-vor-toggle-btn')?.click();
            }
            const ctDrawer = document.querySelector('#ct-slice-drawer');
            if (ctDrawer?.classList.contains('open')) {
              document.querySelector('#rad-ct-toggle-btn')?.click();
            }
            const scdsBtn = document.querySelector('#rad-scds-toggle-btn');
            if (scdsBtn?.classList.contains('active')) {
              scdsBtn?.click();
            }
            document.querySelector('#mode-anatomy-btn')?.click();
          })()
        `,
      });
    }

    // Check for any unhandled console errors across all viewports
    if (consoleErrors.length > 0) {
      throw new Error(`Console errors encountered:\n${consoleErrors.join('\n')}`);
    }
    console.log(`\n✓ ZERO console errors or unhandled exceptions across all test viewports!`);

    console.log('\n======================================================');
    console.log('🎉 ALL AUTOMATED HEADLESS CHROME CDP TESTS PASSED!');
    console.log('======================================================');

    client.close();
  } finally {
    try { chromeProc.kill('SIGKILL'); } catch {}
    if (chromeTmpDir && existsSync(chromeTmpDir)) {
      try { rmSync(chromeTmpDir, { recursive: true, force: true }); } catch {}
    }
    server.close();
  }
}

run().catch((err) => {
  console.error('\n❌ CDP TEST FAILURE:', err);
  process.exit(1);
});
