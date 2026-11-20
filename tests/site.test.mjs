// Checks on the built site (run `npm run build` first; `npm test` does both).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";

const dist = new URL("../dist/", import.meta.url);
const read = (p) => readFileSync(new URL(p, dist), "utf8");
const pages = readdirSync(dist).filter((f) => f.endsWith(".html"));
const slugs = pages.filter((f) => !["index.html", "404.html"].includes(f)).map((f) => f.replace(".html", ""));
const meta = (html, attr, key) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1];

test("six game pages, a home page and a 404", () => {
  assert.deepEqual(slugs.sort(), ["coil", "lightkeeper", "minefield", "nonet", "rally", "typester"]);
});

for (const page of pages.filter((p) => p !== "404.html")) {
  test(`${page}: title, description, canonical, card, one h1, valid JSON-LD`, () => {
    const html = read(page);
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? "";
    assert.ok(title.length >= 20 && title.length <= 90, `title length ${title.length}: ${title}`);
    const desc = meta(html, "name", "description") ?? "";
    assert.ok(desc.length >= 80 && desc.length <= 200, `description length ${desc.length}`);
    assert.match(html, /<link rel="canonical" href="https:\/\/games\.ashwinsathian\.com\/?[a-z]*"/);
    const card = meta(html, "property", "og:image");
    assert.ok(existsSync(new URL(`../public/og/${card.split("/og/")[1]}`, import.meta.url)), `missing card ${card}`);
    assert.equal(html.match(/<h1[\s>]/g)?.length, 1);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)];
    assert.ok(blocks.length >= 1);
    for (const [, json] of blocks) JSON.parse(json);
  });
}

test("no inline executable script: the CSP allows only script files", () => {
  for (const page of pages) {
    for (const [, tag, body] of read(page).matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/application\/ld\+json/.test(tag)) continue;
      assert.match(tag, /src=/, `${page} has an inline script`);
      assert.equal(body.trim(), "");
    }
  }
});

test("every character on every page is in the font cut", () => {
  const cut = new Set(JSON.parse(readFileSync(new URL("../src/fonts/bricolage-grotesque.codepoints.json", import.meta.url))));
  for (const page of pages) {
    const text = read(page)
      .replace(/<(script|style)[\s\S]*?<\/\1>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
    const missing = [...new Set(text)].filter((c) => !cut.has(c.codePointAt(0)) && !/\s/.test(c));
    assert.deepEqual(missing, [], `${page} needs glyphs outside the cut`);
  }
});

test("byte budgets: home page HTML under 12 KB gzipped, script under 4 KB", () => {
  assert.ok(gzipSync(read("index.html")).length < 12 * 1024);
  const js = readdirSync(new URL("_astro/", dist)).filter((f) => f.endsWith(".js"));
  assert.equal(js.length, 1);
  assert.ok(gzipSync(readFileSync(new URL(`_astro/${js[0]}`, dist))).length < 4 * 1024);
});

test("every page has its cache rule, and every clip exists", () => {
  const headers = read("_headers");
  for (const s of slugs) {
    assert.match(headers, new RegExp(`^/${s}\\n  Cache-Control`, "m"));
    assert.ok(existsSync(new URL(`media/${s}.mp4`, dist)));
  }
});

test("sitemap lists the pages and leaves the cards out", () => {
  const xml = read("sitemap-0.xml");
  for (const s of slugs) assert.match(xml, new RegExp(`/${s}</loc>`));
  assert.doesNotMatch(xml, /\/cards\//);
  assert.match(read("robots.txt"), /Sitemap: https:\/\/games\.ashwinsathian\.com\/sitemap-index\.xml/);
});

test("llms.txt names every game with its link", () => {
  const txt = read("llms.txt");
  for (const s of slugs) assert.match(txt, new RegExp(`https://${s}\\.ashwinsathian\\.com`));
});
