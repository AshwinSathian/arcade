// Screenshots of the built site at phone, tablet and desktop widths, light and dark, for visual review.
// Usage: node scripts/shoot.ts [base-url] [outdir]
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4332';
const out = process.argv[3] ?? '.shots';
const browser = await chromium.launch();
const pages = ['/', '/minefield'];
for (const [w, h] of [[1440, 900], [820, 1180], [390, 844]] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: scheme });
    const p = await ctx.newPage();
    const errs: string[] = [];
    p.on('pageerror', (e) => errs.push(String(e)));
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    for (const path of pages) {
      await p.goto(base + path, { waitUntil: 'networkidle' });
      await p.waitForTimeout(1800);
      const name = `${out}/${path === '/' ? 'home' : path.slice(1)}-${w}-${scheme}`;
      await p.screenshot({ path: `${name}.png` });
      if (scheme === 'light') await p.screenshot({ path: `${name}-full.png`, fullPage: true });
    }
    if (errs.length) console.log(w, scheme, errs);
    await ctx.close();
  }
}
await browser.close();
