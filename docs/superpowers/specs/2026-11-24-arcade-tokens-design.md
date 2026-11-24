# Arcade tokens, player card and the pass: design

Date: 2026-11-24. Status: approved by the user 2026-11-24, after an adversarial pass.

## Intent

The twelve games are separate sites on their own subdomains. Today the only thing tying them together is the hall at arcade.ashwinsathian.com and a best-score cookie. This change makes the arcade a place you belong to. You carry one player card with a tag ("Velvet Otter") and a cup of tokens, every machine costs a token to play, good play pays tokens back, and every game, even one opened from a direct link, greets you as a cabinet in the same arcade.

Success: a first-time visitor gets a tag and 12 tokens, plays three games, sees their tokens go down and come back up, and a game opened from a blog link shows the same card and balance. Nobody is shut out for long.

## Goals

- One wallet and one identity across all twelve games, kept in the browser, shared through a cookie on `.ashwinsathian.com`.
- Tokens spent per credit and won per result, with the economy defined once, centrally.
- Each game greets a direct visitor as an arcade cabinet ("insert token") and links back to the hall.
- The hall gets the card, the price of each machine, a coin-insert camera move and a change machine that pays the daily tokens.
- The site's language moves from "games" to "the arcade" throughout.
- A new game joins with one script tag and two events.

## Non-goals

- Accounts, servers, sync across devices or browsers. Clearing cookies resets the card.
- Spending tokens on anything except plays (no shop or prizes yet).
- Leaderboards by tag.

## Anti-goals

- A game that stops working because the pass failed to load. The pass fails open: no pass, free play.
- Anyone locked out for more than about 15 minutes.
- Pass UI that covers a game's own controls or HUD, or appears mid-run.
- Pretending the wallet is secure. It is a cookie the player can edit. The design doesn't claim otherwise and doesn't fight it.

## Constraints found in the code

- The games use separate localStorage per origin, so the wallet has to be a cookie on `Domain=ashwinsathian.com`. This is the same pattern as `arcade_best_<slug>` (docs/ARCHITECTURE.md).
- Every game's CSP has `connect-src 'self'`. That doesn't matter, because the pass makes no requests. Spillway, Swish, Clover, Coil, Glide, Nonet, Noughts and Pinfall have `script-src 'self' 'unsafe-inline'` and `font-src 'self'`, and each needs `https://arcade.ashwinsathian.com` added. Rally, Minefield, Lightkeeper and Typester have no CSP.
- The arcade's own CSP allows script files only (no inline). The budgets are a 30 KB hall, a 4 KB shared script and 12 KB of home HTML. Every glyph must be in the Bricolage subset (tests/site.test.mjs).
- Spillway already has an in-game "wallet" of letters, so the arcade's currency is called **tokens**, never coins or wallet.
- Typester is Angular with SSR prerender. Anything it calls must be browser-guarded.
- No game repo has CI. The checks are each repo's `npm test`, its build, and a browser run.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (picked)** | **A live shared pass.** Each game loads `https://arcade.ashwinsathian.com/pass.js` and dispatches `arcade:start` and `arcade:end`. | One source. The economy and UI change without redeploying the games, and a new game needs one tag and two events. Costs: a CSP change per game, and the single-file games are no longer fully self-contained. |
| B | **A vendored copy** of the pass, synced into each repo and inlined at build. | Games stay single-file, but 12 copies drift, and every economy change means 12 deploys. |
| C | **A server wallet** (Workers + D1). | Ruled out: the user asked for browser-only state. |

The user picked A.

## The contract between a game and the pass

The game adds this to `<head>`:

```html
<script src="https://arcade.ashwinsathian.com/pass.js" data-game="clover" defer></script>
```

At the point a run is committed to (rules below), the game calls:

```ts
if (!dispatchEvent(new CustomEvent('arcade:start', { cancelable: true, detail: { mode } }))) return; // no token: the pass shows why
```

When a run ends with a result:

```ts
dispatchEvent(new CustomEvent('arcade:end', { detail: { mode, score, won } })); // fields per game, below
```

That is the whole integration. With no pass loaded, `dispatchEvent` returns true and nothing listens.

Rules every game follows:
- Never dispatch for attract or demo play, `?autoplay`, bot-driven menus, replay or ghost-viewing links, warm-up or practice throws, or resuming a saved run.
- Dispatch `start` at the commit point, not on a menu click. Restart, Play again and Rematch each count as a new start.
- Dispatch `end` only for a finished run. Quit and Restart mid-run send nothing: no payout, and no refund.
- `detail.mode` uses the game's own mode ids. The pass's table decides which modes are free.

## The pass (pass.js)

The source lives in the arcade repo under `src/pass/`. It is built to a stable `/pass.js` served with `Cache-Control: public, max-age=300, stale-while-revalidate=86400`. It is a classic script, wrapped in an IIFE. It has no dependencies and a budget of 14 KB gzipped, enforced by a test. The hall loads the same deployed `/pass.js` with a `<script src>` tag, not a bundled copy, so there is one implementation and the hall budget holds. The pass exposes a small `window.arcadePass` API (card, insert, onChange) for the hall to drive. The external tag carries no SRI on purpose: the pass is updated in place by design, and it is served from the same owner's origin.

### The card (cookie `arcade_card`)

The value is `encodeURIComponent(JSON)` on `Domain=ashwinsathian.com; Path=/; Max-Age=34560000; SameSite=Lax; Secure`. Off that domain (localhost, workers.dev), it is host-only without `Domain`.

```ts
type Card = {
  v: 1;
  tag: string;                          // "Velvet Otter"; 2–20 chars [A-Za-z0-9 '-]
  tok: number;                          // 0..99
  at: number;                           // refill anchor, epoch ms
  day: number;                          // last daily claim, days since epoch (UTC)
  st: number;                           // streak, consecutive daily claims
  cr: Record<string, number>;           // plays left on each machine
  paid: Record<string, [number, number]>; // slug → [day, tokens paid that day]
  log: [number, string, number, string][]; // last 12: [epoch s, slug|"hall", delta, why]
  seen: string[];                       // slugs played at least once
  b: Record<string, number>;            // "slug.mode" → personal best metric
  dd: Record<string, number>;           // slug → day its daily last paid
};
```

- Treat the cookie as input. On read, parse it defensively: clamp the numbers, sanitise the tag, drop unknown slugs, and cut the log. Malformed means a fresh card, keeping the tag when it is valid.
- Read, modify, then write on every change, re-reading first, so two open tabs stay roughly consistent. Last write wins, which is acceptable.
- The size stays under about 1.5 KB.

### Economy (one table, `src/pass/economy.ts`)

- **Welcome:** 12 tokens and a random tag on the first card.
- **Daily:** the first page load on a UTC day, in the hall or any game, pays `4 + min(st, 5)` tokens automatically: 5 on day one, rising to 9 on a five-day streak. Missing a day resets the streak. A toast announces it. In the hall, the change machine plays the dispense. There is no Collect button. *(Builder's call after review.)*
- **Refill:** while `tok < 3`, the card gains 1 token every 15 minutes since `at`, up to 3. It is computed lazily on read, with no timers needed except for the countdown display.
- **Cap:** 99 tokens. Payouts above the cap are lost, and the toast says "Cup's full".
- **Price:** 1 token loads a credit of `plays` plays on that machine. Plays stay on the machine (`cr[slug]`) until used. The hall marquee and the game chip show "CREDIT n".
- **Start:** `arcade:start` takes one play. With no plays left it auto-inserts a token, then takes one play. With no tokens it is refused, and the out-of-tokens sheet opens. Free modes are never charged.
- **Payout:** on `arcade:end` for a charged run, the pass looks up `tiers(slug, detail)`, which returns 0–3. It adds 1 for a new personal best, which the pass tracks itself in `card.b["slug.mode"]`, using the table's higher-is-better `metric(detail)` for that machine. The games report no best. *(Builder's call after review.)* The result is capped by the daily cap of 20 tokens per machine per UTC day, then credited, with a toast and a log line.
- **Sanity:** an `end` with no matching `start` in this tab (run id kept in sessionStorage) pays nothing. So does a run shorter than the machine's `minMs`.

Per machine. The tier thresholds are first guesses, and the builder sets them from each game's scoring code so that tier 1 is a typical first decent run, tier 2 a good run and tier 3 a great one.

| Machine | Plays per token | Free modes | End detail | Tiers (1 / 2 / 3) |
|---|---|---|---|---|
| Clover | 1 | calm | score, lawns, won | lawns ≥1 / ≥3 / ≥6; daily won = 2 |
| Coil | 3 | zen | score | Classic/Gates/Blitz score thresholds by mode |
| Glide | 1 | online | won, level, margin | win Rookie 1 / Regular 2 / Shark 3; duel pays 0 |
| Lightkeeper | 1 | practice | score | score thresholds (classic, timed) |
| Minefield | 3 (beginner), 1 (others) | — | won, mode, secs | win beginner 1 / intermediate 2 / expert 3; daily won 2 |
| Nonet | 1 | — | won, level, underPar | solved 1, under par +1, hard/master +1 |
| Noughts | 3 | online | won, level, variant | win vs good 1 / best 2; ultimate +1; a draw vs best 1; local pays 0 |
| Pinfall | 1 | warm | score (solo), spares | score ≥90 / ≥150 / ≥200; spares ≥4 / ≥7 / ≥9 |
| Rally | 1 match, 3 solo | online | won, level, points | win Casual 1 / Club 2 / Pro 3; solo points thresholds |
| Spillway | 2 | — | score | score thresholds |
| Swish | 2 | — | score, mode | per-mode score thresholds |
| Typester | 2 | — | score, wpm | wpm ≥35 / ≥55 / ≥80; drill pays at most 1 |

The intent is that an average player gets back about 0.6 to 0.8 of what they spend, and a good one gains. Refill and daily tokens keep everyone playing.

Two players and online:
- Local two-player is one credit on that device and never pays (see the adversarial fixes).
- Online is free and never pays.

### Tags

`Adjective Noun` from two curated lists of 64 words each, themed on night, neon and arcade-hall nature ("Velvet Otter", "Neon Heron", "Copper Moth"). That gives 4,096 tags. Both lists are ASCII and in the font subset. Players can reroll (a dice button) or type their own; custom names are sanitised to `[A-Za-z0-9 '-]`, 2–20 characters. The tag shows on the card, on toasts ("Nice one, Velvet Otter"), on the hall marquee next to the best ("12,340 · VELVET OTTER") and on the welcome screen.

### UI inside each game (shadow DOM, the arcade's look)

Everything renders in one closed shadow root, appended to `<body>`, so game CSS can't reach it. Dialogs use `<dialog>` and `showModal` (the top layer, so no z-index fights). The arcade's Bricolage is loaded from the arcade origin, so the arcade needs `Access-Control-Allow-Origin: *` on the font path. The palette is a night "player card": near-black glass, the game's `bright` as the accent (the pass carries each machine's name and colours), and a gold token.

1. **The chip.** A small pill in a corner showing a spinning gold token, the token count, the tag and `CREDIT n`. The corner is set per game with `data-corner="tr|tl|br|bl"`, chosen by the builder to stay clear of that game's HUD and tools. It shows only between runs, sliding away at `start` and returning at `end`. Tapping it opens the card.
2. **Cabinet welcome.** Shown on a direct visit, meaning there is no hall hand-off (below). It shows "Cabinet 04 of 12 · The Arcade", the machine name lettered large in its colour, the card (tag, tokens), the price ("1 token · 3 plays · pays up to 3"), **Insert token**, which loads a credit with a coin-drop animation and sound and then closes, and **Walk the hall**, which goes to `arcade.ashwinsathian.com/#slug`. Esc or close dismisses it without inserting; the next start auto-inserts. On a first-ever card, the welcome comes first ("You're Velvet Otter. Here are 12 tokens.").
3. **Toasts**, bottom centre, `aria-live=polite`, 2.4 s, at most two stacked: "−1 token · 2 plays left on Coil", "+3 tokens · Great run", "+1 · New best", "Cup's full".
4. **Out of tokens.** A dialog that names the next refill with a live countdown and links to Walk the hall.
5. **The card sheet.** The tag (edit, reroll), the token count, the streak, the refill timer, plays left on this machine, the receipt (the log), and Walk the hall.

Accessibility: everything is keyboard reachable, with labelled buttons and focus returned to the game on close. Reduced motion turns off the coin spin and flight. Contrast meets AA.

### The hall hand-off

When Play is pressed in the hall, the hall inserts the token itself, as part of the camera move. It then sets `arcade_via=<slug>` (Max-Age 120, same domain) before navigating. The pass reads it, deletes it, and skips the welcome, because the credit is already loaded.

## The hall (arcade.ashwinsathian.com)

Budgets stay as tests/site.test.mjs sets them, except the hall script, which goes from 30 KB to 34 KB for the change machine and the coin move (user decision). Home HTML stays under 12 KB: prices and credits are filled in by script from the pass's table, and "How the arcade works" is its own page, `/tokens`.

- **The card in the top bar:** token chip and tag, which opens the same card sheet (the shared modules, styled for the page).
- **Card for each machine:** the price ("1 token · 3 plays"), "Pays up to 3", "Credit n" when plays are loaded, and "Your best: … · Velvet Otter".
- **Insert and play: a new camera move.** Play eases the camera down and in to the machine's coin door (about 0.45 s). A gold token, a small lit mesh in the shared shader, drops into the slot. The coin door lamp flashes, the marquee credit counter ticks up, and the coin sound plays. Then the camera rises into the screen as it does today. With reduced motion it cuts. With 0 tokens, Play becomes "Out of tokens · 12:41", and the card offers the change machine.
- **The change machine.** The drinks machine is repainted as a TOKENS change machine (art.ts `vending`) in brass and red with a token hopper. It can be picked in the 3D scene and in the row of buttons ("Change machine"). When a daily is claimable, its lamp pulses. Claiming swings the camera to it, tokens spill into the tray with the sound, and a toast shows "+7 · Day 3 streak". It is the hall's one new stop on the rail.
- **Marquees** letter the best with the tag, and the credit count when there are plays left.
- **The random-machine button** is renamed from "Insert coin" to "Surprise me". Coins now mean something real.
- **Language:**
  - The footer block letters spell "arcade".
  - Headings and copy say machines, cabinets, the hall and the arcade where they name the place, and games where they name the games.
  - A new page, `/tokens` ("How the arcade works"), covers tokens, plays, payouts, refill, daily and that everything stays in this browser. It is linked from the card and the footer.
  - Game pages (`/[slug]`) show the price, the payout table in words and free modes.
  - The README, ARCHITECTURE (a pass contract section, the card cookie added to the state table), CONTRIBUTING (a checklist for adding a game) and llms.txt are updated.
  - Internal `games:*` storage keys stay as they are.

## Adversarial review: fixes folded in

1. **Quit leaves the chip hidden forever.** Quit and Restart send no end, so the pass would think a run is still live. Fix: games also dispatch `arcade:end` with `{ quit: true }` on quit, abandon and return-to-menu paths. That pays nothing and shows the chip again. A new `arcade:start` also closes any open run.
2. **Keys leak through pass dialogs.** Games listen on `window` for Enter, Space and Esc. Enter on "Insert token" would also start or restart the game behind it. Fix: the pass host stops propagation of `keydown`, `keyup`, `pointerdown`, `pointerup` and `click` from its shadow root while a pass dialog is open.
3. **Online play can't be refused.** Glide online, Rally online and Noughts online restart rounds by server or peer message. Refusing a start on one device would desync the match, and payouts there are farmable with two tabs. Fix: online modes are free and never pay.
4. **Local two-player has no "you".** Glide duel, Noughts local and Pinfall with two or more players are charged like any credit, since one cabinet is one coin, and they never pay. This replaces "Noughts local: free" and "duel: win 1".
5. **Daily modes are farmable.** A daily board is the same all day and can be memorised. Fix: a mode id containing `daily` pays only on its first finished run per UTC day (`card.dd[slug] = day`). Later runs are charged but pay 0. Minefield and Nonet shared or custom boards are free and never pay, since anyone can craft them. Minefield runs marked `assisted` (take-back) pay 0.
6. **Load order.** The pass tag must sit before the game's own script in the HTML, so a `defer` pass runs before an inline or module game script and before any `?start=` autostart. Pass loaded late means a free run, with no payout (no matching start).
7. **First card double grant.** A brand-new card gets the 12 welcome tokens and today's `day`, so it doesn't also collect the daily on the same load.

Further calls:
- Refill anchor: whenever `tok >= 3`, `at = now`, so the 15-minute countdown starts from the spend that dropped you below 3.
- Machine facts (name, colours, cabinet number) are generated into the pass from `src/data/games.ts` at build time. A site test fails if any game lacks an economy entry, so a new game can't skip the wiring.
- The font is copied to a stable `/pass/bricolage.woff2` with `Access-Control-Allow-Origin: *`. The `/_astro` hashed path can't be referenced from other origins.
- `minMs` per machine is about 1.5 s, under which nothing pays.
- Coil: charge on the first `begin()` after each `startGame`, not on every Gates room. Minefield: charge on the first dig. Typester: charge on the first key. Nonet: charge at the `newGame` call sites, never in `begin`.

## Shipping

- Arcade first: `/pass.js` has to exist before the games reference it, though they fail open anyway.
- Then the twelve games, each on branch `arcade-pass` with a PR and a deploy.
- Typester has no deploy script. Use `ng build` then `npx wrangler deploy`, as its README says.
- The user authorised production deploys of all thirteen, and merging at the builder's discretion. Order: verify, merge, deploy from `main`.

## Verification

- The pass economy gets `node:test` unit tests for refill, daily and streak, the cap, plays per token, free modes, the payout tiers per machine, the daily cap, malformed-cookie parsing, and tag sanitising.
- Site tests: the pass budget, the font-subset check for the new copy, and no inline scripts.
- Each game: its own `npm test` and build pass, then a Playwright run against the local build with the pass served locally. Checks: the welcome on a direct visit, a token taken at start, a payout at end, and free modes free. Also check that no pass dispatch fires under `?autoplay`, and that with the pass blocked the game plays with no errors.
- After deploy: a cross-subdomain check in a real browser. A token spent in Clover shows in the hall and in Coil.

## Left to the builder

- Exact tier thresholds per game, from each game's scoring code.
- The chip corner per game.
- The pass build mechanism (a Vite lib build or esbuild) that writes `/pass.js` into the Astro output.
- The 128 tag words.
- The exact coin-door camera pose and token mesh.
