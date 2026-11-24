<div align="center">

# The Arcade

**Ten browser games in a 3D arcade you can walk along, drawn live in WebGL 2 with no 3D library.**

[**arcade.ashwinsathian.com**](https://arcade.ashwinsathian.com)

[![CI](https://github.com/AshwinSathian/arcade/actions/workflows/ci.yml/badge.svg)](https://github.com/AshwinSathian/arcade/actions/workflows/ci.yml)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
![Hall script: 24 KB gzipped](https://img.shields.io/badge/hall%20script-24%20KB%20gzipped-success)
![No 3D library](https://img.shields.io/badge/3D%20library-none-lightgrey)

![The arcade at night: a row of cabinets under downlights, each screen playing its game, with a pink ARCADE neon on the wall](public/og/index.jpg)

</div>

The Arcade is the front door to ten small games: Clover, Coil, Lightkeeper, Minefield, Nonet, Noughts, Rally, Spillway, Swish and Typester. Each game runs on its own subdomain. This repository is the room they stand in.

## What it does

- **A machine for every game.** Uprights for the arcade games, cocktail tables for the three puzzles and a pinball table for Lightkeeper. Every screen plays a real recording of its game, and every marquee, side panel and control panel is painted on a canvas when the page opens, in that game's colours.
- **A camera that frames for the screen it is on.** It stands at eye height, front left, on a rail along the row. It works out the part of the screen the interface leaves free and frames the machine there: beside the card on a laptop, above it on a phone, between the bars on a phone held sideways.
- **Day and Night.** These follow the system theme until the visitor picks one, on every page, with no flash on load. By day, sun shafts come through clerestory windows. By night, the downlights come on one by one, the neon lights up, and each screen lights the floor in its clip's colour.
- **Your own bests on the marquees.** Each game shares the player's best through a cookie on `.ashwinsathian.com`, and the arcade letters it onto that game's marquee.
- **An arcade that keeps going without you.** After 40 seconds of quiet it switches to attract mode and walks the row by itself. The machine you played last glows and is where you start next time. A low room hum and distant attract tunes play after your first tap, panned to where each machine stands.
- **Every way in.** Drag, flick, the arrow keys, a gamepad, the row of buttons, or Insert coin for a random machine. Play flies the camera into the screen, then opens the game.

## How it is built

| Layer | What it is |
| --- | --- |
| Site | [Astro](https://astro.build) 7, fully static, one page per game plus `llms.txt`, sitemap and social cards |
| The hall | About 1,700 lines of TypeScript and GLSL in [`src/arcade`](src/arcade), on raw WebGL 2 |
| Rendering | Shadow map, mirrored floor reflection, 4× MSAA HDR, GGX lighting from 21 lights, contact shadows, light beams, bloom, neutral tone curve |
| Sound | Web Audio, synthesised: no audio files |
| Hosting | Cloudflare Workers static assets. One Worker answers byte ranges for the clips, because Safari needs them, and another sends the old address on to the new one |

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) explains how the parts fit together: the frame pipeline, the camera, the best-score cookie and the fallbacks.

### Budgets, enforced by `npm test`

- Home page HTML under 12 KB gzipped, shared script under 4 KB, the hall under 30 KB.
- Every character on every page is in the subset font.
- No inline scripts: the Content Security Policy allows script files only.
- No link to a private repository or to the old address.

### When things are missing

| Situation | What happens |
| --- | --- |
| Before the first frame | A photograph of the hall in the current light stands in (`public/hall/*.webp`) |
| No WebGL 2 | The cards and the row still work over that photograph |
| Save-Data | Screens show stills, and no clip is downloaded |
| Reduced motion | The camera cuts instead of gliding, there is no fly-in and no attract mode |
| Pause clips | Screens stop, and the idle drift stops |
| Slow GPU | Resolution steps down while frames run long, and phones start at a lower pixel budget |

## Getting started

Requires Node 24.

```sh
npm install
npm run dev          # http://localhost:4330
npm test             # astro check, build, then the site and Worker tests
```

| Script | What it does |
| --- | --- |
| `npm run deploy` | Build and deploy the site to Cloudflare |
| `npm run deploy:redirect` | Deploy the Worker that sends games.ashwinsathian.com on to the arcade |
| `npm run capture` | Re-record the gameplay clips from the live games (needs ffmpeg) |
| `npm run hall` | Re-photograph the hall by day and by night (needs a real GPU), then build |
| `npm run og` | Redraw the social cards, then build |
| `npm run shoot` | Screenshot the built site at phone, tablet and desktop widths for review |

## Project layout

```
src/
  arcade/        the hall: renderer, scene, cabinet art, shaders, sound
  scripts/       page scripts: arcade.ts (home), site.ts (every page)
  pages/         home, one page per game, social cards, llms.txt
  components/    Lights switch, game tiles, footer
  data/games.ts  every game's copy and facts, the one source for pages and llms.txt
public/          clips, hall photographs, social cards, headers, theme.js
worker/          the clip-range Worker and the old-address redirect
scripts/         capture, photograph and screenshot tools (Playwright)
tests/           node:test checks on the built site and the Workers
docs/            architecture notes
```

## Contributing

Bug reports and ideas are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md). To report a security problem, see [`SECURITY.md`](SECURITY.md).

## Licence

[MIT](LICENSE) © Ashwin Sathian. The gameplay clips and stills are recorded from the games, which remain the author's.
