# games.ashwinsathian.com

The front door to eight browser games: [Coil](https://coil.ashwinsathian.com) (snake), [Lightkeeper](https://lightkeeper.ashwinsathian.com) (pinball), [Lintel](https://lintel.ashwinsathian.com) (falling-brick puzzle), [Minefield](https://minefield.ashwinsathian.com) (Minesweeper), [Nonet](https://nonet.ashwinsathian.com) (sudoku), [Noughts](https://noughts.ashwinsathian.com) (noughts and crosses), [Rally](https://rally.ashwinsathian.com) (table tennis) and [Typester](https://typester.ashwinsathian.com) (typing). Each game lives in its own repository and on its own subdomain; this site links to them.

![The home page](public/og/index.jpg)

## How it works

Astro builds a fully static site into `dist`, and Cloudflare Workers serves it as static assets. The only code on the server is `worker/index.js`, which answers byte-range requests for the clips, because Safari will not play an MP4 without them. The home page is about 9 KB of gzipped HTML with its CSS inlined, one 24 KB font and one script of about 2 KB.

- **Clips are real play.** `scripts/capture.ts` drives each live game with its own hooks (Coil's replay links, Lightkeeper's attract loop, Minefield's hints, Noughts' solved Fading line, Rally's `?autoplay` bot) and records nine seconds with Playwright, encoded by ffmpeg as muted H.264 of 30 to 280 KB. A clip loads only when its tile is on screen, pauses when it leaves, and never loads under Save-Data. With reduced motion it plays only on hover or focus.
- **Skeletons.** Every picture shimmers until it arrives. A slow navigation shows a progress bar and the shape of the next page after 120 ms; prerendered pages land before that and never show it.
- **Speed.** `public/speculation.json` prerenders site pages on hover and prefetches a game's page when its Play link is hovered. Other browsers get a prefetch from `src/scripts/site.ts`. Cross-document view transitions carry a game's clip from its tile to the top of its page.
- **Search and answer engines.** Every page has a canonical URL, Open Graph and Twitter cards, and JSON-LD (`WebSite` and `ItemList` on the home page; `VideoGame` with a `VideoObject` trailer and a `BreadcrumbList` on each game page). There is a sitemap, a robots file that admits AI crawlers, and `/llms.txt` built from the same data as the pages.

All copy and game facts live in `src/data/games.ts`.

## Commands

```sh
npm install
npm run dev        # http://localhost:4330
npm test           # build, then check meta, JSON-LD, font coverage, CSP, byte budgets, headers
npm run capture    # re-record the clips from the live games (needs ffmpeg and ../coil)
npm run og         # re-draw the social cards from the built /og pages, then build again
npm run deploy     # build and deploy to Cloudflare
```

The font is the portfolio's cut of Bricolage Grotesque (Latin, weights 400 to 800). `npm test` fails if a page uses a character outside it.

## Licence

MIT. The games' screenshots and clips come from the games themselves, which are MIT-licensed too.
