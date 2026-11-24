// Photographs the live hall, Day and Night, into public/hall/*.webp: the picture that stands in until the canvas draws.
// Usage: npm run build && node scripts/hall.ts   (then build again so dist carries them)
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';

const said = execFileSync('npx', ['astro', 'preview', '--port', '4331'], { encoding: 'utf8' });
const started = !/already running/.test(said);
const base = said.match(/http:\/\/localhost:\d+/)![0];
for (let i = 0; i < 60; i++) {
  try { await fetch(base); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
}
mkdirSync('public/hall', { recursive: true });
// A real GPU, not SwiftShader: the hall is too heavy for the software path to finish in time.
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [theme, scheme] of [['day', 'light'], ['night', 'dark']] as const) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, colorScheme: scheme });
  // A player card already claimed today, so neither the welcome nor the day's tokens get in the picture.
  const now = Date.now(), day = Math.floor(now / 86_400_000);
  const card = { v: 1, tag: 'Velvet Otter', tok: 12, at: now, day, st: 1, cr: {}, paid: {}, log: [], seen: [], b: {}, dd: {} };
  await page.context().addCookies([{ name: 'arcade_card', value: Buffer.from(JSON.stringify(card)).toString('base64url'), url: base }]);
  await page.goto(`${base}/#spillway`, { waitUntil: 'load' });
  // Hidden but still laid out, so the camera frames the room exactly as a visitor sees it behind the interface.
  await page.addStyleTag({ content: '.hall__top, .hall__cards, .hall__row, .hall__hint, .coach, .attract { visibility: hidden !important; }' });
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-hall-live'));
  await page.waitForTimeout(5000);
  const png = await page.locator('.hall').screenshot();
  await sharp(png).webp({ quality: 68 }).toFile(`public/hall/${theme}.webp`);
  console.log('hall', theme);
  await page.close();
}
await browser.close();
if (started) execFileSync('npx', ['astro', 'preview', 'stop']);
