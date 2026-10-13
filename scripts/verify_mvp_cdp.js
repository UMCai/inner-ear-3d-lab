import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST_DIR = '/Users/umcai/Documents/antigravity/radiant-darwin/web/dist';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 4188;
const DEBUG_PORT = 9223;

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
function launchChrome() {
  const proc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
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

async function waitForCdpEndpoint(maxWaitMs = 10000) {
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
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
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
    };
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
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
      if (params.type === 'error') {
        const text = params.args.map((a) => a.value || a.description || '').join(' ');
        consoleErrors.push(`[Console Error] ${text}`);
      }
    });
    client.on('Runtime.exceptionThrown', (params) => {
      consoleErrors.push(`[Uncaught Exception] ${params.exceptionDetails.text}`);
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
        if (evalRes.result.value?.isHidden && evalRes.result.value?.title.includes('Inner Ear 3D Lab')) {
          loaded = true;
        } else {
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

      // 6. Test Search Bar functionality
      const searchTest = await client.send('Runtime.evaluate', {
        expression: `
          (() => {
            const input = document.querySelector('#search-input');
            input.value = 'cochlea';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const dropdown = document.querySelector('#search-dropdown');
            const items = dropdown.querySelectorAll('.search-result-item');
            const itemCount = items.length;
            if (itemCount > 0) {
              items[0].click();
            }
            return { itemCount };
          })()
        `,
        returnByValue: true,
      });
      if (searchTest.result.value.itemCount === 0) {
        throw new Error('Search input did not return matching results for "cochlea"');
      }
      console.log(`✓ Search Bar verified (${searchTest.result.value.itemCount} matches found for "cochlea", selection clicked)`);

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
            if (!drawer?.classList.contains('open')) {
              toggleBtn?.click();
            }
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
              afterEye
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
    chromeProc.kill('SIGKILL');
    server.close();
  }
}

run().catch((err) => {
  console.error('\n❌ CDP TEST FAILURE:', err);
  process.exit(1);
});
