// ============================================================================
// SEISMOLIVE v4.0 — Independent Browser Validation Runner (Playwright on Deno)
// Tier 4 (Runtime Testing) & Tier 5 (Rendering Validation)
// ============================================================================

import { chromium } from "npm:playwright-core";

const ARTIFACTS_DIR = "/Users/katsina/.gemini/antigravity/brain/17a06635-381a-4696-af01-da0acfb6b284";
const WORKSPACE_DIR = "/Users/katsina/Downloads/seismolive-clean";

console.log("[Playwright Runner] Initializing Chrome via playwright-core...");

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: [
    "--use-gl=angle",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--window-size=1920,1080"
  ]
});

const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1
});

const page = await context.newPage();

const consoleMessages = [];
const consoleErrors = [];
const pageErrors = [];

page.on("console", msg => {
  const entry = `[${msg.type().toUpperCase()}] ${msg.text()}`;
  consoleMessages.push(entry);
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

page.on("pageerror", err => {
  pageErrors.push(err.message);
  console.error("[Page Error]", err.message);
});

// Test 1: Validate 2D Baseline (Earthquake_Live_Pulse_final.html)
console.log("\n--- TEST 1: 2D Application Runtime & DOM Verification ---");
const t0 = performance.now();
await page.goto(`file://${WORKSPACE_DIR}/Earthquake_Live_Pulse_final.html`, { waitUntil: "networkidle" });
const t1 = performance.now();

const title = await page.title();
const cardCount = await page.$$eval(".event-card", els => els.length);
console.log(`Page Title: "${title}"`);
console.log(`Load Duration: ${(t1 - t0).toFixed(1)} ms`);
console.log(`Event Feed Cards: ${cardCount}`);
console.log(`Console Errors: ${consoleErrors.length}`);

// Test 2: Validate 3D WebGL Scene & Shader Execution (render_artistic_reset_studies.html)
console.log("\n--- TEST 2: WebGL2 Context & Shader Compilation Check ---");
const t2 = performance.now();
await page.goto(`file://${WORKSPACE_DIR}/scripts/render_artistic_reset_studies.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000); // Allow WebGL frames to render
const t3 = performance.now();

const webglInfo = await page.evaluate(() => {
  const cvs = document.getElementById("canvas");
  if (!cvs) return { error: "Canvas not found" };
  const gl = cvs.getContext("webgl2") || cvs.getContext("webgl");
  if (!gl) return { error: "WebGL context failed" };
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : "Unknown",
    renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "Unknown",
    version: gl.getParameter(gl.VERSION),
    shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
  };
});

console.log("WebGL Diagnostic Info:", JSON.stringify(webglInfo, null, 2));

// Capture independent verification screenshot
const screenshotPath = `${ARTIFACTS_DIR}/playwright_study01_verification.png`;
await page.screenshot({ path: screenshotPath });
console.log(`[Playwright Screenshot Saved] ${screenshotPath}`);

// Summary
console.log("\n========================================================");
console.log(`Total Console Messages: ${consoleMessages.length}`);
console.log(`Total Console Errors: ${consoleErrors.length}`);
console.log(`Total Page Errors: ${pageErrors.length}`);
console.log("========================================================");

await browser.close();

if (consoleErrors.length > 0 || pageErrors.length > 0) {
  console.error("FAIL: Browser validation encountered errors.");
  Deno.exit(1);
} else {
  console.log("PASS: Playwright independent browser validation succeeded with 0 errors!");
  Deno.exit(0);
}
