// What each machine costs and what it pays. The one place the arcade's economy is tuned.
// Thresholds come from each game's scoring code (2026-11-24): tier 1 is a first decent run, 2 a good one, 3 a great one.
import { type Card, add, insert as load, note, refill, today } from "./card.ts";

export type Detail = Record<string, unknown> & { mode?: string; quit?: boolean };
export type Tier = 0 | 1 | 2 | 3;
export type Machine = {
  /** Plays a token loads onto this machine. */
  plays: number;
  /** Mode ids the game dispatches. */
  modes: string[];
  free: (mode: string, d: Detail) => boolean;
  tier: (mode: string, d: Detail) => Tier;
  /** Higher is better; a new personal best pays one more. Undefined: this result has no best. */
  metric?: (mode: string, d: Detail) => number | undefined;
  /** The most one run pays, for the price line. */
  top: number;
  /** What pays, in words, for the game's page. */
  pays: string;
};

const DAILY_CAP = 20, MIN_MS = 1500;
const n = (d: Detail, k: string) => { const v = d[k]; return typeof v === "number" && Number.isFinite(v) ? v : 0; };
const yes = (d: Detail, k: string) => d[k] === true;
/** Tier from a higher-is-better value. */
const up = (v: number, [a, b, c]: number[]): Tier => (v >= c ? 3 : v >= b ? 2 : v >= a ? 1 : 0);
/** Tier from a lower-is-better time, for a result that has already counted as a 1. */
const fast = (secs: number, [b, c]: number[]): Tier => (secs > 0 && secs < c ? 3 : secs > 0 && secs < b ? 2 : 1);
const score = (_: string, d: Detail) => (n(d, "score") > 0 ? n(d, "score") : undefined);
const none = () => false;
const only = (...ids: string[]) => (m: string) => ids.includes(m);
const byScore = (t: Record<string, number[]>): Machine["tier"] => (m, d) => (t[m] ? up(n(d, "score"), t[m]) : 0);
const level = (d: Detail) => Math.max(0, Math.min(2, Math.floor(n(d, "level"))));

export const machines: Record<string, Machine> = {
  clover: {
    plays: 1, modes: ["garden", "daily", "calm"], free: only("calm"), top: 4,
    tier: byScore({ garden: [2500, 8000, 20000], daily: [1500, 2500, 4000] }), metric: score,
    pays: "Garden pays from 2,500 points, Daily from 1,500. Calm is free play.",
  },
  coil: {
    plays: 3, modes: ["classic", "daily", "blitz", "gates", "zen"], free: only("zen"), top: 4,
    tier: byScore({ classic: [300, 1200, 3500], daily: [300, 1200, 3500], blitz: [400, 1200, 2500], gates: [400, 1500, 4000] }), metric: score,
    pays: "Pays from 300 points in Classic and Daily, 400 in Blitz and Gates. Zen is free play.",
  },
  glide: {
    plays: 1, modes: ["house", "duel", "online"], free: only("online"), top: 3,
    tier: (m, d) => (m === "house" && yes(d, "won") ? ((level(d) + 1) as Tier) : 0),
    pays: "A win against the house pays 1 at Rookie, 2 at Regular and 3 at Shark. Duels and online matches don't pay; online is free.",
  },
  lightkeeper: {
    plays: 1, modes: ["classic", "timed", "practice"], free: only("practice"), top: 4,
    tier: byScore({ classic: [150_000, 600_000, 2_000_000], timed: [200_000, 700_000, 2_000_000] }), metric: score,
    pays: "Classic pays from 150,000 points, Timed from 200,000. Practice is free play.",
  },
  minefield: {
    plays: 2, modes: ["beginner", "intermediate", "expert", "daily", "custom", "shared"], free: only("custom", "shared"), top: 4,
    tier: (m, d) => {
      if (!yes(d, "won") || yes(d, "assisted")) return 0;
      const t = ({ beginner: [30, 10], intermediate: [120, 45], expert: [300, 120], daily: [300, 120] } as Record<string, number[]>)[m];
      return t ? fast(n(d, "secs"), t) : 0;
    },
    metric: (_, d) => (yes(d, "won") && !yes(d, "assisted") && n(d, "secs") > 0 ? Math.round(1e6 / n(d, "secs")) : undefined),
    pays: "A clean win pays 1, a quick one 2, a very quick one 3. Take-backs, custom and shared boards don't pay.",
  },
  nonet: {
    plays: 1, modes: ["adaptive", "level", "daily", "custom"], free: only("custom"), top: 4,
    tier: (_, d) => {
      if (!yes(d, "won")) return 0;
      const r = n(d, "ratio"), clean = n(d, "hints") === 0;
      const t = 1 + (r > 0 && r <= 1 && clean ? 1 : 0) + (["hard", "expert", "master"].includes(String(d.level)) ? 1 : 0);
      return Math.min(3, t) as Tier;
    },
    metric: (_, d) => (yes(d, "won") && n(d, "ratio") > 0 ? Math.round(1000 / n(d, "ratio")) : undefined),
    pays: "A solve pays 1, plus 1 inside par with no hints, plus 1 on Hard and above. Pasted puzzles are free.",
  },
  noughts: {
    plays: 3, modes: ["classic.bot", "fading.bot", "ultimate.bot", "classic.local", "fading.local", "ultimate.local", "classic.online", "fading.online", "ultimate.online"],
    free: (m) => m.endsWith(".online"), top: 3,
    tier: (m, d) => {
      if (!m.endsWith(".bot")) return 0;
      const lv = ["easy", "good", "best"].indexOf(String(d.level)), won = yes(d, "won"), draw = yes(d, "draw");
      if (lv < 0) return 0;
      if (m.startsWith("classic")) return won ? (lv + 1) as Tier : draw && lv === 2 ? 3 : 0;
      if (m.startsWith("fading")) return won ? ([0, 1, 3] as Tier[])[lv] : draw && lv === 2 ? 2 : 0;
      return won ? (lv + 1) as Tier : 0;
    },
    pays: "A win against the bot pays 1 on Easy, 2 on Good and 3 on Best; holding Best to a draw pays too. Two-player games don't pay, and online is free.",
  },
  pinfall: {
    plays: 1, modes: ["game", "daily", "spares"], free: none, top: 4,
    tier: (m, d) => (n(d, "players") > 1 ? 0 : m === "spares" ? up(n(d, "spares"), [4, 7, 9]) : up(n(d, "score"), [100, 160, 220])),
    metric: (m, d) => (n(d, "players") > 1 ? undefined : m === "spares" ? (n(d, "spares") || undefined) : score(m, d)),
    pays: "A solo game pays from 100, Spares from 4 made. Games for two or more players don't pay.",
  },
  rally: {
    plays: 2, modes: ["match", "solo", "online"], free: only("online"), top: 4,
    tier: (m, d) => (m === "match" ? (yes(d, "won") ? ((level(d) + 1) as Tier) : 0) : m === "solo" ? up(n(d, "score"), [25, 150, 800]) : 0),
    metric: (m, d) => (m === "solo" ? score(m, d) : undefined),
    pays: "A match win pays 1 at Casual, 2 at Club and 3 at Pro. Solo pays from 25 points. Online is free.",
  },
  spillway: {
    plays: 2, modes: ["open", "daily", "slack", "ghost"], free: only("ghost"), top: 4,
    tier: byScore({ open: [3000, 15000, 50000], daily: [3000, 15000, 50000], slack: [2400, 12000, 40000] }), metric: score,
    pays: "Pays from 3,000 points, 2,400 in Slack Water. Ghost races are free.",
  },
  swish: {
    plays: 2, modes: ["free", "step", "clock", "daily"], free: none, top: 4,
    tier: byScore({ free: [15, 35, 60], step: [4, 10, 18], clock: [15, 45, 100], daily: [10, 25, 45] }), metric: score,
    pays: "Free Throws pays from 15, Step Back from 4 makes, the Shot Clock from 15 and the Daily from 10.",
  },
  typester: {
    plays: 2, modes: ["rush", "sprint", "daily", "drill"], free: none, top: 4,
    tier: (m, d) => {
      if (n(d, "words") <= 0) return 0;
      const t = ({ rush: [2500, 10000, 25000], daily: [2500, 10000, 25000], sprint: [2000, 6000, 16000], drill: [1200, 4000, 10000] } as Record<string, number[]>)[m];
      const v = t ? up(n(d, "score"), t) : 0;
      return m === "drill" ? (Math.min(1, v) as Tier) : v;
    },
    metric: (m, d) => (n(d, "words") > 0 ? score(m, d) : undefined),
    pays: "Rush and the Daily pay from 2,500 points, Sprint from 2,000. Drill pays at most 1.",
  },
};

const isFree = (slug: string, mode: string, d: Detail) => { const m = machines[slug]; return !m || !m.modes.includes(mode) || m.free(mode, d); };

/** A token loads a credit of plays onto the machine. */
export function insert(c: Card, slug: string, now: number): { card: Card; ok: boolean } {
  refill(c, now);
  const m = machines[slug];
  if (!m || c.tok < 1) return { card: c, ok: false };
  load(c, slug, m.plays);
  note(c, now, slug, -1, "Token in");
  return { card: c, ok: true };
}

/** A run is starting: use a play, loading a token first if the machine has none. Refused with no tokens. */
export function start(c: Card, slug: string, mode: string, d: Detail, now: number): { card: Card; ok: boolean; charged: number; free: boolean } {
  refill(c, now);
  if (!c.seen.includes(slug) && machines[slug]) c.seen.push(slug);
  if (isFree(slug, mode, d)) return { card: c, ok: true, charged: 0, free: true };
  let charged = 0;
  if (!(c.cr[slug] > 0)) {
    if (!insert(c, slug, now).ok) return { card: c, ok: false, charged: 0, free: false };
    charged = 1;
  }
  c.cr[slug] -= 1;
  if (c.cr[slug] <= 0) delete c.cr[slug];
  return { card: c, ok: true, charged, free: false };
}

const WHY = ["", "Nice run", "Good run", "Great run"];

/** A run has ended. Pays its tier, plus one for a new best, within the machine's day cap and the cup. */
export function end(c: Card, slug: string, run: { mode: string; at: number } | undefined, d: Detail, now: number): { card: Card; paid: number; best: boolean; why: string } {
  const nothing = { card: c, paid: 0, best: false, why: "" };
  const m = machines[slug];
  if (!m || !run || d.quit || now - run.at < MIN_MS || isFree(slug, run.mode, d)) return nothing;
  const mode = run.mode, tier = m.tier(mode, d), v = m.metric?.(mode, d), key = `${slug}.${mode}`;
  const best = tier > 0 && v !== undefined && v > (c.b[key] ?? 0);
  if (v !== undefined && v > (c.b[key] ?? 0)) c.b[key] = v;
  let total = tier + (best ? 1 : 0);
  const day = today(now);
  if (mode.includes("daily") && total > 0) {
    if (c.dd[slug] === day) total = 0;
    else c.dd[slug] = day;
  }
  const [pd, sum] = c.paid[slug] ?? [day, 0];
  const room = Math.max(0, DAILY_CAP - (pd === day ? sum : 0));
  total = Math.min(total, room);
  if (total <= 0) return { ...nothing, best };
  c.paid[slug] = [day, (pd === day ? sum : 0) + total];
  const paid = add(c, total);
  const why = paid < total ? "Cup's full" : best ? "New best" : WHY[tier];
  note(c, now, slug, paid, why);
  return { card: c, paid, best, why };
}
