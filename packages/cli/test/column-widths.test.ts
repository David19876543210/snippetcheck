import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { renderHuman } from "../src/report.js";
import { FINDING_KINDS, SKIP_REASONS } from "../src/types.js";
import type { SkippedSnippet } from "../src/types.js";
import { stripAnsi, makeSnippet, makeFinding, makeResult } from "./helpers.js";

function longestOf<T extends string>(values: readonly T[]): T {
  return [...values].sort((a, b) => b.length - a.length)[0];
}

// This test doesn't hardcode which FindingKind/SkipReason is longest — it asks the
// real enums at test time. If a future member becomes the new longest, this test
// starts exercising *that* one automatically, with no hand-editing required. That's
// the whole point: a test that names "unsupported-language" directly would keep
// passing even if a *new*, longer member shipped alongside a report.ts that never
// got its padding updated for it.
describe("report column widths, derived from the FindingKind/SkipReason enums", () => {
  test("the longest FindingKind is always followed by whitespace, not the next column running on", () => {
    const longestKind = longestOf(FINDING_KINDS);
    const result = makeResult({
      findings: [makeFinding({ kind: longestKind, symbol: "Marker" })],
    });
    const output = stripAnsi(renderHuman(result));
    // formatSymbolLike prefixes some kinds' symbols (e.g. ".Marker" for property
    // kinds), so this only asserts the separator, not the exact symbol rendering.
    assert.match(output, new RegExp(`${longestKind}\\s`), `"${longestKind}" produced no trailing separator in:\n${output}`);
  });

  test("the longest SkipReason is always followed by whitespace on its own verbose line", () => {
    const longestReason = longestOf(SKIP_REASONS);
    const skipped: SkippedSnippet[] = [{ snippet: makeSnippet({ source: "marker.md" }), reason: longestReason }];
    const result = makeResult({ skipped, snippetsChecked: 0 });
    const output = stripAnsi(renderHuman(result, { verbose: true }));
    // Anchored to the verbose per-line format ("L<n>  <reason>...") specifically —
    // the reason name can otherwise legitimately be followed by punctuation in the
    // prose summary line ("...(1 unparseable)."), which isn't the column being tested.
    assert.doesNotMatch(
      output,
      new RegExp(`L\\d+\\s+${longestReason}\\S`),
      `expected "${longestReason}" to be followed by whitespace on its verbose line, in:\n${output}`,
    );
  });

  test("every FindingKind and every SkipReason individually stay separated (not just the longest)", () => {
    for (const kind of FINDING_KINDS) {
      const output = stripAnsi(renderHuman(makeResult({ findings: [makeFinding({ kind, symbol: "X" })] })));
      assert.match(output, new RegExp(`${kind}\\s`), `"${kind}" produced no trailing separator`);
    }
    for (const reason of SKIP_REASONS) {
      const skipped: SkippedSnippet[] = [{ snippet: makeSnippet({ source: "x.md" }), reason }];
      const output = stripAnsi(renderHuman(makeResult({ skipped, snippetsChecked: 0 }), { verbose: true }));
      assert.doesNotMatch(
        output,
        new RegExp(`L\\d+\\s+${reason}\\S`),
        `"${reason}" ran directly into the next field on its verbose line`,
      );
    }
  });
});
