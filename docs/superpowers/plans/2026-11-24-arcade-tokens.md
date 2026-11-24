# Arcade tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One player card (tag and tokens) shared by the hall and all twelve games, with tokens spent per credit and won per result.

**Architecture:** `src/pass/` in the arcade repo builds to a stable `/pass.js`, a classic IIFE. Every game loads it from `https://arcade.ashwinsathian.com/pass.js` and talks to it through two window events. The hall loads the same file and drives it through `window.arcadePass`. State lives in one cookie on `.ashwinsathian.com`.

**Tech Stack:** TypeScript, Vite library build (Vite is already in node_modules through Astro), Astro 7, WebGL 2 (no library), node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-24-arcade-tokens-design.md`. Read it first. Its "Adversarial review: fixes folded in" section overrides the earlier sections where they differ.

## Global Constraints

- The currency is always "tokens" in copy and code. Never "coins" or "wallet" (Spillway owns "wallet").
- Cookie `arcade_card`: `Domain=ashwinsathian.com; Path=/; Max-Age=34560000; SameSite=Lax; Secure`. It is host-only (no Domain) when `location.hostname` doesn't end with `ashwinsathian.com`. Hand-off cookie: `arcade_via=<slug>`, Max-Age 120.
- Numbers: welcome 12, daily `4 + min(st,5)`, refill to 3 at 1 per 15 min, cap 99, daily payout cap 20 per machine, `minMs` 1500.
- Budgets: `/pass.js` under 14 KB gzipped, hall under **34 KB** (raised from 30), shared script under 4 KB, home HTML under 12 KB. No inline scripts on arcade pages. Every glyph in the Bricolage cut (use SVG for icons such as the dice).
- The pass fails open. No game may throw or block if `pass.js` is missing.
- Everything the pass prints comes from the cookie and is written with `textContent` only.
- British English, plain copy.
- Game repos have no CI. "Green" means that repo's `npm test`, its build, and the Playwright check in its task.

## Review Focus

1. **Enter or Space pressed on a pass dialog leaks to the game's window key handler and starts a run.** Expect nothing to happen in the game. Test in Task 2 (`keys inside the pass don't reach window`) and in each game's Playwright check.
2. **The game is quit mid-run.** Expect the chip to come back and nothing to be paid. Test in Task 1 (`quit closes the run, pays 0`), plus the quit step in each game's Playwright check.
3. **A malformed, hand-edited or oversized `arcade_card` cookie.** Expect a sane card (tag kept if valid, numbers clamped), no throw, and no HTML injection. Tested in Task 1.
4. **Two tabs.** The hall and a game both change the card. Expect each write to re-read first, and the hall to repaint on `pageshow` and `visibilitychange`. Tested in Task 1 (`write re-reads`) and Task 3.
5. **`pass.js` blocked or 404.** Expect the game to play with no console errors. Check it in each game's Playwright check by aborting the route.

---

### Task 1: Card and economy core (pure, tested)

**Files:**
- Create: `src/pass/card.ts`, `src/pass/economy.ts`, `src/pass/tags.ts`, `tests/pass.test.ts`
- Modify: `package.json` (test script: `node --test tests/*.test.mjs tests/*.test.ts`), `tsconfig.json` (`compilerOptions.allowImportingTsExtensions: true`), so `src/pass/*` can import with `.ts` extensions, which Node needs.

**Interfaces (produces):**
```ts
// card.ts
export type Card = { v: 1; tag: string; tok: number; at: number; day: number; st: number; cr: Record<string, number>; paid: Record<string, [number, number]>; log: [number, string, number, string][]; seen: string[]; b: Record<string, number>; dd: Record<string, number> };
export const today: (now: number) => number;                     // floor(now / 86400000), UTC
export function parse(raw: string | undefined, slugs: string[], now: number, rand: () => number): { card: Card; fresh: boolean };
export function serialise(c: Card): string;                      // encodeURIComponent(JSON), under 1600 chars (log trimmed first)
export function refill(c: Card, now: number): Card;              // tok < 3: +1 per 900000 ms since at, max 3; tok >= 3: at = now
export function refillIn(c: Card, now: number): number;          // ms to the next token, 0 if tok >= 3
export function daily(c: Card, now: number): { card: Card; paid: number };  // auto-claim; paid 0 if already today
export function cleanTag(s: unknown): string;                    // [A-Za-z0-9 '-], collapse spaces, 2–20 chars, else ""
// economy.ts
export type Machine = { plays: (mode: string) => number; free: (mode: string, d: Detail) => boolean; tier: (mode: string, d: Detail) => 0 | 1 | 2 | 3; metric?: (mode: string, d: Detail) => number | undefined; minMs: number; top: number };
export type Detail = Record<string, unknown> & { mode?: string; quit?: boolean };
export const machines: Record<string, Machine>;                  // all 12 slugs
export function start(c: Card, slug: string, mode: string, d: Detail, now: number): { card: Card; ok: boolean; charged: number; free: boolean };
export function end(c: Card, slug: string, run: { mode: string; at: number } | undefined, d: Detail, now: number): { card: Card; paid: number; best: boolean; why: string };
export function insert(c: Card, slug: string, mode?: string): { card: Card; ok: boolean };   // tok-1, cr[slug] += plays
// tags.ts
export const ADJ: string[]; export const NOUN: string[];        // 64 each, ASCII, night/neon/arcade-hall nature theme
export function randomTag(rand: () => number): string;
```

- [ ] **Step 1: Write the failing tests** in `tests/pass.test.ts` (node:test, importing `../src/pass/*.ts`):
  - `fresh card`: `parse(undefined, …)` gives `tok 12`, `fresh true`, a tag of two words from `ADJ` and `NOUN`, and `day === today(now)`.
  - `daily`: on the next day, `st 1` pays 5. Five consecutive days pay 5, 6, 7, 8, 9 then 9. A skipped day resets to 5. The same day pays 0. The cap is 99.
  - `refill`: `tok 0`, then +29 min gives `tok 1` with `refillIn` about 1 min. +2 h gives `tok 3`. `tok 5` stays 5 with `refillIn` 0.
  - `start`:
    - coil with `tok 1` and `cr 0` gives `tok 0`, `cr.coil 2`, `charged 1`.
    - The next two starts use `cr` without charging.
    - With `tok 0` and `cr 0`, `ok` is false.
    - A free mode (coil `zen`) gives `ok`, `free`, and no change.
  - `end`:
    - No run gives `paid 0`.
    - A run under 1500 ms gives 0.
    - `quit: true` gives 0.
    - A tier-3 result pays 3, plus 1 on a new best (`b` updated). The same score again pays 3, with no best.
    - The daily cap stops at a total of 20 per machine per day.
    - A second daily-mode run on the same day pays 0.
    - The 99 cap gives `why` "Cup's full".
  - `malformed cookie`: these give a valid card and don't throw:
    - `"%E0"`
    - `"{"`
    - `{"tok":1e9,"tag":"<img src=x onerror=1>"}`, where `tok` clamps to 99 and the tag is replaced
    - unknown slug keys, which are dropped
    - 500 log rows, cut to 12

    A valid tag survives a corrupt `tok`.
  - `serialise`: always under 1600 chars, even with every field full.
  - `every game in src/data/games.ts has a machine`: read the slugs by regex from `src/data/games.ts`, then assert `Object.keys(machines)` equals that set exactly.
- [ ] **Step 2:** Run `node --test tests/pass.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `card.ts`, `tags.ts` and `economy.ts`.
  - Set the tier thresholds per machine by reading each game's scoring code in `../<slug>/src`. Tier 1 is a first decent run, tier 2 a good one, tier 3 a great one. Use the spec's table as the starting point, and its fixes: online modes free; local two-player charged but pays 0; `assisted` pays 0; shared or custom boards free.
  - Mode ids must equal the strings each game passes (listed in Tasks 5–16).
  - `top` is the most a run can pay, for the price line "pays up to N" (3, or 4 counting a best).
- [ ] **Step 4:** Run `node --test tests/pass.test.ts`. Expected: all PASS.
- [ ] **Step 5:** Commit: `Pass: card, economy and tags`.

### Task 2: The pass runtime and UI, built to `/pass.js`

**Files:**
- Create: `src/pass/main.ts` (entry), `src/pass/ui.ts` (shadow DOM: chip, welcome, toasts, out-of-tokens, card sheet), `src/pass/style.css` (imported as a string with `?inline`), `src/pass/machines.gen.ts` (written by the build: `[{slug,name,bright,ground}]` from `src/data/games.ts`, in order), `scripts/pass.ts`
- Modify: `package.json` scripts: `"pass": "node scripts/pass.ts"`, then `build: npm run pass && astro check && astro build` and `dev: npm run pass -- --watch & astro dev --port 4330`. `.gitignore`: add `public/pass.js` and `public/pass/`. `public/_headers` gets:
  ```
  /pass.js
    Cache-Control: public, max-age=300, stale-while-revalidate=86400
    Access-Control-Allow-Origin: *
  /pass/*
    Cache-Control: public, max-age=31536000, immutable
    Access-Control-Allow-Origin: *
  ```
  `tests/site.test.mjs` gets two tests: `pass.js under 14 KB gzipped` and `pass.js is a classic script with no import or export`.

**Interfaces:**
- Consumes: Task 1, all of it.
- Produces, on `window`:
  - Game events: `arcade:start` (cancelable, `detail {mode, …}`) and `arcade:end` (`detail {mode, quit?, …fields}`).
  - Emitted to the page: `arcade:card` (`detail: Card`) on every change.
  - `window.arcadePass` = `{ card(): Card; insert(slug: string): boolean; plays(slug: string): number; refillIn(): number; open(): void; price(slug: string): { plays: number; top: number }; ready: true }`.
  - The script tag reads `data-game` (slug; absent means hall mode) and `data-corner` (`tr|tl|br|bl`, default `tr`). In hall mode, the chip mounts into `[data-arcade-chip]` if that element exists.
  - The font is copied to `public/pass/bricolage.woff2` by `scripts/pass.ts`. `@font-face` points at `new URL('/pass/bricolage.woff2', currentScript.src)`.

- [ ] **Step 1:** `scripts/pass.ts`:
  - Regenerate `machines.gen.ts` by parsing slugs, names and colours from `src/data/games.ts` with a regex (importing it would pull in image imports).
  - Run `vite.build({ configFile: false, build: { lib: { entry: 'src/pass/main.ts', formats: ['iife'], name: 'arcadePassBundle', fileName: () => 'pass.js' }, outDir: 'public', emptyOutDir: false, minify: true }, watch: argv.includes('--watch') ? {} : null })`.
  - Copy the font.
- [ ] **Step 2:** Implement `main.ts`:
  - Read the card. Run `refill` then `daily`, write the card, then toast if daily paid.
  - Handle the hand-off: if the `arcade_via` cookie equals `data-game`, delete it and skip the welcome. Otherwise show the welcome on a game page.
  - Keep `run` in `sessionStorage['arcade:run:'+slug]` as `{mode, at}`.
  - On `start`: call `economy.start`. If it's not ok, call `preventDefault()` and open out-of-tokens. If it charged, toast. Mark the run active, which collapses the chip.
  - On `end`: call `economy.end`, toast the payout or best, clear the run, and show the chip.
  - Re-read the card on `visibilitychange` and `pageshow`.
- [ ] **Step 3:** Implement `ui.ts`:
  - A host `<arcade-pass>` element with a closed shadow root, and dialogs opened with `showModal()`.
  - While any pass dialog is open, the host stops propagation of `keydown keyup keypress pointerdown pointerup click` (Review Focus 1).
  - Focus goes back to the previously focused element on close.
  - Reduced motion disables the token spin and flight.
  - The look is a night glass card with a gold token, the machine's `bright` as accent and Bricolage. Copy, verbatim from the spec: "Cabinet 04 of 12 · The Arcade", "Insert token", "Walk the hall", "1 token · 3 plays · pays up to 4", "You're Velvet Otter. Here are 12 tokens.", "Cup's full".
  - The welcome shows only once per tab session per machine (`sessionStorage`).
- [ ] **Step 4:** Add a Playwright check `scripts/pass-check.ts`. It serves `public/` with a small `node:http` static server. It opens a test page `tests/fixtures/game.html`, which loads `/pass.js` with `data-game="coil"` and has a window keydown counter. It asserts:
  - The welcome is visible, and pressing Enter in it leaves the counter at 0.
  - Insert gives `tok 11`.
  - Dispatching start then end (with a score at tier 3, after 2 s) shows a `+` toast and raises `tok`.
  - Dispatching start then end `{quit:true}` gives no payout, and the chip is visible again.
  - With `/pass.js` aborted, the fixture has no errors.
- [ ] **Step 5:** Run `npm test && node scripts/pass-check.ts`. Expected: all pass. The budget test prints the size.
- [ ] **Step 6:** Commit: `Pass: runtime, UI and /pass.js build`.

### Task 3: The hall: card, prices, coin-door camera move, change machine

**Files:**
- Modify:
  - `src/pages/index.astro`: add `<script src="/pass.js" defer>` before the arcade script, a `<span data-arcade-chip>` in `.hall__tools`, an empty `<p class="card__price" data-price>` per card, and the row button `data-coin` renamed to "Surprise me".
  - `src/scripts/arcade.ts`
  - `src/arcade/hall.ts`: `insert(): Promise<void>`, `dispense(): Promise<void>`, `setCredit(i, n)`, change machine picking via `onChange`.
  - `src/arcade/scene.ts`: a token mesh, and a coin door position per machine (`part.doorAt`).
  - `src/arcade/art.ts`: `vending` becomes `changer`, a TOKENS change machine in brass and red with a lamp. Marquee lettering gets "best · TAG" and "CREDIT n".
  - `src/arcade/sound.ts`: `sfx.drop()`, `sfx.payout()`.
  - `tests/site.test.mjs`: hall budget 30 to 34 KB, and the `Insert coin` assertion, if any, updated.

**Interfaces:**
- Consumes: `window.arcadePass` and `arcade:card` from Task 2.
- Produces: none.

- [ ] **Step 1: Play flow in `arcade.ts`.**
  - With `plays(slug) > 0`, Play goes straight into the screen.
  - Otherwise, if `insert(slug)` succeeds, run `await hall.insert()` (camera to coin door, about 450 ms, token falls into the slot, door lamp flash, `sfx.drop`), then `await hall.enter()`.
  - If `insert` fails, the Play link shows "Out of tokens · m:ss" and stays disabled until `refillIn` reaches 0.
  - Set the `arcade_via` cookie before `location.href`.
  - With reduced motion, skip both camera moves.
  - Modified clicks keep the current behaviour, and the game's own welcome charges.
- [ ] **Step 2: Prices.** Fill `[data-price]` from `arcadePass.price(slug)`, e.g. "1 token · 3 plays · pays up to 4", plus "Credit 2" when plays are loaded. Repaint on `arcade:card`, `pageshow` and `visibilitychange` (Review Focus 4).
- [ ] **Step 3: Change machine.**
  - Picking it, or the row button "Change machine", moves the camera to it. This is a new rail stop after the last machine. Implement it as the focus index `games.length`, with its own card text: "Change machine · Daily tokens".
  - When `main.ts` reported a daily payout on this load (`arcadePass.card().log[0]` is a `daily` row from today, and it hasn't been shown yet), run `hall.dispense()` (tokens spill into the tray, lamp, `sfx.payout`) once, after the hall starts.
- [ ] **Step 4: Marquees.** `setBest` letters `${b.v} · ${tag.toUpperCase()}`, and `setCredit` letters `CREDIT n`. Both use the existing canvas text paths.
- [ ] **Step 5: Verify.**
  - Run `npm test`. Expected: PASS, with the hall under 34 KB and the home HTML under 12 KB.
  - Run `npm run shoot` at phone, tablet and desktop, by day and by night, then look at the screenshots: the chip in the top bar, the price on the card, the change machine painted.
  - Run a Playwright click on Play, then assert the `arcade_via` cookie is set and `tok` dropped by 1.
- [ ] **Step 6:** Commit: `Hall: player card, prices, coin-door move and the change machine`.

### Task 4: The arcade's language, `/tokens`, game pages, docs

**Files:**
- Create: `src/pages/tokens.astro` ("How the arcade works", on `Base`, with its own og card reusing `index`).
- Modify:
  - `src/components/Footer.astro`: block letters spell `arcade` (6 letters, 6 colours, 6 heights), and a "How the arcade works" link.
  - `src/pages/[slug].astro`: a "At the machine" block with the price, what pays in words from `machines[slug]` (import `src/pass/economy.ts`), and the free modes. "More games" becomes "More machines".
  - `src/pages/index.astro`: copy that names the place says arcade, hall or machines.
  - `src/pages/llms.txt.ts`
  - `README.md`, `docs/ARCHITECTURE.md` (a pass section, the card cookie in the state table, the event contract), `CONTRIBUTING.md` (an "Adding a game" checklist: games.ts entry, economy machine, game-side tag and events, CSP).
  - `tests/site.test.mjs`: the page list now includes `tokens`.
- [ ] **Step 1:** Update the test's expected page list and run `npm test`. Expected: FAIL (no `tokens.html`).
- [ ] **Step 2:** Write the pages and copy. Use the humanizing-writing rules: specific claims, no announced points. The `/tokens` page covers: you start with 12; one token loads a credit; plays per machine (a table from `machines`); what pays; refill to 3, one every 15 minutes; daily with streak; the cup holds 99; everything stays in this browser, and clearing cookies starts a new card; your tag and how to change it.
- [ ] **Step 3:** Run `npm test`. Expected: PASS, including the font cut and the budgets.
- [ ] **Step 4:** Commit: `Speak as the arcade: /tokens, prices on game pages, docs`.

### Tasks 5–16: Wire each game (one task per repo, same template)

Each repo is `/Users/ashwinsathian/Documents/Personal/<slug>`, on a new branch `arcade-pass` from `main`.

**Template steps (every game):**
- [ ] **A.** Add `<script src="https://arcade.ashwinsathian.com/pass.js" data-game="<slug>" data-corner="<corner>" defer></script>` in `index.html` `<head>`, **before** the game's script (spec fix 6).
- [ ] **B.** CSP in `public/_headers`, where one exists: add `https://arcade.ashwinsathian.com` to `script-src` and `font-src`.
- [ ] **C.** Dispatch `arcade:start` at the listed commit points. If the dispatch returns false, return before any state changes. Dispatch `arcade:end` with the listed detail, and `{mode, quit:true}` at the listed quit points. Never dispatch under autoplay, demo, attract, replay or resume.
- [ ] **D.** Run `npm test` and `npm run build`. Expected: PASS.
- [ ] **E.** Playwright check (`scripts/arcade-check.ts` in that repo, run by hand). Route `https://arcade.ashwinsathian.com/pass.js` and `/pass/*` to the arcade's `public/` files, then load the local build or preview. Assert:
  - The welcome shows, and Enter doesn't start the game.
  - After Insert, starting a run lowers plays or tokens.
  - Finishing or quitting a run brings the chip back.
  - A free mode charges nothing.
  - `?autoplay` (where it exists) makes no change to the card.
  - With the pass route aborted, the game starts with no page errors.

  Look at one screenshot to confirm the chip corner clears the HUD.
- [ ] **F.** Update the README's size line ("plus the shared arcade pass") and commit: `Join the arcade: tokens and the player card`.

Per game (file:line from recon on 2026-11-24; re-check before editing):

| Task | Game | Start (commit point) | End detail | Quit points | Free / no-dispatch |
|---|---|---|---|---|---|
| 5 | clover | `start()` src/main.ts:233 (all modes; `#r=` race counts as `daily`) | `finish()` :272 → `{mode, score: sim.score, lawns: run.lawns, won: sim.won}` | `bank()` :265 paths (Quit/Restart) | `calm` free; `demo`, `?autoplay` none |
| 6 | coil | first `begin()` after each `startGame()` (src/main.ts:87/:113) | `endGame()` :183 → `{mode, score, fruit, room}` | `toMenu`, pause Restart :522 | `zen` free; replay `#r=`, autopilot none |
| 7 | glide | `startMatch()` src/main.ts:292 for `house`/`duel`; online none | `endMatch()` :417 → `{mode, won: w===me, level: save.level, margin}` | `attract()` :279/:479 | `online` free; `attract`, `?autoplay` none |
| 8 | lightkeeper | `startGame()` src/main.ts:135 | `gameOver()` :522 → `{mode, score: g.score}` | Quit → `startDemo` :645, Restart :644 | `practice` free; demo, `#r=` replay none |
| 9 | minefield | first dig (`act()` with status `ready`, src/main.ts:229-240) | `won()`/`lost()` :268/:292 → `{mode, won, secs, assisted}` | `newGame` while a run is active (mode switch, New, `n`, again) | shared `#b=` free; resume from save none |
| 10 | nonet | the `newGame(...)` call sites for adaptive, level, daily and custom (never `begin`) | `finish(solved)` :379 → `{mode, won: solved, level, underPar}`; `abandon()` :350 → quit | `abandon()` | custom/pasted free; resume none |
| 11 | noughts | `start(g)` src/main.ts:372 for bot and local (not resume :806, not replay) | `finish()` :414 → `{mode: g.mode+'.'+g.opp, won, draw, level}` | Home from a game in progress | online free (no dispatch at all in `onRoom`); replay none |
| 12 | pinfall | `start(m)` src/main.ts:303 for `game`, `daily`, `spares` | `showOver()` :410 → `{mode, score: p1 score, spares: sparesMade, players}` | pause Restart :495, quit/leave → warm :496 | `warm` none; `?autoplay` none |
| 13 | rally | `start(m)` src/main.ts:121 for match levels and solo; `netBegin` none | `showOver()` :598 → `{mode, won, level, points}` | Menu, Restart mid-run | online free; `attract()`, `?autoplay` none |
| 14 | spillway | `start(m)` src/main.ts:197 | `endRun()` :263 → `{mode, score: run.score}` | Start over mid-run, quit to menu | `ghost` `#g=` counts as `open` pay-wise; menu bot and `?autoplay` none |
| 15 | swish | `start(mode, …)` src/main.ts:248 | `finish()` :281 → `{mode, score: round.score}` | pause Restart, quit to home | `warm` none; challenge `#c=` counts as `free` mode |
| 16 | typester | first key (`ready` → `running`, features/play/play.ts:224) | `finish()` :255 → `{mode, score, wpm, words}`; `words === 0` gives quit | Esc while `ready` sends nothing; leaving the route mid-run gives quit | browser-only: guard with `isPlatformBrowser`; Angular stylesheet budget 8 KB untouched (the pass has its own styles) |

Typester has no `_headers` and no deploy script. It deploys with `npx ng build && npx wrangler deploy`.

### Task 17: Review, merge, deploy, live check

- [ ] **Step 1:** Run a whole-change adversarial review across the 13 diffs. Focus on the Review Focus list, the event-contract mismatches between the mode ids in `economy.ts` and what each game dispatches, and the CSP lines. Fix what it finds and re-run each repo's checks.
- [ ] **Step 2:** For each of the 13 repos: push `arcade-pass` (the arcade uses `arcade-tokens`), open a PR with `gh pr create`, merge it with `gh pr merge --squash`, and pull `main`.
- [ ] **Step 3:** Deploy the arcade first with `npm run deploy`. Check that `curl -sI https://arcade.ashwinsathian.com/pass.js` returns 200 with `access-control-allow-origin: *`. Then deploy each game from `main` with `npm run deploy` (Typester as noted above).
- [ ] **Step 4: Live check** with Playwright against production:
  - A fresh context opens the hall: 12 tokens and a tag.
  - Play Coil: the camera moves and `tok` reaches 11.
  - On coil.ashwinsathian.com, the chip shows the same tag, `tok` and CREDIT 2.
  - Open clover.ashwinsathian.com directly: the welcome shows the same card.
  - No console errors on any of the 13 origins.
