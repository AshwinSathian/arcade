// The arcade_best_* cookies come from other sites, so the parser must survive anything.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBests } from "../src/arcade/bests.ts";

const c = (slug, o) => `arcade_best_${slug}=${encodeURIComponent(typeof o === "string" ? o : JSON.stringify(o))}`;

test("reads each game's best and ignores the rest of the jar", () => {
  const jar = ["theme=x", c("coil", { v: "412", l: "Classic" }), c("swish", { v: "34", l: "" })].join("; ");
  assert.deepEqual(parseBests(jar, ["coil", "swish", "rally"]), [{ v: "412", l: "Classic" }, { v: "34", l: "" }, undefined]);
});
test("malformed, empty or non-string values are ignored, never thrown", () => {
  const jar = [c("a", "{not json"), c("b", { v: 12 }), c("c", { v: "" }), "arcade_best_d=%E0%A4%A"].join("; ");
  assert.deepEqual(parseBests(jar, ["a", "b", "c", "d"]), [undefined, undefined, undefined, undefined]);
});
test("strips markup and control characters and cuts to length", () => {
  const [b] = parseBests(c("x", { v: "<img src=x onerror=1>12345678901234", l: "Classic\u0000‮LabelThatIsTooLong" }), ["x"]);
  assert.ok(b.v.length <= 12 && !/[<>=]/.test(b.v), b.v);
  assert.ok(b.l.length <= 14 && !/[\u0000‮]/.test(b.l), b.l);
});
