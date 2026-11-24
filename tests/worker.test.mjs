// The /media range Worker, against a fake asset binding.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";

const bytes = new Uint8Array(1000).map((_, i) => i % 256);
const env = { ASSETS: { fetch: async () => new Response(bytes, { headers: { "Content-Type": "video/mp4" } }) } };
const get = (range) => worker.fetch(new Request("https://x/media/a.mp4", range ? { headers: { Range: range } } : {}), env);

test("no Range: the whole file, advertising ranges", async () => {
  const r = await get();
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Accept-Ranges"), "bytes");
  assert.equal((await r.arrayBuffer()).byteLength, 1000);
});
test("bytes=0-1: Safari's first probe", async () => {
  const r = await get("bytes=0-1");
  assert.equal(r.status, 206);
  assert.equal(r.headers.get("Content-Range"), "bytes 0-1/1000");
  assert.deepEqual([...new Uint8Array(await r.arrayBuffer())], [0, 1]);
});
test("open and suffix ranges", async () => {
  assert.equal((await get("bytes=990-")).headers.get("Content-Range"), "bytes 990-999/1000");
  assert.equal((await get("bytes=-10")).headers.get("Content-Range"), "bytes 990-999/1000");
  assert.equal((await get("bytes=500-5000")).headers.get("Content-Range"), "bytes 500-999/1000");
});
test("unsatisfiable range: 416", async () => {
  assert.equal((await get("bytes=1000-")).status, 416);
});

import redirect from "../worker/redirect.js";
test("the old address: any path and query move permanently to the same place on the arcade", async () => {
  const r = await redirect.fetch(new Request("https://games.ashwinsathian.com/coil?x=1"));
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("Location"), "https://arcade.ashwinsathian.com/coil?x=1");
});
