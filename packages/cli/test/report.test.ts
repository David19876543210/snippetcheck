import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { renderHuman } from "../src/report.js";
import { stripAnsi, makeFinding, makeResult } from "./helpers.js";

// A previous version used a fixed `.padEnd(20)` for the line-number column. Any
// line number whose own width reaches that collapses the separator before the
// finding kind to zero spaces. This is a distinct axis from column-widths.test.ts
// (which covers the FindingKind/SkipReason enum columns) — line numbers are
// unbounded, not drawn from a fixed set, so there's no "enum" to derive a width
// from; the fix is dynamic padding based on the actual rendered length instead.
describe("renderHuman: the line-number column never collapses to zero", () => {
  test("a large line number stays separated from the finding kind", () => {
    const result = makeResult({
      findings: [makeFinding({ line: 123456 })],
    });
    const output = stripAnsi(renderHuman(result));
    assert.match(output, /L123456\s+removed-export\s+Foo/);
  });
});
