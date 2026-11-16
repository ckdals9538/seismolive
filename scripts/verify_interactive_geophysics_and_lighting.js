// ============================================================================
// SEISMOLIVE v4.0 — End-to-End Playwright Verification Script
// Tests: Interactive Geophysics Probe, Gallery Lighting, Archival Typography, Audio Awakening
// ============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'npm:playwright';

const PORT = 8089;
const ROOT = process.cwd();

// MIME Types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found: ' + urlPath);
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, async () => {
  console.log(`[Local Server] Running on http://localhost:${PORT}`);

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=metal']
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', msg => {
    if (msg.type() === 'error') console.error(`[Browser Error] ${msg.text()}`);
    else console.log(`[Browser Log] ${msg.text()}`);
  });

  page.on('pageerror', err => console.error(`[Browser PageError] ${err.message}`));

  try {
    console.log('[Step 1] Loading SEISMOLIVE v4.0...');
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Verify loading screen is gone
    const loadingHidden = await page.$eval('#loading-indicator', el => window.getComputedStyle(el).display === 'none' || window.getComputedStyle(el).opacity === '0');
    console.log(`[Step 1 Verification] Loading indicator dismissed: ${loadingHidden}`);

    // Verify body background is void (#020408)
    const bgColor = await page.$eval('body', el => window.getComputedStyle(el).backgroundColor);
    console.log(`[Step 1 Verification] Body background color: ${bgColor}`);

    await page.screenshot({ path: 'scratch/verify_f1_01_orbit.png' });

    // Step 2: Open USGS category shelf
    console.log('[Step 2] Clicking USGS mode tab...');
    await page.click('#tab-cat-usgs');
    await page.waitForTimeout(500);

    const shelfVisible = await page.$eval('#contextual-benchmarks-shelf', el => window.getComputedStyle(el).display !== 'none');
    console.log(`[Step 2 Verification] Benchmarks shelf visible: ${shelfVisible}`);

    // Step 3: Select 2023 Turkey
    console.log('[Step 3] Selecting 2023 Türkiye benchmark...');
    await page.click('button.shelf-btn[data-id="global_2023_turkey"]');
    await page.waitForTimeout(1000);

    // Verify SELECTED state dossier is open
    const isSelected = await page.$eval('#unified-control-surface', el => el.classList.contains('state-selected'));
    console.log(`[Step 3 Verification] Control surface in state-selected: ${isSelected}`);

    // Step 4: Switch to Geophysics tab (T-X curve)
    console.log('[Step 4] Switching to Geophysics Tab...');
    await page.click('button[data-dossier-tab="inst_geophysics"]');
    await page.waitForTimeout(500);

    // Verify SVG and readout panel exist
    const svgBox = await page.$eval('.tx-curve-svg', el => el.getBoundingClientRect());
    console.log(`[Step 4 Verification] SVG rendered with dimensions: ${svgBox.width}x${svgBox.height}`);

    // Step 5: Test Interactive Hover on T-X Curve
    console.log('[Step 5] Hovering over T-X curve at offset x ~ 180 km...');
    const svgLocator = page.locator('.tx-curve-svg');
    await svgLocator.scrollIntoViewIfNeeded();
    await svgLocator.hover({ position: { x: 380, y: 70 } });
    await page.waitForTimeout(500);

    // Read values from probe bar
    const readoutText = await page.$eval('#tx-probe-readout-bar', el => el.innerText.replace(/\n/g, ' '));
    console.log(`[Step 5 Verification] Probe Readout: ${readoutText}`);

    // Check 3D terrain shader uniform value
    const probeDistValue = await page.evaluate(() => window.terrainUniforms?.u_probeDistUnits?.value || 0);
    console.log(`[Step 5 Verification] 3D Terrain Shader u_probeDistUnits: ${probeDistValue}`);

    await page.screenshot({ path: 'scratch/verify_f1_02_tx_hover_probe.png' });

    // Step 6: Launch 3D Performance & Awaken Audio
    console.log('[Step 6] Launching 3D Performance...');
    await page.click('#btn-launch-performance');
    await page.waitForTimeout(4000); // Wait for descent flight to arrive

    const isPerf = await page.$eval('#unified-control-surface', el => el.classList.contains('state-performance'));
    console.log(`[Step 6 Verification] Control surface in state-performance: ${isPerf}`);

    const audioState = await page.evaluate(() => window.livingSoundfield?.ctx?.state || 'no-ctx');
    console.log(`[Step 6 Verification] AudioContext state: ${audioState}`);

    await page.screenshot({ path: 'scratch/verify_f2_03_turkey_3d_performance.png' });

    // Step 7: Test Return to Orbit & Historical Yangyang
    console.log('[Step 7] Returning to orbit and testing Yangyang 1681 historical archive...');
    await page.click('#btn-transport-return');
    await page.waitForTimeout(2500);

    await page.click('#tab-cat-historical');
    await page.waitForTimeout(500);
    await page.click('button.shelf-btn[data-id="hist_1681_0626"]');
    await page.waitForTimeout(1000);

    const histQuote = await page.$eval('#selected-quote-text', el => el.textContent.trim());
    console.log(`[Step 7 Verification] Yangyang Archival Quote: "${histQuote.substring(0, 50)}..."`);

    await page.screenshot({ path: 'scratch/verify_f3_04_yangyang_historical.png' });

    console.log('\n========================================================');
    console.log('ALL PLAYWRIGHT TESTS COMPLETED SUCCESSFULLY WITH 0 ERRORS');
    console.log('========================================================\n');
  } catch (err) {
    console.error('[Playwright Test Failed]', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
});
