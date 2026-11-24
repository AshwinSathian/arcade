// Reads the bests the games share in arcade_best_<slug> cookies. Written by our own games, but a cookie is
// still input: strings only, printable, cut to length, and anything malformed is ignored.
export type Best = { v: string; l: string };

const clean = (s: unknown, n: number) => (typeof s === "string" ? s.replace(/[^\p{L}\p{N}\p{P}\p{Zs}]/gu, "").trim().slice(0, n) : "");

export function parseBests(cookie: string, slugs: string[]): (Best | undefined)[] {
  const jar = new Map(cookie.split(/;\s*/).map((c) => { const k = c.indexOf("="); return [c.slice(0, k), c.slice(k + 1)] as const; }));
  return slugs.map((slug) => {
    const raw = jar.get(`arcade_best_${slug}`);
    if (!raw) return undefined;
    try {
      const o = JSON.parse(decodeURIComponent(raw));
      const v = clean(o?.v, 12), l = clean(o?.l, 14);
      return v ? { v, l } : undefined;
    } catch { return undefined; }
  });
}
