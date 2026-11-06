import { chromium } from "npm:playwright-core";
import { serveDir } from "jsr:@std/http/file-server";

const ac = new AbortController();
Deno.serve({ port: 8933, signal: ac.signal }, req => serveDir(req, { fsRoot: "/Users/katsina/Downloads/earth" }));

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"]
});

const page = await browser.newPage();
page.on("console", msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
page.on("pageerror", err => console.log(`[Browser PageError]: ${err.stack || err.message}`));

await page.goto("http://localhost:8933/prototype_g2_continuous_seismic_world.html");
await new Promise(r => setTimeout(r, 4000));

await browser.close();
ac.abort();
