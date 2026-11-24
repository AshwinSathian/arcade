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
  clover: {
    // The game's own bot at night, switching to day and back so the loop closes on the same sky.
    url: 'https://clover.ashwinsathian.com/?autoplay&start=garden&seed=9&nohint&warp=8&theme=night', start: 2, dur: 9,
    async play(p) {
      await wait(p, 4500);
      await p.keyboard.press('t');
      await wait(p, 4000);
      await p.keyboard.press('t');
      await wait(p, 4000);
    },
  },
  coil: {
    // An autopilot Gates run from its link, switching to Modern and back so the loop closes on Retro.
    url: `https://coil.ashwinsathian.com/?hq#r=${execFileSync('node', ['scripts/demo-replay.ts', 'gates', '1400'], { cwd: '../coil' }).toString().split(' ')[0]}`,
    start: 8.8, dur: 9,
    async play(p) {
      await wait(p, 800);
      await p.click('[data-speed="4"]');
      await wait(p, 7800);
      await p.click('[data-speed="1"]');
      await wait(p, 1800);
      await p.keyboard.press('m');
      await wait(p, 3000);
      await p.keyboard.press('m');
      await wait(p, 4600);
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
      // The hint toasts would cover the top of the board in the poster frame.
      await p.addStyleTag({ content: '#toast { display: none !important; }' });
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
  noughts: {
    // Fading on one screen, both sides playing the solver's moves: X's forced win from an edge,
    // marks wiped as each side places a fourth, and the strike at the end.
    url: 'https://noughts.ashwinsathian.com/', start: 3.3, dur: 9,
    init: (p) => p.addInitScript(() => localStorage.setItem('noughts:v1', JSON.stringify({ v: 1, settings: { mode: 'fading', opp: 'local', sound: false, theme: 'auto', level: 'best' } }))),
    async play(p) {
      await wait(p, 700);
      await p.click('#play');
      await wait(p, 900);
      for (const i of [5, 6, 4, 3, 0, 8, 2, 1, 6, 4, 7, 5, 8]) {
        await p.click(`#board .cell[data-i="${i}"]`);
        await wait(p, 560);
      }
      await wait(p, 3200);
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
  spillway: {
    // The game's own bot at lantern night, switching to day and back so the loop closes on the same sky.
    url: 'https://spillway.ashwinsathian.com/?autoplay&start=open&at=120&theme=night', start: 2, dur: 9,
    async play(p) {
      await wait(p, 4500);
      await p.keyboard.press('t');
      await wait(p, 4000);
      await p.keyboard.press('t');
      await wait(p, 4000);
    },
  },
  swish: {
    // The game's own bot under the floodlights, switching to day and back so the loop closes on the same sky.
    url: 'https://swish.ashwinsathian.com/?autoplay&start=free&seed=7&theme=night', start: 2, dur: 9,
    async play(p) {
      await wait(p, 4500);
      await p.keyboard.press('t');
      await wait(p, 4000);
      await p.keyboard.press('t');
      await wait(p, 4000);
    },
  },
  typester: {
    // A Rush, typed at a brisk human pace from the word the game is asking for.
    url: 'https://typester.ashwinsathian.com/play/rush', start: 6, dur: 9,
    async play(p) {
      await p.waitForSelector('#field');
      await wait(p, 1200);
      for (let i = 0; i < 34; i++) {
        const word = (await p.getAttribute('#field', 'aria-label'))?.replace('Type the word: ', '');
        if (!word) break;
        if (i === 9) await p.keyboard.press('q'); // one slip, so the miss feedback shows
        await p.keyboard.type(word, { delay: 85 });
        await wait(p, 120);
      }
    },
  },
};

const only = process.argv.slice(2);
mkdirSync('public/media', { recursive: true });
mkdirSync('src/assets/posters', { recursive: true });
// The GPU flags matter for the WebGL games: software rendering records at a few frames a second.
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
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
