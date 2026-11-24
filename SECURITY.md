# Security

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's [private vulnerability reporting](https://github.com/AshwinSathian/arcade/security/advisories/new) instead, and include steps to reproduce. You should hear back within a week.

## Scope

- The site at arcade.ashwinsathian.com and its redirect from games.ashwinsathian.com.
- The code in this repository, including the two Workers in `worker/`.

The site is static and keeps no accounts or server-side data. It sends a strict Content Security Policy (`public/_headers`) that allows same-origin scripts only, with no inline script. The one outside input it reads is the `arcade_best_*` cookie that the games write; [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#best-scores) describes how the page cleans it.
