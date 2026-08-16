import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parsePackageSpec } from "../src/workspace.js";
import { runCheck, sampleEvenly } from "../src/index.js";

describe("sampleEvenly", () => {
  test("returns exactly max items when the pool is larger", () => {
    const items = Array.from({ length: 4599 }, (_, i) => i);
    assert.equal(sampleEvenly(items, 500).length, 500);
  });

  test("matches the exact index formula from the fix spec", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    assert.deepEqual(sampleEvenly(items, 5), [0, 2, 4, 6, 8]);
  });

  test("spans the whole document rather than clustering at the start", () => {
    const items = Array.from({ length: 1000 }, (_, i) => i);
    const sampled = sampleEvenly(items, 10);
    // A prefix-take would produce [0..9]. An even sample must reach the far end.
    assert.deepEqual(sampled, [0, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
  });

  test("never indexes past the end of the pool", () => {
    const items = Array.from({ length: 11 }, (_, i) => i);
    const sampled = sampleEvenly(items, 10);
    assert.ok(sampled.every((v) => v < 11));
  });
});

describe("parsePackageSpec", () => {
  test("unscoped package with no version defaults to latest", () => {
    assert.deepEqual(parsePackageSpec("zod"), { name: "zod", range: "latest" });
  });

  test("unscoped package with a version", () => {
    assert.deepEqual(parsePackageSpec("zod@3.22.4"), { name: "zod", range: "3.22.4" });
  });

  test("scoped package with no version defaults to latest", () => {
    assert.deepEqual(parsePackageSpec("@scope/pkg"), { name: "@scope/pkg", range: "latest" });
  });

  test("scoped package with a version splits on the LAST @, not the first", () => {
    assert.deepEqual(parsePackageSpec("@scope/pkg@1.0.0"), { name: "@scope/pkg", range: "1.0.0" });
  });

  test("scoped package with a dist-tag version", () => {
    assert.deepEqual(parsePackageSpec("@scope/pkg@next"), { name: "@scope/pkg", range: "next" });
  });
});

// This suite performs a real `npm install` of the `ai` package and type-checks
// fixtures/ai-docs.md against it. It requires network access. The fixture snippets
// are pinned against ai@4.x and checked against ai@5.0.237, which contains two real,
// independently-verified breaking changes: `LangChainAdapter` was removed from the
// package's exports, and `GenerateTextResult.reasoningDetails` was removed from the
// result type. Everything else in the fixture is a deliberate near-miss that must
// produce zero findings — that half of the assertion matters more than the first.
describe("checkSnippets end-to-end (real package, network required)", () => {
  test(
    "finds only the two provable breaks in the ai v4 -> v5 fixture, and stays silent on everything else",
    { timeout: 180_000 },
    async () => {
      const result = await runCheck(["test/fixtures/ai-docs.md"], {
        packageSpec: "ai@5.0.237",
        maxSnippets: 500,
        includeJs: false,
        includeHistorical: false,
      });

      assert.equal(result.packageName, "ai");
      assert.equal(result.packageVersion, "5.0.237");
      assert.equal(result.documentsScanned, 1);

      // 6 fenced ts blocks in the fixture; 3 make it all the way through to a
      // type-check (2 findings + 1 clean-but-checked); 3 are skipped for
      // different, specific reasons.
      assert.equal(result.snippetsFound, 6);
      assert.equal(result.snippetsChecked, 3);
      assert.equal(result.skipped.length, 3);

      assert.equal(result.findings.length, 2);

      const removedExport = result.findings.find((f) => f.kind === "removed-export");
      assert.ok(removedExport, "expected a removed-export finding for LangChainAdapter");
      assert.equal(removedExport?.symbol, "LangChainAdapter");
      assert.equal(removedExport?.code, 2305);
      assert.equal(removedExport?.line, 9);
      assert.equal(removedExport?.source, "test/fixtures/ai-docs.md");

      const removedProperty = result.findings.find((f) => f.kind === "removed-property");
      assert.ok(removedProperty, "expected a removed-property finding for reasoningDetails");
      assert.equal(removedProperty?.symbol, "reasoningDetails");
      assert.equal(removedProperty?.code, 2339);
      assert.equal(removedProperty?.line, 16);

      const reasonCounts = new Map<string, number>();
      for (const s of result.skipped) {
        reasonCounts.set(s.reason, (reasonCounts.get(s.reason) ?? 0) + 1);
      }
      assert.equal(reasonCounts.get("no-target-import"), 1, "the ai-sdk-utils lookalike import");
      assert.equal(reasonCounts.get("unparseable"), 1, "the <YOUR_MODEL> placeholder");
      assert.equal(reasonCounts.get("explicitly-skipped"), 1, "the snippetcheck-skip block");

      // The maxSteps break is real (it was removed from generateText's options in v5
      // too) but its options type is an anonymous intersection with no declaration
      // symbol snippetcheck can resolve — so it is checked, and correctly silent,
      // rather than reported as a fourth finding.
      assert.equal(
        result.findings.some((f) => f.symbol === "maxSteps"),
        false,
      );
    },
  );

  // Fix 2: a snippet importing both the target package and an uninstalled third-party
  // package used to get dropped entirely (skip reason "unresolved-import" fired on ANY
  // TS2307, not just the target package's own). That silently threw away every real
  // finding in snippets like this one. It must now still be checked, and the real
  // break in the target-package import must still be found.
  test(
    "an unresolved third-party import does not suppress a real target-package break",
    { timeout: 180_000 },
    async () => {
      const result = await runCheck(["test/fixtures/mixed-import.md"], {
        packageSpec: "ai@5.0.237",
        maxSnippets: 500,
        includeJs: false,
        includeHistorical: false,
      });

      assert.equal(result.snippetsChecked, 1);
      assert.equal(
        result.skipped.some((s) => s.reason === "unresolved-import"),
        false,
        "the snippet must not be skipped just because a third-party import is unresolved",
      );

      const removedExport = result.findings.find((f) => f.kind === "removed-export");
      assert.ok(removedExport, "expected the LangChainAdapter break to still be found");
      assert.equal(removedExport?.symbol, "LangChainAdapter");
      assert.equal(removedExport?.code, 2305);
    },
  );

  // TS2305's message is prefixed with "Module "; TS2724's is not. A regex written
  // only against the TS2305 shape matches nothing for TS2724 and silently drops
  // every renamed-export finding, for every package, unconditionally. Caught while
  // hand-verifying real examples for Fix 6 — this was broken from day one.
  test(
    "a renamed export (TS2724, no 'Module ' prefix in the message) is still found",
    { timeout: 180_000 },
    async () => {
      // ToolExecutionOptions doesn't exist in ai@5.0.237 (the version pinned
      // elsewhere in this file) — it was introduced later. Pinned to an exact
      // version (rather than @latest) so this test doesn't drift over time.
      const result = await runCheck(["test/fixtures/renamed-export.md"], {
        packageSpec: "ai@7.0.66",
        maxSnippets: 500,
        includeJs: false,
        includeHistorical: false,
      });

      const renamedExport = result.findings.find((f) => f.kind === "renamed-export");
      assert.ok(renamedExport, "expected a renamed-export finding for ToolExecutionOption");
      assert.equal(renamedExport?.symbol, "ToolExecutionOption");
      assert.equal(renamedExport?.code, 2724);
      assert.equal(renamedExport?.typescriptSuggestion, "ToolExecutionOptions");
    },
  );
});
