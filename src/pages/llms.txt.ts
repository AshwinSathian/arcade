// A plain-text summary for language models and answer engines (llmstxt.org), built from the same data as the pages.
import type { APIRoute } from "astro";
import { games, site } from "../data/games";
import { machines } from "../pass/economy.ts";

export const GET: APIRoute = () => {
  const body = [
    `# ${site.name}`,
    "",
    `> Twelve free games that run in a web browser on phone, tablet and desktop, made by ${site.author} (${site.authorUrl}). No install, no sign-up, no ads and no analytics. They stand in a 3D arcade drawn live in WebGL 2, whose source is open under the MIT licence: ${site.repo}`,
    "",
    `Every machine takes tokens, which cost nothing: a player starts with 12, good runs pay tokens back, and the cup refills while they are away. A player card with a random "Adjective Noun" tag holds them, kept in one browser cookie shared by every game. How it works: ${site.url}/tokens. What is kept: ${site.url}/privacy`,
    "",
    ...games.flatMap((g) => [
      `## ${g.name} (${g.kind})`,
      "",
      `- Play: ${g.url}`,
      `- About: ${site.url}/${g.slug}`,
      `- Modes: ${g.modes.join(", ")}`,
      `- Controls: ${g.controls}`,
      `- Size: ${g.sizeNote}`,
      `- Built with: ${g.stack}`,
      `- At the machine: 1 token for ${machines[g.slug].plays === 1 ? "1 play" : `${machines[g.slug].plays} plays`}. ${machines[g.slug].pays}`,
      "",
      g.line,
      "",
      ...g.about.flatMap((p) => [p, ""]),
    ]),
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
