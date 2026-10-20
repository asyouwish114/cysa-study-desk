// Unit tests for js/cvss.js. Run: npm test (node --test finds every *.test.mjs file).
// Expected scores are the published CVSS v3.1 base scores for each vector.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

createRequire(import.meta.url)("../js/cvss.js");
const cvss = globalThis.CYSA.cvss;

const KNOWN = [
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", 9.8, "Critical"],
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H", 10.0, "Critical"],
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N", 6.1, "Medium"],
  ["CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", 7.8, "High"],
  ["CVSS:3.1/AV:L/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H", 8.2, "High"],
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H", 7.5, "High"],
  ["CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N", 5.9, "Medium"],
  ["CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N", 6.5, "Medium"],
  ["CVSS:3.1/AV:P/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", 4.6, "Medium"],
  ["CVSS:3.1/AV:L/AC:H/PR:L/UI:N/S:U/C:L/I:N/A:N", 2.5, "Low"],
  ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N", 0.0, "None"]
];

for (const [vector, expected, sev] of KNOWN) {
  test(`${vector} scores ${expected} (${sev})`, () => {
    const r = cvss.score(cvss.parse(vector));
    assert.equal(r.score, expected);
    assert.equal(r.severity, sev);
  });
}

test("scope changed raises the weight of Low and High privileges", () => {
  const u = cvss.score(cvss.parse("AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N")).exploitability;
  const c = cvss.score(cvss.parse("AV:N/AC:L/PR:L/UI:N/S:C/C:L/I:N/A:N")).exploitability;
  assert.ok(c > u);
});

test("roundup follows the spec, including float edge cases", () => {
  assert.equal(cvss.roundup(4.0), 4.0);
  assert.equal(cvss.roundup(4.02), 4.1);
  assert.equal(cvss.roundup(4.000000001), 4.0);
});

test("parse accepts any metric order and an optional prefix", () => {
  const a = cvss.parse("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H");
  const b = cvss.parse("a:h/i:h/c:h/s:u/ui:n/pr:n/ac:l/av:n");
  assert.deepEqual(a, b);
  assert.equal(cvss.toVector(b), "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H");
});

test("parse rejects incomplete, duplicate or invalid vectors", () => {
  assert.equal(cvss.parse("AV:N/AC:L"), null);
  assert.equal(cvss.parse("AV:N/AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"), null);
  assert.equal(cvss.parse("AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"), null);
  assert.equal(cvss.parse("not a vector"), null);
});
