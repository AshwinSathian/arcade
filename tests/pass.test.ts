// The player card and the token economy, which every machine shares through /pass.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, serialise, refill, refillIn, daily, cleanTag, today, type Card } from "../src/pass/card.ts";
import { machines, start, end, insert } from "../src/pass/economy.ts";
import { ADJ, NOUN } from "../src/pass/tags.ts";

const slugs = [...readFileSync(new URL("../src/data/games.ts", import.meta.url), "utf8").matchAll(/^\s{4}slug: "([a-z]+)",$/gm)].map((m) => m[1]);
const DAY = 86_400_000, MIN = 60_000;
const T0 = 20_000 * DAY + 10 * 3600_000; // a fixed morning, UTC
const rand = () => 0.42;
const newCard = (now = T0) => parse(undefined, slugs, now, rand).card;
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const run = (mode: string, at: number) => ({ mode, at });

test("twelve games, each with a machine", () => {
  assert.equal(slugs.length, 12);
  assert.deepEqual(Object.keys(machines).sort(), [...slugs].sort());
});

test("fresh card: 12 tokens, a two-word tag, today already claimed", () => {
  const { card, fresh } = parse(undefined, slugs, T0, rand);
  assert.ok(fresh);
  assert.equal(card.tok, 12);
  const [a, n] = card.tag.split(" ");
  assert.ok(ADJ.includes(a) && NOUN.includes(n), card.tag);
  assert.equal(card.day, today(T0));
  assert.equal(daily(card, T0).paid, 0);
});

test("daily: 5, rising to 9 on a streak; a missed day starts again; never past 99", () => {
  const c = newCard();
  const pays = [1, 2, 3, 4, 5, 6].map((d) => daily(c, T0 + d * DAY).paid);
  assert.deepEqual(pays, [5, 6, 7, 8, 9, 9]);
  assert.equal(daily(c, T0 + 6 * DAY + 3600_000).paid, 0);
  assert.equal(daily(c, T0 + 8 * DAY).paid, 5);
  c.tok = 97;
  assert.equal(daily(c, T0 + 9 * DAY).paid, 2);
  assert.equal(c.tok, 99);
});

test("refill: one token every 15 minutes below 3, none above", () => {
  const c = newCard();
  c.tok = 0; c.at = T0;
  refill(c, T0 + 29 * MIN);
  assert.equal(c.tok, 1);
  assert.equal(refillIn(c, T0 + 29 * MIN), 1 * MIN);
  refill(c, T0 + 120 * MIN);
  assert.equal(c.tok, 3);
  assert.equal(refillIn(c, T0 + 120 * MIN), 0);
  c.tok = 5;
  refill(c, T0 + 999 * MIN);
  assert.equal(c.tok, 5);
});

test("the refill clock starts from the spend that drops you below 3", () => {
  const c = newCard();
  c.tok = 3; c.at = T0 - 10 * DAY; // idle at the floor for days
  start(c, "pinfall", "game", {}, T0);
  assert.equal(c.tok, 2);
  assert.equal(refillIn(c, T0), 15 * MIN);
});

test("start: a token loads a credit; plays are used before tokens; none left is refused", () => {
  const c = newCard();
  c.tok = 1;
  const plays = machines.coil.plays;
  const a = start(c, "coil", "classic", {}, T0);
  assert.deepEqual([a.ok, a.charged, c.tok, c.cr.coil], [true, 1, 0, plays - 1]);
  for (let k = 1; k < plays; k++) assert.equal(start(c, "coil", "classic", {}, T0).charged, 0);
  assert.equal(c.cr.coil ?? 0, 0);
  assert.equal(start(c, "coil", "classic", {}, T0 + 1000).ok, false);
  assert.ok(c.seen.includes("coil"));
});

test("free modes cost nothing and pay nothing", () => {
  const c = newCard();
  const s = start(c, "coil", "zen", {}, T0);
  assert.deepEqual([s.ok, s.free, s.charged, c.tok], [true, true, 0, 12]);
  assert.equal(end(c, "coil", run("zen", T0), { mode: "zen", score: 1e6 }, T0 + 60_000).paid, 0);
  for (const [slug, mode] of [["clover", "calm"], ["lightkeeper", "practice"], ["glide", "online"], ["rally", "online"], ["noughts", "classic.online"], ["minefield", "shared"], ["nonet", "custom"]]) {
    assert.ok(start(newCard(), slug, mode, {}, T0).free, `${slug} ${mode}`);
  }
});

test("end: nothing without a matching start, for a quit, or under a second and a half", () => {
  const c = newCard();
  assert.equal(end(c, "coil", undefined, { mode: "classic", score: 1e6 }, T0).paid, 0);
  assert.equal(end(c, "coil", run("classic", T0), { mode: "classic", quit: true }, T0 + 60_000).paid, 0);
  assert.equal(end(c, "coil", run("classic", T0), { mode: "classic", score: 1e6 }, T0 + 1000).paid, 0);
  assert.equal(c.tok, 12);
});

test("end: a great run pays 3, plus 1 for a new best; the same score again is no best", () => {
  const c = newCard();
  const a = end(c, "coil", run("classic", T0), { mode: "classic", score: 1e6 }, T0 + 60_000);
  assert.deepEqual([a.paid, a.best], [4, true]);
  const b = end(c, "coil", run("classic", T0), { mode: "classic", score: 1e6 }, T0 + 120_000);
  assert.deepEqual([b.paid, b.best], [3, false]);
  assert.equal(c.b["coil.classic"], 1e6);
  assert.equal(end(c, "coil", run("classic", T0), { mode: "classic", score: 0 }, T0 + 180_000).paid, 0);
});

test("no machine pays more than 20 tokens a day; the next day it pays again", () => {
  const c = newCard();
  let total = 0;
  for (let k = 0; k < 10; k++) total += end(c, "coil", run("classic", T0), { mode: "classic", score: 1e6 + k }, T0 + 60_000 * (k + 1)).paid;
  assert.equal(total, 20);
  assert.ok(end(c, "coil", run("classic", T0 + DAY), { mode: "classic", score: 1 }, T0 + DAY + 60_000).paid >= 0);
  assert.ok(end(c, "coil", run("classic", T0 + DAY), { mode: "classic", score: 1e6 }, T0 + DAY + 120_000).paid > 0);
});

test("a daily mode pays on its first finished run of the day only", () => {
  const c = newCard();
  assert.ok(end(c, "coil", run("daily", T0), { mode: "daily", score: 1e6 }, T0 + 60_000).paid > 0);
  assert.equal(end(c, "coil", run("daily", T0), { mode: "daily", score: 2e6 }, T0 + 120_000).paid, 0);
  assert.ok(end(c, "coil", run("daily", T0 + DAY), { mode: "daily", score: 1e6 }, T0 + DAY + 60_000).paid > 0);
});

test("the cup holds 99", () => {
  const c = newCard();
  c.tok = 98;
  const r = end(c, "coil", run("classic", T0), { mode: "classic", score: 1e6 }, T0 + 60_000);
  assert.equal(r.paid, 1);
  assert.equal(r.why, "Cup's full");
  assert.equal(c.tok, 99);
});

test("two players on one device pay for the credit and never win tokens", () => {
  const c = newCard();
  assert.ok(start(c, "glide", "duel", {}, T0).charged === 1);
  assert.equal(end(c, "glide", run("duel", T0), { mode: "duel", won: true }, T0 + 60_000).paid, 0);
  assert.equal(end(c, "minefield", run("expert", T0), { mode: "expert", won: true, assisted: true }, T0 + 60_000).paid, 0);
});

test("every machine pays 0 for an empty result and at most its top for a huge one", () => {
  for (const [slug, m] of Object.entries(machines)) {
    assert.ok(m.top >= 1 && m.top <= 4, slug);
    assert.ok(m.plays >= 1 && m.plays <= 3, slug);
    for (const mode of m.modes) {
      if (m.free(mode, {})) continue;
      assert.equal(m.tier(mode, {}), 0, `${slug} ${mode} empty`);
      const big = { mode, score: 1e9, won: true, level: "best", wpm: 999, points: 1e9, lawns: 99, spares: 10, underPar: true, players: 1 };
      assert.ok(m.tier(mode, big) <= 3, `${slug} ${mode}`);
    }
  }
});

test("insert: a token for a credit of plays", () => {
  const c = newCard();
  assert.ok(insert(c, "pinfall", T0).ok);
  assert.deepEqual([c.tok, c.cr.pinfall], [11, machines.pinfall.plays]);
  c.tok = 0;
  assert.equal(insert(c, "pinfall", T0).ok, false);
});

test("malformed cookies give a sane card and never throw", () => {
  for (const raw of ["%E0", "{", "null", "[]", enc({ v: 2 }), "x".repeat(5000)]) {
    const { card } = parse(raw, slugs, T0, rand);
    assert.equal(card.tok, 12, raw.slice(0, 20));
  }
  const evil = enc({
    v: 1, tok: 1e9, tag: "<img src=x onerror=1>", at: -5, day: 1e12, st: "x",
    cr: { coil: 2, evil: 5, "__proto__": 3 }, b: { "coil.classic": "9", "nope.x": 1 },
    log: Array.from({ length: 500 }, () => [1, "coil", 1, "<b>hi</b>"]), seen: ["coil", 3, "evil"],
  });
  const { card, fresh } = parse(evil, slugs, T0, rand);
  assert.equal(fresh, false);
  assert.equal(card.tok, 99);
  assert.match(card.tag, /^[A-Za-z0-9 '-]{2,20}$/);
  assert.deepEqual(card.cr, { coil: 2 });
  assert.deepEqual(card.b, {});
  assert.equal(card.log.length, 12);
  assert.ok(!card.log[0][3].includes("<"));
  assert.deepEqual(card.seen, ["coil"]);
  assert.ok(card.day <= today(T0) && card.at >= 0);
  const keep = parse(enc({ v: 1, tag: "Velvet Otter", tok: "lots" }), slugs, T0, rand).card;
  assert.deepEqual([keep.tag, keep.tok], ["Velvet Otter", 0]);
});

test("tags: own names are cleaned to letters, digits, spaces, apostrophes and hyphens, 2 to 20 long", () => {
  assert.equal(cleanTag("  Neon   Heron  "), "Neon Heron");
  assert.equal(cleanTag("<script>x"), "scriptx");
  assert.equal(cleanTag("a"), "");
  assert.equal(cleanTag("O'Brien-Smith the Great and Mighty"), "O'Brien-Smith the Gr");
  assert.equal(cleanTag(7), "");
});

test("a full card still fits in a cookie", () => {
  const c: Card = newCard();
  for (const s of slugs) { c.cr[s] = 3; c.paid[s] = [today(T0), 20]; c.dd[s] = today(T0); c.seen.push(s); for (const m of ["classic", "daily", "expert"]) c.b[`${s}.${m}`] = 123456789; }
  for (let k = 0; k < 12; k++) c.log.unshift([T0 / 1000, "lightkeeper", 4, "New best"]);
  assert.ok(serialise(c).length <= 3200, String(serialise(c).length));
  assert.match(serialise(c), /^[A-Za-z0-9_-]+$/);
  assert.ok(parse(serialise(c), slugs, T0, rand).card.log.length >= 1);
});
