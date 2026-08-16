import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { runCheck } from "../src/index.js";
import type { Finding } from "../src/types.js";

// Every (fixture, packageSpec) pair that any other test actually runs through
// runCheck — kept as one explicit list here rather than importing it from each
// test file, so this suite doesn't silently start covering less as fixtures are
// added elsewhere. If you add a new fixture+package pair to another test file,
// add it here too.
const FIXTURE_RUNS: Array<{ fixture: string; packageSpec: string }> = [
  { fixture: "test/fixtures/ai-docs.md", packageSpec: "ai@5.0.237" },
  { fixture: "test/fixtures/mixed-import.md", packageSpec: "ai@5.0.237" },
  { fixture: "test/fixtures/renamed-export.md", packageSpec: "ai@7.0.66" },
  { fixture: "test/fixtures/diagnostic-codes.md", packageSpec: "ai@7.0.66" },
  { fixture: "test/fixtures/default-export-package.md", packageSpec: "zod@4.4.3" },
  { fixture: "test/fixtures/cjs-export-equals-package.md", packageSpec: "chalk@4.1.2" },
  { fixture: "test/fixtures/no-default-export-package.md", packageSpec: "date-fns@4.4.0" },
];

// A path in a rendered finding is worse than a missing one — it makes a report
// mailed to a stranger look like a script someone ran once. This closes the class
// (every code, every fixture) rather than the one instance (TS1192) that surfaced
// it. Mirrors check.ts's own containsUnsanitizedPath backstop, checked
// independently here so a regression in one doesn't hide a regression in the other.
function looksLikeAPath(text: string): boolean {
  return text.includes("node_modules") || /^\//.test(text) || /^[A-Za-z]:\\/.test(text);
}

describe("no Finding field anywhere in the fixture suite leaks a filesystem path", { timeout: 300_000 }, () => {
  let allFindings: Finding[];

  before(async () => {
    allFindings = [];
    for (const { fixture, packageSpec } of FIXTURE_RUNS) {
      const result = await runCheck([fixture], {
        packageSpec,
        maxSnippets: 500,
        includeJs: false,
        includeHistorical: false,
      });
      allFindings.push(...result.findings);
    }
  });

  test("every fixture pair produced at least one finding (the assertion below isn't vacuous)", () => {
    assert.ok(allFindings.length >= FIXTURE_RUNS.length, `expected findings from all ${FIXTURE_RUNS.length} runs, got ${allFindings.length}`);
  });

  test("message, symbol, and typescriptSuggestion never contain a path", () => {
    for (const f of allFindings) {
      assert.ok(!looksLikeAPath(f.message), `${f.source} code ${f.code}: message leaked a path: ${f.message}`);
      if (f.symbol !== null) {
        assert.ok(!looksLikeAPath(f.symbol), `${f.source} code ${f.code}: symbol leaked a path: ${f.symbol}`);
      }
      if (f.typescriptSuggestion !== null) {
        assert.ok(
          !looksLikeAPath(f.typescriptSuggestion),
          `${f.source} code ${f.code}: typescriptSuggestion leaked a path: ${f.typescriptSuggestion}`,
        );
      }
    }
  });
});
