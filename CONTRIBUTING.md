# Contributing

Thanks for taking a look. This is a personal project, so the bar for new features is high, but bug reports, fixes and good ideas are all welcome.

## Reporting a bug

Open an issue with the bug template. The most useful reports name the device, browser and theme (Day or Night), and include a screenshot or a short recording. For rendering bugs, also say whether the page showed the photograph (no WebGL 2) or the live hall.

## Making a change

1. Use Node 24, then run `npm install`.
2. Run `npm run dev` and open http://localhost:4330.
3. Keep the change small and in the style of the file around it. The codebase avoids dependencies: the hall uses no 3D library, and new runtime dependencies are unlikely to be accepted.
4. Run `npm test` before you open a pull request. It runs `astro check`, builds the site and enforces the byte budgets, the font subset, the Content Security Policy and the link rules. Never weaken a test to make it pass.
5. For anything visual, attach before and after screenshots at a phone width, a tablet width and a desktop width, in Day and in Night. `npm run shoot` takes them for you.

## Writing

Copy on the site is British English, plain and specific. Every character must be in the subset font in `src/fonts`; the test names any page that needs a glyph outside it.

## Conduct

Be kind and assume good intent. Harassment or personal attacks of any kind will get you blocked.
