import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { runCheck } from "../src/index.js";
import type { CheckResult } from "../src/types.js";

// Both bugs here were found by deliberately including a snippet expected to fail
// in a real `npm pack` -> fresh install -> `npx snippetcheck` smoke test, then
// asking why "No broken samples found" wasn't true. Neither is about the message
// *parsing* the way TS2724/TS2561 were (see diagnostic-codes.test.ts) — both are
// about packages whose module shape doesn't look like the plain-ESM-named-exports
// case every other fixture in this suite happens to use.
describe("module shapes beyond plain ESM named exports", { timeout: 180_000 }, () => {
  describe("a package with a default export (zod)", () => {
    let result: CheckResult;

    before(async () => {
      result = await runCheck(["test/fixtures/default-export-package.md"], {
        packageSpec: "zod@4.4.3",
        maxSnippets: 500,
        includeJs: false,
        includeHistorical: false,
      });
    });

    test("TS2614 fires as wrong-import-form, not silently dropped", () => {
      assert.equal(result.findings.length, 1);
      const [f] = result.findings;
      assert.equal(f.code, 2614);
      // Not removed-export: the export exists (as default). The snippet imported it
      // the wrong way, so this is the same category as TS1192's mirror-image case.
      assert.equal(f.kind, "wrong-import-form");
      assert.equal(f.symbol, "totallyFakeExport");
      // The "Did you mean to use ... instead?" clause names the same symbol in
      // default-import form, not an alternate name — never surface it as a suggestion.
      assert.equal(f.typescriptSuggestion, null);
    });
  });

  describe("a CJS `export =` package (chalk)", () => {
    let result: CheckResult;

    before(async () => {
      result = await runCheck(["test/fixtures/cjs-export-equals-package.md"], {
        packageSpec: "chalk@4.1.2",
        maxSnippets: 500,
        includeJs: false,
        includeHistorical: false,
      });
    });

    test("TS2339 on an intersection-typed default import still traces to the target package", () => {
      assert.equal(result.findings.length, 1);
      const [f] = result.findings;
      assert.equal(f.code, 2339);
      assert.equal(f.kind, "removed-property");
      assert.equal(f.symbol, "totallyFakeColor");
    });
  });

  describe("a package with no default export (date-fns) — TS2614's mirror image", () => {
    let result: CheckResult;

    before(async () => {
      result = await runCheck(["test/fixtures/no-default-export-package.md"], {
        packageSpec: "date-fns@4.4.0",
        maxSnippets: 500,
        includeJs: false,
        includeHistorical: false,
      });
    });

    test("TS1192 fires as wrong-import-form, with no path leaked into the finding", () => {
      assert.equal(result.findings.length, 1);
      const [f] = result.findings;
      assert.equal(f.code, 1192);
      assert.equal(f.kind, "wrong-import-form");
      assert.equal(f.symbol, null);
      assert.doesNotMatch(f.message, /node_modules|\/private|^\//);
    });
  });

  describe("a package with no bundled types at all (lodash, unscoped types)", () => {
    let result: CheckResult;

    before(async () => {
      result = await runCheck(["test/fixtures/no-bundled-types-package.md"], {
        packageSpec: "lodash",
        maxSnippets: 500,
        includeJs: false,
        includeHistorical: false,
      });
    });

    test("reports noTypeDeclarations, never as a silent zero-findings pass", () => {
      assert.equal(result.noTypeDeclarations, true);
      // @types/lodash genuinely exists on the registry — confirms the informative
      // signal isn't just always false.
      assert.equal(result.definitelyTypedAvailable, true);
      assert.equal(result.findings.length, 0);
    });
  });
});
