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

// noTypeDeclarations must never render as "No broken samples found." — that phrase
// specifically means "checked, and clean," which is not true when nothing was typed
// enough to check in the first place. See workspace.ts's detectTypeDeclarations.
describe("renderHuman: no-type-declarations is its own status, never folded into zero findings", () => {
  test("renders distinctly from a clean pass, even though findings is also empty in both cases", () => {
    const clean = stripAnsi(renderHuman(makeResult({ findings: [], noTypeDeclarations: false })));
    const untyped = stripAnsi(
      renderHuman(makeResult({ findings: [], noTypeDeclarations: true, definitelyTypedAvailable: true })),
    );
    assert.match(clean, /No broken samples found\./);
    assert.doesNotMatch(untyped, /No broken samples found\./);
    assert.match(untyped, /ships no type declarations/);
    assert.match(untyped, /@types\/pkg exists/);
  });

  test("names the absence of a DefinitelyTyped package too, when there isn't one", () => {
    const output = stripAnsi(
      renderHuman(makeResult({ findings: [], noTypeDeclarations: true, definitelyTypedAvailable: false })),
    );
    assert.match(output, /no @types\/ package exists for it either/);
  });
});
