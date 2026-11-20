// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://games.ashwinsathian.com",
  // Fully static: every page is a file served from Cloudflare's edge.
  output: "static",
  trailingSlash: "never",
  build: { format: "file", inlineStylesheets: "always" },
  // Link prefetching is public/speculation.json plus src/scripts/site.ts.
  prefetch: false,
  integrations: [sitemap({ filter: (u) => !u.includes("/og/") })],
  // No data: URIs or inline scripts: the CSP in public/_headers forbids both.
  vite: { build: { assetsInlineLimit: 0 } },
});
