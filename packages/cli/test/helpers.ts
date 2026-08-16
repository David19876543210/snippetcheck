import type { CheckResult, Finding, Snippet } from "../src/types.js";

// picocolors decides whether to emit ANSI escapes based on the environment it runs
// in (TTY, CI, FORCE_COLOR, etc.) — that differs between a local shell and a GitHub
// Actions runner, so tests must not assume either way. Strip codes before asserting
// on visible text.
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[0-9;]*m/g;
export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

export function makeSnippet(overrides: Partial<Snippet> = {}): Snippet {
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

export function makeFinding(overrides: Partial<Finding> = {}): Finding {
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

export function makeResult(overrides: Partial<CheckResult> = {}): CheckResult {
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
