// Typester has no README shots, so take a desktop and a phone still mid-run from the live site.
// Usage: node scripts/stills.ts
import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const [name, w, h, dpr] of [['desktop', 1440, 900, 1], ['phone', 390, 844, 2]] as const) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, colorScheme: 'dark' });
  await p.goto('https://typester.ashwinsathian.com/play/rush', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#field');
  await p.waitForTimeout(800);
  const word = async () => (await p.getAttribute('#field', 'aria-label'))!.replace('Type the word: ', '');
  // Enough clean words to reach the x2 multiplier, then stop partway into the next one.
  for (let i = 0; i < 7; i++) {
    await p.keyboard.type(await word(), { delay: 40 });
    await p.waitForTimeout(120);
  }
  await p.keyboard.type((await word()).slice(0, 2), { delay: 40 });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `src/assets/shots/typester-${name}.png` });
  await p.close();
}
await browser.close();
