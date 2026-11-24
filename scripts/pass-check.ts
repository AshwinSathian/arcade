// Drives /pass.js in a real browser against a stand-in machine (tests/fixtures/game.html).
// Usage: node scripts/pass.ts && node scripts/pass-check.ts
import { chromium, type Page } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import assert from "node:assert/strict";

const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  const path = new URL(req.url!, "http://x").pathname;
  for (const dir of ["public", "tests/fixtures"]) {
    try {
      const body = await readFile(join(dir, path === "/" ? "game.html" : path));
      res.writeHead(200, { "content-type": types[extname(path)] ?? "text/html" });
      return res.end(body);
    } catch { /* next */ }
  }
  res.writeHead(404).end();
}).listen(0);
const base = `http://localhost:${(server.address() as { port: number }).port}`;
const browser = await chromium.launch();
const errors: string[] = [];
const open = async (block = false) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  if (block) await page.route("**/pass.js", (r) => r.abort());
  await page.goto(`${base}/game.html`);
  return page;
};
const card = (p: Page) => p.evaluate(() => window.arcadePass!.card());

try {
  // 1. A direct visit: the cabinet greets you, and Enter in it never reaches the game.
  let p = await open();
  await p.waitForFunction(() => window.arcadePass?.ready);
  assert.equal((await card(p)).tok, 12);
  await p.keyboard.press("Enter"); // focus is on "Insert token"
  await p.waitForTimeout(600);
  assert.equal(await p.locator("#keys").textContent(), "0", "a key leaked through the pass");
  let c = await card(p);
  assert.deepEqual([c.tok, c.cr.coil], [11, 3]);

  // 2. Runs use plays; a great run pays, plus a new best; a quit pays nothing.
  assert.equal(await p.evaluate(() => window.startRun("classic")), true);
  await p.waitForTimeout(1700);
  await p.evaluate(() => window.endRun({ mode: "classic", score: 5000 }));
  c = await card(p);
  assert.deepEqual([c.tok, c.cr.coil], [15, 2], "3 for a great run, 1 for the best");
  await p.evaluate(() => window.startRun("classic"));
  await p.evaluate(() => window.endRun({ mode: "classic", quit: true }));
  assert.equal((await card(p)).tok, 15);
  assert.equal(await p.evaluate(() => window.startRun("zen")), true);
  assert.equal((await card(p)).cr.coil, 1, "zen is free");
  await p.evaluate(() => window.endRun({ mode: "zen", quit: true }));

  // 2b. Open the card from the chip and close it: the game hears its keys again, and Copy doesn't close the card.
  await p.locator("arcade-pass").evaluate((h) => (h as HTMLElement).focus());
  const before = Number(await p.locator("#keys").textContent());
  await p.evaluate(() => window.arcadePass!.open());
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  await p.keyboard.press("ArrowLeft");
  assert.equal(Number(await p.locator("#keys").textContent()), before + 1, "keys stop reaching the game after the card closes");

  // 2c. A token that came back while away shows at once.
  await p.evaluate(() => { const c = window.arcadePass!.card(); c.tok = 0; c.at = Date.now() - 16 * 60_000; document.cookie = `arcade_card=${btoa(JSON.stringify(c)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}; Path=/`; });
  assert.equal((await card(p)).tok, 1, "refilled token not shown");

  // 3. Out of tokens: the start is refused and nothing changes.
  await p.evaluate(() => { const c = window.arcadePass!.card(); c.tok = 0; c.cr = {}; c.at = Date.now(); document.cookie = `arcade_card=${btoa(JSON.stringify(c)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}; Path=/`; });
  assert.equal(await p.evaluate(() => window.startRun("classic")), false);
  await p.keyboard.press("Escape");

  // 4. Coming from the hall: no greeting, and the same card.
  await p.evaluate(() => window.arcadePass!.handoff("coil"));
  await p.evaluate(() => sessionStorage.clear());
  await p.reload();
  await p.waitForFunction(() => window.arcadePass?.ready);
  await p.keyboard.press("Enter");
  assert.equal(await p.locator("#keys").textContent(), "1", "with no greeting open, the game hears its keys");
  await p.screenshot({ path: ".shots/pass-chip.png" });

  // 5. A fresh visitor sees the welcome dialog.
  p = await open();
  await p.waitForTimeout(500);
  await p.screenshot({ path: ".shots/pass-welcome.png" });

  // 6. No pass at all: the game still runs, with no errors.
  p = await open(true);
  assert.equal(await p.evaluate(() => window.startRun("classic")), true);
  assert.deepEqual(errors, []);
  console.log("pass-check: all good");
} finally {
  await browser.close();
  server.close();
}
declare global { interface Window { startRun(mode: string): boolean; endRun(d: object): void } }
