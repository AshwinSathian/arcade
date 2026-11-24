# Architecture

The site is static HTML from Astro, served by Cloudflare. The home page adds one module, the hall, which draws the arcade in WebGL 2 over a photograph of itself. This page covers how the hall is put together and the few contracts it depends on.

## Files

| File | Role |
| --- | --- |
| `src/arcade/core.ts` | Matrix maths, WebGL helpers and the mesh builder. Every face is wound from the normal it is given, so back faces can be culled everywhere. |
| `src/arcade/scene.ts` | Geometry for the three machine types (upright, cocktail table, pinball), the room, the drinks machine and the light beams. Each machine maps its art onto one 1024×1344 canvas. |
| `src/arcade/art.ts` | Canvas painters for marquees, side art, control panels, table tops, the neon and the drinks machine, plus a motif per game. Each painter draws into the rectangle it is given. |
| `src/arcade/shaders.ts` | One lit shader for every surface (material chosen per vertex), a depth shader, the beam shader and the post chain. |
| `src/arcade/hall.ts` | The renderer, the camera rail, pointer input, picking, and the video screens. |
| `src/arcade/sound.ts` | Synthesised effects and the ambient room. |
| `src/scripts/arcade.ts` | The page side: card, row, keyboard, gamepad, attract mode, last played, bests, prices, sound and hints. |
| `src/pass/` | The arcade pass, built by `scripts/pass.ts` to `/pass.js`: the player card (`card.ts`), the economy (`economy.ts`), tags (`tags.ts`) and the UI in a closed shadow root (`ui.ts`). The hall and every game load it. |

## A frame

```mermaid
flowchart LR
  V[Clip frames] --> T[Screen textures]
  T --> G[Screen light colours]
  S[(Shadow map, drawn once)] --> M
  R[Mirrored pass, half size, mipmapped] --> M[Main pass: 4x MSAA HDR]
  G --> M
  M --> B[Beams, additive]
  B --> X[Resolve]
  X --> D[Bloom: 6 levels down, tent filter up]
  X --> C[Composite]
  D --> C
  C --> O[Tone curve, lens fringe, vignette, grain, fade]
```

- **Shadows.** Nothing in the room moves, so the sun's shadow map is drawn once at start-up and sampled with eight rotated taps.
- **Floor.** The hall is drawn a second time, mirrored under the floor, into a half-size target. The floor samples it by screen position at a mip level set by its roughness, with a Fresnel weight, so the reflection blurs where the concrete is matte.
- **Light.** GGX specular and Lambert diffuse, a hemisphere ambient, an analytic room for reflections, and up to 24 point and spot lights. Each screen is a light whose colour is the average of its clip, sampled from a 4×4 canvas a few times a second. Each machine casts a soft contact shadow on the floor from its footprint.
- **Day and Night** is one number from 0 to 1 that drives the sun, the sky, exposure, bloom, the downlights (which come on in order, with a flicker) and the neon.
- **Budget.** The canvas is capped at 3.2 million pixels on a laptop and 1.9 million on a touch device. If frames run long for two seconds, the resolution drops by a fifth.

## The camera

The camera rides a rail along the row, at eye height and from the front left, and springs to the machine in focus. The page measures the part of the canvas its interface leaves free and passes it to the hall as fractions (`hall.free`). The hall then:

1. Sets the field of view so that about 2.5 m of hall fits the free height and at least 2 m fits the free width.
2. Shifts the lens (an off-axis projection) so the machine is centred in the free part rather than on the canvas.

This makes the same code frame a laptop (beside the card), a phone held upright (above the card), a phone held sideways (between the bars, right of the card) and a tablet in either orientation. Play eases the camera into the screen, drops the lens shift, and fades to the game's colour.

## Best scores

Each game writes its headline best to a cookie that every subdomain can read:

```
arcade_best_<slug> = encodeURIComponent(JSON.stringify({ v, l }))
; Domain=ashwinsathian.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure
```

- `v` is the best as the game displays it, at most 12 characters, for example `"12,340"` or `"1:42.3"`.
- `l` is a label, at most 14 characters, for example `"Classic"` or `"Expert"`.

The arcade treats the cookie as input. It accepts strings only, strips anything that is not a letter, number, punctuation or space, cuts both fields to length, and only ever writes them as canvas text or `textContent`. When the visitor comes back from a game through the back button, the page reads the cookies again and repaints that marquee.

## The arcade pass

Every game loads `https://arcade.ashwinsathian.com/pass.js` (a classic script, before its own) and talks to it with two window events:

```ts
if (!dispatchEvent(new CustomEvent("arcade:start", { cancelable: true, detail: { mode } }))) return; // no token: the pass says why
dispatchEvent(new CustomEvent("arcade:end", { detail: { mode, score } }));   // fields per machine, in economy.ts
dispatchEvent(new CustomEvent("arcade:end", { detail: { mode, quit: true } })); // abandoned: pays nothing
```

- With no pass loaded, `dispatchEvent` returns true and the game plays free. A game never depends on the pass.
- Games don't dispatch for attract or demo play, `?autoplay`, replays, warm-up throws, resumed runs or online play.
- The pass prices and pays every machine from one table (`src/pass/economy.ts`). A token loads `plays` plays onto a machine; a run pays 0 to 3 by its result, plus 1 for a new best in that mode, at most 20 tokens per machine per day.
- The pass stops key events that start inside it from reaching the game, so Enter on "Insert token" never also starts a run.
- The hall loads the same file and drives it through `window.arcadePass` (`card`, `insert`, `plays`, `price`, `handoff`, `open`). On Play it inserts the token itself and sets `arcade_via`, so the machine skips its greeting.
- `/pass.js` is cached for five minutes, so a change to the economy reaches every machine without redeploying them.

The card is base64url JSON in one cookie. The pass treats it as input: it clamps numbers, drops unknown machines, cleans the tag to `[A-Za-z0-9 '-]` and cuts the receipt to 12 lines, and every value reaches the page through `textContent`. It is not secure and doesn't try to be: tokens have no value outside the arcade.

## State kept on the device

| Key | Where | What |
| --- | --- | --- |
| `games:lights` | localStorage | `day` or `night`; absent means follow the system |
| `games:still` | localStorage | Clips paused |
| `games:sound` | localStorage | `0` when sound is off |
| `games:last` | localStorage | Slug of the last game played |
| `games:swiped` | localStorage | The swipe hint has been seen |
| `arcade_best_*` | cookie | Written by the games, read here |
| `arcade_card` | cookie | The player card: tag, tokens, plays per machine, bests per mode, streak, receipt. Written by the pass |
| `arcade_via` | cookie | The machine the hall just sent you to, for two minutes |
| `arcade:run:*`, `arcade:hi:*` | sessionStorage | The run in progress and whether a machine has greeted you, per tab |

There is no analytics and no server state. [/privacy](https://arcade.ashwinsathian.com/privacy) lists all of this for players.

## Workers

- `worker/index.js` runs for `/media/*` only and answers byte-range requests, because Safari will not play an MP4 that cannot be fetched by range. Everything else comes straight from static assets.
- `worker/redirect.js` is deployed under the old Worker's name and holds games.ashwinsathian.com. It answers every request with a 301 to the same path and query on arcade.ashwinsathian.com.
