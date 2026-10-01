// Records every scene in build/timings.json to build/clips/<id>.mp4, each
// exactly as long as its narration. Slides come from slides.html; app scenes
// drive the real dashboard at APP_URL in one continuous browser session.
//
//   node demo/record.mjs            # app quotes served from mock-quotes.json
//   LIVE=1 node demo/record.mjs     # app quotes from the real CMC API
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(HERE, "build");
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const FPS = 30;
const VIEW = { width: 1280, height: 720 };
const SCALE = 1.5; // 1280x720 CSS px -> 1920x1080 frames

const timings = JSON.parse(fs.readFileSync(path.join(BUILD, "timings.json"), "utf8"));
const mockQuotes = JSON.parse(fs.readFileSync(path.join(HERE, "mock-quotes.json"), "utf8"));
const only = process.argv[2]; // optional: record a single scene id (or "app")
fs.mkdirSync(path.join(BUILD, "clips"), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Captures painted frames via CDP screencast; encodes them to a constant-fps clip. */
async function startCapture(page) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp, buf: Buffer.from(data, "base64") });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg", quality: 92,
    maxWidth: VIEW.width * SCALE, maxHeight: VIEW.height * SCALE,
  });
  const t0 = Date.now() / 1000;
  return {
    t0,
    async stop(outFile, duration) {
      await cdp.send("Page.stopScreencast");
      await cdp.detach();
      const dir = outFile + ".frames";
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir);
      const end = t0 + duration;
      const usable = frames.filter((f) => f.t < end);
      if (usable.length === 0) throw new Error(`no frames captured for ${outFile}`);
      let list = "";
      usable.forEach((f, i) => {
        const name = `${String(i).padStart(6, "0")}.jpg`;
        fs.writeFileSync(path.join(dir, name), f.buf);
        const start = i === 0 ? t0 : f.t;
        const next = i + 1 < usable.length ? usable[i + 1].t : end;
        list += `file '${name}'\nduration ${Math.max(0.001, next - start).toFixed(4)}\n`;
      });
      list += `file '${String(usable.length - 1).padStart(6, "0")}.jpg'\n`;
      fs.writeFileSync(path.join(dir, "list.txt"), list);
      execFileSync("ffmpeg", [
        "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"),
        "-vf", `scale=1920:1080:flags=lanczos,fps=${FPS},format=yuv420p`,
        "-t", duration.toFixed(3), "-c:v", "libx264", "-preset", "medium", "-crf", "18", outFile,
      ]);
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`  ${path.basename(outFile)}: ${usable.length} frames, ${duration.toFixed(2)}s`);
    },
  };
}

async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE, colorScheme: "dark" });
  return ctx.newPage();
}

// ---------------------------------------------------------------- slides

async function recordSlide(browser, scene) {
  const page = await newPage(browser);
  const cues = scene.cues.map((c) => c.start);
  await page.goto(pathToFileURL(path.join(HERE, "slides.html")).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle").catch(() => {});
  const cap = await startCapture(page);
  await page.evaluate(({ id, cues }) => window.play(id, cues), { id: scene.id, cues });
  await sleep(scene.duration * 1000 + 300);
  await cap.stop(path.join(BUILD, "clips", `${scene.id}.mp4`), scene.duration);
  await page.context().close();
}

// ---------------------------------------------------------------- app

const OVERLAY = `
  (() => {
    const css = document.createElement('style');
    css.textContent = \`
      #demo-cursor { position: fixed; z-index: 99999; left: 0; top: 0; width: 22px; height: 22px; pointer-events: none;
        transform: translate(-3px,-2px); filter: drop-shadow(0 2px 4px rgba(0,0,0,.6)); }
      .demo-ripple { position: fixed; z-index: 99998; width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%;
        border: 2px solid #5eead4; pointer-events: none; animation: demo-rip .5s ease-out forwards; }
      @keyframes demo-rip { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.4); opacity: 0 } }
      .demo-hl { outline: 2px solid rgba(94,234,212,.85) !important; outline-offset: 4px;
        box-shadow: 0 0 0 9px rgba(94,234,212,.10), 0 0 40px rgba(94,234,212,.18) !important;
        transition: outline-color .3s, box-shadow .3s; border-radius: 12px; }
    \`;
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#fff" stroke="#0b0d10" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.head.appendChild(css); document.body.appendChild(cursor);
    cursor.style.left = '-50px';
    addEventListener('mousemove', (e) => { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', (e) => {
      const r = document.createElement('div'); r.className = 'demo-ripple';
      r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 600);
    }, true);
  })();
`;

async function recordApp(browser, scenes) {
  const page = await newPage(browser);
  // The first quotes response is held until capture starts, so the video
  // opens on the dashboard's loading state and shows it filling in.
  let release;
  const gate = new Promise((r) => (release = r));
  if (!process.env.LIVE) {
    await page.route("**/api/quotes?**", async (route) => {
      await gate;
      const symbols = new URL(route.request().url()).searchParams.get("symbols").split(",");
      const quotes = Object.fromEntries(symbols.filter((s) => mockQuotes[s]).map((s) => [s, mockQuotes[s]]));
      await sleep(700); // a realistic round-trip so the loading state is visible
      await route.fulfill({ json: { quotes, missing: symbols.filter((s) => !mockQuotes[s]), source: "keyless" } });
    });
  } else release();
  await page.goto(APP_URL);
  await page.evaluate(() => document.fonts.ready);
  await sleep(500);
  await page.evaluate(OVERLAY); // after hydration, so React doesn't discard it

  const cap = await startCapture(page);
  const total = scenes.reduce((s, sc) => s + sc.duration, 0);
  let sceneStart = 0;
  const at = async (sec) => { // wait until `sec` seconds into the current scene
    const wait = cap.t0 + sceneStart + sec - Date.now() / 1000;
    if (wait > 0) await sleep(wait * 1000);
  };

  let mouse = { x: 640, y: 380 };
  const moveTo = async (x, y, steps = 30) => { await page.mouse.move(x, y, { steps }); mouse = { x, y }; };
  const box = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const click = async (loc) => { const p = await box(loc); await moveTo(p.x, p.y); await sleep(120); await page.mouse.down(); await page.mouse.up(); };
  const type = async (loc, text) => { await click(loc); await loc.pressSequentially(text, { delay: 110 }); };
  const hl = (loc) => page.evaluate((els) => {
    document.querySelectorAll(".demo-hl").forEach((e) => e.classList.remove("demo-hl"));
    els.forEach((e) => e.classList.add("demo-hl"));
  }, loc ? [loc] : []).catch(() => {});
  const hlLoc = async (loc) => hl(await loc.elementHandle());
  const scrollTo = (y, ms = 1200) => page.evaluate(([y, ms]) => new Promise((done) => {
    const from = scrollY, dy = Math.min(y, document.documentElement.scrollHeight - innerHeight) - from, t0 = performance.now();
    const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now) => { const t = Math.min(1, (now - t0) / ms); scrollTo(0, from + dy * ease(t)); t < 1 ? requestAnimationFrame(step) : done(); };
    requestAnimationFrame(step);
  }), [y, ms]);
  const scrollToLoc = async (loc, offset = 90, ms) => {
    const y = await loc.evaluate((e) => e.getBoundingClientRect().top + scrollY);
    await scrollTo(y - offset, ms);
  };
  const section = (title) => page.locator("h2", { hasText: title }).locator("xpath=..");
  const cue = (sc, i) => sc.cues[i].start;

  const steps = {
    "app-overview": async (sc) => {
      await sleep(1200);
      release();
      await page.locator("td", { hasText: "LINK" }).first().waitFor();
      await at(cue(sc, 1));
      await hlLoc(page.locator("span", { hasText: "BTC ×" }).locator(".."));
      await moveTo(330, 300);
      await at(cue(sc, 2));
      await hlLoc(page.locator("div.grid").first());
      await moveTo(700, 370, 40);
    },
    "app-add": async (sc) => {
      await hl(null);
      await hlLoc(page.locator("form"));
      const sym = page.getByPlaceholder("BTC"), qty = page.getByPlaceholder("1.5");
      const add = page.getByRole("button", { name: "Add holding" });
      await at(cue(sc, 1) - 0.2);
      await type(sym, "ONDO"); await type(qty, "1500"); await click(add);
      await sleep(900);
      await type(sym, "DOGE"); await type(qty, "5000"); await click(add);
      await at(cue(sc, 2));
      await hlLoc(page.locator("span", { hasText: "BTC ×" }).locator(".."));
      await moveTo(...Object.values(await box(page.getByRole("button", { name: "Remove DOGE" }))), 35);
      await at(cue(sc, 3));
      await hlLoc(page.locator("div.grid").first());
      await moveTo(900, 560, 40);
    },
    "app-stats": async (sc) => {
      const cards = page.locator("div.grid").first().locator(":scope > div");
      await hl(null);
      await at(cue(sc, 0)); await hlLoc(page.locator("div.grid").first());
      await at(cue(sc, 1)); await hlLoc(cards.nth(0)); await moveTo(...Object.values(await box(cards.nth(0))));
      await sleep(2600); await hlLoc(cards.nth(1)); await moveTo(...Object.values(await box(cards.nth(1))));
      await at(cue(sc, 2)); await hlLoc(cards.nth(2)); await moveTo(...Object.values(await box(cards.nth(2))));
      await sleep(2200); await hlLoc(cards.nth(3)); await moveTo(...Object.values(await box(cards.nth(3))));
      await at(cue(sc, 3) + 6); await hlLoc(cards.nth(2));
      await sleep(3500); await hlLoc(cards.nth(3));
    },
    "app-allocation": async (sc) => {
      await hl(null);
      await moveTo(1150, 400, 25);
      await scrollToLoc(section("Allocation by holding"), 60);
      await hlLoc(section("Allocation by holding"));
      await at(cue(sc, 1));
      await scrollToLoc(section("Sector exposure"), 200);
      await hlLoc(section("Sector exposure"));
    },
    "app-heatmap": async (sc) => {
      await hl(null);
      await scrollToLoc(section("Momentum correlation"), 40);
      await hlLoc(section("Momentum correlation"));
      const cell = (title) => page.locator(`div[title^="${title}"]`);
      await at(cue(sc, 1));
      await hlLoc(cell("ETH vs SOL")); await moveTo(...Object.values(await box(cell("ETH vs SOL"))));
      await at(cue(sc, 1) + 3.2);
      await hlLoc(cell("ONDO vs ETH")); await moveTo(...Object.values(await box(cell("ONDO vs ETH"))));
      await at(cue(sc, 2));
      await hlLoc(section("Momentum correlation"));
      await moveTo(1100, 420, 30);
    },
    "app-table": async (sc) => {
      await hl(null);
      await scrollToLoc(section("Holdings"), 60);
      await hlLoc(section("Holdings"));
      await at(cue(sc, 1));
      const evidence = section("API evidence");
      await scrollToLoc(evidence, 40);
      await hlLoc(evidence);
      await click(page.locator("summary"));
      await sleep(2500);
      await scrollToLoc(evidence, 20, 2500);
      await at(cue(sc, 2) - 1.2);
      await hl(null);
      await scrollTo(0, 1100);
      const refresh = page.getByRole("button", { name: "Refresh prices" });
      await hlLoc(refresh);
      await click(refresh);
    },
  };

  for (const sc of scenes) {
    console.log(`  ▸ ${sc.id}`);
    await steps[sc.id](sc);
    sceneStart += sc.duration;
    await at(0);
  }
  await cap.stop(path.join(BUILD, "clips", "app.mp4"), total);
  await page.context().close();
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
try {
  const appScenes = timings.filter((s) => s.kind === "app");
  if (!only || only === "app") {
    console.log("app");
    await recordApp(browser, appScenes);
  }
  for (const sc of timings.filter((s) => s.kind === "slide" && (!only || only === s.id))) {
    console.log(sc.id);
    await recordSlide(browser, sc);
  }
} finally {
  await browser.close();
}
