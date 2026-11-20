// Typester has no README shots, so take a desktop and a phone still mid-round from the live site.
// Usage: node scripts/stills.ts
import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const [name, w, h, dpr] of [['desktop', 1440, 900, 1], ['phone', 390, 844, 2]] as const) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, colorScheme: 'dark' });
  await p.goto('https://typester.ashwinsathian.com/', { waitUntil: 'domcontentloaded' });
  await p.getByRole('button', { name: 'Got it' }).click();
  await p.getByRole('button', { name: 'Quick Play' }).click();
  await p.waitForSelector('.game__word');
  for (let i = 0; i < 9; i++) {
    const word = await p.evaluate(() => document.querySelector('.game__word')!.textContent!.trim());
    await p.click('.game__input');
    await p.keyboard.type(word, { delay: 40 });
    await p.waitForTimeout(150);
    if (await p.evaluate((w) => document.querySelector('.game__word')!.textContent!.trim() === w, word)) await p.keyboard.press('Enter');
  }
  await p.keyboard.type(await p.evaluate(() => document.querySelector('.game__word')!.textContent!.trim().slice(0, 3)));
  await p.waitForTimeout(400);
  await p.screenshot({ path: `src/assets/shots/typester-${name}.png` });
  await p.close();
}
await browser.close();
