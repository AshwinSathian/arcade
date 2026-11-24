// A plain-text summary for language models and answer engines (llmstxt.org), built from the same data as the pages.
import type { APIRoute } from "astro";
import { games, site } from "../data/games";

export const GET: APIRoute = () => {
  const body = [
    `# ${site.name}`,
    "",
    `> Twelve free games that run in a web browser on phone, tablet and desktop, made by ${site.author} (${site.authorUrl}). No install, no sign-up, no ads and no analytics. They stand in a 3D arcade drawn live in WebGL 2, whose source is open under the MIT licence: ${site.repo}`,
    "",
    ...games.flatMap((g) => [
      `## ${g.name} (${g.kind})`,
      "",
      `- Play: ${g.url}`,
      `- About: ${site.url}/${g.slug}`,
      ...(g.post ? [`- Engineering write-up: ${g.post.url}`] : []),
      `- Modes: ${g.modes.join(", ")}`,
      `- Controls: ${g.controls}`,
      `- Size: ${g.sizeNote}`,
      `- Built with: ${g.stack}`,
      "",
      g.line,
      "",
      ...g.about.flatMap((p) => [p, ""]),
    ]),
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
