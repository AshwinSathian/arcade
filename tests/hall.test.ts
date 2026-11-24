// The hall's lit pass: sized from the room, and inside what every WebGL 2 device can hold.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fsMain, lightsFor } from "../src/arcade/shaders.ts";

const slugs = [...readFileSync(new URL("../src/data/games.ts", import.meta.url), "utf8").matchAll(/^\s{4}slug: "([a-z]+)",$/gm)].map((m) => m[1]);
const hall = readFileSync(new URL("../src/arcade/hall.ts", import.meta.url), "utf8");

test("every light the hall packs has a slot: a screen and a downlight per machine, and the neon", () => {
  // Before, the shader held 24 and 12 machines asked for 25 at night, so the neon's light was dropped.
  assert.equal(hall.match(/\badd\(\[/g)?.length, 3, "a new kind of light: grow lightsFor() to match");
  const fs = fsMain(slugs.length);
  assert.match(fs, new RegExp(`uniform vec4 uLP\\[${lightsFor(slugs.length)}\\]`));
  assert.equal(lightsFor(slugs.length), 25);
  assert.match(fs, new RegExp(`uniform vec4 uFoot\\[${slugs.length}\\]`));
});

test("the lit pass uses fewer than the 224 fragment uniform vectors WebGL 2 guarantees", () => {
  const size: Record<string, number> = { float: 1, int: 1, vec2: 1, vec3: 1, vec4: 1, mat4: 4 };
  let vectors = 0;
  for (const [, type, names] of fsMain(slugs.length).matchAll(/uniform (\w+) ([^;]+);/g)) {
    if (type.startsWith("sampler")) continue;
    for (const n of names.split(",")) vectors += size[type] * Number(n.match(/\[(\d+)\]/)?.[1] ?? 1);
  }
  assert.ok(vectors <= 224, `${vectors} vectors`);
  console.log(`lit pass: ${vectors} of 224 uniform vectors`);
});
