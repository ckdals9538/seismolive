// ============================================================================
// SEISMOLIVE v4.0 — UNORM16 & WebGL2 Hardware Normalization Runner
// ============================================================================

import { chromium } from "npm:playwright-core";
import { serveDir } from "jsr:@std/http/file-server";

const WORKSPACE_DIR = "/Users/katsina/Downloads/seismolive-clean";
const PORT = 8899;

console.log("[Verification Runner] Starting local static server on port " + PORT + "...");
const ac = new AbortController();
const server = Deno.serve({ port: PORT, signal: ac.signal }, req => {
  return serveDir(req, { fsRoot: WORKSPACE_DIR });
});

console.log("[Verification Runner] Launching headless Chrome via Playwright...");
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: [
    "--use-gl=angle",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--window-size=1024,768"
  ]
});

const page = await browser.newPage();
const consoleLogs = [];
page.on("console", msg => {
  consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  console.log(`[Browser Console] ${msg.text()}`);
});

page.on("pageerror", err => {
  console.error("[Browser Page Error]", err);
});

console.log(`[Verification Runner] Navigating to http://localhost:${PORT}/scripts/verify_unorm16_rendering.html ...`);
await page.goto(`http://localhost:${PORT}/scripts/verify_unorm16_rendering.html`, { waitUntil: "networkidle" });

// Wait until window.__verificationResults.ready is true
await page.waitForFunction(() => window.__verificationResults && window.__verificationResults.ready === true, { timeout: 15000 });

const results = await page.evaluate(() => window.__verificationResults);

console.log("\n========================================================");
console.log("UNORM16 & WebGL2 VERIFICATION RESULTS SUMMARY:");
console.log(JSON.stringify(results, null, 2));
console.log("========================================================\n");

await browser.close();
ac.abort();

if (!results.success) {
  console.error("FAIL: UNORM16 verification did not succeed!");
  Deno.exit(1);
} else {
  console.log("PASS: UNORM16 hardware normalization and UV mapping empirically verified!");
  Deno.exit(0);
}
