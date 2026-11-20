// Records a short loop of real play from each live game and writes:
//   public/media/<slug>.mp4      muted H.264 loop for the tiles (720x900, about 9 s)
//   src/assets/posters/<slug>.png first frame of the loop: the poster, and the image Astro optimises
// Every game is driven by its own hooks (replay links, autoplay bots, hint buttons), so nothing is staged.
// Usage: node scripts/capture.ts [slug ...]   (needs ffmpeg; Coil also needs ../coil checked out)
import { chromium, type Page } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const W = 720, H = 900;
type Shot = { url: string; scheme?: 'light' | 'dark'; start: number; dur: number; size?: [number, number]; crop?: string; init?: (p: Page) => Promise<void>; play: (p: Page) => Promise<void> };

const wait = (p: Page, ms: number) => p.waitForTimeout(ms);

const games: Record<string, Shot> = {
  coil: {
    // An autopilot Classic run, replayed from its link: the game's own replay viewer plays it.
    url: `https://coil.ashwinsathian.com/#r=${execFileSync('node', ['scripts/demo-replay.ts', 'classic', '1400'], { cwd: '../coil' }).toString().split(' ')[0]}`,
    // Skip ahead at 4x to where the snake is long, then watch at 1x.
    start: 10, dur: 9,
    async play(p) {
      await wait(p, 800);
      await p.click('[data-speed="4"]');
      await wait(p, 9000);
      await p.click('[data-speed="1"]');
      await wait(p, 10500);
    },
  },
  lightkeeper: {
    // The table's attract loop: its own bot keeps the ball in play.
    // Recorded large and cropped to the table: the menu sits around it.
    url: 'https://lightkeeper.ashwinsathian.com/', start: 2, dur: 9, size: [1440, 1800], crop: 'crop=920:1150:260:300',
    play: (p) => wait(p, 12000),
  },
  minefield: {
    url: 'https://minefield.ashwinsathian.com/', scheme: 'dark', start: 3, dur: 9,
    init: (p) => p.addInitScript(() => localStorage.setItem('minefield:v1', JSON.stringify({ v: 1, settings: { mode: 'intermediate', sound: false } }))),
    async play(p) {
      await wait(p, 600);
      await p.click('#' + await p.evaluate(() => document.querySelector('#board')!.getAttribute('aria-activedescendant')));
      await wait(p, 700);
      // Follow the solver's hints: every move shown is one the game proved.
      for (let i = 0; i < 24; i++) {
        await p.keyboard.press('h');
        await wait(p, 160);
        const h = await p.evaluate(() => { const e = document.querySelector('.c.hint') as HTMLElement | null; return e && { id: e.id, safe: e.classList.contains('safe') }; });
        if (!h) break;
        await p.click('#' + h.id, { button: h.safe ? 'left' : 'right', force: true });
        await wait(p, 90);
      }
    },
  },
  nonet: {
    url: 'https://nonet.ashwinsathian.com/', start: 1.2, dur: 9,
    async play(p) {
      await wait(p, 600);
      await p.click('#ad-play');
      await p.click('[data-start="2.5"]');
      await wait(p, 900);
      const g = await p.evaluate(() => JSON.parse(localStorage.getItem('nonet')!).game);
      for (let i = 0; i < 81; i++) {
        if (g.values[i] === +g.solution[i]) continue;
        await p.click(`#board .cell[data-i="${i}"]`);
        await p.click(`#pad button[data-d="${g.solution[i]}"]`);
        await wait(p, 120);
      }
      await wait(p, 1500);
    },
  },
  rally: {
    // ?autoplay hands the near paddle to the game's own bot.
    url: 'https://rally.ashwinsathian.com/?autoplay=2', start: 1.5, dur: 9,
    async play(p) {
      await wait(p, 1000);
      await p.click('.levels button[data-level="1"]');
      await wait(p, 12000);
    },
  },
  typester: {
    url: 'https://typester.ashwinsathian.com/', start: 3.5, dur: 8,
    async play(p) {
      await wait(p, 1500);
      await p.getByRole('button', { name: 'Got it' }).click().catch(() => {});
      await p.getByRole('button', { name: 'Quick Play' }).click();
      await p.waitForSelector('.game__word');
      // Type whatever word the game shows, at a brisk human pace.
      for (let i = 0; i < 24; i++) {
        const word = await p.evaluate(() => document.querySelector('.game__word')?.textContent?.trim());
        if (!word) break;
        await p.click('.game__input');
        await p.keyboard.type(word, { delay: 95 });
        await wait(p, 150);
        // A correct word advances on its own in some modes; otherwise Enter submits it.
        if (await p.evaluate((w) => document.querySelector('.game__word')?.textContent?.trim() === w, word)) await p.keyboard.press('Enter');
        await wait(p, 150);
      }
    },
  },
};

const only = process.argv.slice(2);
mkdirSync('public/media', { recursive: true });
mkdirSync('src/assets/posters', { recursive: true });
const browser = await chromium.launch();
for (const [slug, g] of Object.entries(games)) {
  if (only.length && !only.includes(slug)) continue;
  const dir = mkdtempSync(join(tmpdir(), `games-${slug}-`));
  const [w, h] = g.size ?? [W, H];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: g.scheme ?? 'dark', recordVideo: { dir, size: { width: w, height: h } } });
  const p = await ctx.newPage();
  await g.init?.(p);
  await p.goto(g.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await g.play(p);
  await ctx.close();
  const raw = join(dir, readdirSync(dir)[0]);
  const ff = (...a: string[]) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a]);
  ff('-ss', String(g.start), '-t', String(g.dur), '-i', raw, '-vf', `${g.crop ? g.crop + ',' : ''}scale=${W}:${H}:flags=lanczos`, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `public/media/${slug}.mp4`);
  ff('-i', `public/media/${slug}.mp4`, '-frames:v', '1', `src/assets/posters/${slug}.png`);
  console.log('wrote', slug);
}
await browser.close();
