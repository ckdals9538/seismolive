// Capture performance frames for visual QA: deno run -A scripts/capture_event_frames.js <eventId> <prefix>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'npm:playwright';

const EVENT_ID = Deno.args[0] || 'global_2023_turkey';
const PREFIX = Deno.args[1] || 'qa';
const PORT = 8091;
const ROOT = Deno.cwd();
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.bin': 'application/octet-stream', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});

server.listen(PORT, async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-webgl', '--use-gl=angle', '--use-angle=metal']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => console.error('[PageError]', e.message));
  page.on('console', m => { if (m.type() === 'error' || /THREE\.WebGLProgram|shader/i.test(m.text())) console.error('[Console]', m.text().slice(0, 600)); });
  try {
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `scratch/${PREFIX}_0_orbit.png` });
    await page.evaluate(async (id) => { await window.controlSurface.selectEvent({ id, eventId: id }); }, EVENT_ID);
    for (const [i, t] of [[1, 6000], [2, 5000], [3, 6000]]) {
      await page.waitForTimeout(t);
      if (i === 2) {
        const info = await page.evaluate(() => {
          return window.scene.children.filter(c => c.visible).map(c => ({
            name: c.name || c.constructor.name,
            type: c.type,
            renderOrder: c.renderOrder,
            mat: c.material ? (c.material.type + (c.material.transparent ? ' (transp)' : ' (opaque)')) : 'none',
            numChildren: c.children.length
          }));
        });
        console.log('[SCENE_VISIBLE]', JSON.stringify(info, null, 2));
      }
      await page.screenshot({ path: `scratch/${PREFIX}_${i}.png` });
    }
    console.log('CAPTURE_OK');
  } catch (e) { console.error(e); } finally { await browser.close(); server.close(); }
});
