import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { renderHuman } from "../src/report.js";
import type { CheckResult, Finding, SkippedSnippet, Snippet } from "../src/types.js";

// picocolors decides whether to emit ANSI escapes based on the environment it runs
// in (TTY, CI, FORCE_COLOR, etc.) — that differs between a local shell and a GitHub
// Actions runner, so tests must not assume either way. Strip codes before asserting
// on the visible text.
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[0-9;]*m/g;
function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

function makeSnippet(overrides: Partial<Snippet> = {}): Snippet {
  return {
    id: "id",
    source: "doc.md",
    line: 1,
    lang: "ts",
    code: "const a = 1;",
    imports: ["pkg"],
    sectionPath: [],
    ...overrides,
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    kind: "removed-export",
    symbol: "Foo",
    code: 2305,
    message: "Module '\"pkg\"' has no exported member 'Foo'.",
    typescriptSuggestion: null,
    source: "doc.md",
    line: 1,
    column: 1,
    excerpt: "import { Foo } from 'pkg';",
    snippetId: "id",
    section: null,
    sectionPath: [],
    ...overrides,
  };
}

function makeResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    packageName: "pkg",
    packageVersion: "1.0.0",
    documentsScanned: 1,
    snippetsFound: 1,
    snippetsTotal: 1,
    snippetsChecked: 1,
    skipped: [],
    findings: [],
    ...overrides,
  };
}

// A previous version used `.padEnd(20)` for both the line-number and skip-reason
// columns. Any value whose own length reaches that width collapses the separator
// to zero spaces, running two columns together — caught on a real run where a
// 6-digit line number and the exact 20-character reason "unsupported-language"
// both hit this. These are regression tests for that class of bug.
describe("renderHuman: column widths never collapse to zero", () => {
  test("a large line number stays separated from the finding kind", () => {
    const result = makeResult({
      findings: [makeFinding({ line: 123456 })],
    });
    const output = stripAnsi(renderHuman(result));
    assert.match(output, /L123456\s+removed-export\s+Foo/);
  });

  test("the exact 20-character skip reason stays separated from the source", () => {
    const skipped: SkippedSnippet[] = [
      { snippet: makeSnippet({ line: 1 }), reason: "unsupported-language" },
    ];
    const result = makeResult({ skipped, snippetsFound: 1, snippetsChecked: 0 });
    const output = stripAnsi(renderHuman(result, { verbose: true }));
    // "unsupported-language" is exactly 20 characters — this is the exact bug that
    // shipped: padEnd(20) on a 20-char string adds zero separating space.
    assert.equal("unsupported-language".length, 20);
    assert.doesNotMatch(output, /unsupported-language\S/);
  });
});
