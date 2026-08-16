import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { runCheck } from "../src/index.js";
import type { CheckResult, Finding } from "../src/types.js";

// One test per diagnostic code in check.ts's KIND_BY_CODE allowlist. Two of these
// seven were silently broken until this suite was written: TS2724's message has no
// "Module " prefix (TS2305 does), and TS2561's message reads "Did you mean to write
// 'x'?" (TS2551's reads "Did you mean 'x'?" — no "to write"). Both regexes matched
// TS2305/TS2551 and silently returned null for the other code, unconditionally, for
// every package — no exception, no failed test, just a finding that never happened.
// Every symbol/suggestion value below came from a real `--json` run against
// ai@7.0.66; see fixtures/diagnostic-codes.md for the snippets and provenance.
describe("one real, verified case per allowlisted diagnostic code", { timeout: 180_000 }, () => {
  let result: CheckResult;

  before(async () => {
    result = await runCheck(["test/fixtures/diagnostic-codes.md"], {
      packageSpec: "ai@7.0.66",
      maxSnippets: 500,
      includeJs: false,
      includeHistorical: false,
    });
  });

  function findByCode(code: number): Finding | undefined {
    return result.findings.find((f) => f.code === code);
  }

  test("all seven fire, and nothing else does", () => {
    assert.equal(result.snippetsChecked, 7);
    assert.equal(result.findings.length, 7);
  });

  test("TS2305 removed-export, no suggestion", () => {
    const f = findByCode(2305);
    assert.ok(f, "expected a TS2305 finding");
    assert.equal(f?.kind, "removed-export");
    assert.equal(f?.symbol, "AssistantResponse");
    assert.equal(f?.typescriptSuggestion, null);
  });

  test("TS2339 removed-property, no suggestion", () => {
    const f = findByCode(2339);
    assert.ok(f, "expected a TS2339 finding");
    assert.equal(f?.kind, "removed-property");
    assert.equal(f?.symbol, "reasoningDetails");
    assert.equal(f?.typescriptSuggestion, null);
  });

  test("TS2551 renamed-property, with suggestion", () => {
    const f = findByCode(2551);
    assert.ok(f, "expected a TS2551 finding");
    assert.equal(f?.kind, "renamed-property");
    assert.equal(f?.symbol, "pipeDataStreamToResponse");
    assert.equal(f?.typescriptSuggestion, "pipeTextStreamToResponse");
  });

  test("TS2353 unknown-option, no suggestion", () => {
    const f = findByCode(2353);
    assert.ok(f, "expected a TS2353 finding");
    assert.equal(f?.kind, "unknown-option");
    assert.equal(f?.symbol, "unrecognizedFlag");
    assert.equal(f?.typescriptSuggestion, null);
  });

  test("TS2561 unknown-option, with suggestion (the 'to write' phrasing bug)", () => {
    const f = findByCode(2561);
    assert.ok(f, "expected a TS2561 finding");
    assert.equal(f?.kind, "unknown-option");
    assert.equal(f?.symbol, "abortSignall");
    assert.equal(f?.typescriptSuggestion, "abortSignal");
  });

  test("TS2554 wrong-arity, no symbol or suggestion by design", () => {
    const f = findByCode(2554);
    assert.ok(f, "expected a TS2554 finding");
    assert.equal(f?.kind, "wrong-arity");
    assert.equal(f?.symbol, null);
    assert.equal(f?.typescriptSuggestion, null);
    assert.match(f!.message, /^Expected \d+ arguments, but got \d+\.$/);
  });

  test("TS2724 renamed-export, with suggestion (the missing-'Module '-prefix bug)", () => {
    const f = findByCode(2724);
    assert.ok(f, "expected a TS2724 finding");
    assert.equal(f?.kind, "renamed-export");
    assert.equal(f?.symbol, "LanguageModelV1Middleware");
    assert.equal(f?.typescriptSuggestion, "LanguageModelMiddleware");
  });
});
