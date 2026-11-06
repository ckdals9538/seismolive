import { chromium } from "npm:playwright-core";

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--no-sandbox", "--disable-gpu-watchdog"]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto("http://localhost:8933/prototype_g2_continuous_seismic_world.html");
await page.waitForFunction(() => window.__SCENE_READY__ === true, { timeout: 30000 });

// Set camera to look close at epicenter
await page.evaluate(() => {
  // EPI_POS is (0.0, 0.03365)
  // Let's position camera looking down at epicenter
  const cam = window.__MAIN_CAMERA__;
  if (cam) {
    cam.position.set(0.0, 0.18, 0.10);
    cam.lookAt(0.0, 0.0, 0.03365);
  }
});

for (const t of [0.5, 1.0, 2.0, 3.0, 3.5]) {
  await page.evaluate((simT) => {
    window.setSimTime(simT);
  }, t);
  await page.waitForTimeout(100);
  await page.screenshot({ path: `captures/epicenter_zoom_t${t.toFixed(1)}.png` });
  console.log(`Captured t=${t.toFixed(1)}`);
}

await browser.close();
console.log("Done");
