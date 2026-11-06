// scripts/test_phase5_diagnostics.js
import { chromium } from "npm:playwright-core";
import { serveDir } from "jsr:@std/http/file-server";

const WORKSPACE_DIR = "/Users/katsina/Downloads/earth";
const PORT = 8915;

console.log(`[Phase 5 Diagnostic] Starting server on port ${PORT}...`);
const ac = new AbortController();
const server = Deno.serve({ port: PORT, signal: ac.signal }, req => {
  return serveDir(req, { fsRoot: WORKSPACE_DIR });
});

console.log("[Phase 5 Diagnostic] Launching browser...");
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: [
    "--use-gl=angle",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--window-size=1280,720"
  ]
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1
});

const page = await context.newPage();
const consoleMsgs = [];
const errors = [];
page.on("console", msg => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", err => errors.push(err.toString()));

console.log("[Phase 5 Diagnostic] Navigating...");
await page.goto(`http://localhost:${PORT}/prototype_g2_continuous_seismic_world.html`, { waitUntil: "networkidle" });

console.log("[Phase 5 Diagnostic] Waiting for scene initialization...");
await page.waitForFunction(() => {
  const loading = document.getElementById("loading-indicator");
  return loading && loading.style.display === "none" && window.__PROTOTYPE_METRICS__ !== null;
}, { timeout: 30000 });

console.log("[Phase 5 Diagnostic] Scene loaded!");

// Check prototype metrics
const metrics = await page.evaluate(() => window.__PROTOTYPE_METRICS__);
console.log("Prototype Metrics:", JSON.stringify(metrics, null, 2));

// Test diagnostic function across key timestamps
const testTimes = [0.0, 3.5, 6.0, 9.0, 12.0, 14.5, 17.0, 20.0];
console.log("\n--- Testing window.__CHECK_ARCHIVAL_ENGINES__() across timeline ---");

for (const t of testTimes) {
  const diag = await page.evaluate(({ t }) => {
    // Set simTime and update displays
    const slider = document.getElementById("slider-time");
    slider.value = t;
    slider.dispatchEvent(new Event("input"));
    return window.__CHECK_ARCHIVAL_ENGINES__();
  }, { t });

  console.log(`\n>> simTime: ${diag.simTime}s (Active: ${diag.activeUnitsCount}, Collisions: ${diag.collisionCount})`);
  diag.units.forEach(u => {
    console.log(`  - [${u.id}] (${u.displayWord} / ${u.sourcePhrase}): state=${u.lifecycleState}, opacity=${u.opacity}, NDC=(${u.ndcPos.x}, ${u.ndcPos.y}), inBounds=${u.isWithinNDCGuard}, cleaned=${u.isCleanedUp}`);
  });
}

console.log("\nConsole Messages:", consoleMsgs.slice(-10));
if (errors.length > 0) {
  console.error("Page Errors found:", errors);
} else {
  console.log("ZERO PAGE ERRORS! Diagnostic verification SUCCESSFUL.");
}

await browser.close();
ac.abort();
Deno.exit(errors.length > 0 ? 1 : 0);
