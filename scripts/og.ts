// Photographs the /og/* card pages of the built site into public/og/*.jpg, and draws the touch icon.
// Usage: npm run build && node scripts/og.ts   (then build again so dist carries the cards)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import sharp from 'sharp';

// Astro's preview runs in the background and reports the one already running, if any.
const said = execFileSync('npx', ['astro', 'preview', '--port', '4331'], { encoding: 'utf8' });
const started = !/already running/.test(said);
const base = said.match(/http:\/\/localhost:\d+/)![0];
for (let i = 0; i < 60; i++) {
  try { await fetch(base); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
}
mkdirSync('public/og', { recursive: true });
const cards = readdirSync('dist/og').filter((f) => f.endsWith('.html')).map((f) => f.replace('.html', ''));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const c of cards) {
  await page.goto(`${base}/og/${c}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `public/og/${c}.jpg`, type: 'jpeg', quality: 86 });
  console.log('card', c);
}
await browser.close();
if (started) execFileSync('npx', ['astro', 'preview', 'stop']);

await sharp('public/favicon.svg', { density: 600 }).resize(140, 140).extend({ top: 20, bottom: 20, left: 20, right: 20, background: '#dfdedb' }).png().toFile('public/apple-touch-icon.png');
